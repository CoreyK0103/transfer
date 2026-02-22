import { Logger } from "@aws-lambda-powertools/logger";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
	SESClient,
	SendEmailCommand,
	type SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
	S3Event,
	SQSBatchItemFailure,
	SQSBatchResponse,
	SQSEvent,
} from "aws-lambda";

const logger = new Logger({
	serviceName: "upload-url",
});

export const getLambda = (
	s3Client: S3Client,
	sesClient: SESClient,
	dynamoDBClient: DynamoDBDocumentClient,
) => {
	return async (event: SQSEvent): Promise<SQSBatchResponse> => {
		logger.info("Received event", { event });

		const batchItemFailures: SQSBatchItemFailure[] = [];

		const promises = event.Records.map(async (record) => {
			const s3Event = JSON.parse(record.body) as S3Event;

			await Promise.all(
				s3Event.Records.map(async (s3Record) => {
					const bucket = s3Record.s3.bucket.name;
					const key = s3Record.s3.object.key;

					const uuid = key.split("/")[1];

					const getUrl = await getSignedUrl(
						s3Client,
						new GetObjectCommand({
							Bucket: bucket,
							Key: key,
						}),
						{ expiresIn: 60 * 24 },
					);

					const res = await dynamoDBClient.send(
						new GetCommand({
							TableName: process.env.FILE_INFO_TABLE_NAME,
							Key: {
								fileId: uuid,
							},
						}),
					);

					if (!res.Item) {
						logger.error("File ID not found in dynamoDB table", { uuid });
						throw new Error(`File ID not found in dynamoDB table: ${uuid}`);
					}

					const recipientEmail = res.Item.recipientEmail;

					const input: SendEmailCommandInput = {
						Source: process.env.SENDER,
						Destination: {
							ToAddresses: [recipientEmail],
						},
						Message: {
							Subject: {
								Data: `File available to download`,
							},
							Body: {
								Text: {
									Data: `Download file here: ${getUrl}`,
								},
							},
						},
					};

					const response = await sesClient.send(new SendEmailCommand(input));
					if (response.$metadata.httpStatusCode !== 200) {
						logger.error("Failed to send email", {
							response,
							key,
							recipientEmail,
						});
						throw new Error(`Failed to send email: ${response}`);
					}
				}),
			);
		});

		const results = await Promise.allSettled(promises);

		results.forEach((result, index) => {
			if (result.status === "rejected") {
				logger.error("Failed to process event", {
					event: event.Records[index],
					error: result.reason,
				});
				batchItemFailures.push({
					itemIdentifier: event.Records[index].messageId,
				});
			}
		});

		return { batchItemFailures };
	};
};

export const handler = getLambda(
	new S3Client({ region: "eu-west-2" }),
	new SESClient({ region: "eu-west-2" }),
	DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-2" })),
);
