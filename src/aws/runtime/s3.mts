import { Upload } from '@aws-sdk/lib-storage';
import { S3 } from '@aws-sdk/client-s3';
import type { ObjectCannedACL } from '@aws-sdk/client-s3';
import { Readable } from "node:stream";

export async function uploadToS3(
    bucketName: string,
    body: Readable,
    objectName: string,
    cannedAcl?: ObjectCannedACL,
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

function doUpload(
    s3: S3,
    bucketName: string,
    body: Readable,
    filename: string,
    cannedAcl?: ObjectCannedACL,
    contentType?: string,
) {
    return new Upload({
        client: s3,
        params: {
            Bucket: bucketName,
            Body: body,
            Key: filename,
            ACL: cannedAcl,
            ContentType: contentType,
        },
    }).done();
}
