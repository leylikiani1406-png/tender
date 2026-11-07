// استعلام قیمت: پوشه‌های دلخواه (تو در تو)، ردیف استعلام و پیوست‌ها
const router = require('express').Router();
const pool = require('../db');
const { authenticate, requireRole, notStaff } = require('../middleware/auth');
const { handleUpload, removeFile, releaseFile, sendFile } = require('../lib/files');
const { yearOf } = require('../lib/jalali');
router.use(authenticate, notStaff);
const MANAGE = ['super_admin', 'ceo', 'procurement', 'technical_manager', 'technical_expert', 'financial'];
const STATUS = ['open', 'answered', 'selected', 'closed'];
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const num = v => { if (v === '' || v == null) return null; const x = Number(String(v).replace(/[,٬\s]/g, '')); return isNaN(x) ? null : x; };
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const like = q => '%' + String(q).replace(/[\\%_]/g, m => '\\' + m) + '%';

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100), parent = parseInt(req.query.parent) || null;
    const path = []; let cur = parent;
    for (let i = 0; cur && i < 30; i++) {
      const f = (await pool.query('SELECT id, name, parent_id FROM inquiry_folders WHERE id=$1', [cur])).rows[0];
      if (!f) return res.status(404).json({ error: 'پوشه یافت نشد' });
      path.unshift({ id: f.id, name: f.name }); cur = f.parent_id;
    }
    const params = [], w = [];
    if (q) { params.push(like(q)); w.push(`(i.title ILIKE $1 OR i.party ILIKE $1 OR i.description ILIKE $1)`); } else { params.push(parent); w.push('i.folder_id IS NOT DISTINCT FROM $1::int'); }
    const items = await pool.query(`SELECT i.*, (SELECT COUNT(*)::int FROM inquiry_files f WHERE f.inquiry_id = i.id) AS files_count FROM inquiries i WHERE ${w.join(' AND ')} ORDER BY i.inquiry_date DESC NULLS LAST, i.id DESC LIMIT 1000`, params);
    const folders = q ? { rows: [] } : await pool.query(`SELECT f.id, f.name,
        (SELECT COUNT(*)::int FROM inquiry_folders c WHERE c.parent_id = f.id) + (SELECT COUNT(*)::int FROM inquiries x WHERE x.folder_id = f.id) AS items
      FROM inquiry_folders f WHERE f.parent_id IS NOT DISTINCT FROM $1::int ORDER BY f.name`, [parent]);
    res.json({ path, folders: folders.rows, items: items.rows, can_manage: MANAGE.includes(req.user.role) });
  } catch (e) { next(e); }
});
router.post('/folder', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const name = str(req.body.name, 200), parent = parseInt(req.body.parent_id) || null;
    if (!name) return res.status(400).json({ error: 'نام پوشه الزامی است' });
    if (parent && !(await pool.query('SELECT 1 FROM inquiry_folders WHERE id=$1', [parent])).rows[0]) return res.status(400).json({ error: 'پوشهٔ والد نامعتبر است' });
    const r = await pool.query('INSERT INTO inquiry_folders (parent_id, name, created_by) VALUES ($1,$2,$3) RETURNING id', [parent, name, req.user.id]);
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { next(e); }
});
router.put('/folder/:id', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const name = str(req.body.name, 200); if (!name) return res.status(400).json({ error: 'نام پوشه الزامی است' });
    await pool.query('UPDATE inquiry_folders SET name=$1 WHERE id=$2', [name, parseInt(req.params.id) || 0]); res.json({ success: true });
  } catch (e) { next(e); }
});
router.delete('/folder/:id', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id) || 0;
    const c = await pool.query('SELECT (SELECT COUNT(*)::int FROM inquiry_folders WHERE parent_id=$1) + (SELECT COUNT(*)::int FROM inquiries WHERE folder_id=$1) AS n', [id]);
    if (c.rows[0].n > 0) return res.status(400).json({ error: 'ابتدا محتویات پوشه را حذف کنید' });
    await pool.query('DELETE FROM inquiry_folders WHERE id=$1', [id]); res.json({ success: true });
  } catch (e) { next(e); }
});

