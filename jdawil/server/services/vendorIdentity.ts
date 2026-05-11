/**
 * Vendor identity — single source of truth for "who is this report
 * branded as?". Every Excel / PDF / receipt the platform issues
 * pulls from here so a vendor's reports look consistent across
 * surfaces and ZATCA-compliant where required.
 */
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface VendorIdentity {
  nameAr: string;
  nameEn: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  crNumber: string | null;
  vatNumber: string | null;
  nationalAddress: string | null;
  bankName: string | null;
  bankIban: string | null;
  ownerName: string | null;
  businessType: string | null;
  maroofNumber: string | null;
  primaryColor: string | null;
}

export async function getVendorIdentity(vendorId: number): Promise<VendorIdentity | null> {
  const [v] = await db.select({
    nameAr: vendors.nameAr,
    nameEn: vendors.nameEn,
    logoUrl: vendors.logoUrl,
    phone: vendors.phone,
    email: vendors.email,
    address: vendors.address,
    city: vendors.city,
    crNumber: vendors.crNumber,
    vatNumber: vendors.vatNumber,
    nationalAddress: vendors.nationalAddress,
    bankName: vendors.bankName,
    bankIban: vendors.bankIban,
    ownerName: vendors.ownerName,
    businessType: vendors.businessType,
    maroofNumber: vendors.maroofNumber,
    primaryColor: vendors.primaryColor,
  }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  return v ?? null;
}

/**
 * Standard cover-sheet rows for any Excel export. Prepend before
 * the actual data so every report opens with the vendor's official
 * identity — name, CR, VAT, address — exactly the same way.
 */
export function buildIdentityCoverRows(identity: VendorIdentity | null, reportTitle: string, dateRange?: { from: Date; to: Date }): string[][] {
  const rows: string[][] = [];
  rows.push([reportTitle]);
  rows.push([]);

  if (identity) {
    rows.push(['اسم المنشأة', identity.nameAr ?? '']);
    if (identity.nameEn) rows.push(['الاسم بالإنجليزية', identity.nameEn]);
    if (identity.crNumber) rows.push(['السجل التجاري', identity.crNumber]);
    if (identity.vatNumber) rows.push(['الرقم الضريبي', identity.vatNumber]);
    if (identity.nationalAddress) rows.push(['العنوان الوطني', identity.nationalAddress]);
    if (identity.address) rows.push(['العنوان', identity.address]);
    if (identity.city) rows.push(['المدينة', identity.city]);
    if (identity.phone) rows.push(['الجوال', identity.phone]);
    if (identity.email) rows.push(['البريد الإلكتروني', identity.email]);
    if (identity.bankName) rows.push(['البنك', identity.bankName]);
    if (identity.bankIban) rows.push(['IBAN', identity.bankIban]);
    if (identity.maroofNumber) rows.push(['رقم معروف', identity.maroofNumber]);
    if (identity.logoUrl) rows.push(['شعار المنشأة', identity.logoUrl]);
  }

  rows.push([]);
  if (dateRange) {
    rows.push(['الفترة من', dateRange.from.toLocaleDateString('ar-SA')]);
    rows.push(['الفترة إلى', dateRange.to.toLocaleDateString('ar-SA')]);
  }
  rows.push(['تاريخ الإصدار', new Date().toLocaleString('ar-SA')]);
  rows.push(['صادر عبر', 'منصة جداول (Jdawil)']);
  rows.push([]);
  return rows;
}

/**
 * HTML header block for invoices, terms PDFs, and any HTML→PDF flow.
 * Includes the logo (when set) and the official identity in the same
 * format ZATCA expects for printable invoice headers.
 */
export function buildIdentityHtmlHeader(identity: VendorIdentity | null): string {
  if (!identity) return '';
  const logo = identity.logoUrl
    ? `<img src="${identity.logoUrl}" alt="${identity.nameAr}" style="width:64px;height:64px;border-radius:12px;object-fit:cover;margin-left:12px"/>`
    : '';
  const lines: string[] = [];
  lines.push(`<h1 style="margin:0;font-size:18px;color:#0b1220">${identity.nameAr}</h1>`);
  if (identity.nameEn) lines.push(`<div style="font-size:11px;color:#64748b">${identity.nameEn}</div>`);
  if (identity.crNumber) lines.push(`<div style="font-size:11px;color:#64748b">س.ت: ${identity.crNumber}</div>`);
  if (identity.vatNumber) lines.push(`<div style="font-size:11px;color:#64748b">الرقم الضريبي: ${identity.vatNumber}</div>`);
  return `<div style="display:flex;align-items:center;direction:rtl;margin-bottom:16px">${logo}<div>${lines.join('')}</div></div>`;
}

/**
 * Filename helper — "تقرير الدخل-اسم المنشأة-2026-05-06.xlsx".
 * Sanitizes the name to avoid filesystem issues with slashes etc.
 */
export function buildReportFilename(reportTitle: string, identity: VendorIdentity | null, ext: 'xlsx' | 'pdf' | 'csv'): string {
  const cleanName = (identity?.nameAr ?? 'متجر').replace(/[\\/:*?"<>|]/g, '');
  const date = new Date().toISOString().slice(0, 10);
  return `${reportTitle}-${cleanName}-${date}.${ext}`;
}
