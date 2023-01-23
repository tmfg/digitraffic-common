import {MediaType} from "../../types/mediatypes";
import {JsonSchema, JsonSchemaType, JsonSchemaVersion, MethodResponse, Model,} from "aws-cdk-lib/aws-apigateway";
import {IModel} from "aws-cdk-lib/aws-apigateway/lib/model";

/**
 * This is velocity-script, that assumes the response to be LambdaResponse(status and body).
 * It will always return the body and status, but if status in something else than 200 OK the content-type
 * will be overridden to text/plain. (it's assumed, that lambda will return error text).
 *
 * Body content must be base64-encoded! use LambdaResponse for this! This way you can also return
 * non-textual content.
 *
 * If fileName is set, then Content-Disposition-header will be set to use it
 */
export const RESPONSE_DEFAULT_LAMBDA = `#set($inputRoot = $input.path('$'))
$util.base64Decode($inputRoot.body)
#if ($inputRoot.status != 200)
#set ($context.responseOverride.status = $inputRoot.status)
#set ($context.responseOverride.header.Content-Type = 'text/plain')
#end
#set ($context.responseOverride.header.Access-Control-Allow-Origin = '*')
#if ("$!inputRoot.fileName" != "")
#set ($disposition = 'attachment; filename="FN"')
#set ($context.responseOverride.header.Content-Disposition = $disposition.replaceAll('FN', $inputRoot.fileName))
#end
`;

export const getDeprecatedDefaultLambdaResponse = (sunset: string) => {
    const setDeprecationHeaders = `#set ($context.responseOverride.header.Deprecation = 'true')
#set ($context.responseOverride.header.Sunset = '${sunset}')`;
    return RESPONSE_DEFAULT_LAMBDA.concat(setDeprecationHeaders);
};

const BODY_FROM_INPUT_PATH = "$input.path('$').body";

/// @deprecated
const messageSchema: JsonSchema = {
    schema: JsonSchemaVersion.DRAFT4,
    type: JsonSchemaType.OBJECT,
    description: "Response with message",
    properties: {
        message: {
            type: JsonSchemaType.STRING,
            description: "Response message",
        },
    },
};

/// @deprecated
export const MessageModel = {
    contentType: MediaType.APPLICATION_JSON,
    modelName: "MessageResponseModel",
    schema: messageSchema,
};

const NotFoundMessage = "Not found";
export const NotFoundResponse = JSON.stringify({ message: NotFoundMessage });

const InternalServerErrorMessage = "Error";
const InternalServerErrorResponse = JSON.stringify({
    message: InternalServerErrorMessage,
});

const BadRequestMessage = "Bad request";
const BadRequestResponse = JSON.stringify({ message: BadRequestMessage });

/// @deprecated
export const BadRequestResponseTemplate = createResponses(
    MediaType.APPLICATION_JSON,
    BadRequestResponse
);
/// @deprecated
export const NotFoundResponseTemplate = createResponses(
    MediaType.APPLICATION_JSON,
    NotFoundResponse
);
/// @deprecated
export const XmlResponseTemplate = createResponses(
    MediaType.APPLICATION_XML,
    BODY_FROM_INPUT_PATH
);
/// @deprecated
export const InternalServerErrorResponseTemplate = createResponses(
    MediaType.APPLICATION_JSON,
    InternalServerErrorResponse
);

/// @deprecated
export function createResponses<T>(
    key: MediaType,
    value: T
): Record<string, T> {
    return {
        [key]: value,
    };
}

export class DigitrafficMethodResponse {
    static response(
        statusCode: string,
        model: IModel,
        mediaType: MediaType,
        disableCors = false,
        deprecation = false
    ): MethodResponse {
        return {
            statusCode,
            responseModels: {
                [mediaType]: model,
            },
            responseParameters: {
                "method.response.header.Access-Control-Allow-Origin": !disableCors,
                "method.response.header.Deprecation": deprecation,
                "method.response.header.Sunset": deprecation,
            },
        };
    }

    static response200(model: IModel, mediaType = MediaType.APPLICATION_JSON) {
        return DigitrafficMethodResponse.response(
            "200",
            model,
            mediaType,
            false
        );
    }

    static response500(
        model = Model.EMPTY_MODEL,
        mediaType = MediaType.APPLICATION_JSON
    ) {
        return DigitrafficMethodResponse.response(
            "500",
            model,
            mediaType,
            false
        );
    }

    static response400(
        model = Model.EMPTY_MODEL,
        mediaType = MediaType.APPLICATION_JSON
    ) {
        return DigitrafficMethodResponse.response(
            "400",
            model,
            mediaType,
            false
        );
    }
}
