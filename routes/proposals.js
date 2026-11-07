// پروپوزال‌ها: ردیف با نام، تاریخ ارسال، وضعیت، مبلغ پیشنهادی و شماره مناقصه؛ هرکدام چند پیوست دارد
const router = require('express').Router();
const pool = require('../db');
const { authenticate, requireRole, notStaff } = require('../middleware/auth');
const { handleUpload, removeFile, releaseFile, sendFile } = require('../lib/files');
router.use(authenticate, notStaff);
const MANAGE = ['super_admin', 'ceo', 'technical_manager', 'technical_expert', 'procurement'];
const STATUSES = ['draft', 'sent', 'awaiting', 'won', 'lost', 'cancelled'];
const RUNNING = ['draft', 'sent', 'awaiting'];
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const num = v => { if (v === '' || v == null) return null; const x = Number(String(v).replace(/[,٬\s]/g, '')); return isNaN(x) ? null : x; };
const like = q => '%' + String(q).replace(/[\\%_]/g, m => '\\' + m) + '%';

const COLS = `p.id, p.title, p.title_en, p.tender_number, p.client_name, p.sent_date, p.status, p.offer_amount, p.description, p.tender_id, p.created_at, p.updated_at,
  (SELECT COUNT(*)::int FROM proposal_files f WHERE f.proposal_id = p.id) AS files_count`;

router.get('/', async (req, res, next) => {
  try {
    const q = req.query, params = [], w = ['TRUE'];
    const add = (sql, v) => { params.push(v); w.push(sql.replace('?', '$' + params.length)); };
    if (q.bucket === 'running') add('p.status = ANY(?::text[])', RUNNING);
    if (q.bucket === 'done') add('NOT (p.status = ANY(?::text[]))', RUNNING);
    if (STATUSES.includes(q.status)) add('p.status = ?', q.status);
    if (isDate(q.date_from)) add('COALESCE(p.sent_date, p.created_at::date) >= ?::date', q.date_from);
    if (isDate(q.date_to)) add('COALESCE(p.sent_date, p.created_at::date) <= ?::date', q.date_to);
    if (q.q && String(q.q).trim()) {
      params.push(like(String(q.q).trim().slice(0, 100)));
      const n = '$' + params.length;
      w.push(`(p.title ILIKE ${n} OR p.title_en ILIKE ${n} OR p.tender_number ILIKE ${n} OR p.client_name ILIKE ${n})`);
    }
    const sorts = { newest: 'p.id DESC', sent: 'p.sent_date DESC NULLS LAST, p.id DESC', amount_desc: 'p.offer_amount DESC NULLS LAST', amount_asc: 'p.offer_amount ASC NULLS LAST', name: 'p.title ASC' };
    const r = await pool.query(`SELECT ${COLS} FROM proposals p WHERE ${w.join(' AND ')} ORDER BY ${sorts[q.sort] || sorts.newest} LIMIT 1000`, params);
    res.json(r.rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id) || 0;
    const p = (await pool.query(`SELECT ${COLS} FROM proposals p WHERE p.id = $1`, [id])).rows[0];
    if (!p) return res.status(404).json({ error: 'یافت نشد' });
    const f = await pool.query(`SELECT f.id, f.file_name, f.file_size, f.created_at, u.full_name AS uploaded_by_name FROM proposal_files f LEFT JOIN users u ON u.id = f.uploaded_by WHERE f.proposal_id = $1 ORDER BY f.id`, [id]);
    res.json({ ...p, files: f.rows, can_manage: MANAGE.includes(req.user.role) });
  } catch (e) { next(e); }
});

