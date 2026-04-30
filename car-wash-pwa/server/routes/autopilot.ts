/**
 * Autopilot routes — expose configuration + decision feed to the vendor
 * dashboard. All writes are tenant-scoped via requireAuth/requireRole.
 */

import { Router } from 'express';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { getAutopilotConfig, saveAutopilotConfig } from '../services/autopilot/config.js';
import { listDecisions } from '../services/autopilot/decisions.js';
import { runAssignEmployee } from '../services/autopilot/assignEmployee.js';
import { runReorderInventory } from '../services/autopilot/reorderInventory.js';
import { runDormantRemarket } from '../services/autopilot/dormantRemarket.js';
import { runAutoConfirm } from '../services/autopilot/autoConfirm.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('vendor_admin', 'admin'));

router.get('/config', async (req: AuthRequest, res) => {
  const vendorId = req.user!.vendorId;
  if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
  return res.json(await getAutopilotConfig(vendorId));
});

router.put('/config', async (req: AuthRequest, res) => {
  const vendorId = req.user!.vendorId;
  if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
  const next = await saveAutopilotConfig(vendorId, req.body ?? {});
  return res.json(next);
});

router.get('/decisions', async (req: AuthRequest, res) => {
  const vendorId = req.user!.vendorId;
  if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
  return res.json({ decisions: await listDecisions(vendorId, limit) });
});

// POST /api/autopilot/run — manually kick off a run for this vendor.
// Handy for the "شغّل الآن" button on the dashboard.
router.post('/run', async (req: AuthRequest, res) => {
  const vendorId = req.user!.vendorId;
  if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
  const cfg = await getAutopilotConfig(vendorId);
  try {
    // Run the four engines sequentially — combined latency is small enough.
    await runAssignEmployee(vendorId, cfg.assignEmployee);
    await runAutoConfirm(vendorId, cfg.autoConfirm);
    await runReorderInventory(vendorId, cfg.reorderInventory);
    await runDormantRemarket(vendorId, cfg.dormantRemarket);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[autopilot/run]', e);
    return res.status(500).json({ error: 'فشل تشغيل الطيار الآلي' });
  }
});

export default router;
