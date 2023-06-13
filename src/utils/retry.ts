import { HttpError } from "../types/http-error";

export enum RetryLogError {
    LOG_ALL_AS_ERRORS,
    LOG_LAST_RETRY_AS_ERROR_OTHERS_AS_WARNS,
    NO_LOGGING,
}

type TimeoutFn = (retryCount: number) => number;
type RetryPredicate = (error: unknown) => boolean;

function noTimeout(retryCount: number): number {
    return 0;
}

function exponentialTimeout(retryCount: number): number {
    return 2 ** retryCount;
}

function alwaysRetry(error: unknown): boolean {
    return true;
}

// Tämä muuttuja on testejä varten määritelty täällä.
export let retryCount = 0;

/**
 * Utility function for retrying async functions.
 * @param asyncFn Function
 * @param retries Amount of retries, default is 3. If set to <= 0, no retries will be done. Using non-finite numbers will throw an error. The maximum allowed retry count is 100.
 * @param logError Logging options
 * @param timeoutBetweenRetries A function that returns the timeout between retries in milliseconds. Default is a function returning 0. The function is called with the current retry count.
 * @param retryPredicate A function that returns true if the error should be retried. Default is a function that always returns true. The function is called with the error object.
 * @return Promise return value
 */
export async function retry<T>(
    asyncFn: () => Promise<T>,
    retries = 3,
    logError = RetryLogError.LOG_LAST_RETRY_AS_ERROR_OTHERS_AS_WARNS,
    timeoutBetweenRetries: TimeoutFn = noTimeout,
    retryPredicate: RetryPredicate = alwaysRetry
): Promise<T> {
    retryCount = 0;

    if (!isFinite(retries)) {
        throw new Error("Only finite numbers are supported");
    }
    if (retries > 100) {
        throw new Error("Exceeded the maximum retry count of 100");
    }
    try {
        return await asyncFn();
    } catch (error) {
        const remainingRetries = retries - 1;

        const errorMessage = "method=retry error";
        if (logError === RetryLogError.LOG_ALL_AS_ERRORS) {
            console.error(errorMessage, error);
        } else if (
            logError === RetryLogError.LOG_LAST_RETRY_AS_ERROR_OTHERS_AS_WARNS
        ) {
            if (remainingRetries < 0) {
                console.error(errorMessage, error);
            } else {
                console.warn(errorMessage, error);
            }
        }

        if (remainingRetries < 0) {
            console.warn("method=retry no retries left");
            throw new Error("No retries left");
        }
        console.warn(
            "method=retry invocation failed, retrying with remaining retries %d",
            remainingRetries
        );
        if (retryPredicate(error)) {
            retryCount++;
            const milliseconds = timeoutBetweenRetries(retryCount);
            if (milliseconds > 0) {
                await new Promise((resolve) =>
                    setTimeout(resolve, milliseconds)
                );
            }
            return retry(asyncFn, remainingRetries, logError);
        } else {
            throw new Error("Retry predicate failed");
        }
    }
}

const retryStatusCodes = new Set([
    // 403 näyttää tulevan aina sillon tällön ilman mitään ilmeistä syytä
    403,
    // Opensearch ainakin huutaa 429, jos tekee liian monta kyselyä liian nopeasti
    429,
]);

function retryBasedOnStatusCode(error: unknown): boolean {
    if (error instanceof HttpError) {
        return retryStatusCodes.has(error.statusCode);
    }
    return false;
}

function wrapArgsToFn<T>(
    fn: (...args: unknown[]) => Promise<T>,
    ...args: unknown[]
): () => Promise<T> {
    return () => fn(...args);
}

export async function retryRequest<T>(
    request: (...args: unknown[]) => Promise<T>,
    ...args: unknown[]
): Promise<T> {
    const asyncFn = wrapArgsToFn(request, ...args);
    return retry(
        asyncFn,
        5,
        RetryLogError.LOG_LAST_RETRY_AS_ERROR_OTHERS_AS_WARNS,
        exponentialTimeout,
        retryBasedOnStatusCode
    );
}
