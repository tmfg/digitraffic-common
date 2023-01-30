import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { IpAddresses, IVpc, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { InfraStackConfiguration } from "./intra-stack-configuration";
import { exportValue } from "../import-util";

export interface NetworkConfiguration {
    readonly vpcName: string;
    readonly cidr: string;
}

export class NetworkStack extends Stack {
    readonly vpc: IVpc;

    constructor(
        scope: Construct,
        id: string,
        isc: InfraStackConfiguration,
        configuration: NetworkConfiguration
    ) {
        super(scope, id, {
            env: isc.env,
        });

        this.vpc = this.createVpc(configuration);
        exportValue(this, isc.environmentName, "VPCID", this.vpc.vpcId);
        exportValue(
            this,
            isc.environmentName,
            "digitrafficpublicASubnet",
            this.vpc.publicSubnets[0].subnetId
        );
        exportValue(
            this,
            isc.environmentName,
            "digitrafficpublicBSubnet",
            this.vpc.publicSubnets[1].subnetId
        );
        exportValue(
            this,
            isc.environmentName,
            "digitrafficprivateASubnet",
            this.vpc.privateSubnets[0].subnetId
        );
        exportValue(
            this,
            isc.environmentName,
            "digitrafficprivateBSubnet",
            this.vpc.privateSubnets[1].subnetId
        );
    }

    createVpc(configuration: NetworkConfiguration): Vpc {
        return new Vpc(this, "DigitrafficVPC", {
            vpcName: configuration.vpcName,
            availabilityZones: ["eu-west-1a", "eu-west-1b"],
            enableDnsHostnames: true,
            enableDnsSupport: true,
            ipAddresses: IpAddresses.cidr(configuration.cidr),
            subnetConfiguration: [
                {
                    name: "public",
                    cidrMask: 24,
                    subnetType: SubnetType.PUBLIC,
                },
                {
                    name: "private",
                    cidrMask: 24,
                    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                },
            ],
        });
    }
}