function fields(b) {
  const d = isDate(b.inquiry_date) ? b.inquiry_date : null;
  return { title: str(b.title, 400), party: str(b.party, 300) || null, inquiry_date: d, year_j: yearOf(d) || parseInt(b.year_j) || null, amount: num(b.amount),
    status: STATUS.includes(b.status) ? b.status : 'open', description: str(b.description, 5000) || null, folder_id: parseInt(b.folder_id) || null };
}
router.get('/item/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id) || 0;
    const i = (await pool.query('SELECT * FROM inquiries WHERE id=$1', [id])).rows[0];
    if (!i) return res.status(404).json({ error: 'استعلام یافت نشد' });
    const f = await pool.query('SELECT f.id, f.file_name, f.file_size, f.created_at, u.full_name AS uploaded_by_name FROM inquiry_files f LEFT JOIN users u ON u.id = f.uploaded_by WHERE f.inquiry_id=$1 ORDER BY f.id', [id]);
    res.json({ ...i, files: f.rows, can_manage: MANAGE.includes(req.user.role) });
  } catch (e) { next(e); }
});
router.post('/item', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const f = fields(req.body); if (!f.title) return res.status(400).json({ error: 'عنوان استعلام الزامی است' });
    const r = await pool.query('INSERT INTO inquiries (folder_id, title, party, inquiry_date, year_j, amount, status, description, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [f.folder_id, f.title, f.party, f.inquiry_date, f.year_j, f.amount, f.status, f.description, req.user.id]);
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { next(e); }
});
router.put('/item/:id', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const f = fields(req.body); if (!f.title) return res.status(400).json({ error: 'عنوان استعلام الزامی است' });
    const r = await pool.query('UPDATE inquiries SET title=$1, party=$2, inquiry_date=$3, year_j=$4, amount=$5, status=$6, description=$7, updated_at=NOW() WHERE id=$8',
      [f.title, f.party, f.inquiry_date, f.year_j, f.amount, f.status, f.description, parseInt(req.params.id) || 0]);
    if (!r.rowCount) return res.status(404).json({ error: 'استعلام یافت نشد' }); res.json({ success: true });
  } catch (e) { next(e); }
});
router.delete('/item/:id', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id) || 0;
    const files = (await pool.query('SELECT file_path FROM inquiry_files WHERE inquiry_id=$1', [id])).rows;
    await pool.query('DELETE FROM inquiries WHERE id=$1', [id]);
    for (const f of files) await releaseFile(f.file_path);
    res.json({ success: true });
  } catch (e) { next(e); }
});
router.post('/item/:id/files', requireRole(...MANAGE), handleUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'فایل را انتخاب کنید' });
    const id = parseInt(req.params.id) || 0;
    if (!(await pool.query('SELECT 1 FROM inquiries WHERE id=$1', [id])).rows.length) { removeFile(req.file.filename); return res.status(404).json({ error: 'استعلام یافت نشد' }); }
    const r = await pool.query('INSERT INTO inquiry_files (inquiry_id, file_name, file_path, file_size, uploaded_by) VALUES ($1,$2,$3,$4,$5) RETURNING id', [id, req.file.originalname.slice(0, 300), req.file.filename, req.file.size, req.user.id]);
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { if (req.file) removeFile(req.file.filename); next(e); }
});
router.get('/item/:id/files/:fid/download', async (req, res, next) => {
  try {
    const f = (await pool.query('SELECT file_name, file_path FROM inquiry_files WHERE id=$1 AND inquiry_id=$2', [parseInt(req.params.fid) || 0, parseInt(req.params.id) || 0])).rows[0];
    if (!f) return res.status(404).json({ error: 'فایل پیدا نشد' }); sendFile(res, f.file_path, f.file_name);
  } catch (e) { next(e); }
});
router.delete('/item/:id/files/:fid', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const f = (await pool.query('DELETE FROM inquiry_files WHERE id=$1 AND inquiry_id=$2 RETURNING file_path', [parseInt(req.params.fid) || 0, parseInt(req.params.id) || 0])).rows[0];
    if (!f) return res.status(404).json({ error: 'فایل پیدا نشد' }); await releaseFile(f.file_path); res.json({ success: true });
  } catch (e) { next(e); }
});
module.exports = router;
