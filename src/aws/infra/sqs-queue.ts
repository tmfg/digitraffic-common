import { Queue, QueueEncryption, QueueProps } from "aws-cdk-lib/aws-sqs";
import { Duration } from "aws-cdk-lib";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { InlineCode, Runtime } from "aws-cdk-lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { ComparisonOperator, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { S3, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { SQSEvent, SQSHandler, SQSRecord } from "aws-lambda";
import { DigitrafficStack } from "./stack/stack.js";
import { MonitoredFunction } from "./stack/monitoredfunction.js";

/**
 * Construct for creating SQS-queues.
 *
 * If you don't config your own deadLetterQueue, this will create a dlq for you, also a lambda function, a s3 bucket
 * and an alarm for the queue.  Anything that goes to the dlq will be written into the bucket and the alarm is activated.
 */
export class DigitrafficSqsQueue extends Queue {
    static create(stack: DigitrafficStack, name: string, props: QueueProps): DigitrafficSqsQueue {
        const queueName = `${stack.configuration.shortName}-${name}-Queue`;
        const queueProps = {
            ...props,
            ...{
                encryption: QueueEncryption.KMS_MANAGED,
                queueName,
                deadLetterQueue: props.deadLetterQueue ?? {
                    maxReceiveCount: 2,
                    queue: DigitrafficDLQueue.create(stack, name),
                },
            },
        };

        return new DigitrafficSqsQueue(stack, queueName, queueProps);
    }
}

export class DigitrafficDLQueue {
    static create(stack: DigitrafficStack, name: string): DigitrafficSqsQueue {
        const dlqName = `${stack.configuration.shortName}-${name}-DLQ`;

        const dlq = new DigitrafficSqsQueue(stack, dlqName, {
            queueName: dlqName,
            visibilityTimeout: Duration.seconds(60),
            encryption: QueueEncryption.KMS_MANAGED,
        });

        const dlqBucket = new Bucket(stack, `${dlqName}-Bucket`, {
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        });

        const dlqFunctionName = `${dlqName}-Function`;
        const lambda = MonitoredFunction.create(stack, dlqFunctionName, {
            runtime: Runtime.NODEJS_20_X,
            logRetention: RetentionDays.ONE_YEAR,
            functionName: dlqFunctionName,
            code: getDlqCode(dlqBucket.bucketName),
            timeout: Duration.seconds(10),
            handler: "index.handler",
            memorySize: 128,
            reservedConcurrentExecutions: 1,
        });

        const statement = new PolicyStatement();
        statement.addActions("s3:PutObject");
        statement.addActions("s3:PutObjectAcl");
        statement.addResources(dlqBucket.bucketArn + "/*");

        lambda.addToRolePolicy(statement);
        lambda.addEventSource(new SqsEventSource(dlq));

        addDLQAlarm(stack, dlqName, dlq);

        return dlq;
    }
}

function addDLQAlarm(stack: DigitrafficStack, dlqName: string, dlq: Queue) {
    const alarmName = `${dlqName}-Alarm`;
    dlq.metricNumberOfMessagesReceived({
        period: Duration.minutes(5),
    })
        .createAlarm(stack, alarmName, {
            alarmName,
            threshold: 0,
            evaluationPeriods: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        })
        .addAlarmAction(new SnsAction(stack.warningTopic));
}

function getDlqCode(Bucket: string): InlineCode {
    const functionBody = DLQ_LAMBDA_CODE.replace("__bucketName__", Bucket)
        .replace("__upload__", uploadToS3.toString())
        .replace("__doUpload__", doUpload.toString())
        .replace("__handler__", createHandler().toString().substring(23)); // remove function handler() from signature

    return new InlineCode(functionBody);
}

async function uploadToS3(s3: S3 | S3Client, Bucket: string, Body: string, Key: string): Promise<void> {
    try {
        console.info("writing %s to %s", Key, Bucket);
        await doUpload(s3, Bucket, Body, Key);
    } catch (error) {
        console.warn(error);
        console.warn("method=uploadToS3 retrying upload to bucket %s", Bucket);
        try {
            await doUpload(s3, Bucket, Body, Key);
        } catch (e2) {
            console.error("method=uploadToS3 failed retrying upload to bucket %s", Bucket);
        }
    }
}

async function doUpload(s3: S3 | S3Client, Bucket: string, Body: string, Key: string) {
    try {
        const upload = new Upload({
            client: s3,
            params: { Bucket, Key, Body },
        });

        await upload.done();
    } catch (error) {
        console.error(error);
    }
}

// bucketName is unused, will be overridden in the actual lambda code below
const bucketName = "";

function createHandler(): SQSHandler {
    return async function handler(event: SQSEvent): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
        const AWS = require("aws-sdk");

        const millis = new Date().getTime();
        await Promise.all(
            event.Records.map((e: SQSRecord, idx: number) =>
                uploadToS3(
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    new AWS.S3(),
                    bucketName,
                    e.body,
                    `dlq-${millis}-${idx}.json`
                )
            )
        );
    };
}

const DLQ_LAMBDA_CODE = `
import { S3, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
const bucketName = "__bucketName__";

__upload__
__doUpload__

exports.handler = async (event) => __handler__
`;
