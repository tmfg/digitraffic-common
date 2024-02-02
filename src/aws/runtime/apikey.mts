import { APIGateway } from "@aws-sdk/client-api-gateway";
import type { UpdateApiKeyCommandOutput } from "@aws-sdk/client-api-gateway";

export function getApiKeyFromAPIGateway(keyId: string): Promise<UpdateApiKeyCommandOutput> {
    const agw = new APIGateway();
    return agw.getApiKey({
        apiKey: keyId,
        includeValue: true,
    });
}
