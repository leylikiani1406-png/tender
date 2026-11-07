// رزومه‌ساز: هر رزومه دو نسخهٔ فارسی و انگلیسی دارد (data.fa / data.en) و قالب و تم رنگی خودش
const router = require('express').Router();
const pool = require('../db');
const { authenticate, notStaff } = require('../middleware/auth');
const { handleUpload, releaseFile, sendFile } = require('../lib/files');
router.use(authenticate, notStaff);
const ADMINS = ['super_admin', 'ceo', 'technical_manager'];
const TEMPLATES = ['table', 'classic', 'modern', 'compact', 'timeline'];
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const hex = (v, d) => /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v) : d;

function cleanTheme(t) {
  t = t && typeof t === 'object' ? t : {};
  return { primary: hex(t.primary, '#b3202a'), accent: hex(t.accent, '#7d1219'), paper: hex(t.paper, '#ffffff'), ink: hex(t.ink, '#1d2433'),
    logo: t.logo !== false, size: ['s', 'm', 'l'].includes(t.size) ? t.size : 'm' };
}
const list = (a, n, m) => (Array.isArray(a) ? a : []).slice(0, n).map(x => {
  if (typeof x === 'string') return str(x, m);
  const o = {}; Object.keys(x || {}).slice(0, 12).forEach(k => { o[str(k, 30)] = str(x[k], 1500); }); return o;
});
function cleanLang(d) {
  d = d && typeof d === 'object' ? d : {};
  const o = {};
  ['name', 'title', 'email', 'phone', 'address', 'website', 'years'].forEach(k => { o[k] = str(d[k], 200); });
  o.summary = str(d.summary, 3000);
  ['experience', 'education', 'projects', 'certificates'].forEach(k => { o[k] = list(d[k], 40, 1500); });
  ['skills', 'languages'].forEach(k => { o[k] = list(d[k], 60, 200); });
  return o;
}
const cleanData = d => ({ fa: cleanLang(d && d.fa), en: cleanLang(d && d.en) });
const canEdit = (r, u) => ADMINS.includes(u.role) || r.owner_id === u.id || r.created_by === u.id;

