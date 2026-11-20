import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

export const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
});

export async function createProductUploadUrl(userId: string, contentType: string) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(contentType)) throw Object.assign(new Error("Upload a JPEG, PNG, or WebP image."), { status: 400 });
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw Object.assign(new Error("S3 uploads are not configured."), { status: 503 });
  const imageKey = `products/${userId}/${randomUUID()}`;
  const command = new PutObjectCommand({ Bucket: bucket, Key: imageKey, ContentType: contentType });
  return { imageKey, uploadUrl: await getSignedUrl(s3, command, { expiresIn: 300 }) };
}

export function productImageUrl(imageKey: string) {
  if (!imageKey) return "";
  if (/^https?:\/\//i.test(imageKey)) return imageKey;
  const base = process.env.S3_PUBLIC_URL;
  return base ? `${base.replace(/\/$/, "")}/${imageKey}` : "";
}
