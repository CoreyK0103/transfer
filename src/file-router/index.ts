import { Logger } from "@aws-lambda-powertools/logger";
import {
	CopyObjectCommand,
	DeleteObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import type {
	SQSBatchItemFailure,
	SQSBatchResponse,
	SQSEvent,
} from "aws-lambda";
import type { AWSEvent } from "../schema/aws/guardduty/guarddutymalwareprotectionobjectscanresult/AWSEvent";
import type { GuardDutyMalwareProtectionObjectScanResult } from "../schema/aws/guardduty/guarddutymalwareprotectionobjectscanresult/GuardDutyMalwareProtectionObjectScanResult";

const logger = new Logger({
	serviceName: "file-router",
});

export const getLambda = (s3Client: S3Client) => {
	return async (event: SQSEvent): Promise<SQSBatchResponse> => {
		logger.info("Received event", { event });

		const batchItemFailures: SQSBatchItemFailure[] = [];

		const promises = event.Records.map(async (record) => {
			const body = JSON.parse(
				record.body,
			) as AWSEvent<GuardDutyMalwareProtectionObjectScanResult>;

			const scanResult = body.detail.scanResultDetails.scanResultStatus;

			if (scanResult === "NO_THREATS_FOUND") {
				await s3Client.send(
					new CopyObjectCommand({
						Bucket: process.env.CLEAN_BUCKET_NAME,
						CopySource: `/${body.detail.s3ObjectDetails.bucketName}/${body.detail.s3ObjectDetails.objectKey}`,
						Key: body.detail.s3ObjectDetails.objectKey,
					}),
				);
				logger.info("File copied to clean bucket", {
					key: body.detail.s3ObjectDetails.objectKey,
				});
			} else if (scanResult === "THREATS_FOUND") {
				await s3Client.send(
					new CopyObjectCommand({
						Bucket: process.env.QUARANTINE_BUCKET_NAME,
						CopySource: `/${body.detail.s3ObjectDetails.bucketName}/${body.detail.s3ObjectDetails.objectKey}`,
						Key: body.detail.s3ObjectDetails.objectKey,
					}),
				);
				logger.info("Malicious file moved to quarantine bucket", {
					key: body.detail.s3ObjectDetails.objectKey,
					threats: body.detail.scanResultDetails.threats,
				});
			} else {
				logger.error("Unexpected scan result", { scanResult });
				throw new Error(`Unexpected scan result: ${scanResult}`);
			}

			// TODO:
			// 1. Add logic for failed scans
			// 2. Alerting/notification for malicious files

			await s3Client.send(
				new DeleteObjectCommand({
					Bucket: body.detail.s3ObjectDetails.bucketName,
					Key: body.detail.s3ObjectDetails.objectKey,
				}),
			);

			return record.messageId;
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

export const handler = getLambda(new S3Client({ region: "eu-west-2" }));
