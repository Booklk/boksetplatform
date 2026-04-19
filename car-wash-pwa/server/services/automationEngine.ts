/**
 * Marketing Automation Engine
 *
 * Processes automation workflows triggered by customer behavior
 * (booking completed, new customer, inactivity, etc.) and
 * executes multi-step action sequences (WhatsApp, push, points, promo).
 *
 * Entry points:
 *   - processAutomationTrigger()  — called on business events
 *   - processAutomationQueue()    — cron every 5 min
 *   - recoverAbandonedBookings()  — cron every 15 min
 */

import { db } from '../db/index.js';
import {
  automationWorkflows,
  automationSteps,
  automationExecutions,
  automationStepLogs,
  abandonedBookings,
  bookings,
  customers,
  users,
  vendors,
  loyaltyPoints,
  promoCodes,
} from '../db/schema.js';
import { eq, and, gte, lte, sql, isNull, lt, desc } from 'drizzle-orm';
import { sendRawWhatsAppMessage } from './whatsapp.js';
import { decrypt } from '../lib/crypto.js';

// ─── TYPES ───────────────────────────────────────────────────────────────────

type StepActionType =
  | 'send_whatsapp'
  | 'send_push'
  | 'add_points'
  | 'apply_promo'
  | 'wait';

interface StepConfig {
  message?: string;
  templateName?: string;
  promoCode?: string;
  points?: number;
  delayMinutes?: number;
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string;
}

interface StepRow {
  id: number;
  workflowId: number;
  stepOrder: number;
  actionType: string;
  config: StepConfig;
  delayMinutes: number;
}

interface ExecutionRow {
  id: number;
  workflowId: number;
  customerId: number;
  currentStep: number;
  status: string;
  nextRunAt: Date | null;
  startedAt: Date;
  completedAt: Date | null;
}

interface CustomerRow {
  id: number;
  vendorId: number;
  userId: number;
}

interface VendorRow {
  id: number;
  nameAr: string;
  whatsappPhoneId: string | null;
  whatsappToken: string | null;
}

// ─── 1. TRIGGER ──────────────────────────────────────────────────────────────

/**
 * Called when a business event occurs (e.g. booking_completed, new_customer).
 * Finds every active workflow that matches the trigger and creates a new
 * execution for the given customer.
 */
export async function processAutomationTrigger(
  vendorId: number,
  triggerType: string,
  customerId: number,
  metadata?: Record<string, unknown>,
): Promise<number> {
  try {
    // Find active workflows matching this trigger for the vendor
    const workflows = await db
      .select()
      .from(automationWorkflows)
      .where(
        and(
          eq(automationWorkflows.vendorId, vendorId),
          eq(automationWorkflows.triggerType, triggerType),
          eq(automationWorkflows.isActive, true),
        ),
      );

    if (workflows.length === 0) return 0;

    let created = 0;

    for (const workflow of workflows) {
      // Load the first step to determine initial delay
      const [firstStep] = await db
        .select()
        .from(automationSteps)
        .where(eq(automationSteps.workflowId, workflow.id))
        .orderBy(automationSteps.stepOrder)
        .limit(1);

      if (!firstStep) continue;

      const delayMs = (firstStep.delayMinutes ?? 0) * 60 * 1000;
      const nextRunAt = new Date(Date.now() + delayMs);

      await db.insert(automationExecutions).values({
        workflowId: workflow.id,
        customerId,
        currentStep: firstStep.stepOrder,
        status: 'running',
        nextRunAt,
      });

      created++;
      console.log(
        `[Automation] Created execution for workflow "${workflow.name}" ` +
          `(trigger=${triggerType}, customer=${customerId})`,
      );
    }

    return created;
  } catch (err) {
    console.error('[Automation] processAutomationTrigger error:', err);
    return 0;
  }
}

// ─── 2. QUEUE PROCESSOR ─────────────────────────────────────────────────────

/**
 * Called by cron every 5 minutes.
 * Picks up running executions whose nextRunAt has passed, executes the
 * current step, and either advances to the next step or completes the run.
 */
