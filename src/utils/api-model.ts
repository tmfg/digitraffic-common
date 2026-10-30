import type {
  JsonSchema,
  Model,
  RequestValidator,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { JsonSchemaType, JsonSchemaVersion } from "aws-cdk-lib/aws-apigateway";
import type { ZodType } from "zod";
import { toJSONSchema } from "zod";
import type { ModelWithReference } from "../aws/types/model-with-reference.js";

type ModelReferenceUrl =
  `https://apigateway.amazonaws.com/restapis/${string}/models/${string}`;

type JsonSchemaWithNullable = JsonSchema & {
  nullable?: boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Keywords whose value is a map from a name to a schema. The names are data
// (for example field names) and must not be changed, only the schema values.
// A dependencies value can also be a string array, which is left unchanged.
const SCHEMA_MAP_KEYWORDS = [
  "properties",
  "patternProperties",
  "definitions",
  "dependencies",
];

// Keywords whose value is a list of schemas.
const SCHEMA_LIST_KEYWORDS = ["oneOf", "anyOf", "allOf"];

// Keywords whose value is a single schema.
const SCHEMA_KEYWORDS = [
  "items",
  "additionalProperties",
  "additionalItems",
  "contains",
  "propertyNames",
  "not",
];

/**
 * Walks a JSON Schema and applies the transform to every schema object,
 * starting from the innermost ones. Only values of known schema keywords are
 * treated as schemas. Everything else, such as field names in `properties`
 * and literal values like `default`, is left untouched.
 */
function transformSchemaDeep(
  schema: unknown,
  transform: (schema: Record<string, unknown>) => Record<string, unknown>,
): unknown {
  if (!isObject(schema)) {
    return schema;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (SCHEMA_MAP_KEYWORDS.includes(key) && isObject(value)) {
      result[key] = Object.fromEntries(
        Object.entries(value).map(([name, subSchema]) => [
          name,
          transformSchemaDeep(subSchema, transform),
        ]),
      );
    } else if (SCHEMA_LIST_KEYWORDS.includes(key) && Array.isArray(value)) {
      result[key] = value.map((item) => transformSchemaDeep(item, transform));
    } else if (key === "items" && Array.isArray(value)) {
      result[key] = value.map((item) => transformSchemaDeep(item, transform));
    } else if (SCHEMA_KEYWORDS.includes(key) && isObject(value)) {
      result[key] = transformSchemaDeep(value, transform);
    } else {
      result[key] = value;
    }
  }
  return transform(result);
}

/**
 * Collects all local reference values ("#/...") from a schema. Walks only
 * known schema keywords, so references inside literal values such as defaults
 * or enums are not collected. Both the CDK property name "ref" and the raw
 * JSON Schema keyword "$ref" are checked.
 */
function findLocalReferences(schema: unknown): string[] {
  if (!isObject(schema)) {
    return [];
  }

  const references: string[] = [];
  for (const [key, value] of Object.entries(schema)) {
    if (
      (key === "ref" || key === "$ref") &&
      typeof value === "string" &&
      value.startsWith("#/")
    ) {
      references.push(value);
    } else if (SCHEMA_MAP_KEYWORDS.includes(key) && isObject(value)) {
      for (const subSchema of Object.values(value)) {
        references.push(...findLocalReferences(subSchema));
      }
    } else if (
      (SCHEMA_LIST_KEYWORDS.includes(key) || key === "items") &&
      Array.isArray(value)
    ) {
      for (const item of value) {
        references.push(...findLocalReferences(item));
      }
    } else if (SCHEMA_KEYWORDS.includes(key) && isObject(value)) {
      references.push(...findLocalReferences(value));
    }
  }
  return references;
}

/**
 * Wraps a schema and a null alternative into a union. Definitions are kept at
 * the root, otherwise local references like "#/definitions/X" would point to
 * nothing after wrapping.
 *
 * Throws if the schema contains local references to other locations, such as
 * "#/properties/...". Wrapping would silently break them, so failing at synth
 * time is safer than deploying a broken model.
 */
function wrapSchemaWithNull(
  schema: Record<string, unknown>,
  unionKeyword: "oneOf" | "anyOf",
): Record<string, unknown> {
  const { definitions, ...rest } = schema;

  const brokenReferences = findLocalReferences(rest).filter(
    (reference) => !reference.startsWith("#/definitions/"),
  );
  if (brokenReferences.length > 0) {
    throw new Error(
      `Cannot convert nullable schema: wrapping would break local references: ${brokenReferences.join(", ")}. Only #/definitions/ references are supported.`,
    );
  }

  const wrapped: Record<string, unknown> = {
    [unionKeyword]: [rest, { type: "null" }],
  };
  if (definitions !== undefined) {
    // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
    wrapped["definitions"] = definitions;
  }
  return wrapped;
}

/**
 * Converts one schema object with `nullable: true` to a form that accepts null.
 */
function convertNullableSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  if (!("nullable" in schema)) {
    return schema;
  }

  // The nullable keyword is always removed because API Gateway rejects it.
  // A null alternative is added only when the value was true.
  const { nullable, ...rest } = schema;
  if (nullable !== true) {
    return rest;
  }

  // A simple typed schema cannot overlap with null, so oneOf is safe.
  // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
  if (typeof rest["type"] === "string") {
    return wrapSchemaWithNull(rest, "oneOf");
  }

  // A standalone anyOf can take null as one more alternative. This is only
  // safe when anyOf is the sole keyword: sibling keywords such as enum apply
  // to the whole schema and would still reject null.
  // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
  const anyOf = rest["anyOf"];
  if (Array.isArray(anyOf) && Object.keys(rest).length === 1) {
    const hasNull = anyOf.some(
      // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
      (item) => isObject(item) && item["type"] === "null",
    );
    return hasNull ? rest : { anyOf: [...anyOf, { type: "null" }] };
  }

  // Everything else: oneOf, allOf, references or an empty schema. Wrap in
  // anyOf instead of oneOf, because the schema itself may also accept null
  // and oneOf would then reject it (oneOf requires exactly one match).
  return wrapSchemaWithNull(rest, "anyOf");
}

/**
 * Removes the `pattern` keyword from one schema object. Field names that
 * happen to be called "pattern" live inside `properties` and are not touched.
 */
function removePatternKeyword(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  if (!("pattern" in schema)) {
    return schema;
  }
  const { pattern: _pattern, ...rest } = schema;
  return rest;
}

/**
 * Converts nullable fields in an OpenAPI 3.0 JSON Schema to a form accepted by
 * API Gateway model schemas.
 *
 * API Gateway rejects the OpenAPI 3.0 `nullable` keyword. Importing a model
 * with it fails with errors such as "ArrayNode cannot be cast to TextNode".
 * This input is not accepted:
 *
 * ```json
 * { "type": "string", "nullable": true }
 * ```
 *
 * This function removes `nullable` and expresses null as an alternative,
 * which API Gateway accepts:
 *
 * ```json
 * { "oneOf": [{ "type": "string" }, { "type": "null" }] }
 * ```
 *
 * If the nullable schema is already an `anyOf` union, the null alternative is
 * added to it. If it has no `type` at all (for example `allOf` or a plain
 * reference), the whole schema is wrapped in an `anyOf` so that null stays
 * allowed. The conversion is applied recursively to nested schemas. Field
 * names and literal values such as defaults are left untouched.
 *
 * Limitation: when a nullable schema is wrapped, only references to
 * `#/definitions/...` stay valid. If the schema contains local references to
 * other locations, such as `#/properties/...`, an error is thrown instead of
 * producing a model with broken references. Zod output never contains such
 * references, so this only matters for hand-written schemas.
 */
export function convertJsonSchemaNullableToOneOfDeep(
  schema: JsonSchemaWithNullable,
): JsonSchemaWithNullable {
  return transformSchemaDeep(
    schema,
    convertNullableSchema,
  ) as JsonSchemaWithNullable;
}

/**
 * Creates a JSON Schema that can be used as an API Gateway model from a Zod schema.
 *
 * API Gateway does not accept Zod's default nullable output or regex patterns in
 * model schemas. This helper keeps nullable values as `oneOf` alternatives and
 * removes the `pattern` keyword that API Gateway cannot import. Field names and
 * literal values are not touched, so a field may safely be named for example
 * "pattern" or "nullable".
 *
 * For example, this Zod schema:
 *
 * ```ts
 * z.object({ reason: z.string().nullable() });
 * ```
 *
 * becomes this API Gateway schema:
 *
 * ```json
 * {
 *   "type": "object",
 *   "properties": {
 *     "reason": {
 *       "oneOf": [{ "type": "string" }, { "type": "null" }]
 *     }
 *   }
 * }
 * ```
 */
export function toApiGatewayJsonSchema(schema: ZodType): JsonSchema {
  const jsonSchema = toJSONSchema(schema, {
    target: "openapi-3.0",
    unrepresentable: "any",
  });

  return transformSchemaDeep(jsonSchema, (schemaObject) =>
    convertNullableSchema(removePatternKeyword(schemaObject)),
  ) as JsonSchema;
}

/**
 * Get a reference to an OpenAPI model object in a REST API.
 * Can be used to supply a reference to properties of a GeoJSON feature.
 * @param modelId Id of the referenced object
 * @param restApiId Id of the REST API
 */
export function getModelReference(
  modelId: string,
  restApiId: string,
): ModelReferenceUrl {
  return `https://apigateway.amazonaws.com/restapis/${restApiId}/models/${modelId}`;
}

/**
 * Adds a request validator to a REST API to enforce request parameters/body requirements.
 * https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-method-request-validation.html
 * @param api REST API
 */
export function addDefaultValidator(api: RestApi): RequestValidator {
  return api.addRequestValidator("DefaultValidator", {
    validateRequestParameters: true,
    validateRequestBody: true,
  });
}

/**
 * Adds a JSON Schema model to an API Gateway API. Can be used later to generate OpenAPI specifications.
 * This method adds a schema for _a single object._
 * @param modelName
 * @param api REST API
 * @param schema JSON Schema
 * @return ModelWithReference A model object with a reference to an API Gateway model object.
 */
export function addServiceModel(
  modelName: string,
  api: RestApi,
  schema: JsonSchema,
): ModelWithReference {
  const mwr = api.addModel(modelName, {
    contentType: "application/json",
    modelName,
    schema,
  }) as ModelWithReference;
  mwr.modelReference = getModelReference(mwr.modelId, api.restApiId);
  return mwr;
}

/**
 * Add an empty JSON schema model to an API Gateway API.
 * Usable for example if the incoming data is in XML format but some template transformation is necessary.
 * @param modelName
 * @param api
 * @param contentType
 */
export function addSimpleServiceModel(
  modelName: string,
  api: RestApi,
  contentType: `${string}/${string}` = "application/xml",
): Model {
  return api.addModel(modelName, {
    contentType,
    modelName,
    schema: {},
  });
}

/**
 * Adds a JSON Schema model to an API Gateway API. Can be used later to generate OpenAPI specifications.
 * This method adds a schema for _an array._
 * @param model
 * @param api
 */
export function createArraySchema(model: Model, api: RestApi): JsonSchema {
  return {
    type: JsonSchemaType.ARRAY,
    items: {
      ref: getModelReference(model.modelId, api.restApiId),
    },
  };
}

/**
 * Creates a JSON Schema for a GeoJSON Feature. Can be used to generate OpenAPI descriptions.
 * @param modelReference Reference to a model object
 */
export function featureSchema(modelReference: string): JsonSchema {
  return {
    schema: JsonSchemaVersion.DRAFT4,
    type: JsonSchemaType.OBJECT,
    description: "GeoJson Feature",
    required: ["type", "properties", "geometry"],
    properties: {
      type: {
        type: JsonSchemaType.STRING,
        description: "Feature",
        enum: ["Feature"],
      },
      properties: {
        ref: modelReference,
      },
      geometry: {
        type: JsonSchemaType.OBJECT,
        description: "GeoJSON geometry",
      },
    },
  };
}

/**
 * Creates a JSON Schema for a GeoJSON Feature Collection. Can be used to generate OpenAPI descriptions.
 * @param modelReference Reference to a model object, in this case Features.
 */
export function geojsonSchema(modelReference: string): JsonSchema {
  return {
    schema: JsonSchemaVersion.DRAFT4,
    type: JsonSchemaType.OBJECT,
    description: "GeoJson FeatureCollection",
    required: ["type", "features"],
    properties: {
      type: {
        type: JsonSchemaType.STRING,
        description: "FeatureCollection",
        enum: ["FeatureCollection"],
      },
      features: {
        type: JsonSchemaType.ARRAY,
        items: {
          ref: modelReference,
        },
      },
    },
  };
}
