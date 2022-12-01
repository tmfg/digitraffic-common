import { HandlerFactory } from "../../src/aws/infra/api/handler-factory";
import {
    ErrorHandler,
    LoggingHandler,
} from "../../dist/aws/infra/api/handler-factory";

describe("handler-factory tests", () => {
    test("test defaults", async () => {
        const factory = new HandlerFactory();
        const method = jest.fn();
        const handler = factory.createEventHandler("test", method);

        await handler({});

        expect(method).toBeCalledTimes(1);
    });

    test("test logging", async () => {
        const logger: LoggingHandler<string> = jest.fn(
            (name: string, method: () => Promise<string>) => {
                return method();
            }
        );
        const factory = new HandlerFactory<string>().withLoggingHandler(logger);
        const method = jest.fn();
        const handler = factory.createEventHandler("test", method);

        await handler({});

        expect(method).toBeCalledTimes(1);
        expect(logger).toBeCalledTimes(1);
    });

    test("test error handling", async () => {
        const eh: ErrorHandler<string> = jest.fn();
        const factory = new HandlerFactory().withErrorHandler(eh);
        const method = jest.fn(() => {
            throw new Error("MAGIC");
        });
        const handler = factory.createEventHandler("test", method);

        await handler({});

        expect(method).toBeCalledTimes(1);
        expect(eh).toBeCalledTimes(1);
    });
});
