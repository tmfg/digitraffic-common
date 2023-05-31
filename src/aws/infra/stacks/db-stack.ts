import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import {
    InstanceType,
    IVpc,
    SecurityGroup,
    SubnetType,
    Vpc,
} from "aws-cdk-lib/aws-ec2";
import { ISecurityGroup } from "aws-cdk-lib/aws-ec2/lib/security-group";
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
import { Construct } from "constructs";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { InfraStackConfiguration } from "./intra-stack-configuration";
import { exportValue, importVpc } from "../import-util";

export interface DbConfiguration {
    /** superuser username and password are fetched from this secret, using keys
     * db.superuser and db.superuser.password
     */
    readonly secretArn: string;

    readonly dbVersion: AuroraPostgresEngineVersion;
    readonly dbInstanceType: InstanceType;
    readonly snapshotIdentifier?: string;
    readonly instances: number;
    readonly customParameterGroup: boolean;
    readonly securityGroupId: string;
    /** If this is not specified, import default vpc */
    readonly vpc?: IVpc;

    readonly proxy: {
        readonly name?: string;
        readonly securityGroupId: string;
    };
}

/**
 * Stack that creates DatabaseCluster.
 *
 * Please not, that created Cluster has RETAIL removalPolicy, so if you want to delete the stack,
 * you must first deploy without parameter group, then delete stack and manually delete cluster.
 *
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
                          work_mem: "524288", // 512 MiB
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
        parameterGroup: IParameterGroup
    ): DatabaseClusterProps {
        const secret = Secret.fromSecretCompleteArn(
            this,
            "DBSecret",
            configuration.secretArn
        );

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
            credentials: Credentials.fromPassword(
                secret.secretValueFromJson("db.superuser").unsafeUnwrap(),
                secret.secretValueFromJson("db.superuser.password")
            ),
            parameterGroup,
            storageEncrypted: true,
            monitoringInterval: Duration.seconds(30),
        };
    }

    createAuroraCluster(
        isc: InfraStackConfiguration,
        configuration: DbConfiguration
    ): DatabaseCluster {
        const instanceName = isc.environmentName + "-db";
        const securityGroup = SecurityGroup.fromSecurityGroupId(
            this,
            "securitygroup",
            configuration.securityGroupId
        );
        const parameterGroup = this.createParamaterGroup(configuration);
        const vpc = configuration.vpc
            ? configuration.vpc
            : importVpc(this, isc.environmentName);

        const parameters = this.createClusterParameters(
            configuration,
            instanceName,
            vpc,
            securityGroup,
            parameterGroup
        );

        // create cluster from the snapshot or from the scratch
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

        cluster.node.addDependency(parameterGroup);

        return cluster;
    }
}
