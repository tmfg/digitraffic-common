const config = {
    roots: [
        '<rootDir>/test',
    ],
    testMatch: [
        "**/?(*.)+(spec|test).m[jt]s?(x)"
    ],
    testResultsProcessor: 'jest-junit',
    preset: 'ts-jest',
    coverageThreshold: {
        global: {
            lines: 60,
        },
    },
    transform: {
        "\\.m[jt]s?$": ["ts-jest", {
            useESM: true,
            tsconfig: "<rootDir>/tsconfig.test.json"
        }],
    },
    moduleNameMapper: {
        "(.+)\\.mjs": "$1"
    },
    extensionsToTreatAsEsm: [".mts"],
    moduleFileExtensions: ["js", "mts", "mjs"]
}

export default config;
