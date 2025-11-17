import { App, Duration } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { Architecture, Code, Runtime } from "aws-cdk-lib/aws-lambda";
import { FunctionBuilder } from "../../aws/infra/stack/dt-function.js";
import { DigitrafficStack } from "../../aws/infra/stack/stack.js";
import { EnvKeys } from "../../aws/runtime/environment.js";
import { TrafficType } from "../../types/traffictype.js";

const TEST_ENV_VAR = "TEST_ENV_VAR" as const;
const TEST_ENV_VALUE = "testValue" as const;

describe("FunctionBuilder test", () => {
  function createTemplate(
    tester: (builder: FunctionBuilder) => void,
    plain: boolean = false,
  ): Template {
    const app = new App();
    const stack = new DigitrafficStack(app, "test-stack", {
      alarmTopicArn: "",
      production: false,
      shortName: "test",
      stackProps: {},
      secretId: "testSecret",
      trafficType: TrafficType.ROAD,
      warningTopicArn: "",
    });

    const environment = {
      [TEST_ENV_VAR]: TEST_ENV_VALUE,
    };

    const builder = plain
      ? FunctionBuilder.plain(stack, "test")
          .withEnvironment(environment)
          .withCode(Code.fromInline("{}"))
      : FunctionBuilder.create(stack, "test")
          .withoutDatabaseAccess()
          .withEnvironment(environment)
          .withCode(Code.fromInline("{}"));

    tester(builder);
    builder.build();

    return Template.fromStack(stack);
  }

  function expectEnvironmentValue(
    template: Template,
    key: string,
    value: string,
  ): void {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: Match.objectLike({
          [key]: value,
        }),
      },
    });
  }

  function expectEnvironmentValueMissing(
    template: Template,
    key: string,
  ): void {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: Match.objectLike({
          [key]: Match.absent(),
        }),
      },
    });
  }

  test("default builder", () => {
    const template = createTemplate((_builder: FunctionBuilder) => {});

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          [EnvKeys.SECRET_ID]: "testSecret",
          [TEST_ENV_VAR]: TEST_ENV_VALUE,
        },
      },
      Runtime: Runtime.NODEJS_22_X.name,
      MemorySize: 128,
      Timeout: 60,
      Handler: "test.handler",
    });
  });

  test("plain builder", () => {
    const template = createTemplate((_builder: FunctionBuilder) => {}, true);

    expectEnvironmentValue(template, TEST_ENV_VAR, TEST_ENV_VALUE);
    expectEnvironmentValueMissing(template, EnvKeys.SECRET_ID);
  });

  test("withoutSecretAccess does not add secret-related environment variable", () => {
    const template = createTemplate((builder: FunctionBuilder) => {
      builder.withoutSecretAccess();
    });

    expectEnvironmentValueMissing(template, EnvKeys.SECRET_ID);
  });

  test("Lambda runtime is set", () => {
    const template = createTemplate((builder: FunctionBuilder) => {
      builder.withRuntime(Runtime.NODEJS_20_X);
    });

    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: Runtime.NODEJS_20_X.name,
    });
  });

  test("Lambda memory size is set", () => {
    const template = createTemplate((builder: FunctionBuilder) => {
      builder.withMemorySize(256);
    });

    template.hasResourceProperties("AWS::Lambda::Function", {
      MemorySize: 256,
    });
  });

  test("Lambda architecture is set", () => {
    const template = createTemplate((builder: FunctionBuilder) => {
      builder.withArchitecture(Architecture.X86_64);
    });

    template.hasResourceProperties("AWS::Lambda::Function", {
      Architectures: [Architecture.X86_64.name],
    });
  });

  test("Lambda timeout is set", () => {
    const template = createTemplate((builder: FunctionBuilder) => {
      builder.withTimeout(Duration.seconds(120));
    });

    template.hasResourceProperties("AWS::Lambda::Function", {
      Timeout: 120,
    });
  });

  test("Lambda reserved concurrency is set", () => {
    const template = createTemplate((builder: FunctionBuilder) => {
      builder.withReservedConcurrentExecutions(5);
    });

    template.hasResourceProperties("AWS::Lambda::Function", {
      ReservedConcurrentExecutions: 5,
    });
  });

  test("Lambda handler is set", () => {
    const template = createTemplate((builder: FunctionBuilder) => {
      builder.withHandler("custom", "main");
    });

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "custom.main",
    });
  });
});
