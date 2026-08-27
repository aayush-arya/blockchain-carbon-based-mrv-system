import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

export interface ReadStreamResult {
  stream: NodeJS.ReadableStream;
  contentType: string;
  contentLength: number;
}

export interface StorageDriver {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  getReadStream(key: string): Promise<ReadStreamResult>;
  /** Returns a time-limited direct URL, or null if the driver has no such concept (local). */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string | null>;
  isHealthy(): Promise<boolean>;
}

class LocalStorageDriver implements StorageDriver {
  private readonly basePath: string;

  constructor(basePath: string) {
    // Resolve relative to the backend package root (apps/backend), not process.cwd() - cwd
    // differs depending on how the process is launched (npm workspace script vs. direct tsx
    // invocation vs. vitest), which previously caused paths to double up.
    const backendRoot = path.resolve(__dirname, '..', '..');
    this.basePath = path.isAbsolute(basePath) ? basePath : path.resolve(backendRoot, basePath);
  }

  private resolveKey(key: string): string {
    // Evidence keys are server-generated (see evidenceService), but guard against traversal
    // in case that ever changes.
    const resolved = path.resolve(this.basePath, key);
    if (!resolved.startsWith(this.basePath)) {
      throw new Error(`Refusing to resolve storage key outside base path: ${key}`);
    }
    return resolved;
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<void> {
    const filePath = this.resolveKey(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
  }

  async getReadStream(key: string): Promise<ReadStreamResult> {
    const filePath = this.resolveKey(key);
    const stats = await stat(filePath);
    return {
      stream: createReadStream(filePath),
      contentType: 'application/octet-stream',
      contentLength: stats.size,
    };
  }

  async getSignedUrl(): Promise<string | null> {
    return null;
  }

  async isHealthy(): Promise<boolean> {
    try {
      await mkdir(this.basePath, { recursive: true });
      const probe = path.join(this.basePath, '.health-check');
      await writeFile(probe, 'ok');
      await readFile(probe);
      return true;
    } catch {
      return false;
    }
  }
}

class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;
  private readonly presignClient: S3Client;
  private readonly bucket: string;

  constructor() {
    const credentials =
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : undefined;

    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials,
    });

    // Signing is a local, offline computation (no request is sent to this endpoint) - it just
    // has to name a host the browser can actually resolve. See S3_PUBLIC_ENDPOINT above.
    this.presignClient = env.S3_PUBLIC_ENDPOINT
      ? new S3Client({
          region: env.S3_REGION,
          endpoint: env.S3_PUBLIC_ENDPOINT,
          forcePathStyle: env.S3_FORCE_PATH_STYLE,
          credentials,
        })
      : this.client;

    this.bucket = env.S3_BUCKET;
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: mimeType })
    );
  }

  async getReadStream(key: string): Promise<ReadStreamResult> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return {
      stream: result.Body as NodeJS.ReadableStream,
      contentType: result.ContentType ?? 'application/octet-stream',
      contentLength: result.ContentLength ?? 0,
    };
  }

  async getSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return awsGetSignedUrl(this.presignClient, command, { expiresIn: expiresInSeconds });
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}

export const storage: StorageDriver =
  env.STORAGE_DRIVER === 's3' ? new S3StorageDriver() : new LocalStorageDriver(env.STORAGE_LOCAL_PATH);

/** Reads an object fully into memory regardless of driver - used where a caller needs actual
 * bytes (e.g. forwarding evidence to the AI service) rather than a stream or signed URL. */
export async function readObjectAsBuffer(key: string): Promise<Buffer> {
  const { stream } = await storage.getReadStream(key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Deterministic, collision-resistant storage key that keeps evidence grouped by observation. */
export function buildEvidenceKey(observationId: string, originalFilename: string, sha256: string): string {
  const ext = path.extname(originalFilename).toLowerCase() || '';
  return `evidence/${observationId}/${sha256}${ext}`;
}
