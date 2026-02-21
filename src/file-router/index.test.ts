import type {
	CopyObjectCommandInput,
	DeleteObjectCommandInput,
	S3Client,
} from "@aws-sdk/client-s3";
import type { SQSEvent, SQSRecord } from "aws-lambda";
import { mock } from "jest-mock-extended";
import type { GuardDutyMalwareProtectionObjectScanResult } from "../schema/aws/guardduty/guarddutymalwareprotectionobjectscanresult/GuardDutyMalwareProtectionObjectScanResult";
import { getLambda } from "./index";

const getMockEvent = (
	bucketName: string,
	key: string,
	scanResultStatus: string,
) => ({
	detail: {
		schemaVersion: "1.0",
		scanStatus: "COMPLETED",
		resourceType: "S3_OBJECT",
		s3ObjectDetails: {
			bucketName: bucketName,
			objectKey: key,
			eTag: "eTag",
			versionId: "version-id",
			s3Throttled: false,
		},
		scanResultDetails: {
			scanResultStatus: scanResultStatus,
			threats: [],
		},
	} as GuardDutyMalwareProtectionObjectScanResult,
});

const getSqsRecord = (
	bucketName: string = "test-bucket",
	key: string = "uuid/test.txt",
	scanResultStatus: string = "NO_THREATS_FOUND",
): SQSRecord =>
	({
		messageId: "mock-message-id",
		body: JSON.stringify(getMockEvent(bucketName, key, scanResultStatus)),
	}) as SQSRecord;

const getSqsEvent = (
	bucketName: string = "test-bucket",
	key: string = "uuid/test.txt",
	scanResultStatus: string = "NO_THREATS_FOUND",
): SQSEvent => ({
	Records: [getSqsRecord(bucketName, key, scanResultStatus)],
});

describe("file-router handler", () => {
	it("should process the event and return an empty batchItemFailures array", async () => {
		const s3Client = mock<S3Client>();
		s3Client.send.mockImplementation(() => Promise.resolve({}));

		const uut = getLambda(s3Client);

		const response = await uut(getSqsEvent());

		expect(response).toEqual({ batchItemFailures: [] });
	});

	it("should return batchItemFailures for failed records", async () => {
		const s3Client = mock<S3Client>();
		s3Client.send.mockImplementation(() =>
			Promise.reject(new Error("Failed to process record")),
		);

		const uut = getLambda(s3Client);

		const response = await uut(getSqsEvent());

		expect(response).toEqual({
			batchItemFailures: [
				{
					itemIdentifier: "mock-message-id",
				},
			],
		});
	});

	it("should move clean files to the clean bucket", async () => {
		const s3Client = mock<S3Client>();
		s3Client.send.mockImplementation(() => Promise.resolve({}));

		const uut = getLambda(s3Client);

		process.env.CLEAN_BUCKET_NAME = "clean-bucket";
		await uut(getSqsEvent());

		expect(s3Client.send).toHaveBeenCalledWith<CopyObjectCommandInput[]>(
			expect.objectContaining({
				input: {
					Bucket: "clean-bucket",
					CopySource: "/test-bucket/uuid/test.txt",
					Key: "uuid/test.txt",
				},
			}),
		);
	});

	it("should move malicious files to the quarantine bucket", async () => {
		const s3Client = mock<S3Client>();
		s3Client.send.mockImplementation(() => Promise.resolve({}));

		const uut = getLambda(s3Client);

		process.env.QUARANTINE_BUCKET_NAME = "quarantine-bucket";
		const maliciousEvent = getSqsEvent(
			"test-bucket",
			"uuid/malicious-file.txt",
			"THREATS_FOUND",
		);

		await uut(maliciousEvent);

		expect(s3Client.send).toHaveBeenCalledWith<CopyObjectCommandInput[]>(
			expect.objectContaining({
				input: {
					Bucket: "quarantine-bucket",
					CopySource: "/test-bucket/uuid/malicious-file.txt",
					Key: "uuid/malicious-file.txt",
				},
			}),
		);
	});

	it("should throw an error for unexpected scan results", async () => {
		const s3Client = mock<S3Client>();
		s3Client.send.mockImplementation(() => Promise.resolve({}));

		const uut = getLambda(s3Client);

		const unexpectedScanResultEvent = getSqsEvent(
			"test-bucket",
			"uuid/test.txt",
			"UNKNOWN_STATUS",
		);

		const response = await uut(unexpectedScanResultEvent);

		expect(response).toEqual({
			batchItemFailures: [
				{
					itemIdentifier: "mock-message-id",
				},
			],
		});
	});

	it("should delete the original file after processing", async () => {
		const s3Client = mock<S3Client>();
		s3Client.send.mockImplementation(() => Promise.resolve({}));

		const uut = getLambda(s3Client);

		await uut(getSqsEvent());

		expect(s3Client.send).toHaveBeenCalledWith<DeleteObjectCommandInput[]>(
			expect.objectContaining({
				input: {
					Bucket: "test-bucket",
					Key: "uuid/test.txt",
				},
			}),
		);
	});
});
