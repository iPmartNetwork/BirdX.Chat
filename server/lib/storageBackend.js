import fs from "node:fs";
import path from "node:path";
import { readEnvString } from "../settings/env.js";

/**
 * Storage backend abstraction layer.
 *
 * Supports two backends:
 *   - "local" (default): files stored on disk in the upload directory.
 *   - "s3": files stored in an S3-compatible bucket (AWS, MinIO, DigitalOcean Spaces, etc.)
 *
 * Configuration via environment variables:
 *   STORAGE_BACKEND=local|s3          (default: local)
 *   S3_BUCKET=my-bucket
 *   S3_REGION=us-east-1
 *   S3_ENDPOINT=https://s3.amazonaws.com   (or custom for MinIO/Spaces)
 *   S3_ACCESS_KEY_ID=...
 *   S3_SECRET_ACCESS_KEY=...
 *   S3_PUBLIC_URL=https://cdn.example.com   (optional: public URL prefix for downloads)
 */

const BACKEND = readEnvString("STORAGE_BACKEND", "local").toLowerCase();

let s3Client = null;
let s3Bucket = "";
let s3PublicUrl = "";

if (BACKEND === "s3") {
  try {
    // Dynamic import so the AWS SDK is only loaded when S3 is configured.
    const { S3Client } = await import("@aws-sdk/client-s3");
    s3Bucket = readEnvString("S3_BUCKET", "");
    const region = readEnvString("S3_REGION", "us-east-1");
    const endpoint = readEnvString("S3_ENDPOINT", "");
    const accessKeyId = readEnvString("S3_ACCESS_KEY_ID", "");
    const secretAccessKey = readEnvString("S3_SECRET_ACCESS_KEY", "");
    s3PublicUrl = readEnvString("S3_PUBLIC_URL", "").replace(/\/$/, "");

    if (s3Bucket && accessKeyId && secretAccessKey) {
      s3Client = new S3Client({
        region,
        ...(endpoint ? { endpoint } : {}),
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: Boolean(endpoint), // needed for MinIO
      });
      console.log(`[storage] S3 backend initialized (bucket: ${s3Bucket})`);
    } else {
      console.warn("[storage] S3 configured but missing credentials; falling back to local.");
    }
  } catch (error) {
    console.warn("[storage] S3 SDK not available; falling back to local:", error?.message);
  }
}

if (BACKEND === "local" || !s3Client) {
  console.log("[storage] Using local filesystem backend.");
}

/**
 * Save a file buffer.
 * @param {string} key - Relative path/filename (e.g. "messages/abc123.jpg")
 * @param {Buffer} buffer - File data
 * @param {object} options - { contentType, baseDir }
 */
export async function putFile(key, buffer, options = {}) {
  if (s3Client) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: options.contentType || "application/octet-stream",
      }),
    );
    return;
  }
  // Local fallback
  const baseDir = options.baseDir || "";
  const filePath = path.join(baseDir, key);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

/**
 * Get a file buffer.
 * @param {string} key
 * @param {object} options - { baseDir }
 * @returns {Promise<Buffer|null>}
 */
export async function getFile(key, options = {}) {
  if (s3Client) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      const response = await s3Client.send(
        new GetObjectCommand({ Bucket: s3Bucket, Key: key }),
      );
      const chunks = [];
      for await (const chunk of response.Body) chunks.push(chunk);
      return Buffer.concat(chunks);
    } catch (error) {
      if (error?.name === "NoSuchKey") return null;
      throw error;
    }
  }
  // Local fallback
  const filePath = path.join(options.baseDir || "", key);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

/**
 * Delete a file.
 * @param {string} key
 * @param {object} options - { baseDir }
 */
export async function deleteFile(key, options = {}) {
  if (s3Client) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: s3Bucket, Key: key }),
    );
    return;
  }
  // Local fallback
  const filePath = path.join(options.baseDir || "", key);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

/**
 * Check if a file exists.
 * @param {string} key
 * @param {object} options - { baseDir }
 * @returns {Promise<boolean>}
 */
export async function fileExists(key, options = {}) {
  if (s3Client) {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      await s3Client.send(
        new HeadObjectCommand({ Bucket: s3Bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }
  return fs.existsSync(path.join(options.baseDir || "", key));
}

/**
 * Get the public URL for a file (for downloads/display).
 * @param {string} key
 * @param {object} options - { baseDir, serverBaseUrl }
 * @returns {string}
 */
export function getFileUrl(key, options = {}) {
  if (s3Client && s3PublicUrl) {
    return `${s3PublicUrl}/${key}`;
  }
  // Local: relative URL served by Express static
  return `/uploads/${key}`;
}

export const storageBackend = {
  type: s3Client ? "s3" : "local",
  putFile,
  getFile,
  deleteFile,
  fileExists,
  getFileUrl,
};
