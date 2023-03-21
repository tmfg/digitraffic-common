import { Writable } from "stream";
import { DtLogger, LoggerConfiguration } from "../../src/aws/runtime/dt-logger";
import { LoggableType } from "../../src/aws/runtime/dt-logger";

const LOG_LINE: LoggableType = {
    method: "dt-logger.test",
    message: "FOO",
};

describe("dt-logger", () => {
    function assertLog(
        config: LoggerConfiguration,
        message: LoggableType,
        expected: LoggableType
    ) {
        assertWrite(
            config,
            (logger: DtLogger) => {
                logger.info(message);
            },
            expected
        );
    }

    function assertDebug(
        config: LoggerConfiguration,
        message: unknown,
        expected: Record<string, unknown>
    ) {
        assertWrite(
            config,
            (logger: DtLogger) => {
                logger.debug(message);
            },
            expected
        );
    }

    function assertWrite(
        config: LoggerConfiguration,
        writeFunction: (logger: DtLogger) => void,
        expected: Record<string, unknown>
    ) {
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

        writeFunction(logger);

        expect(logged.length).toBe(1);

        const loggedLine = JSON.parse(logged[0]) as unknown as Record<
            string,
            unknown
        >;
        console.info(loggedLine);

        if (expected.stack) {
            const stack = loggedLine.stack;
            delete loggedLine.stack;
            delete expected.stack;

            expect(stack).toBeDefined();
        }

        expect(loggedLine).toEqual(expected);
    }

    test("default values", () => {
        assertLog({}, LOG_LINE, {
            method: LOG_LINE.method,
            message: LOG_LINE.message,
            level: "INFO",
        });
    });

    test("set lambdaName", () => {
        const LAMBDA_NAME = "test_lambda_name";

        assertLog({ lambdaName: LAMBDA_NAME }, LOG_LINE, {
            lambdaName: LAMBDA_NAME,
            method: LOG_LINE.method,
            message: LOG_LINE.message,
            level: "INFO",
        });
    });

    test("set fileName", () => {
        const FILE_NAME = "test_file_name";

        assertLog({ fileName: FILE_NAME }, LOG_LINE, {
            fileName: FILE_NAME,
            method: LOG_LINE.method,
            message: LOG_LINE.message,
            level: "INFO",
        });
    });

    test("set runtime", () => {
        const RUNTIME = "test_runtime";

        assertLog({ runTime: RUNTIME }, LOG_LINE, {
            message: LOG_LINE.message,
            method: LOG_LINE.method,
            level: "INFO",
            runtime: RUNTIME,
        });
    });

    test("debug - string", () => {
        const DEBUG_STRING = "debug string";

        assertDebug({}, DEBUG_STRING, {
            message: DEBUG_STRING,
            level: "DEBUG",
        });
    });

    test("debug - json", () => {
        const DEBUG_JSON = {
            debug: "debug",
            thing: 42,
        };

        assertDebug({}, DEBUG_JSON, {
            message: {
                debug: "debug",
                thing: 42,
            },
            level: "DEBUG",
        });
    });
});
