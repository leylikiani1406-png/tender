// انصراف از مناقصه: نامه‌ها و پیوست‌ها؛ هر ردیف: عنوان مناقصه، کارفرما، تاریخ انصراف، دلیل و پیوست
const router = require('express').Router();
const pool = require('../db');
const { authenticate, requireRole, notStaff } = require('../middleware/auth');
const { handleUpload, removeFile, releaseFile, sendFile } = require('../lib/files');
const { yearOf } = require('../lib/jalali');
router.use(authenticate, notStaff);
const MANAGE = ['super_admin', 'ceo', 'procurement'];
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const like = q => '%' + String(q).replace(/[\\%_]/g, m => '\\' + m) + '%';

router.get('/', async (req, res, next) => {
  try {
    const params = [], w = ['TRUE'], q = String(req.query.q || '').trim().slice(0, 100);
    const y = parseInt(req.query.year);
    if (y) { params.push(y); w.push(`COALESCE(x.year_j, 0) = $${params.length}`); }
    if (q) { params.push(like(q)); w.push(`(x.title ILIKE $${params.length} OR x.client_name ILIKE $${params.length} OR x.reason ILIKE $${params.length})`); }
    const r = await pool.query(`SELECT x.*, (SELECT COUNT(*)::int FROM withdrawal_files f WHERE f.withdrawal_id = x.id) AS files_count FROM tender_withdrawals x WHERE ${w.join(' AND ')} ORDER BY x.withdraw_date DESC NULLS LAST, x.id DESC LIMIT 1000`, params);
    const years = (await pool.query('SELECT DISTINCT year_j FROM tender_withdrawals WHERE year_j IS NOT NULL ORDER BY year_j DESC')).rows.map(x => x.year_j);
    res.json({ items: r.rows, years, can_manage: MANAGE.includes(req.user.role) });
  } catch (e) { next(e); }
});
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id) || 0, x = (await pool.query('SELECT * FROM tender_withdrawals WHERE id=$1', [id])).rows[0];
    if (!x) return res.status(404).json({ error: 'یافت نشد' });
    const f = await pool.query('SELECT f.id, f.file_name, f.file_size, f.created_at, u.full_name AS uploaded_by_name FROM withdrawal_files f LEFT JOIN users u ON u.id = f.uploaded_by WHERE f.withdrawal_id=$1 ORDER BY f.id', [id]);
    res.json({ ...x, files: f.rows, can_manage: MANAGE.includes(req.user.role) });
  } catch (e) { next(e); }
});
const fields = b => { const d = isDate(b.withdraw_date) ? b.withdraw_date : null; return { title: str(b.title, 400), client_name: str(b.client_name, 300) || null, withdraw_date: d, year_j: yearOf(d) || parseInt(b.year_j) || null, reason: str(b.reason, 5000) || null, tender_id: parseInt(b.tender_id) || null }; };
router.post('/', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const f = fields(req.body); if (!f.title) return res.status(400).json({ error: 'عنوان مناقصه الزامی است' });
    const r = await pool.query('INSERT INTO tender_withdrawals (tender_id, title, client_name, withdraw_date, year_j, reason, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [f.tender_id, f.title, f.client_name, f.withdraw_date, f.year_j, f.reason, req.user.id]);
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { next(e); }
});
router.put('/:id', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const f = fields(req.body); if (!f.title) return res.status(400).json({ error: 'عنوان مناقصه الزامی است' });
    const r = await pool.query('UPDATE tender_withdrawals SET title=$1, client_name=$2, withdraw_date=$3, year_j=$4, reason=$5 WHERE id=$6', [f.title, f.client_name, f.withdraw_date, f.year_j, f.reason, parseInt(req.params.id) || 0]);
    if (!r.rowCount) return res.status(404).json({ error: 'یافت نشد' }); res.json({ success: true });
  } catch (e) { next(e); }
});
router.delete('/:id', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id) || 0, files = (await pool.query('SELECT file_path FROM withdrawal_files WHERE withdrawal_id=$1', [id])).rows;
    await pool.query('DELETE FROM tender_withdrawals WHERE id=$1', [id]); for (const f of files) await releaseFile(f.file_path); res.json({ success: true });
  } catch (e) { next(e); }
});
router.post('/:id/files', requireRole(...MANAGE), handleUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'فایل را انتخاب کنید' });
    const id = parseInt(req.params.id) || 0;
    if (!(await pool.query('SELECT 1 FROM tender_withdrawals WHERE id=$1', [id])).rows.length) { removeFile(req.file.filename); return res.status(404).json({ error: 'یافت نشد' }); }
    const r = await pool.query('INSERT INTO withdrawal_files (withdrawal_id, file_name, file_path, file_size, uploaded_by) VALUES ($1,$2,$3,$4,$5) RETURNING id', [id, req.file.originalname.slice(0, 300), req.file.filename, req.file.size, req.user.id]);
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { if (req.file) removeFile(req.file.filename); next(e); }
});
router.get('/:id/files/:fid/download', async (req, res, next) => {
  try {
    const f = (await pool.query('SELECT file_name, file_path FROM withdrawal_files WHERE id=$1 AND withdrawal_id=$2', [parseInt(req.params.fid) || 0, parseInt(req.params.id) || 0])).rows[0];
    if (!f) return res.status(404).json({ error: 'فایل پیدا نشد' }); sendFile(res, f.file_path, f.file_name);
  } catch (e) { next(e); }
});
router.delete('/:id/files/:fid', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const f = (await pool.query('DELETE FROM withdrawal_files WHERE id=$1 AND withdrawal_id=$2 RETURNING file_path', [parseInt(req.params.fid) || 0, parseInt(req.params.id) || 0])).rows[0];
    if (!f) return res.status(404).json({ error: 'فایل پیدا نشد' }); await releaseFile(f.file_path); res.json({ success: true });
  } catch (e) { next(e); }
});
module.exports = router;