function fields(b) {
  return { title: str(b.title, 300), title_en: str(b.title_en, 300) || null, tender_number: str(b.tender_number, 100) || null, client_name: str(b.client_name, 300) || null,
    sent_date: isDate(b.sent_date) ? b.sent_date : null, status: STATUSES.includes(b.status) ? b.status : 'draft', offer_amount: num(b.offer_amount), description: str(b.description, 5000) || null };
}
router.post('/', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const f = fields(req.body);
    if (!f.title) return res.status(400).json({ error: 'نام پروپوزال الزامی است' });
    const r = await pool.query(
      `INSERT INTO proposals (title, title_en, tender_number, client_name, sent_date, status, offer_amount, description, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [f.title, f.title_en, f.tender_number, f.client_name, f.sent_date, f.status, f.offer_amount, f.description, req.user.id]);
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { next(e); }
});
router.put('/:id', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id) || 0, f = fields(req.body);
    if (!f.title) return res.status(400).json({ error: 'نام پروپوزال الزامی است' });
    const r = await pool.query(
      `UPDATE proposals SET title=$1, title_en=$2, tender_number=$3, client_name=$4, sent_date=$5, status=$6, offer_amount=$7, description=$8, updated_at=NOW() WHERE id=$9 RETURNING id`,
      [f.title, f.title_en, f.tender_number, f.client_name, f.sent_date, f.status, f.offer_amount, f.description, id]);
    r.rows[0] ? res.json({ success: true }) : res.status(404).json({ error: 'یافت نشد' });
  } catch (e) { next(e); }
});
// تغییر سریع وضعیت از روی فهرست
router.put('/:id/status', requireRole(...MANAGE), async (req, res, next) => {
  try {
    if (!STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'وضعیت نامعتبر است' });
    await pool.query(`UPDATE proposals SET status=$1, sent_date = CASE WHEN $1 = 'sent' AND sent_date IS NULL THEN CURRENT_DATE ELSE sent_date END, updated_at=NOW() WHERE id=$2`, [req.body.status, parseInt(req.params.id) || 0]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.post('/:id/files', requireRole(...MANAGE), handleUpload, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id) || 0;
    if (!req.file) return res.status(400).json({ error: 'فایل را انتخاب کنید' });
    const p = (await pool.query('SELECT 1 FROM proposals WHERE id=$1', [id])).rows[0];
    if (!p) { removeFile(req.file.filename); return res.status(404).json({ error: 'یافت نشد' }); }
    const r = await pool.query(`INSERT INTO proposal_files (proposal_id, file_name, file_path, file_size, uploaded_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [id, req.file.originalname, req.file.filename, req.file.size, req.user.id]);
    await pool.query('UPDATE proposals SET updated_at=NOW() WHERE id=$1', [id]);
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { if (req.file) removeFile(req.file.filename); next(e); }
});
router.get('/:id/files/:fid/download', async (req, res, next) => {
  try {
    const f = (await pool.query('SELECT file_name, file_path FROM proposal_files WHERE id=$1 AND proposal_id=$2', [parseInt(req.params.fid) || 0, parseInt(req.params.id) || 0])).rows[0];
    if (!f) return res.status(404).json({ error: 'یافت نشد' });
    sendFile(res, f.file_path, f.file_name);
  } catch (e) { next(e); }
});
router.delete('/:id/files/:fid', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const f = (await pool.query('DELETE FROM proposal_files WHERE id=$1 AND proposal_id=$2 RETURNING file_path', [parseInt(req.params.fid) || 0, parseInt(req.params.id) || 0])).rows[0];
    if (f) await releaseFile(f.file_path);
    res.json({ success: true });
  } catch (e) { next(e); }
});
router.delete('/:id', requireRole(...MANAGE), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id) || 0;
    const files = await pool.query('SELECT file_path FROM proposal_files WHERE proposal_id=$1', [id]);
    const old = await pool.query('SELECT file_path FROM proposals WHERE id=$1', [id]);
    await pool.query('DELETE FROM proposals WHERE id=$1', [id]);
    for (const f of [...files.rows, ...old.rows]) await releaseFile(f.file_path);
    res.json({ success: true });
  } catch (e) { next(e); }
});
module.exports = router;
