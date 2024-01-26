import { SecretsManager } from "aws-sdk";
import { getEnvVariable, getEnvVariableOrElse } from "../../../utils/utils.mjs";
import { EnvKeys } from "../environment.mjs";

// SECRET_OVERRIDE_AWS_REGION might not have been set before import of
// secret, so we need to lazy initialize SecretsManager
let smClient: SecretsManager | undefined;
function getSmClient(): SecretsManager {
    if (!smClient) {
        smClient = new SecretsManager({
            region: getEnvVariableOrElse<string>(
                EnvKeys.SECRET_OVERRIDE_AWS_REGION, // this is override secret region
                getEnvVariable(EnvKeys.AWS_REGION)
            ),
        });
    }
    return smClient;
}

export type GenericSecret = Record<string, string>;

export async function getSecret<Secret>(
    secretId: string,
    prefix = ""
): Promise<Secret> {
    const secretObj = await getSmClient()
        .getSecretValue({
            SecretId: secretId,
        })
        .promise();

    if (!secretObj.SecretString) {
        throw new Error("No secret found!");
    }

    const secret: GenericSecret | Secret = JSON.parse(
        secretObj.SecretString
    ) as unknown as GenericSecret | Secret;

    if (!prefix) {
        return secret as Secret;
    }

    return parseSecret(secret as GenericSecret, `${prefix}.`);
}

function parseSecret<Secret>(secret: GenericSecret, prefix: string): Secret {
    const parsed: GenericSecret = {};
    const skip = prefix.length;

    for (const key in secret) {
        if (key.startsWith(prefix)) {
            const withoutPrefix:string = key.substring(skip);
            parsed[withoutPrefix] = secret[key] as string;
        }
    }

    return parsed as unknown as Secret;
}
