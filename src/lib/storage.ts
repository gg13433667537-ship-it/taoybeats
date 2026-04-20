/**
 * Unified Storage Layer for Audio Files
 * Handles upload to R2 and provides stable download URLs
 */

import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import https from "https";
import http from "http";

// Environment variable names
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

/**
 * Check if R2 is properly configured
 */
export function isR2Configured(): boolean {
  return Boolean(
    R2_ACCOUNT_ID &&
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    R2_BUCKET_NAME &&
    R2_PUBLIC_URL
  );
}

/**
 * Get R2 configuration - throws if not configured
 */
function getR2Config(): { accountId: string; accessKeyId: string; secretAccessKey: string; bucketName: string; publicUrl: string } {
  if (!isR2Configured()) {
    throw new Error("R2 is not configured. Required env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL");
  }
  return {
    accountId: R2_ACCOUNT_ID!,
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
    bucketName: R2_BUCKET_NAME!,
    publicUrl: R2_PUBLIC_URL!,
  };
}

/**
 * Lazy R2 client singleton
 */
let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (r2Client) return r2Client;
  const config = getR2Config();
  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return r2Client;
}

/**
 * Download a file from URL and return as Buffer
 * Includes timeout to prevent hanging on slow/unresponsive servers
 */
async function downloadFromUrl(url: string, timeoutMs: number = 30000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    // Create timeout timer
    const timeoutTimer = setTimeout(() => {
      req.destroy();
      reject(new Error(`Download timeout after ${timeoutMs}ms for URL: ${url}`));
    }, timeoutMs);

    const req = protocol.get(url, (response) => {
      clearTimeout(timeoutTimer);

      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFromUrl(redirectUrl, timeoutMs).then(resolve).catch(reject);
          return;
        }
        reject(new Error(`Redirect without location header: ${response.statusCode}`));
        return;
      }
      if (response.statusCode !== 200) {
        // Check for expiration errors (Aliyun OSS returns 403 with error message)
        if (response.statusCode === 403) {
          reject(new Error(`Audio URL has expired: ${response.statusCode}`));
          return;
        }
        reject(new Error(`Failed to download from URL: ${response.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", (err) => {
        clearTimeout(timeoutTimer);
        reject(err);
      });
    }).on("error", (err) => {
      clearTimeout(timeoutTimer);
      reject(err);
    });

    // Ensure timeout is cleared on req error
    req.on("error", () => clearTimeout(timeoutTimer));
  });
}

/**
 * Upload audio buffer to R2 and return stable R2 URL
 */
export async function uploadAudioBuffer(
  buffer: Buffer,
  songId: string,
  contentType: string = "audio/mpeg"
): Promise<{ r2Url: string; objectKey: string; size: number }> {
  const config = getR2Config();
  const client = getR2Client();

  // Determine extension from content type
  const extension = contentType.includes("mpeg") || contentType.includes("mp3") ? "mp3"
    : contentType.includes("wav") ? "wav"
    : contentType.includes("flac") ? "flac"
    : "mp3";

  const objectKey = `songs/${songId}.${extension}`;

  console.log(`[Storage] Uploading audio to R2: ${objectKey}, size: ${buffer.length}`);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    })
  );

  // Verify upload with HeadObject
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: objectKey,
      })
    );
  } catch (error) {
    console.error(`[Storage] Upload verification failed for ${objectKey}:`, error);
    throw new Error(`Upload verification failed - object may not exist in R2`);
  }

  const r2Url = `${config.publicUrl}/${objectKey}`;
  console.log(`[Storage] Upload successful: ${r2Url}`);

  return { r2Url, objectKey, size: buffer.length };
}

/**
 * Upload audio from a URL to R2
 * Downloads the audio first, then uploads to R2
 */
export async function uploadAudioFromUrl(
  sourceUrl: string,
  songId: string
): Promise<{ r2Url: string; objectKey: string; size: number }> {
  console.log(`[Storage] Downloading audio from: ${sourceUrl}`);

  const buffer = await downloadFromUrl(sourceUrl);

  // Determine content type from URL extension
  const urlExtension = sourceUrl.split(".").pop()?.split("?")[0]?.toLowerCase() || "mp3";
  const contentType = urlExtension === "wav" ? "audio/wav"
    : urlExtension === "flac" ? "audio/flac"
    : urlExtension === "pcm" ? "audio/pcm"
    : "audio/mpeg";

  return uploadAudioBuffer(buffer, songId, contentType);
}

/**
 * Get audio stream from R2 by object key
 */
export async function getAudioStream(objectKey: string): Promise<{ body: Buffer; contentType: string; contentLength: number }> {
  const config = getR2Config();
  const client = getR2Client();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
    })
  );

  const body = await response.Body?.transformToByteArray();
  if (!body) {
    throw new Error("Failed to get audio body from R2");
  }

  return {
    body: Buffer.from(body),
    contentType: response.ContentType || "audio/mpeg",
    contentLength: Number(response.ContentLength) || body.length,
  };
}

/**
 * Check if an object exists in R2
 */
export async function objectExists(objectKey: string): Promise<boolean> {
  try {
    const config = getR2Config();
    const client = getR2Client();
    await client.send(
      new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: objectKey,
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract object key from R2 URL
 * Returns null if R2 is not configured or URL doesn't match R2 pattern
 */
export function extractObjectKeyFromUrl(url: string): string | null {
  if (!isR2Configured()) {
    return null;
  }
  const config = getR2Config();
  if (!url.startsWith(config.publicUrl)) {
    return null;
  }
  return url.replace(`${config.publicUrl}/`, "");
}

/**
 * Generate R2 URL from object key
 */
export function getR2Url(objectKey: string): string {
  const config = getR2Config();
  return `${config.publicUrl}/${objectKey}`;
}
