import { GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import type {
	SESClient,
	SendEmailCommandInput,
	SendEmailCommandOutput,
} from "@aws-sdk/client-ses";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { S3Event, S3EventRecord, SQSEvent, SQSRecord } from "aws-lambda";
import { mock } from "jest-mock-extended";
import { getLambda } from "./index";

jest.mock("@aws-sdk/s3-request-presigner");

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const getS3Event = (bucket: string, key: string): S3Event => ({
	Records: [
		{
			s3: {
				bucket: {
					name: bucket,
				},
				object: {
					key: key,
				},
			},
		} as S3EventRecord,
	],
});

const getSqsEvent = (bucket: string, key: string): SQSEvent => ({
	Records: [
		{
			messageId: "mock-message-id",
			body: JSON.stringify(getS3Event(bucket, key)),
		} as SQSRecord,
	],
});

describe("Notifier lambda", () => {
	it("should process an S3 event and send an email", async () => {
		process.env.FILE_INFO_TABLE_NAME = "mock-table-name";
		process.env.SENDER = "mock-email@example.com";

		const getSignedUrlMock = jest.mocked(getSignedUrl);
		getSignedUrlMock.mockImplementation(() =>
			Promise.resolve("mock-signed-url"),
		);

		const s3Client = mock<S3Client>();

		const sesClient = mock<SESClient>();
		sesClient.send.mockImplementation(() =>
			Promise.resolve({
				$metadata: {
					httpStatusCode: 200,
				},
			} as SendEmailCommandOutput),
		);

		const dynamodbClient = mock<DynamoDBDocumentClient>();
		dynamodbClient.send.mockImplementation(() =>
			Promise.resolve({
				Item: {
					filename: "mock-file.txt",
					recipientEmail: "test@example.com",
					contentType: "text/plain",
				},
			}),
		);

		const uut = getLambda(s3Client, sesClient, dynamodbClient);

		const event = getSqsEvent("mock-bucket", "uploads/mock-uuid/mock-file.txt");
		const result = await uut(event);

		expect(result).toStrictEqual({ batchItemFailures: [] });
		expect(getSignedUrlMock).toHaveBeenCalledWith(
			s3Client,
			expect.any(GetObjectCommand),
			{ expiresIn: 60 * 24 },
		);
		expect(dynamodbClient.send).toHaveBeenCalledWith(
			expect.objectContaining({
				input: {
					TableName: "mock-table-name",
					Key: {
						fileId: "mock-uuid",
					},
				},
			}),
		);
		expect(sesClient.send).toHaveBeenCalledWith<SendEmailCommandInput[]>(
			expect.objectContaining({
				input: {
					Source: "mock-email@example.com",
					Destination: {
						ToAddresses: ["test@example.com"],
					},
					Message: {
						Subject: {
							Data: "File available to download",
						},
						Body: {
							Text: {
								Data: "Download file here: mock-signed-url",
							},
						},
					},
				},
			}),
		);
	});

	it("should handle batch errors", async () => {
		const getSignedUrlMock = jest.mocked(getSignedUrl);
		getSignedUrlMock.mockImplementation(() =>
			Promise.reject(new Error("Failed to get signed URL")),
		);

		const uut = getLambda(
			mock<S3Client>(),
			mock<SESClient>(),
			mock<DynamoDBDocumentClient>(),
		);

		const event = getSqsEvent("mock-bucket", "uploads/mock-uuid/mock-file.txt");
		const result = await uut(event);

		expect(result).toStrictEqual({
			batchItemFailures: [
				{
					itemIdentifier: "mock-message-id",
				},
			],
		});
	});

	it("should handle non-existent file in DynamoDB", async () => {
		const getSignedUrlMock = jest.mocked(getSignedUrl);
		getSignedUrlMock.mockImplementation(() =>
			Promise.resolve("mock-signed-url"),
		);

		const dynamodbClient = mock<DynamoDBDocumentClient>();
		dynamodbClient.send.mockImplementation(() =>
			Promise.resolve({
				Item: null,
			}),
		);

		const uut = getLambda(mock<S3Client>(), mock<SESClient>(), dynamodbClient);

		const event = getSqsEvent("mock-bucket", "uploads/mock-uuid/mock-file.txt");
		const result = await uut(event);

		expect(result).toStrictEqual({
			batchItemFailures: [
				{
					itemIdentifier: "mock-message-id",
				},
			],
		});
	});

	it("should handle failed email sending", async () => {
		const getSignedUrlMock = jest.mocked(getSignedUrl);
		getSignedUrlMock.mockImplementation(() =>
			Promise.resolve("mock-signed-url"),
		);

		const dynamodbClient = mock<DynamoDBDocumentClient>();
		dynamodbClient.send.mockImplementation(() =>
			Promise.resolve({
				Item: {
					filename: "mock-file.txt",
				},
			}),
		);

		const sesClient = mock<SESClient>();
		sesClient.send.mockImplementation(() =>
			Promise.resolve({
				$metadata: {
					httpStatusCode: 400,
				},
			} as SendEmailCommandOutput),
		);

		const uut = getLambda(mock<S3Client>(), sesClient, dynamodbClient);

		const event = getSqsEvent("mock-bucket", "uploads/mock-uuid/mock-file.txt");
		const result = await uut(event);

		expect(result).toStrictEqual({
			batchItemFailures: [
				{
					itemIdentifier: "mock-message-id",
				},
			],
		});
	});
});
