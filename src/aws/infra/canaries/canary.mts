import { Duration } from "aws-cdk-lib";
import {
    AssetCode,
    Canary,
    Runtime,
    Schedule,
    Test,
} from "aws-cdk-lib/aws-synthetics";
import { Role } from "aws-cdk-lib/aws-iam";
import { CanaryAlarm } from "./canary-alarm.mjs";
import { CanaryParameters } from "./canary-parameters.mjs";
import { Construct } from "constructs";
import { LambdaEnvironment } from "../stack/lambda-configs.mjs";

export class DigitrafficCanary extends Canary {
    constructor(
        scope: Construct,
        canaryName: string,
        role: Role,
        params: CanaryParameters,
        environmentVariables: LambdaEnvironment
    ) {
        super(scope, canaryName, {
            runtime: Runtime.SYNTHETICS_NODEJS_PUPPETEER_4_0,
            role,
            test: Test.custom({
                code: new AssetCode("dist", {
                    exclude: ["lambda", "out", "canaries"],
                }),
                handler: params.handler,
            }),
            environmentVariables: {
                ...environmentVariables,
                ...params.canaryEnv,
            },
            canaryName,
            schedule: params.schedule ?? Schedule.rate(Duration.minutes(15)),
        });

        this.artifactsBucket.grantWrite(role);

        new CanaryAlarm(scope, this, params);
    }
}
