import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
    PrivateHostedZone,
    RecordSet,
    RecordTarget,
    RecordType,
} from "aws-cdk-lib/aws-route53";
import { InfraStackConfiguration } from "./intra-stack-configuration";
import { importValue, importVpc } from "../import-util";
import { DbStack } from "./db-stack";
import { DbProxyStack } from "./db-proxy-stack";

const DEFAULT_RECORD_TTL = Duration.seconds(30);

/**
 * Creates a dns local zone and creates records for cluster endpoints and proxy endpoints.
 *
 */
export class DbDnsStack extends Stack {
    constructor(scope: Construct, id: string, isc: InfraStackConfiguration) {
        super(scope, id, {
            env: isc.env,
        });

        this.createDnsRecords(isc);
    }

    createDnsRecords(isc: InfraStackConfiguration) {
        const vpc = importVpc(this, isc.environmentName);
        const zone = new PrivateHostedZone(this, "DNSHostedZone", {
            zoneName: isc.environmentName + ".local",
            vpc,
        });

        zone.applyRemovalPolicy(RemovalPolicy.RETAIN);

        const clusterReaderEndpoint = importValue(
            isc.environmentName,
            DbStack.CLUSTER_READ_ENDPOINT_EXPORT_NAME
        );
        const clusterWriterEndpoint = importValue(
            isc.environmentName,
            DbStack.CLUSTER_WRITE_ENDPOINT_EXPORT_NAME
        );

        const proxyReaderEndpoint = importValue(
            isc.environmentName,
            DbProxyStack.PROXY_READER_EXPORT_NAME
        );
        const proxyWriterEndpoint = importValue(
            isc.environmentName,
            DbProxyStack.PROXY_WRITER_EXPORT_NAME
        );

        new RecordSet(this, "ReaderRecord", {
            recordType: RecordType.CNAME,
            recordName: `db-ro.${isc.environmentName}.local`,
            target: RecordTarget.fromValues(clusterReaderEndpoint),
            ttl: DEFAULT_RECORD_TTL,
            zone,
        });

        new RecordSet(this, "WriterRecord", {
            recordType: RecordType.CNAME,
            recordName: `db.${isc.environmentName}.local`,
            target: RecordTarget.fromValues(clusterWriterEndpoint),
            ttl: DEFAULT_RECORD_TTL,
            zone,
        });

        new RecordSet(this, "ProxyReaderRecord", {
            recordType: RecordType.CNAME,
            recordName: `proxy-ro.${isc.environmentName}.local`,
            target: RecordTarget.fromValues(proxyReaderEndpoint),
            ttl: DEFAULT_RECORD_TTL,
            zone,
        });

        new RecordSet(this, "ProxyWriterRecord", {
            recordType: RecordType.CNAME,
            recordName: `proxy.${isc.environmentName}.local`,
            target: RecordTarget.fromValues(proxyWriterEndpoint),
            ttl: DEFAULT_RECORD_TTL,
            zone,
        });
    }
}
