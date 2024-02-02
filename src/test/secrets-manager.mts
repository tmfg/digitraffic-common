import { type GetSecretValueCommandOutput, SecretsManager } from "@aws-sdk/client-secrets-manager";
import sinon from "sinon";
import { EnvKeys } from "../aws/runtime/environment.mjs";
import { setEnvVariable } from "../utils/utils.mjs";
import { jest } from '@jest/globals';


setEnvVariable(EnvKeys.AWS_REGION, "eu-west-1");

const emptySecret: GetSecretValueCommandOutput = { $metadata: {} };
const SecretsManagerStubInstance = sinon.createStubInstance(SecretsManager);
SecretsManagerStubInstance.getSecretValue.resolves(emptySecret);

/**
 * Stub Secrets Manager for tests.  You must call this
 * before you instantiate Secrets Manager(this might happen when you import the function that uses Secrets Manager).
 *
 * To mock the actual secret, call mockSecret()
 */
export function stubSecretsManager(): any {
    jest.unstable_mockModule("@aws-sdk/client-secrets-manager", async function () {
        return {
            SecretsManager: sinon.stub().returns(SecretsManagerStubInstance)
        };
    });

    return SecretsManagerStubInstance.getSecretValue;
}

export function mockSecret<Secret>(secret: Secret) {
    if (!secret) {
        SecretsManagerStubInstance.getSecretValue.resolves({ ...emptySecret });
    } else {
        SecretsManagerStubInstance.getSecretValue.resolves({ SecretString: JSON.stringify(secret) });
    }
}
