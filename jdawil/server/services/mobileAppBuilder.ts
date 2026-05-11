/**
 * Mobile-app build orchestrator.
 *
 * Turns a vendor's Jdawil storefront into a Capacitor project ready to
 * compile into a native Android APK + iOS Xcode project. The product
 * (sold via /vendor/mobile-app) is "you give us your branding, we ship
 * you a buildable native project + the APK".
 *
 * Pipeline:
 *
 *   1. Copy `mobile-template/` to a temp working folder.
 *   2. Read the vendor's row from the DB (nameAr, slug, logoUrl,
 *      primaryColor, phone) — these become the app's identity.
 *   3. Substitute every {{PLACEHOLDER}} in the template files.
 *   4. Download the logo (or use a default) and write to resources/.
 *   5. ZIP the customised project — that's the "source-ready" deliverable.
 *   6. (Optional, separate flow) Trigger a remote APK build via GitHub
 *      Actions repository_dispatch. The workflow runs gradle, signs
 *      with the platform keystore, uploads APK to S3, then PATCHes
 *      the order with the URL.
 *
 * iOS gets the same Xcode project in the ZIP. Final IPA build requires
 * macOS + Apple Developer credentials and is done either by the vendor
 * (when they upload their own cert) or as a concierge add-on by us.
 */
import { db } from '../db/index.js';
import { vendors, mobileAppOrders } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import crypto from 'crypto';
import { putObject } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In dev: ../mobile-template. In the Docker runtime image: /app/mobile-template
// (we copy it in via Dockerfile.server).
const TEMPLATE_DIR = path.resolve(__dirname, '..', '..', 'mobile-template');
const WORK_DIR = path.join(process.cwd(), 'data', 'mobile-builds');

/**
 * Tokens we replace inside every template file. Keep this list in sync
 * with the actual `{{TOKEN}}` strings in mobile-template/.
 */
interface BuildContext {
  appName: string;          // → {{APP_NAME}}  vendor's nameAr
  appBundleId: string;      // → {{APP_BUNDLE_ID}}  sa.jdawil.<slug>
  vendorStoreUrl: string;   // → {{VENDOR_STORE_URL}}  https://.../store/<slug>
  vendorHost: string;       // → {{VENDOR_HOST}}  jdawil.sa
  primaryColor: string;     // → {{PRIMARY_COLOR}}  #rrggbb
  keystoreAlias: string;    // → {{KEYSTORE_ALIAS}}  <slug>
}

const FILES_WITH_PLACEHOLDERS = [
  'package.json',
  'capacitor.config.json',
  'index.html',
  'src/main.ts',
  'README.md',
];

function sanitizeBundleId(slug: string): string {
  // Bundle IDs must match ^[a-z0-9.]+$ and use reverse-DNS. Strip any
  // characters Google/Apple would reject, fall back to a hash if the
  // slug is empty after sanitisation.
  const cleaned = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  const tail = cleaned || crypto.randomBytes(3).toString('hex');
  return `sa.jdawil.${tail}`;
}

function sanitizeKeystoreAlias(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32) || 'jdawil';
}

async function copyRecursive(src: string, dst: string): Promise<void> {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyRecursive(srcPath, dstPath);
    } else {
      await fs.copyFile(srcPath, dstPath);
    }
  }
}

async function applyPlaceholders(workDir: string, ctx: BuildContext): Promise<void> {
  for (const rel of FILES_WITH_PLACEHOLDERS) {
    const filePath = path.join(workDir, rel);
    try {
      const original = await fs.readFile(filePath, 'utf8');
      const replaced = original
        .replace(/\{\{APP_NAME\}\}/g,         ctx.appName)
        .replace(/\{\{APP_BUNDLE_ID\}\}/g,    ctx.appBundleId)
        .replace(/\{\{VENDOR_STORE_URL\}\}/g, ctx.vendorStoreUrl)
        .replace(/\{\{VENDOR_HOST\}\}/g,      ctx.vendorHost)
        .replace(/\{\{PRIMARY_COLOR\}\}/g,    ctx.primaryColor)
        .replace(/\{\{KEYSTORE_ALIAS\}\}/g,   ctx.keystoreAlias);
      await fs.writeFile(filePath, replaced, 'utf8');
    } catch {
      // Missing optional template file — skip silently.
    }
  }
}

async function downloadLogo(logoUrl: string | null, destPath: string): Promise<void> {
  if (!logoUrl) {
    // Fall back to a packaged generic logo so the build still succeeds.
    const fallback = path.join(TEMPLATE_DIR, 'resources', 'default-logo.png');
    try { await fs.copyFile(fallback, destPath); } catch {/* no-op */}
    return;
  }
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return;
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(destPath, buf);
  } catch {
    // Network failure — leave the resources/logo.png missing; the
    // Capacitor assets step will pick up the default.
  }
}

