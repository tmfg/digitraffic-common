import { GenericSecret, getSecret } from "./secret";
import { checkExpectedSecretKeys } from "./dbsecret";
import { getEnvVariable } from "../../../utils/utils";

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
const NodeTtl = require("node-ttl");

const DEFAULT_PREFIX = "";
const DEFAULT_SECRET_KEY = "SECRET";
const DEFAULT_CONFIGURATION = {
    ttl: 5 * 60, // timeout secrets in 5 minutes
};

/**
 * Utility class for getting secrets from Secret Manager.
 * Supports prefix for secrets, checking of expected keys and ttl-configuration.
 *
 * By default, secrets are cached for 5 minutes and then reread from the Secrets Manager(This can be overridden with configuration).
 *
 * Supports setting the database environment paramaters from the secret too.
 */
export class SecretHolder<Secret extends GenericSecret> {
    private readonly secretId: string;
    private readonly prefix: string;
    private readonly expectedKeys: string[];

    private readonly secretCache;

    constructor(
        secretId: string,
        prefix = "",
        expectedKeys: string[] = [],
        configuration = DEFAULT_CONFIGURATION
    ) {
        this.secretId = secretId;
        this.prefix = prefix;
        this.expectedKeys = expectedKeys;

        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        this.secretCache = new NodeTtl(configuration);
    }

    private async initSecret() {
        const secretValue = await getSecret<Secret>(this.secretId);

        console.info("refreshing secret " + this.secretId);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        this.secretCache.push(DEFAULT_SECRET_KEY, secretValue);
    }

    public static create<S extends GenericSecret>(
        prefix = DEFAULT_PREFIX,
        expectedKeys: string[] = []
    ) {
        return new SecretHolder<S>(
            getEnvVariable("SECRET_ID"),
            prefix,
            expectedKeys
        );
    }

    public async get(): Promise<Secret> {
        const secret = await this.getSecret<Secret>();
        const parsedSecret =
            this.prefix === DEFAULT_PREFIX
                ? secret
                : this.parseSecret(secret, `${this.prefix}.`);

        if (this.expectedKeys.length > 0) {
            checkExpectedSecretKeys(this.expectedKeys, parsedSecret);
        }

        return parsedSecret;
    }

    private parseSecret(secret: GenericSecret, prefix: string): Secret {
        const parsed: GenericSecret = {};
        const skip = prefix.length;

        for (const key in secret) {
            if (key.startsWith(prefix)) {
                parsed[key.substring(skip)] = secret[key];
            }
        }

        return parsed as unknown as Secret;
    }

    private async getSecret<S>(): Promise<S> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const secret: S | undefined = this.secretCache.get(DEFAULT_SECRET_KEY);

        if (!secret) {
            await this.initSecret();
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return secret ?? (this.secretCache.get(DEFAULT_SECRET_KEY) as S);
    }
}
