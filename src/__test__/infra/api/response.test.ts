import etag from "etag";
import velocity from "velocityjs";
import { RESPONSE_DEFAULT_LAMBDA } from "../../../aws/infra/api/response.js";
import type { LambdaResponse } from "../../../aws/types/lambda-response.js";
import {
  compressBuffer,
  decodeBase64ToString,
} from "../../../aws/types/lambda-response.js";
import { TEST_BIG_JSON } from "../../types/lambda-response.test.js";

const TEST_BODY = "Hello world!";

interface VelocityContext {
  responseOverride: {
    status: number;
    header: Record<string, string>;
  };
}

describe("response tests", () => {
  function generateEtagValueFromString(body: string): string {
    return generateEtagValueFromBase64String(
      Buffer.from(body).toString("base64"),
    );
  }
  function generateEtagValueFromBase64String(bodyBase64: string): string {
    return etag(bodyBase64);
  }

  function generateResponse(
    status: number,
    fileName?: string,
    timestamp?: Date,
    compressBody: boolean = false,
    body: string = TEST_BODY,
  ): [string, VelocityContext] {
    const compile = new velocity.Compile(
      velocity.parse(RESPONSE_DEFAULT_LAMBDA),
    );
    const rawBuffer = Buffer.from(body, "utf8");
    const output = compile.render({
      input: {
        path: () =>
          ({
            body: (compressBody
              ? compressBuffer(rawBuffer)
              : rawBuffer
            ).toString("base64"),
            status,
            fileName,
            timestamp: timestamp?.toUTCString(),
            etag: generateEtagValueFromString(body),
            compressed: compressBody,
          }) satisfies Omit<LambdaResponse, "withTimestamp">,
      },
      util: {
        base64Decode: (data: string) =>
          decodeBase64ToString(data, compressBody),
      },
      context: {
        responseOverride: {
          status: undefined,
          header: {
            "Content-Type": undefined,
            "Access-Control-Allow-Origin": undefined,
            ETag: undefined,
            "Last-Modified": undefined,
            "Content-Disposition": undefined,
            "Content-Encoding": undefined,
          },
        },
      },
    });

    // @ts-expect-error: context is not in the type definition
    return [output as string, compile.context.context];
  }

  function assertOutputAndContext(
    output: string,
    context: VelocityContext,
    status?: number,
    contentType?: string,
    fileName?: string,
    timestamp?: Date,
    body: string = TEST_BODY,
    compressBody: boolean = false,
  ): void {
    expect(output).toEqual(body);
    expect(context).toMatchObject({
      responseOverride: {
        status,
        header: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Content-Disposition": fileName,
          "Last-Modified": timestamp?.toUTCString(),
          ETag: generateEtagValueFromString(body),
          "Content-Encoding": compressBody ? "gzip" : undefined,
        },
      },
    });
  }

  test("test 200", () => {
    const [output, context] = generateResponse(200);
    assertOutputAndContext(output, context);
  });

  test("test 200 - filename", () => {
    const [output, context] = generateResponse(200, "test.txt");

    assertOutputAndContext(
      output,
      context,
      undefined,
      undefined,
      'attachment; filename="test.txt"',
    );
  });

  test("test 200 - filename and timestamp", () => {
    const now = new Date();
    const [output, context] = generateResponse(200, "test.txt", now);

    assertOutputAndContext(
      output,
      context,
      undefined,
      undefined,
      'attachment; filename="test.txt"',
      now,
    );
  });

  test("test 204", () => {
    const [output, context] = generateResponse(204);

    assertOutputAndContext(output, context, 204, "text/plain");
  });

  test("test 200 - compressed", () => {
    const now = new Date();
    const body = JSON.stringify(TEST_BIG_JSON);
    const [output, context] = generateResponse(
      200,
      "test.json",
      now,
      true,
      body,
    );

    assertOutputAndContext(
      output,
      context,
      undefined,
      undefined,
      'attachment; filename="test.json"',
      now,
      body,
      true,
    );
  });
});