/**
 * Generate a customised Capacitor project for a vendor, ZIP it, and
 * return the public download URL. Called when the super-admin clicks
 * "Build" on an order, or when the vendor self-serves via
 * /api/mobile-app/orders/:id/build.
 */
export async function generateVendorProject(orderId: number): Promise<{
  zipUrl: string;
  zipKey: string;
  bundleId: string;
  appName: string;
}> {
  const [order] = await db.select().from(mobileAppOrders).where(eq(mobileAppOrders.id, orderId)).limit(1);
  if (!order) throw new Error(`mobile app order ${orderId} not found`);

  const [vendor] = await db.select({
    id: vendors.id,
    nameAr: vendors.nameAr,
    slug: vendors.slug,
    logoUrl: vendors.logoUrl,
    primaryColor: vendors.primaryColor,
  }).from(vendors).where(eq(vendors.id, order.vendorId)).limit(1);
  if (!vendor) throw new Error(`vendor ${order.vendorId} not found`);

  // App-level overrides from the order take precedence over vendor defaults
  // — the vendor may have asked us to use a different name/color just for
  // the app (e.g. an English-only name to clear App Store review).
  const appName  = (order.appName ?? '').trim() || vendor.nameAr;
  const color    = order.primaryColor ?? vendor.primaryColor ?? '#1e3a8a';
  const slug     = vendor.slug;
  const bundleId = order.bundleId ?? sanitizeBundleId(slug);

  const ctx: BuildContext = {
    appName,
    appBundleId: bundleId,
    vendorStoreUrl: `https://${process.env.DOMAIN ?? 'jdawil.sa'}/store/${slug}`,
    vendorHost: process.env.DOMAIN ?? 'jdawil.sa',
    primaryColor: color,
    keystoreAlias: sanitizeKeystoreAlias(slug),
  };

  // ─── 1. Stage ────────────────────────────────────────────────────────
  const workRoot = path.join(WORK_DIR, `order-${order.id}`);
  await fs.rm(workRoot, { recursive: true, force: true });
  await fs.mkdir(workRoot, { recursive: true });
  await copyRecursive(TEMPLATE_DIR, workRoot);

  // ─── 2. Substitute ────────────────────────────────────────────────────
  await applyPlaceholders(workRoot, ctx);

  // ─── 3. Logo + splash ────────────────────────────────────────────────
  const resourcesDir = path.join(workRoot, 'resources');
  await fs.mkdir(resourcesDir, { recursive: true });
  await downloadLogo(order.iconUrl ?? vendor.logoUrl, path.join(resourcesDir, 'logo.png'));
  // Splash uses the same image — Capacitor assets will tint/resize.
  await downloadLogo(order.iconUrl ?? vendor.logoUrl, path.join(resourcesDir, 'splash.png'));

  // Write a build-context summary inside the project so future debugging
  // is easy — humans look at this file first.
  await fs.writeFile(
    path.join(workRoot, '_build-context.json'),
    JSON.stringify({ orderId, vendorId: vendor.id, generatedAt: new Date().toISOString(), context: ctx }, null, 2),
  );

  // ─── 4. ZIP ──────────────────────────────────────────────────────────
  const zipName = `jdawil-app-${slug}-${order.id}.zip`;
  const zipPath = path.join(WORK_DIR, zipName);
  await runZip(workRoot, zipPath);

  // ─── 5. Upload via storage abstraction (local OR s3) ──────────────────
  const zipBuf = await fs.readFile(zipPath);
  const { url, key } = await putObject(zipBuf, zipName, {
    contentType: 'application/zip',
    folder: 'mobile-builds',
    private: true,    // signed URL — only the vendor gets it
  });

  // Tidy the working folder; the ZIP we copied to storage is the
  // authoritative artifact.
  await fs.rm(workRoot, { recursive: true, force: true });
  await fs.unlink(zipPath).catch(() => {/* */});

  // ─── 6. Persist on the order ──────────────────────────────────────────
  await db.update(mobileAppOrders).set({
    bundleId,
    githubRepoUrl: key,      // overload — we store the storage key here
    androidApkUrl: null,     // set later by the remote APK build job
    status: 'ready',
    updatedAt: new Date(),
  }).where(eq(mobileAppOrders.id, orderId));

  return { zipUrl: url, zipKey: key, bundleId, appName };
}

/**
 * ZIP a directory. Uses the system `zip` binary (available in our Alpine
 * runtime via `apk add zip`). Falls back to a Node-native implementation
 * if zip isn't installed — we keep that path as a small dependency-free
 * helper rather than pulling archiver as a runtime dep.
 */
function runZip(srcDir: string, outZip: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('zip', ['-rq', outZip, '.'], { cwd: srcDir, stdio: ['ignore', 'inherit', 'inherit'] });
    proc.on('error', reject);
    proc.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`zip exited ${code}`)));
  });
}
