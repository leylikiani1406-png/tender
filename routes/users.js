const router = require('express').Router();
const bcrypt = require('bcrypt');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
router.use(authenticate);

const ROLES = ['super_admin', 'ceo', 'technical_manager', 'technical_expert', 'financial', 'procurement', 'staff'];
const toLatin = s => String(s == null ? '' : s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const idOk = s => /^[A-Za-z0-9_.\-@]{2,60}$/.test(s);

// فهرست افراد برای انتخاب در ارجاع کار (مدیر فنی / مدیرعامل / مدیر ارشد)
router.get('/directory', requireRole('super_admin', 'ceo', 'technical_manager'), async (req, res, next) => {
  try {
    const r = await pool.query(`SELECT id, full_name, position, role, personnel_no FROM users WHERE is_active AND role <> 'super_admin' ORDER BY full_name`);
    res.json(r.rows);
  } catch (e) { next(e); }
});

router.use(requireRole('super_admin'));

router.get('/', async (req, res, next) => {
  try {
    const u = await pool.query(`SELECT id, full_name, username, personnel_no, position, email, phone, role, is_active, must_change_password, last_login_at FROM users ORDER BY id`);
    res.json(u.rows);
  } catch (e) { next(e); }
});

async function createOne(b) {
  const full_name = str(b.full_name, 200);
  const personnel_no = toLatin(b.personnel_no).slice(0, 50) || null;
  const username = toLatin(b.username) || personnel_no || '';
  const password = b.password != null && String(b.password) !== '' ? String(b.password) : (personnel_no || '');
  const role = b.role || 'staff';
  if (!full_name) return { error: 'نام کامل الزامی است' };
  if (!idOk(username)) return { error: 'نام کاربری باید ۲ تا ۶۰ کاراکتر انگلیسی/عدد باشد (یا شماره پرسنلی وارد شود)' };
  if (password.length < 4) return { error: 'رمز اولیه (شماره پرسنلی) حداقل ۴ کاراکتر باشد' };
  if (!ROLES.includes(role)) return { error: 'نقش نامعتبر است' };
  const dup = await pool.query('SELECT username, personnel_no FROM users WHERE LOWER(username) = LOWER($1) OR ($2::text IS NOT NULL AND personnel_no = $2)', [username, personnel_no]);
  if (dup.rows.length) return { error: 'این نام کاربری یا شماره پرسنلی قبلاً ثبت شده است', duplicate: true };
  const hash = await bcrypt.hash(password, 10);
  const r = await pool.query(
    `INSERT INTO users (full_name, username, personnel_no, password_hash, role, access_level, position, email, phone, is_active, must_change_password)
     VALUES ($1,$2,$3,$4,$5,'all',$6,$7,$8,TRUE,TRUE) RETURNING id`,
    [full_name, username, personnel_no, hash, role, str(b.position, 200) || null, str(b.email, 200) || null, str(b.phone, 50) || null]);
  return { id: r.rows[0].id, username };
}

router.post('/', async (req, res, next) => {
  try {
    const r = await createOne(req.body || {});
    if (r.error) return res.status(400).json({ error: r.error });
    res.status(201).json({ id: r.id, username: r.username });
  } catch (e) { next(e); }
});

// ساخت گروهی از روی فهرست اکسل: نام کاربری و رمز اولیه = شماره پرسنلی (در اولین ورود تغییر رمز اجباری است)
router.post('/bulk', async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : null;
    if (!rows || !rows.length) return res.status(400).json({ error: 'فهرست کاربران خالی است' });
    if (rows.length > 300) return res.status(400).json({ error: 'در هر بار حداکثر ۳۰۰ کاربر قابل ثبت است' });
    const report = { created: 0, skipped: [], errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const r = await createOne({ ...row, password: undefined });
      if (r.error) (r.duplicate ? report.skipped : report.errors).push({ row: i + 1, name: str(row.full_name, 100), reason: r.error });
      else report.created++;
    }
    res.json(report);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {}, role = b.role;
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'نقش نامعتبر است' });
    if (!str(b.full_name, 200)) return res.status(400).json({ error: 'نام کامل الزامی است' });
    if (id === req.user.id && (b.is_active === false || role !== req.user.role))
      return res.status(400).json({ error: 'نمی‌توانید نقش یا وضعیت خودتان را تغییر دهید' });
    const pn = toLatin(b.personnel_no).slice(0, 50) || null;
    if (pn) {
      const d = await pool.query('SELECT 1 FROM users WHERE personnel_no = $1 AND id <> $2', [pn, id]);
      if (d.rows.length) return res.status(400).json({ error: 'این شماره پرسنلی برای کاربر دیگری ثبت شده است' });
    }
    await pool.query('UPDATE users SET full_name=$1, role=$2, is_active=$3, personnel_no=$4, position=$5, email=$6, phone=$7 WHERE id=$8',
      [str(b.full_name, 200), role, b.is_active !== false, pn, str(b.position, 200) || null, str(b.email, 200) || null, str(b.phone, 50) || null, id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// حذف کاربر. اگر کاربر در سامانه سابقه دارد (مناقصه، کامنت، ...) حذف کامل ممکن نیست و به‌جای آن غیرفعال می‌شود.
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id) || 0;
    if (id === req.user.id) return res.status(400).json({ error: 'نمی‌توانید حساب خودتان را حذف کنید' });
    const u = (await pool.query('SELECT id, username, role FROM users WHERE id=$1', [id])).rows[0];
    if (!u) return res.status(404).json({ error: 'کاربر یافت نشد' });
    if (u.username === 'admin') return res.status(400).json({ error: 'حساب «admin» قابل حذف نیست' });
    if (u.role === 'super_admin') {
      const c = await pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE role='super_admin' AND is_active AND id <> $1`, [id]);
      if (!c.rows[0].n) return res.status(400).json({ error: 'آخرین مدیر ارشد را نمی‌توان حذف کرد' });
    }
    try {
      await pool.query('DELETE FROM users WHERE id=$1', [id]);
      return res.json({ success: true, deleted: true });
    } catch (e) {
      if (e.code !== '23503') throw e;            // وابستگی (کلید خارجی) دارد
      await pool.query('UPDATE users SET is_active=FALSE WHERE id=$1', [id]);
      return res.json({ success: true, deleted: false, deactivated: true });
    }
  } catch (e) { next(e); }
});

router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 4) return res.status(400).json({ error: 'رمز حداقل ۴ کاراکتر باشد' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash=$1, must_change_password=TRUE WHERE id=$2', [hash, req.params.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});
module.exports = router;
