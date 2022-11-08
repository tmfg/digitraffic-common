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

        const readerEndpoint = importValue(
            isc.environmentName,
            DbStack.CLUSTER_READ_ENDPOINT_EXPORT_NAME
        );
        const writerEndpoint = importValue(
            isc.environmentName,
            DbStack.CLUSTER_WRITE_ENDPOINT_EXPORT_NAME
        );

        new RecordSet(this, "ReaderRecord", {
            recordType: RecordType.CNAME,
            recordName: `db-ro.${isc.environmentName}.local`,
            target: RecordTarget.fromValues(readerEndpoint),
            ttl: Duration.seconds(30),
            zone,
        });

        new RecordSet(this, "WriterRecord", {
            recordType: RecordType.CNAME,
            recordName: `db.${isc.environmentName}.local`,
            target: RecordTarget.fromValues(writerEndpoint),
            ttl: Duration.seconds(30),
            zone,
        });
    }
}