export async function processAutomationQueue(): Promise<void> {
  const now = new Date();

  try {
    // Fetch executions ready to process
    const executions = await db
      .select()
      .from(automationExecutions)
      .where(
        and(
          eq(automationExecutions.status, 'running'),
          lte(automationExecutions.nextRunAt, now),
        ),
      );

    if (executions.length === 0) return;

    console.log(`[Automation] Processing ${executions.length} execution(s)…`);

    for (const execution of executions) {
      try {
        await processExecution(execution as ExecutionRow);
      } catch (err) {
        console.error(
          `[Automation] Failed processing execution ${execution.id}:`,
          err,
        );
        // Mark as failed so it doesn't retry forever
        await db
          .update(automationExecutions)
          .set({ status: 'failed' })
          .where(eq(automationExecutions.id, execution.id));
      }
    }
  } catch (err) {
    console.error('[Automation] processAutomationQueue error:', err);
  }
}

/** Process a single execution: run current step, advance or complete. */
async function processExecution(execution: ExecutionRow): Promise<void> {
  // Load workflow steps in order
  const steps = await db
    .select()
    .from(automationSteps)
    .where(eq(automationSteps.workflowId, execution.workflowId))
    .orderBy(automationSteps.stepOrder);

  const currentStep = steps.find(
    (s) => s.stepOrder === execution.currentStep,
  ) as StepRow | undefined;

  if (!currentStep) {
    // No matching step — mark completed
    await db
      .update(automationExecutions)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(automationExecutions.id, execution.id));
    return;
  }

  // Load customer + user (for phone/name)
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, execution.customerId))
    .limit(1);

  if (!customer) {
    await db
      .update(automationExecutions)
      .set({ status: 'failed' })
      .where(eq(automationExecutions.id, execution.id));
    return;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, customer.userId))
    .limit(1);

  if (!user) {
    await db
      .update(automationExecutions)
      .set({ status: 'failed' })
      .where(eq(automationExecutions.id, execution.id));
    return;
  }

  // Load vendor (for WhatsApp credentials & name)
  const [vendor] = await db
    .select({
      id: vendors.id,
      nameAr: vendors.nameAr,
      whatsappPhoneId: vendors.whatsappPhoneId,
      whatsappToken: vendors.whatsappToken,
    })
    .from(vendors)
    .where(eq(vendors.id, customer.vendorId))
    .limit(1);

  if (!vendor) {
    await db
      .update(automationExecutions)
      .set({ status: 'failed' })
      .where(eq(automationExecutions.id, execution.id));
    return;
  }

  // Execute the action
  const result = await executeStepAction(
    currentStep,
    execution,
    { ...customer, userId: customer.userId, name: user.name, phone: user.phone },
    vendor as VendorRow,
  );

  // Log the step result
  await db.insert(automationStepLogs).values({
    executionId: execution.id,
    stepId: currentStep.id,
    status: result.success ? 'sent' : 'failed',
    error: result.error ?? null,
    metadata: result.metadata ?? {},
  });

  // Determine next step
  const currentIndex = steps.findIndex((s) => s.id === currentStep.id);
  const nextStep = steps[currentIndex + 1] as StepRow | undefined;

  if (nextStep) {
    // Advance to next step
    const delayMs = (nextStep.delayMinutes ?? 0) * 60 * 1000;
    const nextRunAt = new Date(Date.now() + delayMs);

    await db
      .update(automationExecutions)
      .set({
        currentStep: nextStep.stepOrder,
        nextRunAt,
      })
      .where(eq(automationExecutions.id, execution.id));
  } else {
    // Workflow complete
    await db
      .update(automationExecutions)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(automationExecutions.id, execution.id));

    // Increment workflow totalExecutions counter
    await db
      .update(automationWorkflows)
      .set({
        totalExecutions: sql`${automationWorkflows.totalExecutions} + 1`,
      })
      .where(eq(automationWorkflows.id, execution.workflowId));

    console.log(
      `[Automation] Execution ${execution.id} for workflow ${execution.workflowId} completed.`,
    );
  }
}

// ─── 3. STEP ACTION EXECUTOR ────────────────────────────────────────────────

