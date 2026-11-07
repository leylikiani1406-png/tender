// آمار نتایج مناقصه/پروپوزال برای داشبورد؛ از فایل اکسل (در مرورگر خوانده می‌شود) ذخیره می‌شود
const router = require('express').Router();
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
router.use(authenticate);
const MANAGE = ['super_admin', 'ceo', 'procurement'];

router.get('/', async (req, res, next) => {
  try {
    const r = await pool.query('SELECT rows, file_name, uploaded_at FROM result_stats WHERE id = 1');
    res.json(r.rows[0] || { rows: [], file_name: null, uploaded_at: null });
  } catch (e) { next(e); }
});

router.put('/', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const src = Array.isArray(req.body.rows) ? req.body.rows : null;
    if (!src || !src.length) return res.status(400).json({ error: 'هیچ ردیفی برای ذخیره ارسال نشد' });
    if (src.length > 5000) return res.status(400).json({ error: 'تعداد ردیف‌ها بیش از ۵۰۰۰ است' });
    const rows = [];
    for (const x of src) {
      const y = parseInt(x.y), a = Number(x.a) || 0;
      if (!(y >= 1300 && y <= 2100) || !['t', 'p'].includes(x.t) || !['w', 'l'].includes(x.r) || a < 0 || a > 1e16) continue;
      rows.push({ y, t: x.t, r: x.r, a, n: String(x.n || '').slice(0, 200) });
    }
    if (!rows.length) return res.status(400).json({ error: 'ردیف معتبری پیدا نشد' });
    await pool.query(
      `INSERT INTO result_stats (id, rows, file_name, uploaded_by, uploaded_at) VALUES (1,$1::jsonb,$2,$3,NOW())
       ON CONFLICT (id) DO UPDATE SET rows=EXCLUDED.rows, file_name=EXCLUDED.file_name, uploaded_by=EXCLUDED.uploaded_by, uploaded_at=NOW()`,
      [JSON.stringify(rows), String(req.body.file_name || '').slice(0, 300) || null, req.user.id]);
    res.json({ success: true, count: rows.length, skipped: src.length - rows.length });
  } catch (e) { next(e); }
});

router.delete('/', requireRole(...MANAGE), async (req, res, next) => {
  try { await pool.query('DELETE FROM result_stats WHERE id = 1'); res.json({ success: true }); } catch (e) { next(e); }
});
module.exports = router;
