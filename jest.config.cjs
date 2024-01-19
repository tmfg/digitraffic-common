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
        "\\.[jt]s?$": ["ts-jest", {
            useESM: true,
            tsconfig: "<rootDir>/tsconfig.test.json"
        }],
    },
    moduleNameMapper: {
        "(.+)\\.js": "$1"
    },
    extensionsToTreatAsEsm: [".ts"]
}
