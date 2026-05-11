/**
 * Storage abstraction — local disk OR S3-compatible (AWS S3, Cloudflare R2,
 * DigitalOcean Spaces, Backblaze B2).
 *
 * Why this exists: keeping uploaded logos / KYC documents / before-after
 * photos on the local filesystem is a hard scaling blocker. With 5K vendors:
 *   - disk fills up → process crashes
 *   - second app instance can't see the first instance's uploads
 *   - no CDN, no replication, no backup
 *
 * This module gives every upload site one API. In dev / single-process
 * setups you can keep `STORAGE_PROVIDER=local`. For production set
 * `STORAGE_PROVIDER=s3` plus the S3 env block and uploads land in object
 * storage instead.
 *
 * Required env when STORAGE_PROVIDER=s3:
 *   S3_ENDPOINT      — e.g. https://<account>.r2.cloudflarestorage.com
 *                       (omit for AWS S3 — SDK auto-resolves)
 *   S3_REGION        — auto for R2, us-east-1 for AWS, etc.
 *   S3_BUCKET        — bucket name
 *   S3_ACCESS_KEY    — access key id
 *   S3_SECRET_KEY    — secret access key
 *   S3_PUBLIC_URL    — public CDN base URL (e.g. https://cdn.jdawil.sa)
 *   S3_FORCE_PATH    — "true" for some MinIO/legacy S3 setups
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type StorageProvider = 'local' | 's3';

export interface PutOptions {
  contentType?: string;
  /**
   * Folder prefix inside the bucket (e.g. "logos", "kyc", "before-after").
   * Slashes are flattened to keep the layout predictable.
   */
  folder?: string;
  /**
   * If true, generate a private object accessible only via signed URL.
   * Default false — most uploads are public storefront images.
   */
  private?: boolean;
}

export interface PutResult {
  /** Stable identifier — use for delete/getUrl. Format: `<folder>/<filename>` */
  key: string;
  /** Public URL the client can use right now. For private objects this is a signed URL valid 1h. */
  url: string;
}

const PROVIDER: StorageProvider = (process.env.STORAGE_PROVIDER as StorageProvider) ?? 'local';
const LOCAL_DIR = path.join(process.cwd(), 'uploads');

let s3: S3Client | null = null;
function getS3(): S3Client {
  if (s3) return s3;
  s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'auto',
    forcePathStyle: process.env.S3_FORCE_PATH === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
  });
  return s3;
}

function safeFilename(originalName: string): string {
  const raw = path.extname(originalName ?? '').toLowerCase();
  const ext = /^\.[a-z0-9]{1,6}$/.test(raw) ? raw : '';
  return `${crypto.randomUUID()}${ext}`;
}

function safeFolder(folder: string | undefined): string {
  if (!folder) return '';
  // Strip leading slashes and any '..' to prevent traversal in either backend.
  return folder.replace(/^\/+|\.\.+/g, '').replace(/\/+/g, '/');
}

/**
 * Upload a buffer. Returns a stable key + ready-to-use URL.
 *
 * Behaviour:
 *   - local: writes to ./uploads/<folder?>/<uuid.ext> and returns BASE_URL/uploads/...
 *   - s3:    PutObject to <folder?>/<uuid.ext> and returns S3_PUBLIC_URL/<key>
 *            (or a 1h signed URL if `private`).
 */
export async function putObject(
  buffer: Buffer,
  originalName: string,
  options: PutOptions = {},
): Promise<PutResult> {
  const filename = safeFilename(originalName);
  const folder = safeFolder(options.folder);
  const key = folder ? `${folder}/${filename}` : filename;

  if (PROVIDER === 's3') {
    const bucket = requireEnv('S3_BUCKET');
    await getS3().send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: options.contentType ?? 'application/octet-stream',
      // Private objects: omit ACL (default deny) and serve via signed URL.
      ...(options.private ? {} : { ACL: 'public-read' as const }),
    }));

    if (options.private) {
      const url = await getSignedUrl(
        getS3(),
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: 3600 },
      );
      return { key, url };
    }
    const publicBase = (process.env.S3_PUBLIC_URL ?? `${process.env.S3_ENDPOINT}/${bucket}`).replace(/\/$/, '');
    return { key, url: `${publicBase}/${key}` };
  }

  // local
  const fullDir = folder ? path.join(LOCAL_DIR, folder) : LOCAL_DIR;
  fs.mkdirSync(fullDir, { recursive: true });
  fs.writeFileSync(path.join(fullDir, filename), buffer);
  const baseUrl = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
  return { key, url: `${baseUrl}/uploads/${key}` };
}

/** Delete an object by its key. Idempotent — non-existent keys are ignored. */
export async function deleteObject(key: string): Promise<void> {
  if (!key) return;
  if (PROVIDER === 's3') {
    try {
      await getS3().send(new DeleteObjectCommand({ Bucket: requireEnv('S3_BUCKET'), Key: key }));
    } catch (e) {
      // Best-effort delete — some providers throw on missing keys, which is
      // not actually an error for the caller.
      console.warn(`[storage] s3 delete ${key} failed:`, e instanceof Error ? e.message : e);
    }
    return;
  }
  const target = path.join(LOCAL_DIR, key);
  // Don't allow paths to escape the upload root.
  const safe = path.normalize(target);
  if (!safe.startsWith(LOCAL_DIR)) return;
  try { fs.unlinkSync(safe); } catch {/* already gone */}
}

/** Get a signed URL for a private object (used for KYC docs in admin review). */
export async function getSignedReadUrl(key: string, expiresInSec = 3600): Promise<string> {
  if (PROVIDER === 's3') {
    return getSignedUrl(
      getS3(),
      new GetObjectCommand({ Bucket: requireEnv('S3_BUCKET'), Key: key }),
      { expiresIn: expiresInSec },
    );
  }
  const baseUrl = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
  return `${baseUrl}/uploads/${key}`;
}

export function currentProvider(): StorageProvider {
  return PROVIDER;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`storage: missing env ${name}`);
  return v;
}
