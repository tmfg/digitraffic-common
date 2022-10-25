export function envValue(key: string): string {
    const value = process.env[key];

    if (value == null) {
        throw new Error(`Missing environment value ${key}`);
    }

    return value;
}
