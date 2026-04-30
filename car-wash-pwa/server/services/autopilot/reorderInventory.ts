/**
 * Inventory auto-reorder — when an item's quantity falls at or below its
 * minQuantity, Autopilot places a restocking transaction equal to
 * `reorderFactor × minQuantity`. The transaction is recorded as a normal
 * inventory IN movement so existing financial/inventory reports pick it
 * up automatically.
 *
 * WhatsApp nudge (if enabled): owner gets a one-line message summarising
 * what was reordered. Vendor pays the supplier themselves — we don't
 * auto-charge anything.
 */

import { db } from '../../db/index.js';
import { inventory, inventoryTransactions, vendors, users } from '../../db/schema.js';
import { and, eq, lte, sql } from 'drizzle-orm';
import type { AutopilotConfig } from './config.js';
import { recordDecision } from './decisions.js';
import { sendPlatformWhatsApp } from '../whatsapp.js';

export async function runReorderInventory(vendorId: number, cfg: AutopilotConfig['reorderInventory']) {
  if (!cfg.enabled) return;

  const low = await db.select().from(inventory).where(and(
    eq(inventory.vendorId, vendorId),
    lte(inventory.quantity, inventory.minQuantity),
    eq(inventory.autoReorderEnabled, true),
  ));
  if (low.length === 0) return;

  const actions: Array<{ name: string; addedQty: number; unit: string }> = [];

  for (const item of low) {
    const minQty = Number(item.minQuantity);
    if (!(minQty > 0)) continue;
    // Prefer the item's own reorderQuantity if set, otherwise apply the factor.
    const addQty = Number.isFinite(Number(item.reorderQuantity)) && Number(item.reorderQuantity) > 0
      ? Number(item.reorderQuantity)
      : Math.max(1, Math.round(minQty * cfg.reorderFactor));

    const newQty = Number(item.quantity) + addQty;

    await db.update(inventory)
      .set({ quantity: String(newQty), updatedAt: new Date() })
      .where(eq(inventory.id, item.id));

    await db.insert(inventoryTransactions).values({
      vendorId,
      inventoryId: item.id,
      type: 'in',
      quantity: String(addQty),
      notes: 'Autopilot reorder',
    } as any);

    actions.push({ name: item.name, addedQty: addQty, unit: item.unit });

    await recordDecision(vendorId, 'autopilot.reorder_inventory', {
      summary: `طلب ${addQty} ${item.unit} من "${item.name}"`,
      itemId: item.id,
      itemName: item.name,
      addedQty: addQty,
      newQuantity: newQty,
    });
  }

  if (cfg.notifyOwnerOnReorder && actions.length > 0) {
    try {
      const [vendor] = await db.select({ phone: vendors.phone, nameAr: vendors.nameAr })
        .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
      if (vendor?.phone) {
        const lines = actions.slice(0, 5).map((a) => `• ${a.name}: +${a.addedQty} ${a.unit}`).join('\n');
        const extra = actions.length > 5 ? `\n… و ${actions.length - 5} صنف إضافي` : '';
        await sendPlatformWhatsApp(
          vendor.phone,
          `🤖 الطيار الآلي أعاد طلب المخزون المنخفض:\n${lines}${extra}\n\nافتح متجرك: https://jdawil.sa/vendor/inventory`,
        );
      }
    } catch (e) { console.error('[reorder notify]', e); }
  }
  // `users` is imported so we could eventually notify specific admins
  // (not just the vendor phone) — keeping the import reserved.
  void users;
}
