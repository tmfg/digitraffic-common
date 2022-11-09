import { Environment } from "aws-cdk-lib";

export interface InfraStackConfiguration {
    readonly env: Environment;
    readonly environmentName: string;
}
