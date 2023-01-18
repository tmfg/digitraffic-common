/**
 * Check if arrays have only elements that also exists also in other array.
 * Individual element count doesn't matter.
 * Function works only for primitive types and for other it just checks the reference to object.
 *
 * Some examples
 * bothArraysHasSameValues( [a, b], [b, a] )    => true
 * bothArraysHasSameValues( [a, a], [a, a, a] ) => true
 * bothArraysHasSameValues( [a, b], [a] )       => false
 *
 * Object references:
 * const o1 = { a: 1, b: 2};
 * const o2 = { a: 1, b: 2};
 * // Arrays has references to same objects
 * bothArraysHasSameValues([o1], [o1]))         => true
 * Arrays have references to different objects
 * bothArraysHasSameValues([o1], [o2]))         => false
 *
 * @param a first array to compare
 * @param b second array to compare
 */
import { Either } from "../types/either";

export function bothArraysHasSameValues(
    a: null | undefined | unknown[],
    b: null | undefined | unknown[]
): boolean {
    if ((a && !b) || (!a && b)) {
        return false;
    } else if (!a && !b) {
        return true;
    }
    const aSet = new Set(a);
    const bSet = new Set(b);
    if (aSet.size !== bSet.size) {
        return false;
    }
    return Array.from(aSet).every((value) => bSet.has(value));
}

/**
 * Returns the last item on the array.  If the array is empty, throws an error!
 */
export function getLast<T>(array: T[], sortFunction?: (a: T) => number): T {
    return getFirstOrLast(false, array, sortFunction);
}

/**
 * Returns the first item on the array.  If the array is empty, throws an error!
 */
export function getFirst<T>(array: T[], sortFunction?: (a: T) => number): T {
    return getFirstOrLast(true, array, sortFunction);
}

function getFirstOrLast<T>(
    getFirst: boolean,
    array: T[],
    sortFunction?: (a: T) => number
): T {
    if (array.length == 0) {
        throw new Error(
            `can't get ${getFirst ? "first" : "last"} from empty array!`
        );
    }

    const index = getFirst ? 0 : array.length - 1;

    if (sortFunction) {
        return array.sort(sortFunction)[index];
    }

    return array[index];
}

/**
 * Gets environment variable. Throws error if variable is not found.
 *
 * @param key Environment key
 * @return string
 */
export function getEnvVariable(key: string): string {
    const either = getEnvVariableSafe(key);
    if (either.result === "error") {
        throw new Error(either.message);
    }
    return either.value;
}

/**
 * Gets environment variable. Safe version returns object with either ok or error status.
 * Easier to use for recovery than catching an error.
 *
 * @param key Environment key
 * @return Either<string>
 */
export function getEnvVariableSafe(key: string): Either<string> {
    const value = process.env[key];
    if (value === undefined) {
        return {
            result: "error",
            message: `Error: environment variable "${key}" is undefined.`,
        };
    }
    return { result: "ok", value };
}

/**
 * Gets environment variable. If environment variable is undefined, returns value of given function.
 *
 * @param key Environment key
 * @param fn Alternative function
 */
export function getEnvVariableOr<T>(key: string, fn: () => T): string | T {
    const either = getEnvVariableSafe(key);
    if (either.result === "ok") {
        return either.value;
    }
    return fn();
}

/**
 * Gets environment variable. If environment variable is undefined, returns given value.
 * Use to return an explicit alternative value e.g. in cases where environment variable may be undefined.
 *
 * @param key Environment key
 * @param orElse Alternative value
 */
export function getEnvVariableOrElse<T>(key: string, orElse: T): string | T {
    return getEnvVariableOr(key, () => orElse);
}
