import { HandlerFactory } from "../../src/aws/infra/api/handler-factory";
import {
    ErrorHandler,
    LoggingHandler,
} from "../../src/aws/infra/api/handler-factory";
import { DtLogger } from "../../src/aws/runtime/dt-logger";
import { LambdaResponse } from "../../src/aws/types/lambda-response";

const logger = new DtLogger();

describe("handler-factory tests", () => {
    test("test defaults", async () => {
        const factory = new HandlerFactory();
        const method = jest.fn();
        const handler = factory.createEventHandler(method, logger);

        await handler({});

        expect(method).toBeCalledTimes(1);
    });

    test("test logging", async () => {
        const loggingHandler: LoggingHandler = jest.fn(
            (method: () => Promise<LambdaResponse>) => {
                return method();
            }
        );
        const factory = new HandlerFactory().withLoggingHandler(loggingHandler);
        const method = jest.fn();
        const handler = factory.createEventHandler(method, logger);

        await handler({});

        expect(method).toBeCalledTimes(1);
        expect(loggingHandler).toBeCalledTimes(1);
    });

    test("test error handling", async () => {
        const eh: ErrorHandler = jest.fn();
        const factory = new HandlerFactory().withErrorHandler(eh);
        const method = jest.fn(() => {
            throw new Error("MAGIC");
        });
        const handler = factory.createEventHandler(method, logger);

        await handler({});

        expect(method).toBeCalledTimes(1);
        expect(eh).toBeCalledTimes(1);
    });
});
