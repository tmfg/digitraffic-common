import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { DigitrafficStack } from "./stack.js";

export function createLambdaLogGroup(stack: DigitrafficStack, functionName: string) {
  return new LogGroup(stack, `${functionName}-LogGroup`, {
    logGroupName: `${stack.configuration.shortName}/lambda/${functionName}`,
    retention: RetentionDays.ONE_YEAR,
  });
}