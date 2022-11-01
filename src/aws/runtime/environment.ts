export function envValue(key: string, defaultValue?: string): string {
    const value = process.env[key];

    if (value == null) {
        if (defaultValue) {
            return defaultValue;
        }

        throw new Error(`Missing environment value ${key}`);
    }

    return value;
}
