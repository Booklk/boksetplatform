/**
 * Express middleware that blocks a route if the vendor's add-on isn't active.
 * Returns 402 (Payment Required) with a structured error so the UI can show
 * the "ترقية الباقة" prompt with the right add-on details.
 */
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { isAddonActive, getAddon, AddonId } from '../services/addons.js';

export function requireAddon(addonId: AddonId) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const vendorId = req.user?.vendorId;
    if (!vendorId) {
      return res.status(400).json({ error: 'لا يوجد متجر مرتبط بهذا الحساب' });
    }
    const active = await isAddonActive(vendorId, addonId);
    if (!active) {
      const addon = getAddon(addonId)!;
      return res.status(402).json({
        error: 'هذه الميزة تتطلب تفعيل الإضافة',
        addonRequired: {
          id: addon.id,
          nameAr: addon.nameAr,
          priceSar: addon.priceSar,
          descriptionAr: addon.descriptionAr,
        },
      });
    }
    next();
  };
}
