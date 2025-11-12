import {
  decodeBase64ToString,
  LambdaResponse,
  LambdaResponseBuilder,
} from "../../aws/types/lambda-response.js";

// About 18 MB will be compressed to 2 MB
export const TEST_BIG_JSON = {
  items: Array.from({ length: 10 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    description: "This is a test description that repeats to allow compression",
    value: Math.random(),
  })),
};

describe("lambda-response", () => {
  const TEST_MESSAGE = "HELLO";
  const TEST_COUNT = 12;
  const TEST_FILENAME = "file.txt";
  const TEST_TIMESTAMP = new Date();
  const TEST_TIMESTAMP_STR = TEST_TIMESTAMP.toISOString();

  const TEST_JSON = {
    message: TEST_MESSAGE,
    count: TEST_COUNT,
  };

  function assertJson<T>(
    response: LambdaResponse,
    expectedJson: T,
    expectedStatus: number,
    expectedFilename?: string,
    expectedTimestamp?: Date,
  ): void {
    const body = JSON.parse(
      decodeBase64ToString(response.body, response.compressed),
    ) as unknown;

    expect(body).toEqual(expectedJson);
    expect(response.status).toEqual(expectedStatus);
    expect(response.fileName).toEqual(expectedFilename);
    expect(response.timestamp).toEqual(expectedTimestamp?.toUTCString());
  }

  function assertBinary(
    response: LambdaResponse,
    expectedString: string,
    expectedStatus: number,
    expectedFilename?: string,
    expectedTimestamp?: Date,
  ): void {
    const body = decodeBase64ToString(response.body, response.compressed);

    expect(body).toEqual(expectedString);
    expect(response.status).toEqual(expectedStatus);
    expect(response.fileName).toEqual(expectedFilename);
    expect(response.timestamp).toEqual(expectedTimestamp?.toUTCString());
  }

  test("okJson - without fileName", () => {
    const response = LambdaResponse.okJson(TEST_JSON);

    assertJson(response, TEST_JSON, 200);
  });

  test("okJson - with fileName", () => {
    const response = LambdaResponse.okJson(TEST_JSON, TEST_FILENAME);

    assertJson(response, TEST_JSON, 200, TEST_FILENAME);
  });

  test("okJson - with fileName and timestamp", () => {
    const response = LambdaResponse.okJson(
      TEST_JSON,
      TEST_FILENAME,
    ).withTimestamp(TEST_TIMESTAMP);

    assertJson(response, TEST_JSON, 200, TEST_FILENAME, TEST_TIMESTAMP);
  });

  test("okBinary - with fileName and timestamp", () => {
    const response = LambdaResponse.okBinary(
      Buffer.from(TEST_MESSAGE).toString("base64"),
      TEST_FILENAME,
    ).withTimestamp(TEST_TIMESTAMP);

    assertBinary(response, TEST_MESSAGE, 200, TEST_FILENAME, TEST_TIMESTAMP);
  });

  test("badRequest", () => {
    const response = LambdaResponse.badRequest(TEST_MESSAGE);

    assertBinary(response, TEST_MESSAGE, 400);
  });

  test("notFound", () => {
    const response = LambdaResponse.notFound();

    assertBinary(response, "Not found", 404);
  });

  test("internalError", () => {
    const response = LambdaResponse.internalError();

    assertBinary(response, "Internal error", 500);
  });

  test("notImplemented", () => {
    const response = LambdaResponse.notImplemented();

    assertBinary(response, "Not implemented", 501);
  });

  // Builder
  test("Builder - okJson - without fileName", () => {
    const response = LambdaResponseBuilder.create().withBody(TEST_JSON).build();

    assertJson(response, TEST_JSON, 200);
  });

  test("Builder - okJson - with fileName", () => {
    const response = LambdaResponseBuilder.create()
      .withBody(TEST_JSON)
      .withFileName(TEST_FILENAME)
      .build();

    assertJson(response, TEST_JSON, 200, TEST_FILENAME);
  });

  test("Builder - okJson - with fileName and timestamp", () => {
    const response = LambdaResponseBuilder.create()
      .withBody(TEST_JSON)
      .withFileName(TEST_FILENAME)
      .withTimestamp(TEST_TIMESTAMP)
      .build();

    const response2 = LambdaResponseBuilder.create()
      .withBody(TEST_JSON)
      .withFileName(TEST_FILENAME)
      .withTimestamp(TEST_TIMESTAMP_STR)
      .build();

    assertJson(response, TEST_JSON, 200, TEST_FILENAME, TEST_TIMESTAMP);
    assertJson(response2, TEST_JSON, 200, TEST_FILENAME, TEST_TIMESTAMP);
  });

  test("Builder - okBinary - with fileName and timestamp", () => {
    const response = LambdaResponseBuilder.create()
      .withBody(TEST_MESSAGE)
      .withFileName(TEST_FILENAME)
      .withTimestamp(TEST_TIMESTAMP)
      .build();

    assertBinary(response, TEST_MESSAGE, 200, TEST_FILENAME, TEST_TIMESTAMP);
  });

  test("Builder - compression uneffective for small json", () => {
    const response = LambdaResponseBuilder.create()
      .withBody(TEST_JSON)
      .withFileName(TEST_FILENAME)
      .withCompression()
      .withDebug()
      .build();
    expect(response.compressed).toBe(false);
    assertJson(response, TEST_JSON, 200, TEST_FILENAME);
  });

  test("Builder - compression effective for large json", () => {
    const response = LambdaResponseBuilder.create()
      .withBody(TEST_BIG_JSON)
      .withFileName(TEST_FILENAME)
      .withCompression()
      .withDebug()
      .build();

    expect(response.compressed).toBe(true);
    assertJson(response, TEST_BIG_JSON, 200, TEST_FILENAME);
  });
});
