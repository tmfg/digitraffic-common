import { App } from "aws-cdk-lib";
import { Architecture, Code, Runtime } from "aws-cdk-lib/aws-lambda";
import { FunctionBuilder } from "../../aws/infra/stack/dt-function.js";
import { DigitrafficStack } from "../../aws/infra/stack/stack.js";
import { TrafficType } from "../../types/traffictype.js";

describe("FunctionBuilder test", () => {
  function createFunctionBuilder(): FunctionBuilder {
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

    return FunctionBuilder.create(stack, "test")
      .withoutDatabaseAccess()
      .withCode(Code.fromInline("{}"));
  }

  test("test runtime", () => {
    const f = createFunctionBuilder().withRuntime(Runtime.NODEJS_20_X).build();

    expect(f.runtime).toEqual(Runtime.NODEJS_20_X);
  });

  test("test architecture", () => {
    const f = createFunctionBuilder()
      .withArchitecture(Architecture.X86_64)
      .build();

    expect(f.architecture).toEqual(Architecture.X86_64);
  });
});
