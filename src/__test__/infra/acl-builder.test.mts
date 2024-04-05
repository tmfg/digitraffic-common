import { AclBuilder } from "../../aws/infra/acl-builder.mjs";
import { App, Stack } from "aws-cdk-lib";

describe("acl-builder tests", () => {
    function createBuilder(): AclBuilder {
        const app = new App();
        const stack = new Stack(app);

        return new AclBuilder(stack);
    }

    test("no rules", () => {
        expect(() => createBuilder().build()).toThrow();
    });

    test("default rules", () => {
        const acl = createBuilder().withAWSManagedRules().build();

        expect(acl.rules).toHaveLength(4);
    });

    test("two aws rules", () => {
        const acl = createBuilder().withAWSManagedRules(["CommonRuleSet", "AmazonIpReputationList"]).build();

        expect(acl.rules).toHaveLength(2);
    });

    test("ip restriction", () => {
        const acl = createBuilder().withIpRestrictionRule(["1.2.3.4", "1.2.6.6"]).build();

        expect(acl.rules).toHaveLength(1);
    });

});