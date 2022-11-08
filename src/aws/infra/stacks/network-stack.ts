import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { InfraStackConfiguration } from "./intra-stack-configuration";

export interface NetworkConfiguration {
    vpcName: string;
    cidr: string;
}

export class NetworkStack extends Stack {
    constructor(
        scope: Construct,
        id: string,
        isc: InfraStackConfiguration,
        configuration: NetworkConfiguration
    ) {
        super(scope, id, {
            env: isc.env,
        });

        this.createVpc(configuration);
    }

    createVpc(configuration: NetworkConfiguration): Vpc {
        return new Vpc(this, "DigitrafficVPC", {
            vpcName: configuration.vpcName,
            availabilityZones: ["eu-west-1a", "eu-west-1b"],
            enableDnsHostnames: true,
            enableDnsSupport: true,
            cidr: configuration.cidr,
            subnetConfiguration: [
                {
                    name: "public",
                    cidrMask: 24,
                    subnetType: SubnetType.PUBLIC,
                },
                {
                    name: "private",
                    cidrMask: 24,
                    subnetType: SubnetType.PRIVATE_WITH_NAT,
                },
            ],
        });
    }
}