router.get('/', async (req, res, next) => {
  try {
    const params = [];
    let w = 'TRUE';
    if (req.query.q && String(req.query.q).trim()) {
      params.push('%' + String(req.query.q).trim().slice(0, 100).replace(/[\\%_]/g, m => '\\' + m) + '%');
      w = `(r.title ILIKE $1 OR r.data->'fa'->>'name' ILIKE $1 OR r.data->'en'->>'name' ILIKE $1 OR r.data->'fa'->>'title' ILIKE $1)`;
    }
    const r = await pool.query(`SELECT r.id, r.title, r.lang, r.template, r.owner_id, r.created_by, r.updated_at, r.attach_name,
        r.data->'fa'->>'name' AS name_fa, r.data->'en'->>'name' AS name_en, r.data->'fa'->>'title' AS job_fa, u.full_name AS owner_name
      FROM resumes r LEFT JOIN users u ON u.id = r.owner_id WHERE ${w} ORDER BY r.updated_at DESC LIMIT 500`, params);
    res.json(r.rows.map(x => ({ ...x, can_edit: canEdit(x, req.user) })));
  } catch (e) { next(e); }
});
router.get('/:id', async (req, res, next) => {
  try {
    const r = (await pool.query('SELECT * FROM resumes WHERE id = $1', [parseInt(req.params.id) || 0])).rows[0];
    if (!r) return res.status(404).json({ error: 'یافت نشد' });
    res.json({ ...r, can_edit: canEdit(r, req.user) });
  } catch (e) { next(e); }
});
router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const title = str(b.title, 200);
    if (!title) return res.status(400).json({ error: 'عنوان رزومه الزامی است' });
    const r = await pool.query(`INSERT INTO resumes (owner_id, title, lang, template, theme, data, created_by) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$1) RETURNING id`,
      [req.user.id, title, b.lang === 'en' ? 'en' : 'fa', TEMPLATES.includes(b.template) ? b.template : 'classic', JSON.stringify(cleanTheme(b.theme)), JSON.stringify(cleanData(b.data))]);
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { next(e); }
});
async function load(req, res) {
  const r = (await pool.query('SELECT * FROM resumes WHERE id = $1', [parseInt(req.params.id) || 0])).rows[0];
  if (!r) { res.status(404).json({ error: 'یافت نشد' }); return null; }
  if (!canEdit(r, req.user)) { res.status(403).json({ error: 'فقط سازندهٔ رزومه یا مدیر می‌تواند آن را تغییر دهد' }); return null; }
  return r;
}
router.put('/:id', async (req, res, next) => {
  try {
    const r = await load(req, res); if (!r) return;
    const b = req.body || {};
    const title = b.title === undefined ? r.title : str(b.title, 200);
    if (!title) return res.status(400).json({ error: 'عنوان رزومه الزامی است' });
    await pool.query(`UPDATE resumes SET title=$1, lang=$2, template=$3, theme=$4::jsonb, data=$5::jsonb, updated_at=NOW() WHERE id=$6`,
      [title, b.lang === 'en' ? 'en' : b.lang === 'fa' ? 'fa' : r.lang, TEMPLATES.includes(b.template) ? b.template : r.template,
        JSON.stringify(b.theme === undefined ? r.theme : cleanTheme(b.theme)), JSON.stringify(b.data === undefined ? r.data : cleanData(b.data)), r.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const r = (await pool.query('SELECT * FROM resumes WHERE id = $1', [parseInt(req.params.id) || 0])).rows[0];
    if (!r) return res.status(404).json({ error: 'یافت نشد' });
    const n = await pool.query(`INSERT INTO resumes (owner_id, title, lang, template, theme, data, created_by) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$1) RETURNING id`,
      [req.user.id, str(r.title + ' (کپی)', 200), r.lang, r.template, JSON.stringify(r.theme), JSON.stringify(r.data)]);
    res.status(201).json({ id: n.rows[0].id });
  } catch (e) { next(e); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    const r = await load(req, res); if (!r) return;
    await pool.query('DELETE FROM resumes WHERE id = $1', [r.id]);
    await releaseFile(r.attach_path);
    res.json({ success: true });
  } catch (e) { next(e); }
});
// فایل پیوست (مثلاً رزومهٔ اصلی یا مدرک)
router.post('/:id/attach', handleUpload, async (req, res, next) => {
  try {
    const r = await load(req, res); if (!r) { if (req.file) require('../lib/files').removeFile(req.file.filename); return; }
    if (!req.file) return res.status(400).json({ error: 'فایلی انتخاب نشده است' });
    await pool.query('UPDATE resumes SET attach_name=$1, attach_path=$2, updated_at=NOW() WHERE id=$3', [req.file.originalname.slice(0, 300), req.file.filename, r.id]);
    await releaseFile(r.attach_path);
    res.status(201).json({ success: true });
  } catch (e) { next(e); }
});
router.get('/:id/attach', async (req, res, next) => {
  try {
    const r = (await pool.query('SELECT attach_name, attach_path FROM resumes WHERE id = $1', [parseInt(req.params.id) || 0])).rows[0];
    if (!r || !r.attach_path) return res.status(404).json({ error: 'فایل پیدا نشد' });
    sendFile(res, r.attach_path, r.attach_name);
  } catch (e) { next(e); }
});
router.delete('/:id/attach', async (req, res, next) => {
  try {
    const r = await load(req, res); if (!r) return;
    await pool.query('UPDATE resumes SET attach_name=NULL, attach_path=NULL WHERE id=$1', [r.id]);
    await releaseFile(r.attach_path);
    res.json({ success: true });
  } catch (e) { next(e); }
});
module.exports = router;
