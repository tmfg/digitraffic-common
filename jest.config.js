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
            lines: 70,
        },
    },
}
