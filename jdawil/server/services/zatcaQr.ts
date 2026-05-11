/**
 * ZATCA Phase 1 — simplified tax invoice QR.
 *
 * Saudi VAT-registered vendors must print a QR on every tax invoice.
 * Phase 1 (generation) spec encodes 5 TLV fields in base64:
 *
 *   tag 1: seller name
 *   tag 2: VAT registration number (15 digits)
 *   tag 3: invoice timestamp in ISO-8601 Zulu format
 *   tag 4: invoice total (VAT-inclusive) with 2 decimals, string
 *   tag 5: VAT amount with 2 decimals, string
 *
 * Official docs: https://zatca.gov.sa
 *
 * This produces only the data payload — the caller renders it to QR
 * with `qrcode` (server) or any QR renderer client-side.
 */

function tlv(tag: number, value: string): Uint8Array {
  const valueBytes = new TextEncoder().encode(value);
  if (valueBytes.length > 0xff) {
    throw new Error(`ZATCA QR value too long for tag ${tag}`);
  }
  const out = new Uint8Array(valueBytes.length + 2);
  out[0] = tag;
  out[1] = valueBytes.length;
  out.set(valueBytes, 2);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  // Node's Buffer is available at runtime under @types/node; convert
  // via Buffer.from when running on the server.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export interface ZatcaInvoicePayload {
  sellerName: string;
  vatNumber: string;          // 15 digits
  issuedAt: Date;
  totalWithVat: number;       // SAR
  vatAmount: number;          // SAR
}

/** Build the base64 TLV payload that the QR scanner reads. */
export function buildZatcaQrPayload(p: ZatcaInvoicePayload): string {
  const pieces = [
    tlv(1, p.sellerName),
    tlv(2, p.vatNumber),
    // ZATCA expects ISO-8601 Zulu with no milliseconds.
    tlv(3, new Date(p.issuedAt).toISOString().replace(/\.\d{3}Z$/, 'Z')),
    tlv(4, p.totalWithVat.toFixed(2)),
    tlv(5, p.vatAmount.toFixed(2)),
  ];
  const total = pieces.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of pieces) { out.set(a, offset); offset += a.length; }
  return toBase64(out);
}

/** Convenience wrapper — same as buildZatcaQrPayload but returns a
 *  data-URL SVG ready to embed in an invoice <img src>. */
export async function buildZatcaQrSvg(p: ZatcaInvoicePayload): Promise<string> {
  const data = buildZatcaQrPayload(p);
  const QRCode = (await import('qrcode')).default;
  return QRCode.toString(data, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  });
}
