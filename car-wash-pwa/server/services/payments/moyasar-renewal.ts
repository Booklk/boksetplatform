/**
 * Moyasar token-charge adapter for subscription auto-renewal.
 *
 * Moyasar supports recurring charges via the *Tokens* API: the first
 * customer payment is made through hosted checkout with `save_card=1`,
 * which returns a token; subsequent renewals POST to /v1/payments with
 * { source: { type: 'token', token: '...' } } and require no customer
 * interaction.
 *
 * This module looks up the saved token for a vendor and posts the
 * recurring charge. It returns { ok: false, error } on any failure so
 * the dunning cycle can move on; the only thing that throws is a hard
 * misconfiguration (no Moyasar key at all).
 *
 * Wiring required to enable:
 *   1. During initial subscription payment, set save_card=1 on the
 *      Moyasar checkout request and store the returned token in
 *      vendors.paymentConfig.moyasarToken (already encrypted via
 *      services/payments index path).
 *   2. Set the platform Moyasar secret key in MOYASAR_API_KEY (or via
 *      platformSettings 'moyasar.apiKey').
 *
 * Until both are in place this adapter returns a clear error and the
 * dunning cycle treats the renewal as "failed" — same outcome as a
 * declined card.
 */
import { db } from '../../db/index.js';
import { vendors } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { decrypt } from '../../lib/crypto.js';
import { getSetting } from '../platformSettings.js';

interface ChargeResult {
  ok: boolean;
  ref?: string;
  error?: string;
}

const MOYASAR_API = 'https://api.moyasar.com/v1';

export async function chargeStoredCard(vendorId: number, amountSar: number): Promise<ChargeResult> {
  const apiKey = await getSetting('moyasar.apiKey');
  if (!apiKey) return { ok: false, error: 'moyasar.apiKey not configured' };

  const [v] = await db.select({
    paymentConfig: vendors.paymentConfig,
    nameAr: vendors.nameAr,
  }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);

  const cfg = (v?.paymentConfig ?? {}) as {
    moyasarToken?: string;          // encrypted
    moyasarTokenLast4?: string;
  };

  if (!cfg.moyasarToken) {
    return { ok: false, error: 'no saved card token' };
  }

  let token: string;
  try {
    token = decrypt(cfg.moyasarToken);
  } catch {
    return { ok: false, error: 'failed to decrypt saved token' };
  }

  // Moyasar amounts are in halalas (1 SAR = 100 halalas).
  const halalas = Math.round(amountSar * 100);

  try {
    const res = await fetch(`${MOYASAR_API}/payments`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: halalas,
        currency: 'SAR',
        description: `Jdawil subscription renewal — ${v?.nameAr ?? `vendor ${vendorId}`}`,
        source: { type: 'token', token },
        metadata: { vendorId: String(vendorId), kind: 'subscription_renewal' },
      }),
    });

    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { message?: string; type?: string };
      return { ok: false, error: j.message ?? `moyasar ${res.status}` };
    }

    const j = (await res.json()) as { id?: string; status?: string };
    if (j.status !== 'paid') {
      return { ok: false, error: `payment status: ${j.status ?? 'unknown'}` };
    }
    return { ok: true, ref: j.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}
