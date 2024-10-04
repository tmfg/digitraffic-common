import { APIGateway } from "aws-sdk";
import type { ApiKey } from "aws-sdk/clients/apigateway.js";

export async function getApiKeyFromAPIGateway(keyId: string): Promise<ApiKey> {
    const ag = new APIGateway();

    return ag
        .getApiKey({
            apiKey: keyId,
            includeValue: true,
        }).promise();
}
