import { Writable } from "stream";
import _ from "lodash";

export type LOG_LEVEL = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LoggerConfiguration {
    lambdaName?: string;
    fileName?: string;
    runTime?: string;
    writeStream?: Writable;
}

interface LoggableTypeInternal extends LoggableType {
    level: LOG_LEVEL;
}

export interface CustomParams {
    /** do not log your apikey! */
    customApikey?: never;
    /** do not log your apikey! */
    customApiKey?: never;
    [key: `custom${Capitalize<string>}Count`]: number;

    [key: `custom${Capitalize<string>}`]:
        | string
        | number
        | boolean
        | Date
        | null
        | undefined;
}

export interface LoggableType extends CustomParams {
    /** name of method logging the message */
    method: `${string}.${string}`;
    /** message to log, optional */
    message?: string;
    /** type of message, optional */
    type?: string;
    /** stack trace, optional */
    stack?: string | undefined;
    /** amount of time some operation took in milliseconds, optional */
    tookMs?: number;
    /** count of something, optional */
    count?: number;
    /** Pass error object, which will be stringified before logging */
    error?: unknown;
}

/**
 * Helper class for json-logging.  Logged line will include
 * * log-level
 * * lambdaName (taken from process environment)
 * * runtime (taken from process environment)
 * * the actual message (as json or as string)
 */
export class DtLogger {
    readonly lambdaName?: string;
    readonly runtime?: string;

    readonly writeStream: Writable;

    constructor(config?: LoggerConfiguration) {
        this.lambdaName =
            config?.lambdaName ?? process.env.AWS_LAMBDA_FUNCTION_NAME;
        this.runtime = config?.runTime ?? process.env.AWS_EXECUTION_ENV;
        this.writeStream = config?.writeStream ?? process.stdout;
    }

    /**
     * Log given message with level DEBUG.  This will not be forwarded to centralized logging system!.
     *
     * @param message anything
     * @see log
     */
    debug(message: unknown): void {
        const logMessage = {
            message,
            level: "DEBUG",
            lambdaName: this.lambdaName,
            runtime: this.runtime,
        };

        this.writeStream.write(JSON.stringify(logMessage) + "\n");
    }

    /**
     * Log given message with level INFO
     *
     * @param message Json-object to log
     * @see log
     */
    info(message: LoggableType): void {
        this.log({ ...message, level: "INFO" });
    }

    /**
     * Log given message with level WARN
     *
     * @param message Json-object to log
     * @see log
     */
    warn(message: LoggableType): void {
        this.log({ ...message, level: "WARN" });
    }
    /**
     * Log given message with level INFO
     *
     * @param message Json-object to log
     * @see log
     */
    error(message: LoggableType): void {
        this.log({
            ...message,
            level: "ERROR",
        });
    }

    /**
     * Log message with given log level.  If message is a json object, it will be logged as it is and if it is a string it will be wrapped into json-element with key "message".
     * Some metadata is also added to the message:
     * * runtime     - can be configured with constructor or inferred from environment
     * * lambdaName  - can be configured with constructor or inferred from environment
     *
     * @param level "DEBUG", "INFO" or "ERROR"
     * @param message Json-object to log
     */
    private log(message: LoggableTypeInternal): void {
        const error = message.error
            ? typeof message.error === "string"
                ? message.error
                : JSON.stringify(message.error)
            : undefined;

        const logMessage = {
            ...removePrefix("custom", message),
            error,
            lambdaName: this.lambdaName,
            runtime: this.runtime,
        };

        this.writeStream.write(JSON.stringify(logMessage) + "\n");
    }
}

function removePrefix(prefix: string, loggable: LoggableType) {
    return _.mapKeys(loggable, (_index, key: string) =>
        key.startsWith(prefix) ? _.lowerFirst(key.replace(prefix, "")) : key
    );
}
