import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import https from "https";
import http from "http";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

/**
 * Check if R2 is properly configured with all required environment variables.
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
 * Get R2 configuration or throw if not configured.
 * Use this for early validation before operations.
 */
export function requireR2Config(): { accountId: string; accessKeyId: string; secretAccessKey: string; bucketName: string; publicUrl: string } {
  if (!isR2Configured()) {
    throw new Error(
      "R2 is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL environment variables."
    );
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
 * Get R2 client. Throws if R2 is not configured.
 * Client is created lazily on first use.
 */
let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (r2Client) return r2Client;

  const config = requireR2Config();
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
 * Downloads a file from a URL and returns the buffer
 */
async function downloadFromUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFromUrl(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    }).on("error", reject);
  });
}

/**
 * Uploads an audio file from a URL to Cloudflare R2 and returns the public R2 URL
 */
export async function uploadAudioFromUrl(
  audioUrl: string,
  songId: string
): Promise<string> {
  const config = requireR2Config();
  const buffer = await downloadFromUrl(audioUrl);

  const extension = audioUrl.split(".").pop()?.split("?")[0] || "mp3";
  const key = `songs/${songId}.${extension}`;

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: `audio/${extension === "mp3" ? "mpeg" : extension}`,
    })
  );

  return `${config.publicUrl}/${key}`;
}
