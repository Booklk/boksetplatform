import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  automationWorkflows,
  automationSteps,
  automationExecutions,
  automationStepLogs,
  customers,
  users,
} from '../db/schema.js';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';

const router = Router();

// ─── GET /api/automations — list all workflows for vendor ─────────────────────
router.get('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;

    const workflows = await db
      .select({
        id: automationWorkflows.id,
        vendorId: automationWorkflows.vendorId,
        name: automationWorkflows.name,
        nameAr: automationWorkflows.nameAr,
        triggerType: automationWorkflows.triggerType,
        triggerConfig: automationWorkflows.triggerConfig,
        isActive: automationWorkflows.isActive,
        totalExecutions: automationWorkflows.totalExecutions,
        totalConversions: automationWorkflows.totalConversions,
        createdAt: automationWorkflows.createdAt,
        updatedAt: automationWorkflows.updatedAt,
        stepCount: sql<number>`(SELECT COUNT(*) FROM automation_steps WHERE workflow_id = ${automationWorkflows.id})`.as('step_count'),
      })
      .from(automationWorkflows)
      .where(eq(automationWorkflows.vendorId, vendorId))
      .orderBy(desc(automationWorkflows.createdAt));

    return res.json(workflows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── POST /api/automations — create workflow with steps ───────────────────────
const createWorkflowSchema = z.object({
  name: z.string().min(2).max(255),
  nameAr: z.string().max(255).optional(),
  triggerType: z.string().min(1).max(50),
  triggerConfig: z.record(z.unknown()).optional().default({}),
  steps: z.array(z.object({
    stepOrder: z.number().int().min(1),
    actionType: z.string().min(1).max(50),
    config: z.record(z.unknown()).optional().default({}),
    delayMinutes: z.number().int().min(0).optional().default(0),
  })).min(1),
});

router.post('/', requireAuth, requireRole('vendor_admin', 'admin'), audit('automation.create'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const data = createWorkflowSchema.parse(req.body);

    const [workflow] = await db.insert(automationWorkflows).values({
      vendorId,
      name: data.name,
      nameAr: data.nameAr,
      triggerType: data.triggerType,
      triggerConfig: data.triggerConfig,
    }).returning();

    const stepsToInsert = data.steps.map((s) => ({
      workflowId: workflow.id,
      stepOrder: s.stepOrder,
      actionType: s.actionType,
      config: s.config,
      delayMinutes: s.delayMinutes,
    }));

    const insertedSteps = await db.insert(automationSteps).values(stepsToInsert).returning();

    return res.status(201).json({ ...workflow, steps: insertedSteps });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── GET /api/automations/:id — single workflow with steps & recent executions ─
router.get('/:id', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const workflowId = Number(req.params.id);

    const [workflow] = await db.select().from(automationWorkflows)
      .where(and(eq(automationWorkflows.id, workflowId), eq(automationWorkflows.vendorId, vendorId)))
      .limit(1);

    if (!workflow) return res.status(404).json({ error: 'السير غير موجود' });

    const steps = await db.select().from(automationSteps)
      .where(eq(automationSteps.workflowId, workflowId))
      .orderBy(automationSteps.stepOrder);

    const executions = await db
      .select({
        id: automationExecutions.id,
        customerId: automationExecutions.customerId,
        currentStep: automationExecutions.currentStep,
        status: automationExecutions.status,
        nextRunAt: automationExecutions.nextRunAt,
        startedAt: automationExecutions.startedAt,
        completedAt: automationExecutions.completedAt,
        customerName: users.name,
      })
      .from(automationExecutions)
      .innerJoin(customers, eq(automationExecutions.customerId, customers.id))
      .innerJoin(users, eq(customers.userId, users.id))
      .where(eq(automationExecutions.workflowId, workflowId))
      .orderBy(desc(automationExecutions.startedAt))
      .limit(20);

    return res.json({ ...workflow, steps, executions });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PUT /api/automations/:id — update workflow metadata ──────────────────────
const updateWorkflowSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  nameAr: z.string().max(255).optional(),
  triggerType: z.string().min(1).max(50).optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

router.put('/:id', requireAuth, requireRole('vendor_admin', 'admin'), audit('automation.update'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const workflowId = Number(req.params.id);
    const data = updateWorkflowSchema.parse(req.body);

    const [existing] = await db.select({ id: automationWorkflows.id }).from(automationWorkflows)
      .where(and(eq(automationWorkflows.id, workflowId), eq(automationWorkflows.vendorId, vendorId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'السير غير موجود' });

    const [updated] = await db.update(automationWorkflows)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(automationWorkflows.id, workflowId))
      .returning();

    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PUT /api/automations/:id/steps — replace all steps for a workflow ────────
const replaceStepsSchema = z.object({
  steps: z.array(z.object({
    stepOrder: z.number().int().min(1),
    actionType: z.string().min(1).max(50),
    config: z.record(z.unknown()).optional().default({}),
    delayMinutes: z.number().int().min(0).optional().default(0),
  })).min(1),
});

router.put('/:id/steps', requireAuth, requireRole('vendor_admin', 'admin'), audit('automation.steps.update'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const workflowId = Number(req.params.id);
    const data = replaceStepsSchema.parse(req.body);

    const [existing] = await db.select({ id: automationWorkflows.id }).from(automationWorkflows)
      .where(and(eq(automationWorkflows.id, workflowId), eq(automationWorkflows.vendorId, vendorId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'السير غير موجود' });

    // Delete existing steps and insert new ones
    await db.delete(automationSteps).where(eq(automationSteps.workflowId, workflowId));

    const stepsToInsert = data.steps.map((s) => ({
      workflowId,
      stepOrder: s.stepOrder,
      actionType: s.actionType,
      config: s.config,
      delayMinutes: s.delayMinutes,
    }));

    const insertedSteps = await db.insert(automationSteps).values(stepsToInsert).returning();

    await db.update(automationWorkflows)
      .set({ updatedAt: new Date() })
      .where(eq(automationWorkflows.id, workflowId));

    return res.json(insertedSteps);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── DELETE /api/automations/:id — soft-delete (set isActive=false) ───────────
router.delete('/:id', requireAuth, requireRole('vendor_admin', 'admin'), audit('automation.delete'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const workflowId = Number(req.params.id);

    const [existing] = await db.select({ id: automationWorkflows.id }).from(automationWorkflows)
      .where(and(eq(automationWorkflows.id, workflowId), eq(automationWorkflows.vendorId, vendorId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'السير غير موجود' });

    await db.update(automationWorkflows)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(automationWorkflows.id, workflowId));

    return res.json({ message: 'تم تعطيل السير بنجاح' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── GET /api/automations/:id/executions — paginated execution history ────────
router.get('/:id/executions', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const workflowId = Number(req.params.id);

    // Verify workflow belongs to vendor
    const [existing] = await db.select({ id: automationWorkflows.id }).from(automationWorkflows)
      .where(and(eq(automationWorkflows.id, workflowId), eq(automationWorkflows.vendorId, vendorId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'السير غير موجود' });

    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const rows = await db
      .select({
        id: automationExecutions.id,
        customerId: automationExecutions.customerId,
        currentStep: automationExecutions.currentStep,
        status: automationExecutions.status,
        nextRunAt: automationExecutions.nextRunAt,
        startedAt: automationExecutions.startedAt,
        completedAt: automationExecutions.completedAt,
        customerName: users.name,
      })
      .from(automationExecutions)
      .innerJoin(customers, eq(automationExecutions.customerId, customers.id))
      .innerJoin(users, eq(customers.userId, users.id))
      .where(eq(automationExecutions.workflowId, workflowId))
      .orderBy(desc(automationExecutions.startedAt))
      .limit(limitNum)
      .offset(offset);

    const [countRow] = await db
      .select({ total: sql<number>`count(*)` })
      .from(automationExecutions)
      .where(eq(automationExecutions.workflowId, workflowId));

    return res.json({
      data: rows,
      total: Number(countRow?.total ?? 0),
      page: pageNum,
      limit: limitNum,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── POST /api/automations/:id/test — test-run workflow for a customer ────────
const testWorkflowSchema = z.object({
  customerId: z.number().int().positive(),
});

router.post('/:id/test', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const workflowId = Number(req.params.id);
    const data = testWorkflowSchema.parse(req.body);

    const [workflow] = await db.select().from(automationWorkflows)
      .where(and(eq(automationWorkflows.id, workflowId), eq(automationWorkflows.vendorId, vendorId)))
      .limit(1);

    if (!workflow) return res.status(404).json({ error: 'السير غير موجود' });

    // Verify customer belongs to vendor
    const [customer] = await db.select({ id: customers.id }).from(customers)
      .where(and(eq(customers.id, data.customerId), eq(customers.vendorId, vendorId)))
      .limit(1);

    if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

    const { processAutomationTrigger } = await import('../services/automationEngine.js');

    // Run the workflow's trigger against the test customer. Test mode still
    // obeys the vendor scope and logs to the same automation_executions table.
    const executions = await processAutomationTrigger(
      vendorId,
      workflow.triggerType,
      data.customerId,
      { workflowId, testRun: true },
    );

    return res.json({ message: 'تم تشغيل السير التجريبي بنجاح', executions });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في تشغيل السير' });
  }
});

export default router;
