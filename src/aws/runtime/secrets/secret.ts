import { SecretsManager } from "aws-sdk";

const smClient = new SecretsManager({
    region: process.env.AWS_REGION,
});

export type GenericSecret = Record<string, string>;

export async function getSecret<Secret>(
    secretId: string,
    prefix = ""
): Promise<Secret> {
    const secretObj = await smClient
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
            parsed[key.substring(skip)] = secret[key];
        }
    }

    return parsed as unknown as Secret;
}
