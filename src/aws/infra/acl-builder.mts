import { CfnIPSet, CfnWebACL } from "aws-cdk-lib/aws-wafv2";
import type { Construct } from "constructs";

interface RuleProperty {
    action?: CfnWebACL.RuleActionProperty;
    statement: CfnWebACL.StatementProperty;
}

export type AWSManagedWafRule = "CommonRuleSet" | "AmazonIpReputationList" | "KnownBadInputsRuleSet" | "SQLiRuleSet";

/**
 * Builder class for building CfnWebACL.
 * 
 * Currently supports:
 * * Some AWS managed WAF rules
 * * IP blacklisting
 */
export class AclBuilder {
    readonly _construct: Construct;
    readonly _rules: CfnWebACL.RuleProperty[] = [];

    _scope: string = "CLOUDFRONT";
    _name: string = "WebACL";

    constructor(construct: Construct) {
        this._construct = construct;
    }

    isRuleDefined(rules: AWSManagedWafRule[] | "all", rule: AWSManagedWafRule) {
        return rules === "all" || rules.includes(rule);
    }

    withAWSManagedRules(rules: AWSManagedWafRule[] | "all" = "all"): AclBuilder {
        if(this.isRuleDefined(rules, "CommonRuleSet")) {
            this._rules.push(createAWSCommonRuleSet());
        }

        if(this.isRuleDefined(rules, "AmazonIpReputationList")) {
            this._rules.push(createAWSReputationList());
        }

        if(this.isRuleDefined(rules, "KnownBadInputsRuleSet")) {
            this._rules.push(createAWSKnownBadInput());
        }

        if(this.isRuleDefined(rules, "SQLiRuleSet")) {
            this._rules.push(createAWSAntiSQLInjection());
        }

        return this;
    }

    withIpRestrictionRule(addresses: string[]): AclBuilder {   
        const blocklistIpSet = new CfnIPSet(this._construct, "BlocklistIpSet", {
            ipAddressVersion: "IPV4",
            scope: this._scope,
            addresses,
        });
           
        this._rules.push({
            name: "IpBlocklist",
            priority: 10,
            action: { block: {} },
            statement: {
                ipSetReferenceStatement: {
                    arn: blocklistIpSet.attrArn,
                },
            },
            visibilityConfig: {
                sampledRequestsEnabled: false,
                cloudWatchMetricsEnabled: true,
                metricName: "IpBlocklist",
            },
        });                    

        return this;
    }

    public build(): CfnWebACL {
        if(this._rules.length === 0) {
            throw new Error("No rules defined for WebACL")
        }

        const acl = new CfnWebACL(this._construct, this._name, {
            defaultAction: { allow: {} },
            scope: this._scope,
            visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: "WAF-Blocked",
                sampledRequestsEnabled: false
            },
            rules: this._rules,
//            customResponseBodies
        });

        return acl;
    }
}

function createAWSCommonRuleSet(): CfnWebACL.RuleProperty {
    return createRuleProperty("AWS-AWSManagedRulesCommonRuleSet", 70, {
        statement: {
            managedRuleGroupStatement: {
                vendorName: "AWS",
                name: "AWSManagedRulesCommonRuleSet",
                excludedRules: [
                    { name: "NoUserAgent_HEADER" },
                    { name: "SizeRestrictions_BODY" },
                    { name: "GenericRFI_BODY" }
                ]
            }
        }
    });
}

function createAWSReputationList(): CfnWebACL.RuleProperty {
    return createRuleProperty("AWS-AWSManagedRulesAmazonIpReputationList", 80, {
        statement: {
            managedRuleGroupStatement: {
                vendorName: "AWS",
                name: "AWSManagedRulesAmazonIpReputationList"
            }
        }
    });
}

function createAWSKnownBadInput(): CfnWebACL.RuleProperty {
    return createRuleProperty("AWS-AWSManagedRulesKnownBadInputsRuleSet", 90, {
        statement: {
            managedRuleGroupStatement: {
                vendorName: "AWS",
                name: "AWSManagedRulesKnownBadInputsRuleSet"
            }
        }
    });
}

function createAWSAntiSQLInjection(): CfnWebACL.RuleProperty {
    return createRuleProperty("AWS-AWSManagedRulesSQLiRuleSet", 100, {
        statement: {
            managedRuleGroupStatement: {
                vendorName: "AWS",
                name: "AWSManagedRulesSQLiRuleSet"
            }
        }
    });
}

function createRuleProperty(
    name: string,
    priority: number,
    rule: RuleProperty,
    overrideAction: boolean = true
): CfnWebACL.RuleProperty {
    return {
        ...{
            name,
            priority,
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: name
            }
        },
        ...rule,
        ...(overrideAction ? { overrideAction: { none: {} } } : {})
    };
}