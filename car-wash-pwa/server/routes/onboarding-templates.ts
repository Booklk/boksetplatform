import { Router } from 'express';
import { INDUSTRIES, getIndustriesList, type IndustryKey } from '../lib/industries.js';

const router = Router();

// GET /api/onboarding-templates — list all sectors with metadata
router.get('/', (_req, res) => {
  return res.json({
    industries: getIndustriesList().map((i) => ({
      key: i.key,
      nameAr: i.nameAr,
      nameEn: i.nameEn,
      icon: i.icon,
      description: i.description,
      serviceCount: i.defaultServices.length,
      packageCount: i.defaultPackages?.length ?? 0,
    })),
  });
});

// GET /api/onboarding-templates/:industry — full template for one sector
router.get('/:industry', (req, res) => {
  const key = req.params.industry as IndustryKey;
  const template = INDUSTRIES[key];

  if (!template) {
    return res.status(404).json({ error: 'قطاع غير معروف' });
  }

  return res.json({
    key,
    nameAr: template.nameAr,
    nameEn: template.nameEn,
    icon: template.icon,
    description: template.description,
    services: template.defaultServices,
    packages: template.defaultPackages,
    inventory: template.defaultInventory,
    whatsappTemplates: template.whatsappTemplates,
  });
});

export default router;
