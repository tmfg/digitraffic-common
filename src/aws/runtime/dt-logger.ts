type LOG_LEVEL = "DEBUG" | "INFO" | "ERROR";

/**
 * Helper class for json-logging.  Logged line will include
 * * log-level (see LOG_LEVEL)
 * * lambdaName (taken from process environment)
 * * runtime (taken from process environment)
 * * the actual message (as json or as string)
 */
export class DtLogger {
    static info<T>(message: T) {
        this.log("INFO", message);
    }

    static error<T>(message: T) {
        this.log("ERROR", message);
    }

    static log<T>(level: LOG_LEVEL, message: T) {
        const actualMessage =
            typeof message === "string" ? { message } : message;

        const logMessage = {
            ...actualMessage,
            ...{
                level,
                lambdaName: process.env.AWS_LAMBDA_FUNCTION_NAME ?? "",
                runtime: process.env.AWS_EXECUTION_ENV ?? "",
            },
        };

        process.stdout.write(JSON.stringify(logMessage) + "\n");
    }
}
