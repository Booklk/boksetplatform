/**
 * Database backup CLI.
 *
 *     npm run backup           # writes a fresh dump locally
 *     npm run backup -- --upload   # also pushes to the configured S3 bucket
 *
 * Behaviour:
 *   1. Runs `pg_dump` against DATABASE_URL with --format=custom (compressed,
 *      ready for `pg_restore`).
 *   2. Names the file `jdawil-YYYY-MM-DD-HHMM.dump`.
 *   3. With --upload, streams the file to s3://$S3_BACKUP_BUCKET/backups/
 *      using the same S3 client we use for vendor uploads. The backup
 *      bucket SHOULD be different from S3_BUCKET (uploads); if you must
 *      share, set S3_BACKUP_PREFIX to avoid a flat collision.
 *   4. Locally, keeps the most recent N daily backups (BACKUP_RETENTION,
 *      default 14) and deletes older ones.
 *
 * Schedule via cron / scheduled-job in production (DigitalOcean App Platform,
 * Railway, GitHub Actions) — daily at 02:00 KSA is recommended:
 *
 *     0 23 * * *   cd /app && npm run --silent backup -- --upload
 *
 * Required to actually run:
 *   - `pg_dump` on PATH
 *   - DATABASE_URL set to the primary (NOT the replica — replicas may
 *     drift seconds and we want a consistent point-in-time snapshot).
 *   - For --upload: STORAGE_PROVIDER=s3 + S3_BACKUP_BUCKET (or fallback
 *     to S3_BUCKET) + S3_ACCESS_KEY/S3_SECRET_KEY.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const args = process.argv.slice(2);
const upload = args.includes('--upload');
const RETENTION = Number(process.env.BACKUP_RETENTION ?? 14);

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}

const backupDir = path.join(process.cwd(), 'backups');
fs.mkdirSync(backupDir, { recursive: true });

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

const filename = `jdawil-${timestamp()}.dump`;
const filepath = path.join(backupDir, filename);

console.log(`📥 backing up to ${filepath}`);

await new Promise<void>((resolve, reject) => {
  const proc = spawn('pg_dump', [
    '--format=custom',
    '--compress=6',
    '--no-owner',
    '--no-acl',
    `--file=${filepath}`,
    dbUrl,
  ], { stdio: ['ignore', 'inherit', 'inherit'] });

  proc.on('error', reject);
  proc.on('exit', (code) => {
    if (code === 0) resolve();
    else reject(new Error(`pg_dump exited ${code}`));
  });
});

const sizeMb = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
console.log(`✅ dump complete (${sizeMb} MB)`);

// ─── Rotate local backups ──────────────────────────────────────────────────
const all = fs.readdirSync(backupDir)
  .filter((f) => f.startsWith('jdawil-') && f.endsWith('.dump'))
  .map((f) => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtime }))
  .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

const stale = all.slice(RETENTION);
for (const old of stale) {
  fs.unlinkSync(path.join(backupDir, old.name));
}
if (stale.length > 0) {
  console.log(`🗑  pruned ${stale.length} backup(s) older than ${RETENTION} most recent`);
}

// ─── Upload ────────────────────────────────────────────────────────────────
if (upload) {
  const bucket = process.env.S3_BACKUP_BUCKET ?? process.env.S3_BUCKET;
  if (!bucket) {
    console.error('❌ --upload requires S3_BACKUP_BUCKET (or S3_BUCKET)');
    process.exit(1);
  }
  const prefix = process.env.S3_BACKUP_PREFIX ?? 'backups';
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'auto',
    forcePathStyle: process.env.S3_FORCE_PATH === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
  });

  const key = `${prefix}/${filename}`;
  console.log(`📤 uploading to s3://${bucket}/${key}`);
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fs.createReadStream(filepath),
    ContentType: 'application/octet-stream',
    // Prevent accidental public exposure even if the bucket policy is loose.
    ACL: undefined,
  }));
  console.log(`✅ uploaded`);
}

process.exit(0);
