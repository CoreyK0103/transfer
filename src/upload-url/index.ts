import { randomUUID } from "node:crypto";
import { Logger } from "@aws-lambda-powertools/logger";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from "aws-lambda";

const logger = new Logger({
	serviceName: "upload-url",
});

type RequestURL = {
	filename: string;
	contentType: string;
	recipientEmail: string;
};

export const getHandler = (
	s3Client: S3Client,
	dynamoDBClient: DynamoDBDocumentClient,
) => {
	return async (
		event: APIGatewayProxyEventV2,
	): Promise<APIGatewayProxyResultV2> => {
		logger.info("Received event", { event });

		const body = event.body ? (JSON.parse(event.body) as RequestURL) : null;

		if (body === null) throw new Error("No body provided");

		const { filename, contentType, recipientEmail } = body;
		const uuid = randomUUID();

		await dynamoDBClient.send(
			new PutCommand({
				TableName: process.env.FILE_INFO_TABLE_NAME,
				Item: {
					fileId: uuid,
					filename,
					recipientEmail,
					contentType,
				},
			}),
		);

		const putUrl = await getSignedUrl(
			s3Client,
			new PutObjectCommand({
				Bucket: process.env.LANDING_BUCKET_NAME,
				Key: `uploads/${uuid}/${filename}`,
				ContentType: contentType,
				Metadata: {
					recipientEmail,
				},
			}),
			{ expiresIn: 3600 },
		);

		return {
			statusCode: 200,
			body: JSON.stringify({
				uploadUrl: putUrl,
			}),
		};
	};
};

export const handler = getHandler(
	new S3Client({ region: "eu-west-2" }),
	DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-west-2" })),
);
