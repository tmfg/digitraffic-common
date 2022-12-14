import {
    Architecture,
    AssetCode,
    Code,
    FunctionProps,
    Runtime,
} from "aws-cdk-lib/aws-lambda";
import { Duration } from "aws-cdk-lib";
import { ISecurityGroup, IVpc, SubnetSelection } from "aws-cdk-lib/aws-ec2";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Role } from "aws-cdk-lib/aws-iam";
import { DigitrafficStack } from "./stack";
import { MonitoredFunctionAlarmProps } from "./monitoredfunction";

export type LambdaEnvironment = Record<string, string>;

export type DBLambdaEnvironment = LambdaEnvironment & {
    SECRET_ID?: string;
    DB_APPLICATION: string;
};

export interface LambdaConfiguration {
    vpcId: string;
    allowFromIpAddresses?: string[];
    privateSubnetIds: string[];
    availabilityZones: string[];
    lambdaDbSgId: string;
    dbProps?: DbProps;
    defaultLambdaDurationSeconds?: number;
    logsDestinationArn: string;
    memorySize?: number;
    runtime?: Runtime;
}

declare interface DbProps {
    username: string;
    password: string;
    uri?: string;
    ro_uri?: string;
}

export function databaseFunctionProps(
    stack: DigitrafficStack,
    environment: LambdaEnvironment,
    lambdaName: string,
    simpleLambdaName: string,
    config?: Partial<FunctionParameters>
): FunctionProps {
    const vpcSubnets = stack.vpc
        ? {
              subnets: stack.vpc.privateSubnets,
          }
        : undefined;

    return {
        ...lambdaFunctionProps(
            stack,
            environment,
            lambdaName,
            simpleLambdaName,
            config
        ),
        ...{
            vpc: stack.vpc || undefined,
            vpcSubnets,
            securityGroup: stack.lambdaDbSg || undefined,
        },
    };
}

export function lambdaFunctionProps(
    stack: DigitrafficStack,
    environment: LambdaEnvironment,
    lambdaName: string,
    simpleLambdaName: string,
    config?: Partial<FunctionParameters>
): FunctionProps {
    return {
        runtime: config?.runtime ?? Runtime.NODEJS_16_X,
        architecture: config?.architecture ?? Architecture.ARM_64,
        memorySize: config?.memorySize ?? 128,
        functionName: lambdaName,
        role: config?.role,
        timeout: Duration.seconds(config?.timeout ?? 60),
        logRetention: RetentionDays.ONE_YEAR,
        reservedConcurrentExecutions: config?.reservedConcurrentExecutions ?? 2,
        code: getAssetCode(simpleLambdaName, config?.singleLambda ?? false),
        handler: `${simpleLambdaName}.handler`,
        environment,
    };
}

function getAssetCode(
    simpleLambdaName: string,
    isSingleLambda: boolean
): AssetCode {
    const lambdaPath = isSingleLambda
        ? `dist/lambda/`
        : `dist/lambda/${simpleLambdaName}`;

    return new AssetCode(lambdaPath);
}

/**
 * Creates a base configuration for a Lambda that uses an RDS database
 * @param vpc "Private" Lambdas are associated with a VPC
 * @param lambdaDbSg Security Group shared by Lambda and RDS
 * @param props Database connection properties for the Lambda
 * @param config Lambda configuration
 */
export function dbLambdaConfiguration(
    vpc: IVpc,
    lambdaDbSg: ISecurityGroup,
    props: LambdaConfiguration,
    config: FunctionParameters
): FunctionProps {
    return {
        runtime: props.runtime ?? Runtime.NODEJS_16_X,
        memorySize: props.memorySize ?? config.memorySize ?? 1024,
        functionName: config.functionName,
        code: config.code,
        role: config.role,
        handler: config.handler,
        timeout: Duration.seconds(
            config.timeout ?? props.defaultLambdaDurationSeconds ?? 60
        ),
        environment: config.environment ?? {
            DB_USER: props.dbProps?.username ?? "",
            DB_PASS: props.dbProps?.password ?? "",
            DB_URI:
                (config.readOnly
                    ? props.dbProps?.ro_uri
                    : props.dbProps?.uri) ?? "",
        },
        logRetention: RetentionDays.ONE_YEAR,
        vpc: vpc,
        vpcSubnets: {
            subnets: vpc.privateSubnets,
        },
        securityGroups: [lambdaDbSg],
        reservedConcurrentExecutions: config.reservedConcurrentExecutions ?? 3,
    };
}

export function defaultLambdaConfiguration(
    config: FunctionParameters
): FunctionProps {
    const props: FunctionProps = {
        runtime: Runtime.NODEJS_16_X,
        memorySize: config.memorySize ?? 128,
        functionName: config.functionName,
        handler: config.handler,
        environment: config.environment ?? {},
        logRetention: RetentionDays.ONE_YEAR,
        reservedConcurrentExecutions: config.reservedConcurrentExecutions,
        code: config.code,
        role: config.role,
        timeout: Duration.seconds(config.timeout || 10),
    };
    if (config.vpc) {
        return {
            ...props,
            ...{
                vpc: config.vpc,
                vpcSubnets: {
                    subnets: config.vpc?.privateSubnets,
                },
            },
        };
    }
    return props;
}

export interface FunctionParameters {
    memorySize?: number;
    timeout?: number;
    functionName?: string;
    code: Code;
    handler: string;
    readOnly?: boolean;
    environment?: {
        [key: string]: string;
    };
    reservedConcurrentExecutions?: number;
    role?: Role;
    vpc?: IVpc;
    vpcSubnets?: SubnetSelection;
    runtime?: Runtime;
    architecture?: Architecture;
    singleLambda?: boolean;
}

export type MonitoredFunctionParameters = FunctionParameters & {
    readonly durationAlarmProps?: MonitoredFunctionAlarmProps;
    readonly durationWarningProps?: MonitoredFunctionAlarmProps;
    readonly errorAlarmProps?: MonitoredFunctionAlarmProps;
    readonly throttleAlarmProps?: MonitoredFunctionAlarmProps;
};
