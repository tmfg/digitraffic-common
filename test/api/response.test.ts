import { RESPONSE_DEFAULT_LAMBDA } from "../../src/aws/infra/api/response";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
const velocity = require("velocityjs");

const TEST_BODY = "Hello world!";

interface VelocityContext {
    responseOverride: {
        status: number;
        header: Record<string, string>;
    };
}

describe("response tests", () => {
    function generateResponse(
        status: number,
        fileName?: string,
        timestamp?: Date
    ): [string, VelocityContext] {
        // eslint-disable-next-line
        const compile = new velocity.Compile(
            // eslint-disable-next-line
            velocity.parse(RESPONSE_DEFAULT_LAMBDA)
        );
        // eslint-disable-next-line
        const output = compile.render({
            input: {
                path: () => ({
                    body: Buffer.from(TEST_BODY).toString("base64"),
                    status,
                    fileName,
                    timestamp: timestamp?.toUTCString(),
                }),
            },
            util: {
                base64Decode: (data: string) =>
                    Buffer.from(data, "base64").toString(),
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
                    },
                },
            },
        });

        // eslint-disable-next-line
        return [output as string, compile.context.context];
    }

    function assertContext(
        context: VelocityContext,
        status?: number,
        contentType?: string,
        fileName?: string,
        timestamp?: Date
    ) {
        expect(context).toMatchObject({
            responseOverride: {
                status,
                header: {
                    "Content-Type": contentType,
                    "Access-Control-Allow-Origin": "*",
                    "Content-Disposition": fileName,
                    "Last-Modified": timestamp?.toUTCString(),
                    ETag: timestamp?.toUTCString(),
                },
            },
        });
    }

    test("test 200", () => {
        const [output, context] = generateResponse(200);

        expect(output).toEqual(TEST_BODY);
        assertContext(context);
    });

    test("test 200 - filename", () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
        const [output, context] = generateResponse(200, "test.txt");

        expect(output).toEqual(TEST_BODY);
        assertContext(
            context,
            undefined,
            undefined,
            'attachment; filename="test.txt"'
        );
    });

    test("test 200 - filename and timestamp", () => {
        const now = new Date();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
        const [output, context] = generateResponse(200, "test.txt", now);

        expect(output).toEqual(TEST_BODY);
        assertContext(
            context,
            undefined,
            undefined,
            'attachment; filename="test.txt"',
            now
        );
    });

    test("test 204", () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
        const [output, context] = generateResponse(204);

        expect(output).toEqual(TEST_BODY);
        assertContext(context, 204, "text/plain");
    });
});
