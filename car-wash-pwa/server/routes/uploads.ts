import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // Use randomUUID for collision safety — (Date.now + Math.random) can
    // collide when two uploads land in the same millisecond on a busy
    // server. path.extname is also sanitised so the extension can never
    // contain slashes or traversal (/, \, ..).
    const raw = path.extname(file.originalname).toLowerCase();
    const ext = /^\.[a-z0-9]{1,6}$/.test(raw) ? raw : '';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('نوع الملف غير مدعوم'));
  },
});

router.post('/image', requireAuth, requireRole('admin', 'vendor_admin'), upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لم يتم رفع أي صورة' });

  const baseUrl = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
  const url = `${baseUrl}/uploads/${req.file.filename}`;
  return res.json({ url });
});

export default router;
