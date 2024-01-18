module.exports = {
    roots: [
        '<rootDir>/test',
    ],
    testMatch: [
        '**/*.test.ts',
    ],
    testResultsProcessor: 'jest-junit',
    preset: 'ts-jest',
    coverageThreshold: {
        global: {
            lines: 60,
        },
    },
    transform: {
        "\\.[jt]sx?$": "ts-jest",
    },
    "globals": {
        "ts-jest": {
            "useESM": true
        }
    },
    moduleNameMapper: {
        "(.+)\\.js": "$1"
    },
    extensionsToTreatAsEsm: [".ts"],
}
