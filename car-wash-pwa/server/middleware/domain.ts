import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Detect vendor from Host header
// Inject req.detectedVendorSlug for routing
export async function detectVendorDomain(req: Request & { detectedVendorSlug?: string }, res: Response, next: NextFunction) {
  try {
    const host = req.headers.host?.split(':')[0] ?? '';

    // Skip for platform's own domain and localhost
    const platformDomains = (process.env.PLATFORM_DOMAINS ?? 'localhost,127.0.0.1').split(',');
    if (platformDomains.some(d => host === d || host.endsWith(`.${d}`))) {
      return next();
    }

    // Check if host matches a vendor's customDomain
    const [vendor] = await db
      .select({ slug: vendors.slug, isActive: vendors.isActive })
      .from(vendors)
      .where(eq(vendors.customDomain, host))
      .limit(1);

    if (vendor && vendor.isActive) {
      (req as any).detectedVendorSlug = vendor.slug;
    }
    next();
  } catch {
    next(); // never block on error
  }
}
