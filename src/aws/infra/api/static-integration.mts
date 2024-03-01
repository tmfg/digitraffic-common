import {
    type MethodResponse,
    MockIntegration,
    PassthroughBehavior,
    Resource,
} from "aws-cdk-lib/aws-apigateway";
import { MediaType } from "../../types/mediatypes.mjs";
import { RESPONSE_CORS_INTEGRATION } from "./responses.mjs";

const INTEGRATION_RESPONSE_200 = `{
    "statusCode": 200
}`;

const METHOD_RESPONSE_200 = {
    statusCode: "200",
};

/**
 * Static integration, that returns the given response with given mediaType from given resource.
 *
 * @param resource
 * @param mediaType
 * @param response
 */
export class DigitrafficStaticIntegration extends MockIntegration {
    constructor(
        resource: Resource,
        mediaType: MediaType,
        response: string,
        enableCors = true,
        apiKeyRequired = true,
        headers: Record<string, string> = {}
    ) {
        const integrationResponse =
            DigitrafficStaticIntegration.createIntegrationResponse(
                response,
                mediaType,
                enableCors,
                headers
            );

        super({
            passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
            requestTemplates: {
                [mediaType]: INTEGRATION_RESPONSE_200,
            },
            integrationResponses: [integrationResponse],
        });

        ["GET", "HEAD"].forEach((httpMethod) => {
            resource.addMethod(httpMethod, this, {
                apiKeyRequired,
                methodResponses: [
                    DigitrafficStaticIntegration.createMethodResponse(enableCors, headers),
                ],
            });
        });
    }

    static json<K>(
        resource: Resource,
        response: K,
        enableCors = true,
        apiKeyRequired = true
    ) {
        return new DigitrafficStaticIntegration(
            resource,
            MediaType.APPLICATION_JSON,
            JSON.stringify(response),
            enableCors,
            apiKeyRequired
        );
    }

    static createIntegrationResponse(
        response: string,
        mediaType: MediaType,
        enableCors: boolean,
        headers: Record<string, string> = {}
    ) {
        const integrationResponse = {
            statusCode: "200",
            responseTemplates: {
                [mediaType]: response,
            },
            headers: headers
        };

        return enableCors
            ? { ...integrationResponse, ...RESPONSE_CORS_INTEGRATION }
            : integrationResponse;
    }

    static createMethodResponse(enableCors: boolean, headers: Record<string, string>) {
        const allowedHeaders = [
            ...Object.keys(headers),
            ...(enableCors ? ["Access-Control-Allow-Origin"] : [])
        ];

        const entries = Object.fromEntries(allowedHeaders.map((key) => [key, true]));
        const allowedHeaderParams = prefixKeys("method.response.header.", entries);

        return {
            ...METHOD_RESPONSE_200,
            ...{
                responseParameters: {
                    ...allowedHeaderParams
                },
            }
        }
    }
}

/**
 * Create a new Record with prefix added to each of the keys.
 *
 * @param prefix
 * @param obj
 */
function prefixKeys<T>(prefix: string, obj: Record<string, T>): Record<string, T> {
    return Object.entries(obj).reduce((acc: Record<string, T>, entry: [string, T]) => {
        acc[prefix + entry[0]] = entry[1];
        return acc;
    }, {})
}
