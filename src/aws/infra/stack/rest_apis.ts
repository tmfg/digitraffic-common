import {
    CfnDocumentationPart,
    EndpointType,
    GatewayResponse,
    IResource,
    JsonSchema,
    MethodLoggingLevel,
    MockIntegration,
    Model,
    Resource,
    ResponseType,
    RestApi,
    RestApiProps,
} from "aws-cdk-lib/aws-apigateway";
import {
    AnyPrincipal,
    Effect,
    PolicyDocument,
    PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { getModelReference } from "../../../utils/api-model";
import { MediaType } from "../../types/mediatypes";
import { ModelWithReference } from "../../types/model-with-reference";
import { DocumentationPart, DocumentationProperties } from "../documentation";
import { createDefaultUsagePlan, createUsagePlan } from "../usage-plans";
import { DigitrafficStack } from "./stack";

import R = require("ramda");

export class DigitrafficRestApi extends RestApi {
    readonly apiKeyIds: string[];
    readonly enableDocumentation: boolean;

    constructor(
        stack: DigitrafficStack,
        apiId: string,
        apiName: string,
        allowFromIpAddresses?: string[] | undefined,
        config?: Partial<RestApiProps>
    ) {
        const policyDocument =
            allowFromIpAddresses == null
                ? createDefaultPolicyDocument()
                : createIpRestrictionPolicyDocument(allowFromIpAddresses);

        // override default config with given extra config
        const apiConfig = {
            ...{
                deployOptions: {
                    loggingLevel: MethodLoggingLevel.ERROR,
                },
                restApiName: apiName,
                endpointTypes: [EndpointType.REGIONAL],
                policy: policyDocument,
            },
            ...config,
        };

        super(stack, apiId, apiConfig);

        this.apiKeyIds = [];
        this.enableDocumentation =
            stack.configuration.stackFeatures?.enableDocumentation ?? true;

        add404Support(this, stack);
    }

    hostname(): string {
        return `${this.restApiId}.execute-api.${
            (this.stack as DigitrafficStack).region
        }.amazonaws.com`;
    }

    createUsagePlan(apiKeyId: string, apiKeyName: string): string {
        const newKeyId = createUsagePlan(this, apiKeyId, apiKeyName).keyId;

        this.apiKeyIds.push(newKeyId);

        return newKeyId;
    }

    createUsagePlanV2(apiName: string, apiKey?: string): string {
        const newKeyId = createDefaultUsagePlan(this, apiName, apiKey).keyId;

        this.apiKeyIds.push(newKeyId);

        return newKeyId;
    }

    addJsonModel(modelName: string, schema: JsonSchema) {
        return this.getModelWithReference(
            this.addModel(modelName, {
                contentType: MediaType.APPLICATION_JSON,
                modelName,
                schema,
            })
        );
    }

    addCSVModel(modelName: string) {
        return this.getModelWithReference(
            this.addModel(modelName, {
                contentType: MediaType.TEXT_CSV,
                modelName,
                schema: {},
            })
        );
    }

    private getModelWithReference(model: Model): ModelWithReference {
        return R.assoc(
            "modelReference",
            getModelReference(model.modelId, this.restApiId),
            model
        ) as ModelWithReference;
    }

    private addDocumentationPart(
        resource: Resource,
        parameterName: string,
        resourceName: string,
        type: string,
        properties: DocumentationProperties
    ) {
        const location: CfnDocumentationPart.LocationProperty = {
            type,
            path: resource.path,
            name: type !== "METHOD" ? parameterName : undefined,
        };

        new CfnDocumentationPart(this.stack, resourceName, {
            restApiId: resource.api.restApiId,
            location,
            properties: JSON.stringify(properties),
        });
    }

    documentResource(
        resource: Resource,
        ...documentationPart: DocumentationPart[]
    ) {
        if (this.enableDocumentation) {
            documentationPart.forEach((dp) =>
                this.addDocumentationPart(
                    resource,
                    dp.parameterName,
                    `${resource.path}.${dp.parameterName}.Documentation`,
                    dp.type,
                    dp.documentationProperties
                )
            );
        } else {
            console.info("Skipping documentation for %s", resource.path);
        }
    }

    /**
     * Add support for HTTP OPTIONS to an API GW resource,
     * this is required for preflight CORS requests made by browsers.
     * @param apiResource
     */
    addCorsOptions(apiResource: IResource): void {
        apiResource.addMethod(
            "OPTIONS",
            new MockIntegration({
                integrationResponses: [
                    {
                        statusCode: "200",
                        responseParameters: {
                            "method.response.header.Access-Control-Allow-Headers":
                                "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Digitraffic-User'",
                            "method.response.header.Access-Control-Allow-Origin":
                                "'*'",
                            "method.response.header.Access-Control-Allow-Methods":
                                "'OPTIONS,GET,HEAD'",
                        },
                    },
                ],
                requestTemplates: {
                    "application/json": '{"statusCode": 200}',
                },
            }),
            {
                methodResponses: [
                    {
                        statusCode: "200",
                        responseParameters: {
                            "method.response.header.Access-Control-Allow-Headers":
                                true,
                            "method.response.header.Access-Control-Allow-Methods":
                                true,
                            "method.response.header.Access-Control-Allow-Origin":
                                true,
                        },
                    },
                ],
            }
        );
    }
}

/**
 * Due to AWS API design API Gateway will always return 403 'Missing Authentication Token' for requests
 * with a non-existent endpoint. This function translates this response to a 404.
 * Requests with an invalid or missing API key are not affected (still return 403 'Forbidden').
 * @param restApi RestApi
 * @param stack Construct
 */
export function add404Support(restApi: RestApi, stack: Construct) {
    new GatewayResponse(
        stack,
        `MissingAuthenticationTokenResponse-${restApi.restApiName}`,
        {
            restApi,
            type: ResponseType.MISSING_AUTHENTICATION_TOKEN,
            statusCode: "404",
            templates: {
                [MediaType.APPLICATION_JSON]: '{"message": "Not found"}',
            },
        }
    );
}

export function add401Support(restApi: RestApi, stack: Construct) {
    new GatewayResponse(
        stack,
        `AuthenticationFailedResponse-${restApi.restApiName}`,
        {
            restApi,
            type: ResponseType.UNAUTHORIZED,
            statusCode: "401",
            responseHeaders: {
                "WWW-Authenticate": "'Basic'",
            },
        }
    );
}

/**
 * Due to AWS API design API Gateway will always return 403 'Missing Authentication Token' for requests
 * with a non-existent endpoint. This function converts this response to a custom one.
 * Requests with an invalid or missing API key are not affected (still return 403 'Forbidden').
 * @param returnCode
 * @param message
 * @param restApi RestApi
 * @param stack Construct
 */
export function setReturnCodeForMissingAuthenticationToken(
    returnCode: number,
    message: string,
    restApi: RestApi,
    stack: Construct
) {
    new GatewayResponse(
        stack,
        `MissingAuthenticationTokenResponse-${restApi.restApiName}`,
        {
            restApi,
            type: ResponseType.MISSING_AUTHENTICATION_TOKEN,
            statusCode: `${returnCode}`,
            templates: {
                [MediaType.APPLICATION_JSON]: `{"message": ${message}}`,
            },
        }
    );
}

export function createRestApi(
    stack: Construct,
    apiId: string,
    apiName: string,
    allowFromIpAddresses?: string[] | undefined
): RestApi {
    const policyDocument =
        allowFromIpAddresses == null
            ? createDefaultPolicyDocument()
            : createIpRestrictionPolicyDocument(allowFromIpAddresses);
    const restApi = new RestApi(stack, apiId, {
        deployOptions: {
            loggingLevel: MethodLoggingLevel.ERROR,
        },
        restApiName: apiName,
        endpointTypes: [EndpointType.REGIONAL],
        policy: policyDocument,
    });
    add404Support(restApi, stack);
    return restApi;
}

export function createDefaultPolicyDocument() {
    return new PolicyDocument({
        statements: [
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["execute-api:Invoke"],
                resources: ["*"],
                principals: [new AnyPrincipal()],
            }),
        ],
    });
}

export function createIpRestrictionPolicyDocument(
    allowFromIpAddresses: string[]
): PolicyDocument {
    return new PolicyDocument({
        statements: [
            new PolicyStatement({
                effect: Effect.ALLOW,
                conditions: {
                    IpAddress: {
                        "aws:SourceIp": allowFromIpAddresses,
                    },
                },
                actions: ["execute-api:Invoke"],
                resources: ["*"],
                principals: [new AnyPrincipal()],
            }),
        ],
    });
}
