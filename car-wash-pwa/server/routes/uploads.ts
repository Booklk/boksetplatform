import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { putObject } from '../services/storage.js';

const router = Router();

// In-memory buffer + manual write through the storage abstraction. This
// lets the same route work for local disk *and* S3-compatible providers
// without conditional branches at the call site.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('نوع الملف غير مدعوم'));
  },
});

router.post(
  '/image',
  requireAuth,
  requireRole('admin', 'vendor_admin'),
  upload.single('image'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع أي صورة' });
    try {
      const { url } = await putObject(req.file.buffer, req.file.originalname, {
        contentType: req.file.mimetype,
        folder: 'images',
      });
      return res.json({ url });
    } catch (e) {
      console.error('[uploads/image]', e);
      return res.status(500).json({ error: 'تعذّر رفع الصورة' });
    }
  },
);

export default router;
