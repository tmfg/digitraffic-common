const AWS = await import("aws-sdk");
import * as sinon from "sinon";
import { EnvKeys } from "../aws/runtime/environment.mjs";
import { setEnvVariable } from "../utils/utils.mjs";

setEnvVariable(EnvKeys.AWS_REGION, "eu-west-1");
const secretValue = sinon.stub();

/**
 * Stub Secrets Manager for tests.  You must call this
 * before you instantiate Secrets Manager(this might happen when you import the function that uses Secrets Manager).
 *
 * To mock the actual secret, call mockSecret()
 */
export function stubSecretsManager() {
    const smStub = {
        getSecretValue: secretValue,
    };

    sinon.stub(AWS, "SecretsManager").returns(smStub);

    return smStub.getSecretValue;
}

export function mockSecret<Secret>(secret: Secret) {
    if (!secret) {
        secretValue.returns({
            promise: sinon.stub().returns({}),
        });
    } else {
        secretValue.returns({
            promise: sinon.stub().returns({
                SecretString: JSON.stringify(secret),
            }),
        });
    }
}
