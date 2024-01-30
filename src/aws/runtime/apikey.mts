import awsSdk from "aws-sdk";
import type { APIGateway as APIGatewayType } from "aws-sdk";

const { APIGateway } = awsSdk;

export function getApiKeyFromAPIGateway(keyId: string): Promise<APIGatewayType.Types.ApiKey> {
    const agw = new APIGateway();
    return agw.getApiKey({
        apiKey: keyId,
        includeValue: true,
    }).promise();
}
