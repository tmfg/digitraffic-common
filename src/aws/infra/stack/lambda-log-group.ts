import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { DigitrafficStack } from "./stack.js";

export function createLambdaLogGroup(
  stack: DigitrafficStack,
  functionName: string,
  retention: RetentionDays = RetentionDays.ONE_YEAR,
) {
  return new LogGroup(stack, `${functionName}-LogGroup`, {
    logGroupName: `/${stack.configuration.shortName}/lambda/${functionName}`,
    retention,
  });
}
