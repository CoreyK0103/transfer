import type {
	CopyObjectCommandInput,
	DeleteObjectCommandInput,
	S3Client,
} from "@aws-sdk/client-s3";
import type { SQSEvent } from "aws-lambda";
import { mock } from "jest-mock-extended";
import { getLambda } from "./index";

const getMockEvent = (
	bucketName: string,
	key: string,
	scanResultStatus: string,
) => {
	return {
		version: "0",
		id: "72c7d362-737a-6dce-fc78-9e27a0171419",
		"detail-type": "GuardDuty Malware Protection Object Scan Result",
		source: "aws.guardduty",
		account: "111122223333",
		time: "2024-02-28T01:01:01Z",
		region: "us-east-1",
		resources: [
			"arn:aws:guardduty:us-east-1:111122223333:malware-protection-plan/b4c7f464ab3a4EXAMPLE",
		],
		detail: {
			schemaVersion: "1.0",
			scanStatus: "COMPLETED",
			resourceType: "S3_OBJECT",
			s3ObjectDetails: {
				bucketName: bucketName,
				objectKey: key,
				eTag: "ASIAI44QH8DHBEXAMPLE",
				versionId: "d41d8cd98f00b204e9800998eEXAMPLE",
				s3Throttled: false,
			},
			scanResultDetails: {
				scanResultStatus: scanResultStatus,
				threats: null,
			},
		},
	};
};

const getSqsEvent = (
	bucketName: string = "test-bucket",
	key: string = "uuid/test.txt",
	scanResultStatus: string = "NO_THREATS_FOUND",
): SQSEvent => {
	return {
		Records: [
			{
				messageId: "059f36b4-87a3-44ab-83d2-661975830a7d",
				receiptHandle: "AQEBwJnKyrHigUMZj6rYigCgxlaS3SLy0a...",
				body: JSON.stringify(getMockEvent(bucketName, key, scanResultStatus)),
				attributes: {
					ApproximateReceiveCount: "1",
					SentTimestamp: "1545082649183",
					SenderId: "AIDAIENQZJOLO23YVJ4VO",
					ApproximateFirstReceiveTimestamp: "1545082649185",
				},
				messageAttributes: {
					myAttribute: {
						stringValue: "myValue",
						stringListValues: [],
						binaryListValues: [],
						dataType: "String",
					},
				},
				md5OfBody: "e4e68fb7bd0e697a0ae8f1bb342846b3",
				eventSource: "aws:sqs",
				eventSourceARN: "arn:aws:sqs:us-east-2:123456789012:my-queue",
				awsRegion: "us-east-2",
			},
		],
	};
};

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
					itemIdentifier: "059f36b4-87a3-44ab-83d2-661975830a7d",
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
					itemIdentifier: "059f36b4-87a3-44ab-83d2-661975830a7d",
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
