import { SecretHolder } from "./secret-holder";
import { DatabaseEnvironmentKeys, RdsSecret, RdsSecretKey } from "./dbsecret";
import { getEnvVariable } from "../../../utils/utils";

const RDS_SECRET_KEYS = Object.values(RdsSecretKey);

/**
 * Holds credentials for RDS access.
 */
export class RdsHolder {
    private readonly secretHolder;

    constructor(secretId: string) {
        this.secretHolder = new SecretHolder<RdsSecret>(
            secretId,
            "",
            RDS_SECRET_KEYS
        );
    }

    static create() {
        return new RdsHolder(getEnvVariable("SECRET_ID"));
    }

    public async setCredentials() {
        const secret = await this.secretHolder.get();

        process.env[DatabaseEnvironmentKeys.DB_USER] = secret.username;
        process.env[DatabaseEnvironmentKeys.DB_PASS] = secret.password;
        process.env[DatabaseEnvironmentKeys.DB_URI] = secret.host;
        process.env[DatabaseEnvironmentKeys.DB_RO_URI] = secret.ro_host;
    }
}
