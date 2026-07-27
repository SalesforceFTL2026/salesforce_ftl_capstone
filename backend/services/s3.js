import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// One shared S3 client for the whole app. The AWS SDK automatically reads
// your credentials from the AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env
// vars, so we only need to pass the region here.
const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.S3_BUCKET_NAME;

/**
 * Upload a file buffer to S3 under the given key (path inside the bucket).
 * The object stays private — we never make the bucket public.
 */
export async function uploadToS3({ key, buffer, contentType }) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return key;
}

/**
 * Generate a short-lived signed URL so the browser can display a private
 * object. Default: 1 hour. The frontend gets a fresh URL each time it loads
 * the profile, so expiry is never a problem in practice.
 */
export async function getSignedViewUrl(key, expiresInSeconds = 3600) {
  if (!key) return null;
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

/** Delete an object — used when a user replaces their old avatar. */
export async function deleteFromS3(key) {
  if (!key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
