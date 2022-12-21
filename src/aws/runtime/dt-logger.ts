import { Writable } from "stream";

type LOG_LEVEL = "DEBUG" | "INFO" | "ERROR";

export interface LoggerConfiguration {
    lambdaName?: string;
    fileName?: string;
    runTime?: string;
    writeStream?: Writable;
}

export type LoggableType = string | number | Record<string, unknown>;

/**
 * Helper class for json-logging.  Logged line will include
 * * log-level (see LOG_LEVEL)
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

    info(message: LoggableType) {
        this.log("INFO", message);
    }

    error(message: LoggableType) {
        this.log("ERROR", message);
    }

    log(level: LOG_LEVEL, message: LoggableType) {
        // put string/number messages into message object
        const actualMessage =
            typeof message == "object" ? message : { message: message };

        const logMessage = {
            ...actualMessage,
            ...{
                level,
                fileName: this.fileName,
                lambdaName: this.lambdaName,
                runtime: this.runtime,
            },
        };

        this.writeStream.write(JSON.stringify(logMessage) + "\n");
    }
}
