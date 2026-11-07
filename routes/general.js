// مناقصات عمومی (نفت و گاز): خط لولهٔ فرصت‌ها، تصمیم شرکت/عدم شرکت، استانداردها، ریسک، رقبا، کارها، پیوست و داشبورد
const router = require('express').Router();
const pool = require('../db');
const { authenticate, requireRole, notStaff } = require('../middleware/auth');
const { handleUpload, releaseFile, removeFile, sendFile } = require('../lib/files');
router.use(authenticate, notStaff);

const EDIT = ['super_admin', 'ceo', 'technical_manager', 'technical_expert', 'procurement'];
const DECIDE = ['super_admin', 'ceo', 'technical_manager'];
const TECH = ['super_admin', 'technical_manager'], CEO = ['super_admin', 'ceo'], FIN = ['super_admin', 'financial'], PROC = ['super_admin', 'procurement', 'ceo'], ASSIGN = ['super_admin', 'technical_manager', 'ceo'];
const isOpen = g => ['identified', 'qualifying', 'preparing', 'submitted'].includes(g.stage);
const hist = (db, id, uid, note) => db.query('INSERT INTO gen_history (tender_id, user_id, note) VALUES ($1,$2,$3)', [id, uid, note]);
const REMOVE = ['super_admin', 'ceo'];
const CATS = ['upstream', 'downstream', 'drilling', 'pipeline', 'epc', 'supply', 'services', 'hse', 'other'];
const STAGES = ['identified', 'qualifying', 'preparing', 'submitted', 'won', 'lost', 'no_bid'];
const OPEN = ['identified', 'qualifying', 'preparing', 'submitted'];
const STD_STATE = ['required', 'compliant', 'gap', 'na'];
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const num = v => { if (v === '' || v == null) return null; const x = Number(String(v).replace(/[,٬\s]/g, '')); return isNaN(x) ? null : x; };
const like = q => '%' + String(q).replace(/[\\%_]/g, m => '\\' + m) + '%';
const clamp = (v, a, b) => { const x = parseInt(v); return isNaN(x) ? null : Math.min(b, Math.max(a, x)); };

const COLS = `g.id, g.title, g.tender_number, g.client_name, g.category, g.location, g.est_value, g.currency, g.publish_date, g.deadline,
  g.stage, g.bid_decision, g.probability, g.received_date, g.base_amount, g.our_offer, g.guarantee_amount, g.tech_done, g.ceo_decision, g.needs_guarantee, g.guarantee_status, g.closed_ack, g.owner_id, g.created_at, g.updated_at, u.full_name AS owner_name,
  (SELECT COUNT(*)::int FROM gen_files f WHERE f.tender_id = g.id) AS files_count`;

