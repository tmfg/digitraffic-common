import { Writable } from "stream";

type LOG_LEVEL = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LoggerConfiguration {
    lambdaName?: string;
    fileName?: string;
    runTime?: string;
    writeStream?: Writable;
}

export interface LoggableType {
    /** name of method logging the message */
    method: `${string}.${string}`;
    /** message to log, optional */
    message?: string;
    /** type of message, optional */
    type?: string;
    /** stack trace, optional */
    stack?: string;
    /** amount of time some operation took in milliseconds, optional */
    tookMs?: number;
    /** count of something, optional */
    count?: number;
    /** do not log your apikey! */
    apikey?: never;
    /** do not log your apikey! */
    apiKey?: never;
    /** any other loggable key */
    [key: string]: string | number | boolean | Date | undefined;
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
    readonly fileName?: string;
    readonly runtime?: string;

    readonly writeStream: Writable;

    constructor(config?: LoggerConfiguration) {
        this.lambdaName =
            config?.lambdaName ?? process.env.AWS_LAMBDA_FUNCTION_NAME;
        this.fileName = config?.fileName;
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
            fileName: this.fileName,
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
        this.log("INFO", message);
    }

    /**
     * Log given message with level WARN
     *
     * @param message Json-object to log
     * @see log
     */
    warn(message: LoggableType): void {
        this.log("WARN", message);
    }
    /**
     * Log given message with level INFO
     *
     * @param message Json-object to log
     * @see log
     */
    error(message: LoggableType): void {
        this.log("ERROR", message);
    }

    /**
     * Log message with given log level.  If message is a json object, it will be logged as it is and if it is a string it will be wrapped into json-element with key "message".
     * Some metadata is also added to the message:
     * * runtime     - can be configured with constructor or inferred from environment
     * * lambdaName  - can be configured with constructor or inferred from environment
     * * fileName    - can be configured with constructor
     *
     * @param level "DEBUG", "INFO" or "ERROR"
     * @param message Either a string or json-object
     */
    log(level: LOG_LEVEL, message: LoggableType): void {
        const logMessage = {
            ...message,
            level,
            fileName: message.fileName ?? this.fileName,
            lambdaName: this.lambdaName,
            runtime: this.runtime,
        };

        this.writeStream.write(JSON.stringify(logMessage) + "\n");
    }
}
