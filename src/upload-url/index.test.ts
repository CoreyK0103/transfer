import type { S3Client } from "@aws-sdk/client-s3";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from "aws-lambda";
import { mock } from "jest-mock-extended";
import { getHandler } from "./index";

jest.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: jest.fn(() => "http://test.com"),
}));

jest.mock("node:crypto", () => ({
	randomUUID: jest.fn(() => "random-id-1-2-3"),
}));

const event: APIGatewayProxyEventV2 = {
	version: "2.0",
	routeKey: "$default",
	rawPath: "/upload",
	rawQueryString: "",
	headers: {
		"content-type": "test",
	},
	isBase64Encoded: false,
	requestContext: {
		accountId: "123456789012",
		apiId: "api-id",
		domainName: "example.com",
		domainPrefix: "example",
		http: {
			method: "POST",
			path: "/upload",
			protocol: "HTTP/1.1",
			sourceIp: "192.168.0.1",
			userAgent: "test-agent",
		},
		requestId: "request-id",
		routeKey: "$default",
		stage: "$default",
		time: "12/Mar/2020:19:03:58 +0000",
		timeEpoch: 1583348638390,
	},
};

describe("upload-url handler", () => {
	it("should return a pre-signed URL", async () => {
		const uut = getHandler(mock<S3Client>(), mock<DynamoDBDocumentClient>());

		const eventWithBody = {
			...event,
			body: JSON.stringify({
				filename: "test.txt",
				contentType: "text/plain",
				recipientEmail: "test@example.com",
			}),
		};

		const response = (await uut(eventWithBody)) as APIGatewayProxyResultV2 & {
			statusCode: number;
			body: string;
		};

		expect(response.statusCode).toEqual(200);
		expect(response.body).toEqual(
			JSON.stringify({
				uploadUrl: "http://test.com",
			}),
		);
	});

	it("should throw an error if no body is provided", async () => {
		const uut = getHandler(mock<S3Client>(), mock<DynamoDBDocumentClient>());

		await expect(uut(event)).rejects.toThrow("No body provided");
	});

	it("should write file info to DynamoDB", async () => {
		const dynamoDBClient = mock<DynamoDBDocumentClient>();

		const eventWithBody = {
			...event,
			body: JSON.stringify({
				filename: "test.txt",
				contentType: "text/plain",
				recipientEmail: "test@example.com",
			}),
		};

		process.env.FILE_INFO_TABLE_NAME = "test-table";

		const uut = getHandler(mock<S3Client>(), dynamoDBClient);

		await uut(eventWithBody);

		expect(dynamoDBClient.send).toHaveBeenCalledWith(
			expect.objectContaining({
				input: {
					TableName: "test-table",
					Item: {
						fileId: "random-id-1-2-3",
						filename: "test.txt",
						contentType: "text/plain",
						recipientEmail: "test@example.com",
					},
				},
			}),
		);
	});
});
