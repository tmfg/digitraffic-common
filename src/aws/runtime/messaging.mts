import { SNS as SNSType } from "@aws-sdk/client-sns";

/**
 * Utility function for publishing SNS messages.
 * Made because using *await* with AWS APIs doesn't require calling promise() but nothing works if it isn't called.
 * Retries a single time in case of failure.
 * @param message
 * @param topicArn
 * @param sns
 */
export async function snsPublish(
    message: string,
    topicArn: string,
    sns: SNSType
) {
    const publishParams = {
        Message: message,
        TopicArn: topicArn,
    };
    try {
        await sns.publish(publishParams);
    } catch (error) {
        console.error("method=snsPublish error, retrying", error);
        try {
            await sns.publish(publishParams);
        } catch (e2) {
            console.error("method=snsPublish error after retry", e2);
        }
    }
}
