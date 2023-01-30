import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { IVpc, SecurityGroup, SubnetType } from "aws-cdk-lib/aws-ec2";
import {
    AuroraPostgresEngineVersion,
    CfnDBInstance,
    Credentials,
    DatabaseCluster,
    DatabaseClusterEngine,
    DatabaseClusterFromSnapshot,
    DatabaseClusterProps,
    InstanceUpdateBehaviour,
    IParameterGroup,
    ParameterGroup,
} from "aws-cdk-lib/aws-rds";
import { ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager";
import { exportValue, importVpc } from "../import-util";
import { InstanceType } from "aws-cdk-lib/aws-ec2";
import { InfraStackConfiguration } from "./intra-stack-configuration";
import { ISecurityGroup } from "aws-cdk-lib/aws-ec2/lib/security-group";

export interface DbConfiguration {
    readonly secretArn: string;

    readonly dbVersion: AuroraPostgresEngineVersion;
    readonly dbInstanceType: InstanceType;
    readonly snapshotIdentifier?: string;
    readonly instances: number;
    readonly customParameterGroup: boolean;
    readonly securityGroupId: string;

    readonly dbProxyName?: string;
}

/**
 * How to upgrade major version?
 * 0. Set correct SG for db-stack and db-proxy-stack(this step will be removed in the future)
 * 1. Update db-stack WITHOUT parameter group
 * 2. Upgrade extensions by hand
 * 3. Upgrade database from the AWS console
 * 4. Update db-stack with the upgraded version and custom parameter group
 */

export class DbStack extends Stack {
    public static CLUSTER_IDENTIFIER_EXPORT_NAME = "db-cluster";
    public static CLUSTER_READ_ENDPOINT_EXPORT_NAME =
        "db-cluster-reader-endpoint";
    public static CLUSTER_WRITE_ENDPOINT_EXPORT_NAME =
        "db-cluster-writer-endpoint";

    public static CLUSTER_PORT = 5432;

    constructor(
        scope: Construct,
        id: string,
        isc: InfraStackConfiguration,
        configuration: DbConfiguration
    ) {
        super(scope, id, {
            env: isc.env,
        });

        const cluster = this.createAuroraCluster(isc, configuration);

        exportValue(
            this,
            isc.environmentName,
            DbStack.CLUSTER_IDENTIFIER_EXPORT_NAME,
            cluster.clusterIdentifier
        );
        exportValue(
            this,
            isc.environmentName,
            DbStack.CLUSTER_WRITE_ENDPOINT_EXPORT_NAME,
            cluster.clusterEndpoint.hostname
        );
        exportValue(
            this,
            isc.environmentName,
            DbStack.CLUSTER_READ_ENDPOINT_EXPORT_NAME,
            cluster.clusterReadEndpoint.hostname
        );
    }

    createParamaterGroup(configuration: DbConfiguration) {
        return configuration.customParameterGroup
            ? new ParameterGroup(
                  this,
                  `parameter-group-${configuration.dbVersion.auroraPostgresMajorVersion}`,
                  {
                      engine: DatabaseClusterEngine.auroraPostgres({
                          version: configuration.dbVersion,
                      }),
                      parameters: {
                          "pg_stat_statements.track": "ALL",
                          random_page_cost: "1",
                          work_mem: "512MB",
                      },
                  }
              )
            : ParameterGroup.fromParameterGroupName(
                  this,
                  "ParameterGroup",
                  `default.aurora-postgresql${configuration.dbVersion.auroraPostgresMajorVersion}`
              );
    }

    createClusterParameters(
        configuration: DbConfiguration,
        instanceName: string,
        vpc: IVpc,
        securityGroup: ISecurityGroup,
        parameterGroup: IParameterGroup,
        secret: ISecret
    ): DatabaseClusterProps {
        return {
            engine: DatabaseClusterEngine.auroraPostgres({
                version: configuration.dbVersion,
            }),
            instances: configuration.instances,
            instanceUpdateBehaviour: InstanceUpdateBehaviour.ROLLING,
            instanceIdentifierBase: instanceName + "-",
            cloudwatchLogsExports: ["postgresql"],
            backup: {
                retention: Duration.days(35),
                preferredWindow: "01:00-02:00",
            },
            preferredMaintenanceWindow: "mon:03:00-mon:04:00",
            deletionProtection: true,
            removalPolicy: RemovalPolicy.RETAIN,
            port: DbStack.CLUSTER_PORT,
            instanceProps: {
                autoMinorVersionUpgrade: true,
                allowMajorVersionUpgrade: false,
                enablePerformanceInsights: true,
                vpc,
                securityGroups: [securityGroup],
                vpcSubnets: {
                    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                },
                instanceType: configuration.dbInstanceType,
                parameterGroup,
            },
            credentials: Credentials.fromSecret(secret),
            parameterGroup,
        };
    }

    createAuroraCluster(
        isc: InfraStackConfiguration,
        configuration: DbConfiguration
    ): DatabaseCluster {
        const instanceName = isc.environmentName + "-db";
        const secret = Secret.fromSecretAttributes(this, "db-secret", {
            secretCompleteArn: configuration.secretArn,
        });
        const securityGroup = SecurityGroup.fromSecurityGroupId(
            this,
            "securitygroup",
            configuration.securityGroupId
        );
        const vpc = importVpc(this, isc.environmentName);
        const parameterGroup = this.createParamaterGroup(configuration);
        const parameters = this.createClusterParameters(
            configuration,
            instanceName,
            vpc,
            securityGroup,
            parameterGroup,
            secret
        );
        const cluster = configuration.snapshotIdentifier
            ? new DatabaseClusterFromSnapshot(this, instanceName, {
                  ...parameters,
                  ...{ snapshotIdentifier: configuration.snapshotIdentifier },
              })
            : new DatabaseCluster(this, instanceName, parameters);

        // this workaround should prevent stack failing on version upgrade
        const cfnInstances = cluster.node.children.filter(
            (child): child is CfnDBInstance => child instanceof CfnDBInstance
        );
        if (cfnInstances.length === 0) {
            throw new Error(
                "Couldn't pull CfnDBInstances from the L1 constructs!"
            );
        }
        cfnInstances.forEach((cfnInstance) => delete cfnInstance.engineVersion);

        return cluster;
    }
}
