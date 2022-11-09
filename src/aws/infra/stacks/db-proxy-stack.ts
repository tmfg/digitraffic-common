import { Duration, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
    CfnDBProxyEndpoint,
    DatabaseCluster,
    DatabaseClusterEngine,
    DatabaseProxy,
    ProxyTarget,
} from "aws-cdk-lib/aws-rds";
import { ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager";
import { IVpc, SecurityGroup } from "aws-cdk-lib/aws-ec2";
import { InfraStackConfiguration } from "./intra-stack-configuration";
import { DbConfiguration, DbStack } from "./db-stack";
import { exportValue, importValue, importVpc } from "../import-util";

/**
 * A stack that creates a Database proxy.
 */
export class DbProxyStack extends Stack {
    public static PROXY_READER_EXPORT_NAME = "db-reader-endpoint";
    public static PROXY_WRITER_EXPORT_NAME = "db-writer-endpoint";

    readonly isc: InfraStackConfiguration;

    constructor(
        scope: Construct,
        id: string,
        isc: InfraStackConfiguration,
        configuration: DbConfiguration
    ) {
        super(scope, id, {
            env: isc.env,
        });

        this.isc = isc;

        const vpc = importVpc(this, isc.environmentName);
        const secret = Secret.fromSecretAttributes(this, "proxy-secret", {
            secretCompleteArn: configuration.secretArn,
        });
        const proxy = this.createProxy(vpc, secret, configuration);
        const readerEndpoint = this.createProxyEndpoints(
            vpc,
            proxy,
            configuration.securityGroupId
        );
        this.setOutputs(configuration, proxy, readerEndpoint);
    }

    createProxy(vpc: IVpc, secret: ISecret, configuration: DbConfiguration) {
        const proxyId = `${this.isc.environmentName}-proxy`;
        const securityGroup = SecurityGroup.fromSecurityGroupId(
            this,
            "securitygroup",
            configuration.securityGroupId
        );

        const cluster = DatabaseCluster.fromDatabaseClusterAttributes(
            this,
            "db-cluster",
            {
                clusterIdentifier: importValue(
                    this.isc.environmentName,
                    DbStack.CLUSTER_IDENTIFIER_EXPORT_NAME
                ),
                engine: DatabaseClusterEngine.AURORA_POSTGRESQL,
                port: DbStack.CLUSTER_PORT,
            }
        );

        // CDK tries to allow connections between proxy and cluster
        // this does not work on cluster references
        cluster.connections.allowDefaultPortFrom = () => {
            /* nothing */
        };

        return new DatabaseProxy(this, proxyId, {
            dbProxyName: configuration.dbProxyName ?? "AuroraProxy",
            securityGroups: [securityGroup],
            proxyTarget: ProxyTarget.fromCluster(cluster),
            idleClientTimeout: Duration.seconds(1800),
            maxConnectionsPercent: 50,
            maxIdleConnectionsPercent: 25,
            borrowTimeout: Duration.seconds(120),
            requireTLS: false,
            secrets: [secret],
            vpc: vpc,
        });
    }

    createProxyEndpoints(
        vpc: IVpc,
        proxy: DatabaseProxy,
        securityGroupId: string
    ) {
        return new CfnDBProxyEndpoint(this, "ReaderEndpoint", {
            dbProxyEndpointName: "ReaderEndpoint",
            dbProxyName: proxy.dbProxyName,
            vpcSubnetIds: vpc.privateSubnets.map((sub) => sub.subnetId),
            vpcSecurityGroupIds: [securityGroupId],
            targetRole: "READ_ONLY",
        });
    }

    setOutputs(
        configuration: DbConfiguration,
        proxy: DatabaseProxy,
        proxyEndpoint: CfnDBProxyEndpoint
    ) {
        const readerEndpoint =
            configuration.instances > 1
                ? proxyEndpoint.attrEndpoint
                : proxy.endpoint;

        // if only one instance, then there is no reader-endpoint
        exportValue(
            this,
            this.isc.environmentName,
            DbProxyStack.PROXY_READER_EXPORT_NAME,
            readerEndpoint
        );
        exportValue(
            this,
            this.isc.environmentName,
            DbProxyStack.PROXY_WRITER_EXPORT_NAME,
            proxy.endpoint
        );
    }
}
