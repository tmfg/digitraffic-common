import awsSdk from "aws-sdk";
import type { S3 as S3Type } from "aws-sdk";

const { S3 } = awsSdk;

export async function uploadToS3<Body extends S3Type.Body | undefined>(
    bucketName: string,
    body: Body,
    objectName: string,
    cannedAcl?: string,
    contentType?: string,
) {

    const s3 = new S3();
    try {
        await doUpload(
            s3, bucketName, body, objectName, cannedAcl, contentType,
        );
    } catch (error) {
        console.warn('method=uploadToS3 retrying upload to bucket %s', bucketName);
        try {
            await doUpload(
                s3, bucketName, body, objectName, cannedAcl, contentType,
            );
        } catch (e2) {
            console.error('method=uploadToS3 failed retrying upload to bucket %s', bucketName);
        }
    }
}

function doUpload<Body extends S3Type.Body | undefined>(
    s3: S3Type,
    bucketName: string,
    body: Body,
    filename: string,
    cannedAcl?: string,
    contentType?: string,
) {

    return s3.upload({
        Bucket: bucketName,
        Body: body,
        Key: filename,
        ACL: cannedAcl,
        ContentType: contentType,
    }).promise();
}
