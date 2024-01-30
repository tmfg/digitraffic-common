import { mockSecret, stubSecretsManager } from "../../test/secrets-manager.mjs";

import sinon from "sinon";

const SECRET_WITH_PREFIX = {
    "prefix.value": "value",
    "prefix.name": "name",
    "wrong.value": "value",
    username: "DB_USER",
};
const SECRET_EMPTY = {}


const stubSM = stubSecretsManager();

const secretHolder = await import("../../aws/runtime/secrets/secret-holder.mjs");
const database = await import("../../database/database.mjs");
const { SecretHolder } = secretHolder;
const { DatabaseEnvironmentKeys } = database;

describe("SecretHolder - tests", () => {
    beforeEach(() => {
        process.env['SECRET_ID'] = "test-id";
    });

    afterEach(() => {
        sinon.restore();
        sinon.reset();
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete process.env[DatabaseEnvironmentKeys.DB_USER];
    });

    test("get - no secret", () => {
        mockSecret(null);

        const holder = SecretHolder.create();
        const secret = holder.get();
        return expect(secret).rejects.toThrowError("No secret found!");
    }, 10000);

    test("get - empty secret", () => {
        mockSecret(SECRET_EMPTY);

        const holder = SecretHolder.create();
        const secret = holder.get();

        return expect(secret).resolves.toEqual(SECRET_EMPTY);
    });

    test("get - no prefix", () => {
        mockSecret(SECRET_WITH_PREFIX);

        const holder = SecretHolder.create();
        const secret = holder.get();

        return expect(secret).resolves.toEqual(SECRET_WITH_PREFIX);
    });

    test("get - check keys - not found", () => {
        mockSecret(SECRET_WITH_PREFIX);

        const holder = SecretHolder.create("", ["not_found"]);
        const secret = holder.get();

        return expect(secret).rejects.toThrow();
    });

    test("get - check keys - found", () => {
        mockSecret(SECRET_WITH_PREFIX);

        const holder = SecretHolder.create("", ["prefix.value", "username"]);

        return expect(holder.get()).resolves.toBeDefined();
    });

    test("getSecret - with prefix", () => {
        mockSecret(SECRET_WITH_PREFIX);

        const holder = SecretHolder.create("prefix");
        const secret = holder.get();

        return expect(secret).resolves.toEqual({
            value: "value",
            name: "name",
        });
    });

    test("get - ttl - do not fetch", async () => {
        mockSecret(SECRET_WITH_PREFIX);

        const holder = SecretHolder.create();

        const callCount = stubSM.callCount;

        await holder.get();
        expect(stubSM.callCount).toEqual(callCount + 1);

        // gets cached secret
        await holder.get();
        expect(stubSM.callCount).toEqual(callCount + 1);
    });

    test("get - ttl - fetch", async () => {
        mockSecret(SECRET_WITH_PREFIX);

        const holder = new SecretHolder("", "", [], {
            ttl: 1,
        });

        const callCount = stubSM.callCount;

        await holder.get();
        expect(stubSM.callCount).toEqual(callCount + 1);

        // cache expires, fetches secret again
        const start = Date.now();
        while (Date.now() < start + 2000);

        await holder.get();
        expect(stubSM.callCount).toEqual(callCount + 2);
    });
});