interface ActionResult {
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Execute a single automation step action.
 */
export async function executeStepAction(
  step: StepRow,
  execution: ExecutionRow,
  customer: { id: number; vendorId: number; userId: number; name: string | null; phone: string },
  vendor: VendorRow,
): Promise<ActionResult> {
  const actionType = step.actionType as StepActionType;
  const config = step.config ?? {};

  try {
    switch (actionType) {
      // ── WhatsApp message ──────────────────────────────────────────────
      case 'send_whatsapp': {
        const message = interpolateMessage(
          config.message ?? 'مرحبا {name}، شكرا لاختيارك {vendor}!',
          customer,
          vendor,
        );

        const sent = await sendWhatsAppForVendor(
          vendor,
          customer.phone,
          message,
        );

        return sent
          ? { success: true, metadata: { channel: 'whatsapp', phone: customer.phone } }
          : { success: false, error: 'فشل إرسال رسالة واتساب' };
      }

      // ── Push notification (placeholder) ───────────────────────────────
      case 'send_push': {
        const title = config.templateName ?? 'بوكست';
        const body = interpolateMessage(
          config.message ?? 'عندك عرض خاص من {vendor}!',
          customer,
          vendor,
        );

        // TODO: integrate with Firebase Cloud Messaging / Expo push
        console.log(
          `[Automation] Push notification (placeholder): title="${title}" body="${body}" customer=${customer.id}`,
        );

        return {
          success: true,
          metadata: { channel: 'push', title, body, placeholder: true },
        };
      }

      // ── Add loyalty points ────────────────────────────────────────────
      case 'add_points': {
        const points = config.points ?? 50;

        await db.insert(loyaltyPoints).values({
          vendorId: vendor.id,
          customerId: customer.userId,
          transactionType: 'bonus',
          points: points,
          description: 'نقاط مكافأة — أتمتة تسويقية',
        });

        console.log(
          `[Automation] Added ${points} loyalty points to customer ${customer.id} (user ${customer.userId}) for vendor ${vendor.id}`,
        );

        return {
          success: true,
          metadata: { channel: 'loyalty', points },
        };
      }

      // ── Apply promo code ──────────────────────────────────────────────
      case 'apply_promo': {
        const code = config.promoCode ?? `AUTO${Date.now().toString(36).toUpperCase().slice(-6)}`;
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await db.insert(promoCodes).values({
          vendorId: vendor.id,
          code,
          discountType: 'percent',
          discountValue: '15',
          maxUses: 1,
          usedCount: 0,
          isActive: true,
          validUntil: expiresAt,
          descriptionAr: 'كود خصم تلقائي — أتمتة تسويقية',
        });

        console.log(
          `[Automation] Created promo code "${code}" (15% off, expires ${expiresAt.toISOString()}) for vendor ${vendor.id}, customer ${customer.id}`,
        );

        return {
          success: true,
          metadata: { channel: 'promo', promoCode: code, expiresAt: expiresAt.toISOString() },
        };
      }

      // ── Wait (delay until next step) ──────────────────────────────────
      case 'wait': {
        // Nothing to execute — the queue processor already schedules
        // the next step based on delayMinutes.
        return { success: true, metadata: { channel: 'wait', delayMinutes: step.delayMinutes } };
      }

      default: {
        return { success: false, error: `نوع إجراء غير معروف: ${actionType}` };
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[Automation] Step ${step.id} action "${actionType}" error:`,
      errorMsg,
    );
    return { success: false, error: errorMsg };
  }
}

// ─── 4. ABANDONED BOOKING RECOVERY ─────────────────────────────────────────

/**
 * Called by cron every 15 minutes.
 * Finds abandoned bookings older than 30 minutes that haven't been
 * recovered yet, and sends a WhatsApp recovery message with a
 * personalized discount.
 */
export async function recoverAbandonedBookings(
  vendorId?: number,
): Promise<number> {
  try {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Build conditions
    const conditions = [
      eq(abandonedBookings.recoveryMessageSent, false),
      isNull(abandonedBookings.recoveredAt),
      lte(abandonedBookings.abandonedAt, thirtyMinAgo),
    ];

    if (vendorId) {
      conditions.push(eq(abandonedBookings.vendorId, vendorId));
    }

    const abandoned = await db
      .select()
      .from(abandonedBookings)
      .where(and(...conditions))
      .limit(100); // batch size to avoid overloading

    if (abandoned.length === 0) return 0;

    console.log(
      `[Automation] Found ${abandoned.length} abandoned booking(s) to recover`,
    );

    let recovered = 0;

    for (const record of abandoned) {
      try {
        // Resolve customer phone — from record or customer table
        let phone = record.customerPhone;
        let customerName = 'عميلنا الكريم';

        if (record.customerId) {
          const [cust] = await db
            .select()
            .from(customers)
            .where(eq(customers.id, record.customerId))
            .limit(1);

          if (cust) {
            const [usr] = await db
              .select()
              .from(users)
              .where(eq(users.id, cust.userId))
              .limit(1);

            if (usr) {
              phone = phone ?? usr.phone;
              customerName = usr.name ?? customerName;
            }
          }
        }

        if (!phone) {
          console.warn(
            `[Automation] Abandoned booking ${record.id}: no phone available — skipping`,
          );
          continue;
        }

        // Load vendor for name and credentials
        const [vendor] = await db
          .select({
            id: vendors.id,
            nameAr: vendors.nameAr,
            whatsappPhoneId: vendors.whatsappPhoneId,
            whatsappToken: vendors.whatsappToken,
          })
          .from(vendors)
          .where(eq(vendors.id, record.vendorId))
          .limit(1);

        if (!vendor) continue;

        // Compose a personalized Arabic recovery message with discount
        const discountPercent = 15;
        const message =
          `مرحبا ${customerName} 👋\n\n` +
          `لاحظنا إنك ما كملت حجزك في *${vendor.nameAr}*.\n\n` +
          `عشانك جهزنا لك خصم *${discountPercent}%* على أول غسلة!\n` +
          `استخدم الكود: *COME${discountPercent}*\n\n` +
          `كمل حجزك الحين وسيارتك تصير لامعة ✨🚗\n\n` +
          `فريق ${vendor.nameAr}`;

        const sent = await sendWhatsAppForVendor(
          vendor as VendorRow,
          phone,
          message,
        );

        if (sent) {
          await db
            .update(abandonedBookings)
            .set({
              recoveryMessageSent: true,
              recoveryMethod: 'whatsapp',
            })
            .where(eq(abandonedBookings.id, record.id));

          recovered++;
        }
      } catch (err) {
        console.error(
          `[Automation] Failed to recover abandoned booking ${record.id}:`,
          err,
        );
      }
    }

    console.log(
      `[Automation] Sent ${recovered}/${abandoned.length} recovery messages`,
    );
    return recovered;
  } catch (err) {
    console.error('[Automation] recoverAbandonedBookings error:', err);
    return 0;
  }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Send a WhatsApp message using the vendor's own BYOC credentials
 * if available, otherwise fall back to the platform-level credentials.
 */
async function sendWhatsAppForVendor(
  vendor: VendorRow,
  phone: string,
  message: string,
): Promise<boolean> {
  // If vendor has their own WhatsApp credentials, use them directly
  if (vendor.whatsappPhoneId && vendor.whatsappToken) {
    try {
      const phoneId = decrypt(vendor.whatsappPhoneId);
      const token = decrypt(vendor.whatsappToken);
      const WHATSAPP_API_URL = 'https://graph.facebook.com/v19.0';

      const formatted = formatSaudiPhone(phone);

      const res = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formatted,
          type: 'text',
          text: { body: message },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error(
          `[Automation] Vendor ${vendor.id} WhatsApp send failed:`,
          err,
        );
        return false;
      }

      console.log(
        `[Automation] WhatsApp sent via vendor ${vendor.id} credentials to ${formatted}`,
      );
      return true;
    } catch (err) {
      console.error(
        `[Automation] Vendor ${vendor.id} WhatsApp credential error — falling back to platform:`,
        err,
      );
    }
  }

  // Fall back to platform-level credentials
  return sendRawWhatsAppMessage(phone, message);
}

/** Format Saudi phone numbers: 05xxxxxxxx -> +9665xxxxxxxx */
function formatSaudiPhone(phone: string): string {
  let p = phone.replace(/[\s-]/g, '');
  if (p.startsWith('0')) p = '966' + p.slice(1);
  if (!p.startsWith('+')) p = '+' + p;
  return p;
}

/**
 * Simple template interpolation for automation messages.
 * Supported placeholders: {name}, {vendor}, {phone}
 */
function interpolateMessage(
  template: string,
  customer: { name: string | null; phone: string },
  vendor: VendorRow,
): string {
  return template
    .replace(/\{name\}/g, customer.name ?? 'عميلنا الكريم')
    .replace(/\{vendor\}/g, vendor.nameAr)
    .replace(/\{phone\}/g, customer.phone);
}