// ── کاتالوگ استانداردها ──
router.get('/standards', async (req, res, next) => {
  try { res.json((await pool.query('SELECT id, code, title, body, topic, note FROM gen_standards ORDER BY body, code')).rows); } catch (e) { next(e); }
});
router.post('/standards', requireRole(...DECIDE), async (req, res, next) => {
  try {
    const b = req.body || {}, code = str(b.code, 60), title = str(b.title, 300);
    if (!code || !title) return res.status(400).json({ error: 'کد و عنوان استاندارد الزامی است' });
    const r = await pool.query(`INSERT INTO gen_standards (code, title, body, topic, note) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code) DO NOTHING RETURNING id`,
      [code, title, str(b.body, 40) || 'سایر', str(b.topic, 40) || 'general', str(b.note, 500) || null]);
    if (!r.rows.length) return res.status(400).json({ error: 'این کد قبلاً ثبت شده است' });
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { next(e); }
});
router.delete('/standards/:id', requireRole(...DECIDE), async (req, res, next) => {
  try { await pool.query('DELETE FROM gen_standards WHERE id = $1', [parseInt(req.params.id) || 0]); res.json({ success: true }); } catch (e) { next(e); }
});

// ── داشبورد ──
router.get('/summary', async (req, res, next) => {
  try {
    const q = s => pool.query(s).then(r => r.rows);
    const [stages, cats, months, upcoming, win, gaps] = await Promise.all([
      q(`SELECT stage, COUNT(*)::int AS n, COALESCE(SUM(est_value),0)::float8 AS value FROM gen_tenders GROUP BY stage`),
      q(`SELECT category, COUNT(*)::int AS n, COALESCE(SUM(est_value),0)::float8 AS value FROM gen_tenders GROUP BY category ORDER BY n DESC`),
      q(`SELECT to_char(deadline,'YYYY-MM') AS m, COUNT(*)::int AS n FROM gen_tenders WHERE deadline IS NOT NULL AND deadline >= CURRENT_DATE - INTERVAL '60 days' GROUP BY 1 ORDER BY 1 LIMIT 18`),
      q(`SELECT id, title, client_name, deadline, stage, (deadline - CURRENT_DATE) AS days_left FROM gen_tenders WHERE stage IN ('identified','qualifying','preparing') AND deadline IS NOT NULL AND deadline >= CURRENT_DATE ORDER BY deadline LIMIT 8`),
      q(`SELECT COUNT(*) FILTER (WHERE stage='won')::int AS won, COUNT(*) FILTER (WHERE stage='lost')::int AS lost, COUNT(*) FILTER (WHERE stage='no_bid')::int AS no_bid,
           COALESCE(SUM(est_value) FILTER (WHERE stage IN ('identified','qualifying','preparing','submitted')),0)::float8 AS pipeline,
           COALESCE(SUM(est_value * probability / 100.0) FILTER (WHERE stage IN ('identified','qualifying','preparing','submitted')),0)::float8 AS weighted FROM gen_tenders`),
      q(`SELECT COUNT(*)::int AS n FROM gen_tenders g, jsonb_each_text(g.standards) s WHERE s.value = 'gap' AND g.stage IN ('identified','qualifying','preparing','submitted')`)
    ]);
    const w = win[0], decided = w.won + w.lost;
    res.json({ stages, categories: cats, deadlines_by_month: months, upcoming: upcoming.map(x => ({ ...x, days_left: Number(x.days_left) })),
      totals: { ...w, win_rate: decided ? Math.round((w.won / decided) * 100) : null, open_gaps: gaps[0].n } });
  } catch (e) { next(e); }
});


// ═════════ گردش‌کار: کارتابل، بررسی فنی، تصمیم مدیرعامل، ضمانت‌نامه، ارجاع، کامنت و اعلان تغییرات ═════════
const gget = async id => (await pool.query('SELECT * FROM gen_tenders WHERE id = $1', [id])).rows[0];
const CART_COLS = `g.id, g.title, g.tender_number, g.client_name, g.category, g.received_date, g.deadline, g.base_amount, g.est_value, g.currency, g.guarantee_amount, g.our_offer, g.stage, g.tech_done, g.ceo_decision,
  g.needs_guarantee, g.guarantee_status, g.closed_ack, g.created_at,
  (SELECT MAX(c.created_at) FROM gen_changes c WHERE c.tender_id = g.id) AS last_change_at,
  (SELECT COUNT(*)::int FROM gen_comments c WHERE c.tender_id = g.id) AS comments_count,
  (SELECT COUNT(*)::int FROM gen_assignments a WHERE a.tender_id = g.id AND a.status = 'open') AS open_tasks`;
router.get('/cartable', async (req, res, next) => {
  try {
    const role = req.user.role, admin = role === 'super_admin', out = [];
    const rows = (await pool.query(`SELECT ${CART_COLS} FROM gen_tenders g WHERE g.stage IN ('identified','qualifying','preparing','submitted') OR (g.stage = 'no_bid' AND NOT g.closed_ack) ORDER BY g.deadline ASC NULLS LAST, g.id DESC`)).rows;
    const mine = (await pool.query(`SELECT a.id AS aid, a.task, a.doc_key, a.due_date AS task_due, a.status AS task_status, ${CART_COLS} FROM gen_assignments a JOIN gen_tenders g ON g.id = a.tender_id WHERE a.user_id = $1 AND g.stage IN ('identified','qualifying','preparing','submitted') ORDER BY (a.status = 'open') DESC`, [req.user.id])).rows;
    const add = (g, code, wait) => out.push({ ...g, code, wait: !!wait });
    rows.forEach(g => {
      const pre = ['identified', 'qualifying'].includes(g.stage);
      if ((role === 'technical_manager' || admin) && pre && !g.tech_done) add(g, 'tech_review');
      if ((role === 'ceo' || admin) && pre && !g.ceo_decision) add(g, g.tech_done ? 'ceo_decide' : 'ceo_decide_early');
      if ((role === 'financial' || admin) && g.needs_guarantee && g.guarantee_status === 'pending') add(g, 'guarantee_request');
      if (role === 'procurement' || admin) {
        if (g.stage === 'no_bid' && !g.closed_ack) add(g, 'closed');
        if (g.stage === 'preparing') add(g, g.needs_guarantee && g.guarantee_status === 'pending' ? 'prep_guarantee_wait' : 'preparing');
        if (g.stage === 'submitted') add(g, 'submitted', true);
        if (pre && role === 'procurement') add(g, 'waiting', true);
      }
      if (role === 'technical_expert' && pre) add(g, 'expert_review', true);
    });
    mine.forEach(g => { if (!out.some(o => o.id === g.id && o.code === 'my_task')) out.push({ ...g, code: g.task_status === 'done' ? 'my_task_done' : 'my_task', wait: g.task_status === 'done' }); });
    const now = Date.now();
    res.json(out.map(x => { const dl = x.deadline ? Math.ceil((new Date(String(x.deadline).slice(0, 10) + 'T12:00:00Z') - now) / 86400000) : null, flags = [];
      if (x.created_at && now - new Date(x.created_at) < 7 * 86400000) flags.push('new');
      if (x.last_change_at && now - new Date(x.last_change_at) < 7 * 86400000) flags.push('changed');
      if (dl != null && dl >= 0 && dl <= 3) flags.push('due_soon'); if (dl != null && dl < 0) flags.push('overdue');
      return { ...x, days_left: dl, flags }; }));
  } catch (e) { next(e); }
});

// بررسی فنی مدیر دفتر فنی: روش انجام، زمان‌بندی، قیمت پیشنهادی (و انطباق با استانداردها در تب استانداردها)
router.put('/:id/tech', requireRole(...TECH), async (req, res, next) => {
  try {
    const g = await gget(parseInt(req.params.id) || 0); if (!g) return res.status(404).json({ error: 'یافت نشد' });
    if (!['identified', 'qualifying'].includes(g.stage)) return res.status(400).json({ error: 'بررسی فنی فقط تا قبل از تصمیم مدیرعامل ممکن است' });
    const b = req.body || {}, done = !!b.done;
    if (done && !str(b.method, 5000) && !str(b.schedule, 5000)) return res.status(400).json({ error: 'روش انجام کار یا برنامهٔ زمان‌بندی را وارد کنید' });
    await pool.query(`UPDATE gen_tenders SET method=$1, schedule=$2, our_offer=$3, tech_done=$4, tech_at=CASE WHEN $4 THEN NOW() ELSE NULL END, stage=CASE WHEN $4 AND stage='identified' THEN 'qualifying' ELSE stage END, updated_at=NOW() WHERE id=$5`,
      [str(b.method, 5000) || null, str(b.schedule, 5000) || null, num(b.our_offer), done, g.id]);
    if (done) await hist(pool, g.id, req.user.id, 'بررسی فنی ثبت شد (روش انجام، زمان‌بندی و قیمت پیشنهادی)');
    res.json({ success: true });
  } catch (e) { next(e); }
});
// مدیرعامل: دروازهٔ تصمیم شرکت / عدم شرکت
router.post('/:id/ceo', requireRole(...CEO), async (req, res, next) => {
  try {
    const g = await gget(parseInt(req.params.id) || 0); if (!g) return res.status(404).json({ error: 'یافت نشد' });
    if (!['identified', 'qualifying'].includes(g.stage)) return res.status(400).json({ error: 'تصمیم این مناقصه قبلاً ثبت شده است' });
    const b = req.body || {}; if (!['yes', 'no'].includes(b.decision)) return res.status(400).json({ error: 'تصمیم نامعتبر است' });
    const yes = b.decision === 'yes', gr = yes && !!b.needs_guarantee, ga = gr && b.guarantee_amount != null && b.guarantee_amount !== '' ? num(b.guarantee_amount) : g.guarantee_amount;
    await pool.query(`UPDATE gen_tenders SET ceo_decision=$1, ceo_decided_at=NOW(), ceo_note=$2, bid_decision=$3, stage=$4, needs_guarantee=$5, guarantee_status=$6, guarantee_amount=$7, closed_ack=FALSE, updated_at=NOW() WHERE id=$8`,
      [b.decision, str(b.note, 2000) || null, yes ? 'bid' : 'no_bid', yes ? 'preparing' : 'no_bid', gr, gr ? 'pending' : null, ga, g.id]);
    await hist(pool, g.id, req.user.id, (yes ? 'تصمیم: شرکت در مناقصه' + (gr ? ' · نیازمند ضمانت‌نامه (ارجاع به مالی)' : '') : 'تصمیم: عدم شرکت در مناقصه') + (str(b.note, 2000) ? ' · ' + str(b.note, 2000) : ''));
    res.json({ success: true });
  } catch (e) { next(e); }
});
router.post('/:id/ceo-reset', requireRole(...CEO), async (req, res, next) => {
  try {
    const g = await gget(parseInt(req.params.id) || 0); if (!g) return res.status(404).json({ error: 'یافت نشد' });
    if (!g.ceo_decision || ['won', 'lost'].includes(g.stage)) return res.status(400).json({ error: 'امکان ویرایش تصمیم وجود ندارد' });
    if (g.guarantee_status === 'received') return res.status(400).json({ error: 'ضمانت‌نامه دریافت شده است' });
    await pool.query(`UPDATE gen_tenders SET stage=CASE WHEN tech_done THEN 'qualifying' ELSE 'identified' END, ceo_decision=NULL, bid_decision=NULL, needs_guarantee=FALSE, guarantee_status=NULL, closed_ack=FALSE, updated_at=NOW() WHERE id=$1`, [g.id]);
    await hist(pool, g.id, req.user.id, 'تصمیم مدیرعامل بازگردانده شد');
    res.json({ success: true });
  } catch (e) { next(e); }
});
router.post('/:id/guarantee', requireRole(...FIN), async (req, res, next) => {
  try {
    const g = await gget(parseInt(req.params.id) || 0); if (!g) return res.status(404).json({ error: 'یافت نشد' });
    if (!g.needs_guarantee || g.guarantee_status !== 'pending') return res.status(400).json({ error: 'درخواست ضمانت‌نامه‌ای در انتظار نیست' });
    const amt = req.body.amount != null && req.body.amount !== '' ? num(req.body.amount) : g.guarantee_amount;
    await pool.query(`UPDATE gen_tenders SET guarantee_status='received', guarantee_at=NOW(), guarantee_note=$1, guarantee_amount=$2, updated_at=NOW() WHERE id=$3`, [str(req.body.note, 2000) || null, amt, g.id]);
    await hist(pool, g.id, req.user.id, 'ضمانت‌نامه دریافت شد و برای کارشناس ارسال شد');
    res.json({ success: true });
  } catch (e) { next(e); }
});
router.post('/:id/ack', requireRole(...PROC), async (req, res, next) => {
  try { await pool.query(`UPDATE gen_tenders SET closed_ack=TRUE WHERE id=$1 AND stage='no_bid'`, [parseInt(req.params.id) || 0]); res.json({ success: true }); } catch (e) { next(e); }
});
// فهرست مدارک بستهٔ پیشنهاد (چک‌لیست) + ریسک/فرصت
router.put('/:id/checklist', requireRole(...EDIT), async (req, res, next) => {
  try {
    const src = (req.body && req.body.checklist) || {}, out = {};
    Object.keys(src).slice(0, 80).forEach(k => { if (/^[a-z0-9_]{1,40}$/.test(k)) out[k] = !!src[k]; });
    const r = await pool.query('UPDATE gen_tenders SET checklist=$1::jsonb, updated_at=NOW() WHERE id=$2', [JSON.stringify(out), parseInt(req.params.id) || 0]);
    if (!r.rowCount) return res.status(404).json({ error: 'یافت نشد' }); res.json({ success: true });
  } catch (e) { next(e); }
});
router.put('/:id/riskopp', requireRole(...EDIT), async (req, res, next) => {
  try {
    await pool.query('UPDATE gen_tenders SET risk_text=$1, opportunity_text=$2, updated_at=NOW() WHERE id=$3', [str(req.body.risk_text, 3000) || null, str(req.body.opportunity_text, 3000) || null, parseInt(req.params.id) || 0]);
    res.json({ success: true });
  } catch (e) { next(e); }
});
// ارجاع تهیهٔ مدارک به همکاران
router.post('/:id/assignments', requireRole(...ASSIGN), async (req, res, next) => {
  try {
    const g = await gget(parseInt(req.params.id) || 0); if (!g) return res.status(404).json({ error: 'یافت نشد' });
    if (!isOpen(g)) return res.status(400).json({ error: 'مناقصه بسته شده است' });
    const name = str(req.body.assignee_name, 200); if (!name) return res.status(400).json({ error: 'نام فرد ارجاع‌شده را وارد کنید' });
    const u = (await pool.query(`SELECT id, full_name FROM users WHERE is_active AND role <> 'staff' AND (id = $2 OR full_name = $1 OR username = $1 OR personnel_no = $1) ORDER BY (id = $2) DESC LIMIT 1`, [name, parseInt(req.body.user_id) || 0])).rows[0];
    const r = await pool.query('INSERT INTO gen_assignments (tender_id, user_id, assignee_name, doc_key, task, due_date, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [g.id, u ? u.id : null, u ? u.full_name : name, str(req.body.doc_key, 30) || null, str(req.body.task, 3000) || null, isDate(req.body.due_date) ? req.body.due_date : null, req.user.id]);
    await hist(pool, g.id, req.user.id, 'ارجاع تهیهٔ مدرک به: ' + (u ? u.full_name : name) + (str(req.body.task, 200) ? ' — ' + str(req.body.task, 200) : ''));
    res.status(201).json({ id: r.rows[0].id, linked: !!u });
  } catch (e) { next(e); }
});
router.put('/:id/assignments/:aid', async (req, res, next) => {
  try {
    const g = await gget(parseInt(req.params.id) || 0); if (!g) return res.status(404).json({ error: 'یافت نشد' });
    const a = (await pool.query('SELECT * FROM gen_assignments WHERE id=$1 AND tender_id=$2', [parseInt(req.params.aid) || 0, g.id])).rows[0];
    if (!a) return res.status(404).json({ error: 'ارجاع یافت نشد' });
    if (!ASSIGN.includes(req.user.role) && a.user_id !== req.user.id) return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    if (!['open', 'done'].includes(req.body.status)) return res.status(400).json({ error: 'وضعیت نامعتبر است' });
    await pool.query(`UPDATE gen_assignments SET status=$1, done_at=CASE WHEN $1='done' THEN NOW() ELSE NULL END WHERE id=$2`, [req.body.status, a.id]);
    await hist(pool, g.id, req.user.id, (req.body.status === 'done' ? 'مدرک آماده شد: ' : 'کار ارجاعی دوباره باز شد: ') + a.assignee_name);
    res.json({ success: true });
  } catch (e) { next(e); }
});
router.delete('/:id/assignments/:aid', requireRole(...ASSIGN), async (req, res, next) => {
  try { await pool.query('DELETE FROM gen_assignments WHERE id=$1 AND tender_id=$2', [parseInt(req.params.aid) || 0, parseInt(req.params.id) || 0]); res.json({ success: true }); } catch (e) { next(e); }
});
// کامنت
router.post('/:id/comments', async (req, res, next) => {
  try {
    const body = str(req.body.body, 3000); if (!body) return res.status(400).json({ error: 'متن کامنت را بنویسید' });
    const g = await gget(parseInt(req.params.id) || 0); if (!g) return res.status(404).json({ error: 'یافت نشد' });
    const r = await pool.query('INSERT INTO gen_comments (tender_id, user_id, body) VALUES ($1,$2,$3) RETURNING id', [g.id, req.user.id, body]);
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { next(e); }
});
router.delete('/:id/comments/:cid', async (req, res, next) => {
  try {
    const c = (await pool.query('SELECT user_id FROM gen_comments WHERE id=$1 AND tender_id=$2', [parseInt(req.params.cid) || 0, parseInt(req.params.id) || 0])).rows[0];
    if (!c) return res.status(404).json({ error: 'کامنت یافت نشد' });
    if (c.user_id !== req.user.id && req.user.role !== 'super_admin') return res.status(403).json({ error: 'دسترسی مجاز نیست' });
    await pool.query('DELETE FROM gen_comments WHERE id=$1', [parseInt(req.params.cid)]); res.json({ success: true });
  } catch (e) { next(e); }
});
// اعلان تغییرات
const GCH = { guarantee_amount: 'مبلغ ضمانت‌نامه', base_amount: 'مبلغ پایه', deadline: 'مهلت ارسال پیشنهاد', our_offer: 'مبلغ پیشنهادی ما' };
router.post('/:id/changes', requireRole('super_admin', 'ceo', 'technical_manager', 'procurement', 'financial'), async (req, res, next) => {
  try {
    const g = await gget(parseInt(req.params.id) || 0); if (!g) return res.status(404).json({ error: 'یافت نشد' });
    if (!isOpen(g)) return res.status(400).json({ error: 'مناقصه بسته شده است' });
    const title = str(req.body.title, 300); if (!title) return res.status(400).json({ error: 'عنوان تغییر را بنویسید' });
    const field = GCH[req.body.field] ? req.body.field : null; let o = null, nv = null;
    if (field) {
      const isD = field === 'deadline'; if (isD ? !isDate(req.body.new_value) : num(req.body.new_value) == null) return res.status(400).json({ error: 'مقدار جدید معتبر نیست' });
      o = g[field] == null ? null : String(isD ? String(g[field]).slice(0, 10) : g[field]); nv = isD ? req.body.new_value : String(num(req.body.new_value));
    }
    const r = await pool.query('INSERT INTO gen_changes (tender_id, title, body, field, old_value, new_value, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [g.id, title, str(req.body.body, 4000) || null, field, o, nv, req.user.id]);
    if (field && req.body.apply !== false) await pool.query(`UPDATE gen_tenders SET ${field} = $1, updated_at = NOW() WHERE id = $2`, [nv, g.id]);
    await hist(pool, g.id, req.user.id, 'اعلان تغییر: ' + title + (field ? ` (${GCH[field]}: ${o ?? '—'} ← ${nv})` : ''));
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { next(e); }
});
router.delete('/:id/changes/:cid', requireRole('super_admin', 'ceo', 'technical_manager', 'procurement'), async (req, res, next) => {
  try {
    const cid = parseInt(req.params.cid) || 0, id = parseInt(req.params.id) || 0;
    const files = (await pool.query(`DELETE FROM gen_files WHERE change_id=$1 AND tender_id=$2 AND kind='change' RETURNING file_path`, [cid, id])).rows;
    await pool.query('DELETE FROM gen_changes WHERE id=$1 AND tender_id=$2', [cid, id]);
    for (const f of files) await releaseFile(f.file_path); res.json({ success: true });
  } catch (e) { next(e); }
});

// ── فهرست و CRUD ──
router.get('/', async (req, res, next) => {
  try {
    const q = req.query, params = [], w = ['TRUE'];
    const add = (sql, v) => { params.push(v); w.push(sql.replace('?', '$' + params.length)); };
    if (STAGES.includes(q.stage)) add('g.stage = ?', q.stage);
    if (q.bucket === 'open') add('g.stage = ANY(?::text[])', OPEN);
    if (q.bucket === 'closed') add('NOT (g.stage = ANY(?::text[]))', OPEN);
    if (CATS.includes(q.category)) add('g.category = ?', q.category);
    if (isDate(q.date_from)) add('g.deadline >= ?::date', q.date_from);
    if (isDate(q.date_to)) add('g.deadline <= ?::date', q.date_to);
    if (q.q && String(q.q).trim()) {
      params.push(like(String(q.q).trim().slice(0, 100))); const n = '$' + params.length;
      w.push(`(g.title ILIKE ${n} OR g.tender_number ILIKE ${n} OR g.client_name ILIKE ${n} OR g.location ILIKE ${n})`);
    }
    const sorts = { newest: 'g.id DESC', deadline: 'g.deadline ASC NULLS LAST', value_desc: 'g.est_value DESC NULLS LAST', prob_desc: 'g.probability DESC NULLS LAST' };
    const r = await pool.query(`SELECT ${COLS} FROM gen_tenders g LEFT JOIN users u ON u.id = g.owner_id WHERE ${w.join(' AND ')} ORDER BY ${sorts[q.sort] || sorts.newest} LIMIT 1000`, params);
    res.json(r.rows);
  } catch (e) { next(e); }
});
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id) || 0;
    const g = (await pool.query(`SELECT ${COLS}, g.bid_score, g.standards, g.risks, g.competitors, g.tasks, g.notes FROM gen_tenders g LEFT JOIN users u ON u.id = g.owner_id WHERE g.id = $1`, [id])).rows[0];
    if (!g) return res.status(404).json({ error: 'یافت نشد' });
    const f = await pool.query(`SELECT f.id, f.kind, f.assignment_id, f.change_id, f.file_name, f.file_size, f.created_at, u.full_name AS uploaded_by_name FROM gen_files f LEFT JOIN users u ON u.id = f.uploaded_by WHERE f.tender_id = $1 ORDER BY f.id`, [id]);
    const w = (await pool.query('SELECT method, schedule, ceo_note, guarantee_note, guarantee_at, ceo_decided_at, tech_at, checklist, risk_text, opportunity_text FROM gen_tenders WHERE id = $1', [id])).rows[0];
    const asg = (await pool.query('SELECT * FROM gen_assignments WHERE tender_id = $1 ORDER BY id', [id])).rows;
    const hs = (await pool.query('SELECT h.id, h.note, h.created_at, u.full_name FROM gen_history h LEFT JOIN users u ON u.id = h.user_id WHERE h.tender_id = $1 ORDER BY h.id DESC', [id])).rows;
    const cm = (await pool.query('SELECT c.id, c.body, c.created_at, c.user_id, u.full_name FROM gen_comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.tender_id = $1 ORDER BY c.id DESC', [id])).rows;
    const ch = (await pool.query('SELECT c.*, u.full_name FROM gen_changes c LEFT JOIN users u ON u.id = c.created_by WHERE c.tender_id = $1 ORDER BY c.id DESC', [id])).rows;
    const r = req.user.role, open = isOpen(g);
    res.json({ ...g, ...w, files: f.rows, assignments: asg, history: hs, comments: cm, changes: ch, can_edit: EDIT.includes(r), can_decide: DECIDE.includes(r), can_remove: REMOVE.includes(r),
      perm: { tech: TECH.includes(r) && ['identified', 'qualifying'].includes(g.stage), ceo: CEO.includes(r) && ['identified', 'qualifying'].includes(g.stage), ceo_reset: CEO.includes(r) && !!g.ceo_decision && g.guarantee_status !== 'received' && !['won', 'lost'].includes(g.stage),
        finance: FIN.includes(r) && g.needs_guarantee && g.guarantee_status === 'pending', proc: PROC.includes(r), assign: ASSIGN.includes(r) && open, change: ['super_admin', 'ceo', 'technical_manager', 'procurement', 'financial'].includes(r) && open, edit: EDIT.includes(r), guarantee_files: FIN.includes(r) } });
  } catch (e) { next(e); }
});
function fields(b) {
  return { title: str(b.title, 300), tender_number: str(b.tender_number, 100) || null, client_name: str(b.client_name, 300) || null,
    category: CATS.includes(b.category) ? b.category : 'other', location: str(b.location, 200) || null, est_value: num(b.est_value),
    currency: ['IRR', 'USD', 'EUR', 'AED'].includes(b.currency) ? b.currency : 'IRR', publish_date: isDate(b.publish_date) ? b.publish_date : null,
    deadline: isDate(b.deadline) ? b.deadline : null, probability: clamp(b.probability, 0, 100), notes: str(b.notes, 5000) || null,
    received_date: isDate(b.received_date) ? b.received_date : null, base_amount: num(b.base_amount), guarantee_amount: num(b.guarantee_amount), risk_text: str(b.risk_text, 3000) || null, opportunity_text: str(b.opportunity_text, 3000) || null };
}
router.post('/', requireRole(...EDIT), async (req, res, next) => {
  try {
    const f = fields(req.body || {});
    if (!f.title) return res.status(400).json({ error: 'عنوان مناقصه الزامی است' });
    const r = await pool.query(`INSERT INTO gen_tenders (title, tender_number, client_name, category, location, est_value, currency, publish_date, deadline, probability, notes, owner_id, created_by, received_date, base_amount, guarantee_amount, risk_text, opportunity_text)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12, COALESCE($13::date, CURRENT_DATE), $14, $15, $16, $17) RETURNING id`,
      [f.title, f.tender_number, f.client_name, f.category, f.location, f.est_value, f.currency, f.publish_date, f.deadline, f.probability, f.notes, req.user.id, f.received_date, f.base_amount, f.guarantee_amount, f.risk_text, f.opportunity_text]);
    await hist(pool, r.rows[0].id, req.user.id, 'مناقصه ثبت شد و به کارتابل مدیر دفتر فنی و مدیرعامل رفت');
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { next(e); }
});
router.put('/:id', requireRole(...EDIT), async (req, res, next) => {
  try {
    const f = fields(req.body || {});
    if (!f.title) return res.status(400).json({ error: 'عنوان مناقصه الزامی است' });
    const r = await pool.query(`UPDATE gen_tenders SET title=$1, tender_number=$2, client_name=$3, category=$4, location=$5, est_value=$6, currency=$7,
      publish_date=$8, deadline=$9, probability=$10, notes=$11, base_amount=$13, guarantee_amount=$14, risk_text=$15, opportunity_text=$16, received_date=COALESCE($17::date, received_date), updated_at=NOW() WHERE id=$12`,
      [f.title, f.tender_number, f.client_name, f.category, f.location, f.est_value, f.currency, f.publish_date, f.deadline, f.probability, f.notes, parseInt(req.params.id) || 0, f.base_amount, f.guarantee_amount, f.risk_text, f.opportunity_text, f.received_date]);
    if (!r.rowCount) return res.status(404).json({ error: 'یافت نشد' });
    res.json({ success: true });
  } catch (e) { next(e); }
});
router.post('/:id/stage', requireRole(...EDIT), async (req, res, next) => {
  try {
    const st = req.body && req.body.stage;
    if (!STAGES.includes(st)) return res.status(400).json({ error: 'مرحله نامعتبر است' });
    if (['preparing', 'submitted'].includes(st)) {
      const d = (await pool.query('SELECT bid_decision FROM gen_tenders WHERE id = $1', [parseInt(req.params.id) || 0])).rows[0];
      if (d && d.bid_decision !== 'bid') return res.status(400).json({ error: 'ابتدا تصمیم «شرکت در مناقصه» باید ثبت شود' });
    }
    const r = await pool.query('UPDATE gen_tenders SET stage=$1, updated_at=NOW() WHERE id=$2', [st, parseInt(req.params.id) || 0]);
    if (!r.rowCount) return res.status(404).json({ error: 'یافت نشد' });
    res.json({ success: true });
  } catch (e) { next(e); }
});
// تصمیم شرکت/عدم شرکت: امتیازدهی معیارها (۱ تا ۵) و محاسبهٔ امتیاز کل؛ تصمیم نهایی را مدیر ثبت می‌کند
const CRITERIA = ['fit', 'client', 'competition', 'margin', 'capacity', 'risk'];
router.put('/:id/decision', requireRole(...DECIDE), async (req, res, next) => {
  try {
    const b = req.body || {}, score = {};
    CRITERIA.forEach(k => { const v = clamp(b.scores && b.scores[k], 1, 5); if (v) score[k] = v; });
    const r = await pool.query('UPDATE gen_tenders SET bid_score=$1::jsonb, updated_at=NOW() WHERE id=$2', [JSON.stringify(score), parseInt(req.params.id) || 0]);
    if (!r.rowCount) return res.status(404).json({ error: 'یافت نشد' });
    const vals = Object.values(score);
    res.json({ success: true, total: vals.length ? Math.round((vals.reduce((a, c) => a + c, 0) / (CRITERIA.length * 5)) * 100) : null });
  } catch (e) { next(e); }
});
// استانداردهای مرتبط با مناقصه: { "API 5L": "required", ... }
router.put('/:id/standards', requireRole(...EDIT), async (req, res, next) => {
  try {
    const src = (req.body && req.body.standards) || {}, out = {};
    Object.keys(src).slice(0, 80).forEach(k => { if (STD_STATE.includes(src[k])) out[str(k, 60)] = src[k]; });
    const r = await pool.query('UPDATE gen_tenders SET standards=$1::jsonb, updated_at=NOW() WHERE id=$2', [JSON.stringify(out), parseInt(req.params.id) || 0]);
    if (!r.rowCount) return res.status(404).json({ error: 'یافت نشد' });
    res.json({ success: true });
  } catch (e) { next(e); }
});
// ریسک‌ها، رقبا و کارها: آرایه‌هایی از شیء‌های ساده
const listPut = (col, shape) => router.put('/:id/' + col, requireRole(...EDIT), async (req, res, next) => {
  try {
    const src = Array.isArray(req.body && req.body.items) ? req.body.items.slice(0, 100) : null;
    if (!src) return res.status(400).json({ error: 'فهرست نامعتبر است' });
    const items = src.map(shape).filter(Boolean);
    const r = await pool.query(`UPDATE gen_tenders SET ${col}=$1::jsonb, updated_at=NOW() WHERE id=$2`, [JSON.stringify(items), parseInt(req.params.id) || 0]);
    if (!r.rowCount) return res.status(404).json({ error: 'یافت نشد' });
    res.json({ success: true, count: items.length });
  } catch (e) { next(e); }
});
listPut('risks', x => str(x.title, 300) ? { title: str(x.title, 300), probability: clamp(x.probability, 1, 5) || 3, impact: clamp(x.impact, 1, 5) || 3, mitigation: str(x.mitigation, 600) } : null);
listPut('competitors', x => str(x.name, 200) ? { name: str(x.name, 200), strength: str(x.strength, 400), weakness: str(x.weakness, 400), est_price: num(x.est_price) } : null);
listPut('tasks', x => str(x.title, 300) ? { title: str(x.title, 300), owner: str(x.owner, 120), due: isDate(x.due) ? x.due : null, done: !!x.done } : null);

router.delete('/:id', requireRole(...REMOVE), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id) || 0;
    const files = (await pool.query('SELECT file_path FROM gen_files WHERE tender_id = $1', [id])).rows;
    const r = await pool.query('DELETE FROM gen_tenders WHERE id = $1', [id]);
    if (!r.rowCount) return res.status(404).json({ error: 'یافت نشد' });
    for (const f of files) await releaseFile(f.file_path);
    res.json({ success: true });
  } catch (e) { next(e); }
});
// پیوست‌ها (اسناد مناقصه، ضمانت‌نامه، خروجی کار ارجاعی، پیوست اعلان تغییر)
router.post('/:id/files', handleUpload, async (req, res, next) => {
  const bail = (c, m) => { if (req.file) removeFile(req.file.filename); return res.status(c).json({ error: m }); };
  try {
    if (!req.file) return res.status(400).json({ error: 'فایلی انتخاب نشده است' });
    const id = parseInt(req.params.id) || 0, kind = ['tender', 'guarantee', 'work', 'change'].includes(req.body.kind) ? req.body.kind : 'tender', r = req.user.role;
    if (!(await pool.query('SELECT 1 FROM gen_tenders WHERE id = $1', [id])).rows.length) return bail(404, 'یافت نشد');
    if (kind === 'guarantee' ? !FIN.includes(r) : !(EDIT.includes(r) || (kind === 'change' && r === 'financial'))) return bail(403, 'دسترسی مجاز نیست');
    const aid = kind === 'work' ? parseInt(req.body.assignment_id) || null : null, cid = kind === 'change' ? parseInt(req.body.change_id) || null : null;
    const x = await pool.query('INSERT INTO gen_files (tender_id, kind, assignment_id, change_id, file_name, file_path, file_size, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [id, kind, aid, cid, req.file.originalname.slice(0, 300), req.file.filename, req.file.size, req.user.id]);
    res.status(201).json({ id: x.rows[0].id });
  } catch (e) { if (req.file) removeFile(req.file.filename); next(e); }
});
router.get('/:id/files/:fid/download', async (req, res, next) => {
  try {
    const f = (await pool.query('SELECT file_name, file_path FROM gen_files WHERE id = $1 AND tender_id = $2', [parseInt(req.params.fid) || 0, parseInt(req.params.id) || 0])).rows[0];
    if (!f) return res.status(404).json({ error: 'فایل پیدا نشد' });
    sendFile(res, f.file_path, f.file_name);
  } catch (e) { next(e); }
});
router.delete('/:id/files/:fid', requireRole(...EDIT, 'financial'), async (req, res, next) => {
  try {
    const f = (await pool.query('DELETE FROM gen_files WHERE id = $1 AND tender_id = $2 RETURNING file_path', [parseInt(req.params.fid) || 0, parseInt(req.params.id) || 0])).rows[0];
    if (!f) return res.status(404).json({ error: 'فایل پیدا نشد' });
    await releaseFile(f.file_path);
    res.json({ success: true });
  } catch (e) { next(e); }
});
module.exports = router;
