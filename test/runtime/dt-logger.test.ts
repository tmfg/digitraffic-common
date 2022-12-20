import { Writable } from "stream";
import { DtLogger, LoggerConfiguration } from "../../src/aws/runtime/dt-logger";

const LOG_LINE = {
    message: "FOO",
};

describe("dt-logger", () => {
    function assertWrite(config: LoggerConfiguration, expected: unknown) {
        const logged: string[] = [];
        const writeStream = new Writable({
            write: (chunk: Buffer) => {
                logged.push(chunk.toString());
            },
        });

        const logger = new DtLogger({
            ...config,
            ...{ writeStream: writeStream },
        });
        logger.info(LOG_LINE);
        expect(logged.length).toBe(1);

        const loggedLine: unknown = JSON.parse(logged[0]);
        console.info(loggedLine);
        expect(loggedLine).toEqual(expected);
    }

    test("default values", () => {
        assertWrite(
            {},
            {
                message: LOG_LINE.message,
                level: "INFO",
            }
        );
    });

    test("set lambdaName", () => {
        const LAMBDA_NAME = "test_lambda_name";

        assertWrite(
            { lambdaName: LAMBDA_NAME },
            {
                lambdaName: LAMBDA_NAME,
                message: LOG_LINE.message,
                level: "INFO",
            }
        );
    });

    test("set fileName", () => {
        const FILE_NAME = "test_file_name";

        assertWrite(
            { fileName: FILE_NAME },
            {
                fileName: FILE_NAME,
                message: LOG_LINE.message,
                level: "INFO",
            }
        );
    });

    test("set runtime", () => {
        const RUNTIME = "test_runtime";

        assertWrite(
            { runTime: RUNTIME },
            {
                message: LOG_LINE.message,
                level: "INFO",
                runtime: RUNTIME,
            }
        );
    });
});
