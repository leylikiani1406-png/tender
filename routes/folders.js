// پوشه‌ها و مدارک: مدارک کیفی، مدارک فنی، پروپوزال (پوشه تو در تو)
const router = require('express').Router();
const pool = require('../db');
const { authenticate, requireRole, notStaff } = require('../middleware/auth');
const { handleUpload, removeFile, releaseFile, sendFile } = require('../lib/files');
router.use(authenticate, notStaff);
const AREAS = ['quality', 'technical', 'iso'];
const MANAGE = ['super_admin', 'ceo', 'technical_manager', 'technical_expert', 'procurement'];

router.get('/', async (req, res, next) => {
  try {
    const area = req.query.area;
    if (!AREAS.includes(area)) return res.status(400).json({ error: 'بخش نامعتبر است' });
    const parent = parseInt(req.query.parent) || null;
    const path = [];
    let cur = parent;
    for (let i = 0; cur && i < 30; i++) {
      const f = (await pool.query('SELECT id, name, parent_id FROM doc_folders WHERE id=$1 AND area=$2', [cur, area])).rows[0];
      if (!f) return res.status(404).json({ error: 'پوشه یافت نشد' });
      path.unshift({ id: f.id, name: f.name }); cur = f.parent_id;
    }
    const folders = await pool.query(
      `SELECT f.id, f.name, f.created_at,
         (SELECT COUNT(*)::int FROM doc_folders c WHERE c.parent_id = f.id) + (SELECT COUNT(*)::int FROM doc_files x WHERE x.folder_id = f.id) AS items
       FROM doc_folders f WHERE f.area=$1 AND f.parent_id IS NOT DISTINCT FROM $2::int ORDER BY f.name`, [area, parent]);
    const files = await pool.query(
      `SELECT d.id, d.file_name, d.file_size, d.created_at, u.full_name AS uploaded_by_name FROM doc_files d LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.area=$1 AND d.folder_id IS NOT DISTINCT FROM $2::int ORDER BY d.id DESC`, [area, parent]);
    res.json({ path, folders: folders.rows, files: files.rows, can_manage: MANAGE.includes(req.user.role) });
  } catch (e) { next(e); }
});

// کل درخت پوشه‌ها و فایل‌های یک بخش (برای انتخاب مدارک در ساخت بسته PDF)
router.get('/tree', async (req, res, next) => {
  try {
    const area = req.query.area;
    if (!AREAS.includes(area)) return res.status(400).json({ error: 'بخش نامعتبر است' });
    const folders = (await pool.query('SELECT id, parent_id, name FROM doc_folders WHERE area=$1 ORDER BY name', [area])).rows;
    const files = (await pool.query('SELECT id, folder_id, file_name, file_size FROM doc_files WHERE area=$1 ORDER BY file_name', [area])).rows;
    res.json({ folders, files });
  } catch (e) { next(e); }
});

router.post('/folder', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const { area, name } = req.body, parent = parseInt(req.body.parent_id) || null;
    if (!AREAS.includes(area)) return res.status(400).json({ error: 'بخش نامعتبر است' });
    if (!(name || '').trim()) return res.status(400).json({ error: 'نام پوشه الزامی است' });
    if (parent && !(await pool.query('SELECT 1 FROM doc_folders WHERE id=$1 AND area=$2', [parent, area])).rows[0])
      return res.status(400).json({ error: 'پوشه والد نامعتبر است' });
    const r = await pool.query('INSERT INTO doc_folders (area, parent_id, name, created_by) VALUES ($1,$2,$3,$4) RETURNING id',
      [area, parent, name.trim().slice(0, 200), req.user.id]);
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { next(e); }
});

router.delete('/folder/:id', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const c = await pool.query(`SELECT (SELECT COUNT(*)::int FROM doc_folders WHERE parent_id=$1) + (SELECT COUNT(*)::int FROM doc_files WHERE folder_id=$1) AS n`, [id]);
    if (c.rows[0].n > 0) return res.status(400).json({ error: 'ابتدا محتویات پوشه را حذف کنید' });
    await pool.query('DELETE FROM doc_folders WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.post('/file', requireRole(...MANAGE), handleUpload, async (req, res, next) => {
  const bail = (m, code = 400) => { if (req.file) removeFile(req.file.filename); return res.status(code).json({ error: m }); };
  try {
    const { area } = req.body, folder = parseInt(req.body.folder_id) || null;
    if (!AREAS.includes(area)) return bail('بخش نامعتبر است');
    if (!req.file) return bail('فایل را انتخاب کنید');
    if (folder && !(await pool.query('SELECT 1 FROM doc_folders WHERE id=$1 AND area=$2', [folder, area])).rows[0]) return bail('پوشه نامعتبر است');
    const r = await pool.query(`INSERT INTO doc_files (area, folder_id, file_name, file_path, file_size, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [area, folder, req.file.originalname, req.file.filename, req.file.size, req.user.id]);
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { if (req.file) removeFile(req.file.filename); next(e); }
});

router.get('/file/:id/download', async (req, res, next) => {
  try {
    const d = (await pool.query('SELECT file_name, file_path FROM doc_files WHERE id=$1', [req.params.id])).rows[0];
    if (!d) return res.status(404).json({ error: 'یافت نشد' });
    sendFile(res, d.file_path, d.file_name);
  } catch (e) { next(e); }
});

router.delete('/file/:id', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const r = await pool.query('DELETE FROM doc_files WHERE id=$1 RETURNING file_path', [parseInt(req.params.id) || 0]);
    if (r.rows[0]) await releaseFile(r.rows[0].file_path); // اگر جدول دیگری هنوز به فایل اشاره کند، از دیسک پاک نمی‌شود
    res.json({ success: true });
  } catch (e) { next(e); }
});
module.exports = router;
