import { Environment } from "aws-cdk-lib";

export interface InfraStackConfiguration {
    env: Environment;
    environmentName: string;
}
