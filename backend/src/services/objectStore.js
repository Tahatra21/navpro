import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function isObjectStoreEnabled() {
  return Boolean(process.env.MINIO_ENDPOINT && process.env.MINIO_BUCKET);
}

function createClient() {
  const endpoint = required('MINIO_ENDPOINT'); // ex: http://localhost:9000
  const region = process.env.MINIO_REGION || 'us-east-1';
  const accessKeyId = required('MINIO_ACCESS_KEY');
  const secretAccessKey = required('MINIO_SECRET_KEY');

  return new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function uploadBufferAndPresignGet({
  key,
  contentType,
  buffer,
  expiresInSeconds = 60 * 10,
}) {
  const Bucket = required('MINIO_BUCKET');
  const s3 = createClient();

  await s3.send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  // MinIO supports presigning GET via AWS v3 presigner
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket, Key: key }),
    { expiresIn: expiresInSeconds }
  );

  return { ok: true, key, url, expires_in_seconds: expiresInSeconds };
}

