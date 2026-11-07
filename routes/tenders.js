const router = require('express').Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { handleUpload, removeFile, releaseFile, sendFile } = require('../lib/files');
const W = require('../workflow');
router.use(authenticate);

const num = v => {
  if (v === '' || v == null) return null;
  const x = Number(String(v).replace(/[,٬\s]/g, ''));
  return isNaN(x) ? null : x;
};
const str = (v, n = 5000) => (v == null ? '' : String(v).trim().slice(0, n));
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const hist = (db, id, from, to, uid, note) =>
  db.query('INSERT INTO tender_history (tender_id, from_status, to_status, user_id, note) VALUES ($1,$2,$3,$4,$5)', [id, from, to, uid, note || null]);
const deny = res => res.status(403).json({ error: 'دسترسی مجاز نیست' });
const isStaff = u => u.role === 'staff';
const like = q => '%' + String(q).replace(/[\\%_]/g, m => '\\' + m) + '%';

const LIST_COLS = `t.id, t.title, t.title_en, t.tender_number, t.client_name, t.kind, t.package_type, t.budget, t.guarantee_amount, t.our_offer,
  t.deadline, t.sent_date, t.status, t.submit_status, t.result, t.ceo_decision, t.needs_guarantee, t.guarantee_status, t.tech_done,
  t.closed_ack, t.received_date, t.year_j, t.is_archive, t.risk_text, t.opportunity_text, t.created_at, t.updated_at, t.score_quality, t.score_technical, t.score_price, t.score_total, t.rank_no, t.contract_amount, t.winner_name,
  t.feasibility->>'conclusion' AS feas_conclusion,
  (SELECT COUNT(*)::int FROM jsonb_each_text(t.checklist) e WHERE e.value = 'true') AS checklist_done,
  (SELECT COUNT(*)::int FROM tender_files f WHERE f.tender_id = t.id AND f.kind = 'tender') AS docs_count,
  (SELECT MAX(f.created_at) FROM tender_files f WHERE f.tender_id = t.id) AS last_upload_at,
  (SELECT COUNT(*)::int FROM tender_comments c WHERE c.tender_id = t.id) AS comments_count,
  (SELECT COUNT(*)::int FROM tender_changes c WHERE c.tender_id = t.id) AS changes_count,
  (SELECT MAX(c.created_at) FROM tender_changes c WHERE c.tender_id = t.id) AS last_change_at,
  (SELECT string_agg(a.assignee_name, '، ' ORDER BY a.id) FROM tender_assignments a WHERE a.tender_id = t.id) AS assignees`;

const SORTS = {
  newest: 't.id DESC', deadline: 't.deadline ASC NULLS LAST, t.id DESC', deadline_desc: 't.deadline DESC NULLS LAST, t.id DESC',
  score_desc: 't.score_total DESC NULLS LAST, t.id DESC', score_asc: 't.score_total ASC NULLS LAST, t.id DESC',
  amount_desc: 'COALESCE(t.contract_amount, t.budget) DESC NULLS LAST, t.id DESC', amount_asc: 'COALESCE(t.contract_amount, t.budget) ASC NULLS LAST, t.id DESC',
  name: 't.title ASC'
};

// شرط‌های مشترک فهرست: همکار فقط مناقصه‌های ارجاع‌شده به خودش را می‌بیند
function buildWhere(req) {
  const q = req.query, params = [], w = ['TRUE'];
  const add = (sql, v) => { params.push(v); w.push(sql.replace('?', '$' + params.length)); };
  if (isStaff(req.user)) add('EXISTS (SELECT 1 FROM tender_assignments sa WHERE sa.tender_id = t.id AND sa.user_id = ?)', req.user.id);
  if (q.bucket === 'running') add('t.status = ANY(?::text[])', W.RUNNING);
  if (q.bucket === 'done') add('t.status = ANY(?::text[])', W.DONE);
  if (W.KINDS.includes(q.kind)) add('t.kind = ?', q.kind);
  if (W.PACKAGES.includes(q.package_type)) add('t.package_type = ?', q.package_type);
  if (['review', 'active', 'closed', 'cancelled', 'finished'].includes(q.status)) add('t.status = ?', q.status);
  if (W.SUBMIT.includes(q.submit_status)) add('t.submit_status = ?', q.submit_status);
  if (['won', 'lost'].includes(q.result)) add('t.result = ?', q.result);
  if (isDate(q.date_from)) add('COALESCE(t.deadline, t.created_at::date) >= ?::date', q.date_from);
  if (isDate(q.date_to)) add('COALESCE(t.deadline, t.created_at::date) <= ?::date', q.date_to);
  if (q.q && String(q.q).trim()) {
    params.push(like(String(q.q).trim().slice(0, 100)));
    const n = '$' + params.length;
    w.push(`(t.title ILIKE ${n} OR t.title_en ILIKE ${n} OR t.tender_number ILIKE ${n} OR t.client_name ILIKE ${n} OR t.winner_name ILIKE ${n})`);
  }
  return { where: w.join(' AND '), params };
}

async function load(req, res) {
  const t = (await pool.query('SELECT * FROM tenders WHERE id=$1', [parseInt(req.params.id) || 0])).rows[0];
  if (!t) { res.status(404).json({ error: 'مناقصه یافت نشد' }); return null; }
  if (isStaff(req.user)) {
    const a = await pool.query('SELECT 1 FROM tender_assignments WHERE tender_id=$1 AND user_id=$2 LIMIT 1', [t.id, req.user.id]);
    if (!a.rows.length) { res.status(404).json({ error: 'مناقصه یافت نشد' }); return null; }
  }
  return t;
}

// ── کارتابل: آنچه از نظر نقش کاربر منتظر اقدام اوست ──
router.get('/cartable', async (req, res, next) => {
  try {
    const role = req.user.role, admin = role === 'super_admin';
    const items = [];
    if (role === 'staff') {
      const r = await pool.query(`SELECT ${LIST_COLS}, a.id AS assignment_id, a.task, a.part, a.share_percent, a.due_date AS task_due, a.status AS task_status
        FROM tender_assignments a JOIN tenders t ON t.id = a.tender_id
        WHERE a.user_id = $1 AND t.status IN ('review','active') ORDER BY (a.status = 'open') DESC, t.deadline ASC NULLS LAST`, [req.user.id]);
      r.rows.forEach(t => items.push({ ...t, code: t.task_status === 'done' ? 'my_task_done' : 'my_task', wait: t.task_status === 'done' }));
    } else {
      const r = await pool.query(`SELECT ${LIST_COLS} FROM tenders t WHERE t.status IN ('review','active','closed') ORDER BY t.id DESC`);
      r.rows.forEach(t => {
        const add = (code, wait) => items.push({ ...t, code, wait: !!wait });
        if ((role === 'technical_manager' || admin) && t.status === 'review' && !t.tech_done) add('tech_review');
        if ((role === 'ceo' || admin) && t.status === 'review' && !t.ceo_decision) add('ceo_decide');
        if ((role === 'financial' || admin) && t.needs_guarantee && t.guarantee_status === 'pending') add('guarantee_request');
        if (role === 'technical_expert' && t.status === 'review') add('expert_review', true);
        if (role === 'procurement' || admin) {
          if (t.status === 'closed' && !t.closed_ack) add('closed');
          if (t.status === 'active') add(t.needs_guarantee ? (t.guarantee_status === 'received' ? 'active_guarantee_ok' : 'active_guarantee_wait') : 'active');
          if (t.status === 'review' && role === 'procurement') add('waiting', true);
        }
      });
    }
    const ids = [...new Set(items.map(x => x.id))];
    const files = ids.length ? (await pool.query(
      `SELECT id, tender_id, kind, file_name, file_size, created_at FROM tender_files WHERE tender_id = ANY($1::int[]) AND ($2::boolean IS FALSE OR kind IN ('tender','work','change')) ORDER BY id`,
      [ids, isStaff(req.user)])).rows : [];
    const now = Date.now();
    res.json(items.map(x => {
      const fl = files.filter(f => f.tender_id === x.id);
      const dl = x.deadline ? Math.ceil((new Date(x.deadline + 'T12:00:00Z') - now) / 86400000) : null;
      const flags = [];
      if (x.created_at && now - new Date(x.created_at) < 7 * 86400000) flags.push('new');
      if (x.last_upload_at && now - new Date(x.last_upload_at) < 3 * 86400000) flags.push('uploaded');
      if (x.last_change_at && now - new Date(x.last_change_at) < 7 * 86400000) flags.push('changed');
      if (dl != null && dl >= 0 && dl <= 3) flags.push('due_soon');
      if (dl != null && dl < 0) flags.push('overdue');
      const o = { ...x, days_left: dl, flags, files: fl };
      if (isStaff(req.user)) { delete o.budget; delete o.guarantee_amount; delete o.our_offer; }
      return o;
    }));
  } catch (e) { next(e); }
});

// ── اعلان‌ها: مناقصه جدید، مهلت نزدیک/گذشته، ضمانت‌نامه، ارجاع تازه ──
router.get('/notifications', async (req, res, next) => {
  try {
    const u = req.user, role = u.role, admin = role === 'super_admin', items = [];
    const push = (key, type, level, t, message, at) => items.push({ key, type, level, tender_id: t.id, title: t.title, tender_number: t.tender_number, message, at });
    if (role === 'staff') {
      const r = await pool.query(`SELECT a.id AS aid, a.task, a.due_date, a.created_at AS a_at, t.id, t.title, t.tender_number, t.deadline,
          (CURRENT_DATE - a.created_at::date) AS age, (COALESCE(a.due_date, t.deadline) - CURRENT_DATE) AS days_left
        FROM tender_assignments a JOIN tenders t ON t.id = a.tender_id
        WHERE a.user_id = $1 AND a.status = 'open' AND t.status IN ('review','active')`, [u.id]);
      r.rows.forEach(a => {
        if (a.age <= 14) push('as:' + a.aid, 'assigned', 'info', a, 'کار جدیدی به شما ارجاع شد', a.a_at);
        if (a.days_left != null && a.days_left >= 0 && a.days_left <= 3) push('asdl:' + a.aid + ':' + (a.due_date || a.deadline), 'deadline', 'warn', a, `مهلت انجام کار: ${a.days_left} روز مانده`, null);
        if (a.days_left != null && a.days_left < 0 && a.days_left >= -30) push('asod:' + a.aid, 'overdue', 'danger', a, 'مهلت انجام کار گذشته و کار تمام نشده است', null);
      });
    } else {
      const r = await pool.query(`SELECT t.id, t.title, t.tender_number, t.deadline, t.status, t.created_at, t.needs_guarantee, t.guarantee_status, t.closed_ack,
          (t.deadline - CURRENT_DATE) AS days_left, (CURRENT_DATE - t.created_at::date) AS age
        FROM tenders t WHERE t.status IN ('review','active','closed')`);
      const watch = admin || ['procurement', 'technical_manager', 'technical_expert', 'ceo'].includes(role);
      r.rows.forEach(t => {
        const open = t.status === 'review' || t.status === 'active';
        if (watch && t.status === 'review' && t.age <= 7) push('new:' + t.id, 'new', 'info', t, 'مناقصه جدید ثبت شد', t.created_at);
        if (watch && open && t.days_left != null && t.days_left >= 0 && t.days_left <= 3)
          push('dl:' + t.id + ':' + t.deadline, 'deadline', 'warn', t, t.days_left === 0 ? 'امروز آخرین مهلت ارسال پیشنهاد است' : `مهلت ارسال پیشنهاد: ${t.days_left} روز مانده`, null);
        if (watch && open && t.days_left != null && t.days_left < 0 && t.days_left >= -30)
          push('od:' + t.id, 'overdue', 'danger', t, 'مهلت ارسال گذشته و مناقصه هنوز تمام نشده است', null);
        if ((role === 'financial' || admin) && t.needs_guarantee && t.guarantee_status === 'pending') push('gr:' + t.id, 'guarantee', 'warn', t, 'درخواست دریافت ضمانت‌نامه', null);
        if ((role === 'procurement' || admin) && t.status === 'closed' && !t.closed_ack) push('cl:' + t.id, 'closed', 'danger', t, 'مناقصه بسته شد', null);
      });
      if (admin || ['technical_manager', 'procurement'].includes(role)) {
        const d = await pool.query(`SELECT a.id AS aid, a.assignee_name, a.done_at, t.id, t.title, t.tender_number FROM tender_assignments a JOIN tenders t ON t.id = a.tender_id
          WHERE a.status = 'done' AND a.done_at > NOW() - INTERVAL '7 days'`);
        d.rows.forEach(a => push('asdone:' + a.aid, 'work_done', 'info', a, `${a.assignee_name} کار ارجاع‌شده را تمام کرد`, a.done_at));
      }
    }
    // اعلان تغییرات و کامنت‌های تازه (برای همهٔ ذی‌نفعان مناقصه)
    const chg = await pool.query(`SELECT c.id AS cid, c.title AS ctitle, c.created_at, c.created_by, t.id, t.title, t.tender_number FROM tender_changes c JOIN tenders t ON t.id = c.tender_id
      WHERE c.created_at > NOW() - INTERVAL '14 days' AND t.status IN ('review','active') AND c.created_by IS DISTINCT FROM $1
        AND ($2::boolean IS FALSE OR EXISTS (SELECT 1 FROM tender_assignments sa WHERE sa.tender_id = t.id AND sa.user_id = $1))`, [u.id, role === 'staff']);
    chg.rows.forEach(c => push('ch:' + c.cid, 'change', 'warn', c, 'اعلان تغییر: ' + c.ctitle, c.created_at));
    const cmt = await pool.query(`SELECT c.id AS cid, c.created_at, t.id, t.title, t.tender_number, us.full_name FROM tender_comments c JOIN tenders t ON t.id = c.tender_id LEFT JOIN users us ON us.id = c.user_id
      WHERE c.created_at > NOW() - INTERVAL '7 days' AND c.user_id IS DISTINCT FROM $1 AND t.status IN ('review','active')
        AND ($2::boolean IS FALSE OR EXISTS (SELECT 1 FROM tender_assignments sa WHERE sa.tender_id = t.id AND sa.user_id = $1))`, [u.id, role === 'staff']);
    cmt.rows.forEach(c => push('cm:' + c.cid, 'comment', 'info', c, 'کامنت جدید از ' + (c.full_name || '—'), c.created_at));
    const seen = new Set((await pool.query('SELECT key FROM notif_seen WHERE user_id = $1', [u.id])).rows.map(x => x.key));
    const order = { danger: 0, warn: 1, info: 2 };
    items.forEach(i => { i.seen = seen.has(i.key); });
    items.sort((a, b) => (a.seen - b.seen) || (order[a.level] - order[b.level]));
    res.json({ items, unseen: items.filter(i => !i.seen).length });
  } catch (e) { next(e); }
});
router.post('/notifications/seen', async (req, res, next) => {
  try {
    const keys = (Array.isArray(req.body.keys) ? req.body.keys : []).map(k => String(k).slice(0, 100)).slice(0, 300);
    for (const k of keys) await pool.query('INSERT INTO notif_seen (user_id, key) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, k]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ── فهرست و جزئیات ──
router.get('/', async (req, res, next) => {
  try {
    const { where, params } = buildWhere(req);
    const order = SORTS[req.query.sort] || SORTS.newest;
    const r = await pool.query(`SELECT ${LIST_COLS} FROM tenders t WHERE ${where} ORDER BY ${order} LIMIT 1000`, params);
    if (isStaff(req.user)) r.rows.forEach(x => { delete x.budget; delete x.guarantee_amount; delete x.our_offer; delete x.contract_amount; });
    res.json(r.rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const t = await load(req, res); if (!t) return;
    const staff = isStaff(req.user);
    const a = await pool.query(`SELECT a.* FROM tender_assignments a WHERE a.tender_id = $1 AND ($2::boolean IS FALSE OR a.user_id = $3) ORDER BY a.id`, [t.id, staff, req.user.id]);
    const f = await pool.query(`SELECT f.id, f.kind, f.assignment_id, f.change_id, f.file_name, f.file_size, f.created_at, f.uploaded_by, u.full_name AS uploaded_by_name
      FROM tender_files f LEFT JOIN users u ON u.id = f.uploaded_by WHERE f.tender_id = $1
        AND ($2::boolean IS FALSE OR f.kind IN ('tender','change') OR (f.kind = 'work' AND f.assignment_id IN (SELECT id FROM tender_assignments WHERE user_id = $3))) ORDER BY f.id`, [t.id, staff, req.user.id]);
    const cm = await pool.query(`SELECT c.id, c.body, c.created_at, c.user_id, u.full_name FROM tender_comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.tender_id = $1 ORDER BY c.id DESC`, [t.id]);
    const ch = await pool.query(`SELECT c.*, u.full_name FROM tender_changes c LEFT JOIN users u ON u.id = c.created_by WHERE c.tender_id = $1 ORDER BY c.id DESC`, [t.id]);
    if (staff) {
      return res.json({ id: t.id, received_date: t.received_date, comments: cm.rows, changes: ch.rows, title: t.title, title_en: t.title_en, tender_number: t.tender_number, client_name: t.client_name, kind: t.kind,
        package_type: t.package_type, deadline: t.deadline, status: t.status, description: t.description, assignments: a.rows, files: f.rows, history: [],
        perm: W.permsFor(req.user.role, t.status) });
    }
    const h = await pool.query(`SELECT h.*, u.full_name FROM tender_history h LEFT JOIN users u ON u.id = h.user_id WHERE h.tender_id = $1 ORDER BY h.id DESC`, [t.id]);
    res.json({ ...t, comments: cm.rows, changes: ch.rows, history: h.rows, files: f.rows, assignments: a.rows, perm: W.permsFor(req.user.role, t.status) });
  } catch (e) { next(e); }
});

function basicFields(b) {
  return {
    title: str(b.title, 500), title_en: str(b.title_en, 500) || null, client_name: str(b.client_name, 300) || null,
    tender_number: str(b.tender_number, 100) || null, kind: W.KINDS.includes(b.kind) ? b.kind : null,
    package_type: W.PACKAGES.includes(b.package_type) ? b.package_type : 'full', budget: num(b.budget),
    guarantee_amount: num(b.guarantee_amount), deadline: isDate(b.deadline) ? b.deadline : null, description: str(b.description) || null,
    received_date: isDate(b.received_date) ? b.received_date : null, risk_text: str(b.risk_text, 3000) || null, opportunity_text: str(b.opportunity_text, 3000) || null
  };
}

router.post('/', async (req, res, next) => {
  try {
    if (!W.canCreate(req.user.role)) return deny(res);
    const f = basicFields(req.body);
    if (!f.title) return res.status(400).json({ error: 'عنوان مناقصه الزامی است' });
    if (!f.kind) return res.status(400).json({ error: 'نوع مناقصه (اکتشافی یا نظارتی) را انتخاب کنید' });
    const r = await pool.query(
      `INSERT INTO tenders (title, title_en, client_name, tender_number, kind, package_type, budget, guarantee_amount, deadline, description, status, created_by, received_date, risk_text, opportunity_text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'review',$11, COALESCE($12::date, CURRENT_DATE), $13, $14) RETURNING id`,
      [f.title, f.title_en, f.client_name, f.tender_number, f.kind, f.package_type, f.budget, f.guarantee_amount, f.deadline, f.description, req.user.id, f.received_date, f.risk_text, f.opportunity_text]);
    await hist(pool, r.rows[0].id, null, 'review', req.user.id, 'ارسال به مدیر دفتر فنی و مدیرعامل');
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    if (!W.RUNNING.includes(cur.status)) return res.status(400).json({ error: 'مناقصه بسته شده و قابل ویرایش نیست' });
    const b = req.body, sets = [], vals = [];
    const add = (c, v) => { vals.push(v); sets.push(`${c}=$${vals.length}`); };
    if (W.canEditBasic(req.user.role)) {
      const f = basicFields(b);
      if (!f.title) return res.status(400).json({ error: 'عنوان الزامی است' });
      ['title', 'title_en', 'client_name', 'tender_number', 'package_type', 'budget', 'guarantee_amount', 'deadline', 'description', 'risk_text', 'opportunity_text'].forEach(k => add(k, f[k]));
      if (f.received_date) add('received_date', f.received_date);
      if (f.kind) add('kind', f.kind);
    }
    if (W.canEditOffer(req.user.role)) {
      if ('our_offer' in b) add('our_offer', num(b.our_offer));
      if ('guarantee_amount' in b && !W.canEditBasic(req.user.role)) add('guarantee_amount', num(b.guarantee_amount));
    }
    if (!sets.length) return deny(res);
    vals.push(cur.id);
    await pool.query(`UPDATE tenders SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${vals.length}`, vals);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// تغییر سریع دسته (مرحله اول کیفی / فنی / قیمت / همه) از روی کارتابل
router.put('/:id/package', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    if (!W.canStatus(req.user.role) && !W.canEditBasic(req.user.role)) return deny(res);
    if (!W.PACKAGES.includes(req.body.package_type)) return res.status(400).json({ error: 'دسته نامعتبر است' });
    await pool.query('UPDATE tenders SET package_type=$1, updated_at=NOW() WHERE id=$2', [req.body.package_type, cur.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// وضعیت ارسال: در حال انجام / در حال ارسال / ارسال شده / منتظر اعلام برنده / لغو شده
router.post('/:id/status', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    if (!W.canStatus(req.user.role)) return deny(res);
    const v = req.body.value;
    if (v === 'cancelled') {
      if (!W.RUNNING.includes(cur.status)) return res.status(400).json({ error: 'این مناقصه قابل لغو نیست' });
      await pool.query(`UPDATE tenders SET status='cancelled', submit_status=NULL, updated_at=NOW() WHERE id=$1`, [cur.id]);
      await hist(pool, cur.id, cur.status, 'cancelled', req.user.id, str(req.body.note, 1000) || 'مناقصه لغو شد');
      return res.json({ success: true });
    }
    if (cur.status !== 'active') return res.status(400).json({ error: 'وضعیت ارسال فقط برای مناقصه‌ی در حال انجام قابل تنظیم است' });
    if (v !== 'running' && !W.SUBMIT.includes(v)) return res.status(400).json({ error: 'وضعیت نامعتبر است' });
    await pool.query(`UPDATE tenders SET submit_status=$1, sent_date = CASE WHEN $1 = 'sent' AND sent_date IS NULL THEN CURRENT_DATE ELSE sent_date END, updated_at=NOW() WHERE id=$2`,
      [v === 'running' ? null : v, cur.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ── فایل‌ها: اسناد مناقصه / امکان‌سنجی / ضمانت‌نامه / خروجی کار ارجاعی ──
router.post('/:id/files', handleUpload, async (req, res, next) => {
  const bail = (code, msg) => { if (req.file) removeFile(req.file.filename); return res.status(code).json({ error: msg }); };
  try {
    const cur = await load(req, res); if (!cur) { if (req.file) removeFile(req.file.filename); return; }
    const kind = req.body.kind;
    if (!W.fileRoles[kind]) return bail(400, 'نوع فایل نامعتبر است');
    if (!W.fileRoles[kind](req.user.role)) return bail(403, 'دسترسی مجاز نیست');
    if (!req.file) return bail(400, 'فایل را انتخاب کنید');
    let aid = null, chid = null;
    if (kind === 'change') { chid = parseInt(req.body.change_id) || null; if (!chid || !(await pool.query('SELECT 1 FROM tender_changes WHERE id=$1 AND tender_id=$2', [chid, cur.id])).rows.length) return bail(400, 'اعلان تغییر نامعتبر است'); if (isStaff(req.user)) return bail(403, 'دسترسی مجاز نیست'); }
    if (kind === 'work') {
      aid = parseInt(req.body.assignment_id) || null;
      if (isStaff(req.user) && !aid) return bail(400, 'کار ارجاعی را مشخص کنید');
      if (aid) {
        const a = (await pool.query('SELECT user_id FROM tender_assignments WHERE id=$1 AND tender_id=$2', [aid, cur.id])).rows[0];
        if (!a || (isStaff(req.user) && a.user_id !== req.user.id)) return bail(403, 'این کار به شما ارجاع نشده است');
      }
    } else if (isStaff(req.user)) return bail(403, 'دسترسی مجاز نیست');
    const r = await pool.query(`INSERT INTO tender_files (tender_id, kind, assignment_id, change_id, file_name, file_path, file_size, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [cur.id, kind, aid, chid, req.file.originalname, req.file.filename, req.file.size, req.user.id]);
    await pool.query('UPDATE tenders SET updated_at=NOW() WHERE id=$1', [cur.id]);
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { if (req.file) removeFile(req.file.filename); next(e); }
});
router.get('/:id/files/:fid/download', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    const f = (await pool.query('SELECT file_name, file_path, kind, assignment_id FROM tender_files WHERE id=$1 AND tender_id=$2', [parseInt(req.params.fid) || 0, cur.id])).rows[0];
    if (!f) return res.status(404).json({ error: 'فایل پیدا نشد' });
    if (isStaff(req.user) && !['tender', 'change'].includes(f.kind)) {
      const ok = f.kind === 'work' && f.assignment_id && (await pool.query('SELECT 1 FROM tender_assignments WHERE id=$1 AND user_id=$2', [f.assignment_id, req.user.id])).rows.length;
      if (!ok) return res.status(404).json({ error: 'فایل پیدا نشد' });
    }
    sendFile(res, f.file_path, f.file_name);
  } catch (e) { next(e); }
});
router.delete('/:id/files/:fid', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    const f = (await pool.query('SELECT kind, file_path, uploaded_by FROM tender_files WHERE id=$1 AND tender_id=$2', [parseInt(req.params.fid) || 0, cur.id])).rows[0];
    if (!f) return res.status(404).json({ error: 'فایل پیدا نشد' });
    if (!W.fileRoles[f.kind](req.user.role)) return deny(res);
    if (isStaff(req.user) && f.uploaded_by !== req.user.id) return deny(res);
    await pool.query('DELETE FROM tender_files WHERE id=$1', [parseInt(req.params.fid)]);
    await releaseFile(f.file_path);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ── ارجاع کار ──
router.get('/:id/assignments', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    const r = await pool.query(`SELECT * FROM tender_assignments WHERE tender_id=$1 AND ($2::boolean IS FALSE OR user_id=$3) ORDER BY id`, [cur.id, isStaff(req.user), req.user.id]);
    res.json(r.rows);
  } catch (e) { next(e); }
});
async function resolveUser(name, userId) {
  if (userId) {
    const u = (await pool.query('SELECT id, full_name FROM users WHERE id=$1 AND is_active', [parseInt(userId)])).rows[0];
    if (u) return u;
  }
  const n = str(name, 200);
  const u = (await pool.query('SELECT id, full_name FROM users WHERE is_active AND (full_name = $1 OR username = $1 OR personnel_no = $1) ORDER BY id LIMIT 1', [n])).rows[0];
  return u || null;
}
function assignFields(b) {
  const share = b.share_percent === '' || b.share_percent == null ? null : parseInt(b.share_percent);
  return { part: W.PARTS.includes(b.part) ? b.part : 'other', task: str(b.task, 3000) || null, share: isNaN(share) ? null : share, due: isDate(b.due_date) ? b.due_date : null };
}
async function shareTotal(tenderId, part, exceptId) {
  const r = await pool.query('SELECT COALESCE(SUM(share_percent),0)::int AS s FROM tender_assignments WHERE tender_id=$1 AND part=$2 AND id <> $3', [tenderId, part, exceptId || 0]);
  return r.rows[0].s;
}
router.post('/:id/assignments', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    if (!W.canAssign(req.user.role)) return deny(res);
    if (!W.RUNNING.includes(cur.status)) return res.status(400).json({ error: 'مناقصه بسته شده است' });
    const name = str(req.body.assignee_name, 200);
    if (!name) return res.status(400).json({ error: 'نام فرد ارجاع‌شده را وارد کنید' });
    const f = assignFields(req.body);
    if (f.share != null && (f.share < 0 || f.share > 100)) return res.status(400).json({ error: 'سهم کار باید بین ۰ تا ۱۰۰ درصد باشد' });
    if (f.share != null && (await shareTotal(cur.id, f.part, 0)) + f.share > 100) return res.status(400).json({ error: 'مجموع سهم این بخش از کار بیش از ۱۰۰٪ می‌شود' });
    const u = await resolveUser(name, req.body.user_id);
    const r = await pool.query(
      `INSERT INTO tender_assignments (tender_id, user_id, assignee_name, part, task, share_percent, due_date, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [cur.id, u ? u.id : null, u ? u.full_name : name, f.part, f.task, f.share, f.due, req.user.id]);
    await hist(pool, cur.id, cur.status, cur.status, req.user.id, 'ارجاع کار به: ' + (u ? u.full_name : name) + (f.share != null ? ` (${f.share}٪)` : ''));
    res.status(201).json({ id: r.rows[0].id, linked: !!u });
  } catch (e) { next(e); }
});
router.put('/:id/assignments/:aid', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    const a = (await pool.query('SELECT * FROM tender_assignments WHERE id=$1 AND tender_id=$2', [parseInt(req.params.aid) || 0, cur.id])).rows[0];
    if (!a) return res.status(404).json({ error: 'ارجاع یافت نشد' });
    const mine = a.user_id === req.user.id;
    if (!W.canAssign(req.user.role) && !(isStaff(req.user) && mine)) return deny(res);
    if (W.canAssign(req.user.role) && 'assignee_name' in req.body) {
      const name = str(req.body.assignee_name, 200);
      if (!name) return res.status(400).json({ error: 'نام فرد ارجاع‌شده را وارد کنید' });
      const f = assignFields(req.body);
      if (f.share != null && (f.share < 0 || f.share > 100 || (await shareTotal(cur.id, f.part, a.id)) + f.share > 100))
        return res.status(400).json({ error: 'مجموع سهم این بخش از کار بیش از ۱۰۰٪ می‌شود' });
      const u = await resolveUser(name, req.body.user_id);
      await pool.query('UPDATE tender_assignments SET user_id=$1, assignee_name=$2, part=$3, task=$4, share_percent=$5, due_date=$6 WHERE id=$7',
        [u ? u.id : null, u ? u.full_name : name, f.part, f.task, f.share, f.due, a.id]);
    }
    if (['open', 'done'].includes(req.body.status) && req.body.status !== a.status) {
      await pool.query(`UPDATE tender_assignments SET status=$1, done_at = CASE WHEN $1 = 'done' THEN NOW() ELSE NULL END WHERE id=$2`, [req.body.status, a.id]);
      await hist(pool, cur.id, cur.status, cur.status, req.user.id, (req.body.status === 'done' ? 'کار ارجاعی انجام شد: ' : 'کار ارجاعی دوباره باز شد: ') + a.assignee_name);
    }
    res.json({ success: true });
  } catch (e) { next(e); }
});
router.delete('/:id/assignments/:aid', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    if (!W.canAssign(req.user.role)) return deny(res);
    await pool.query('DELETE FROM tender_assignments WHERE id=$1 AND tender_id=$2', [parseInt(req.params.aid) || 0, cur.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ── مدیر دفتر فنی: روش انجام و برنامه زمانبندی ──
router.put('/:id/tech', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    if (!W.canTech(req.user.role)) return deny(res);
    if (cur.status !== 'review') return res.status(400).json({ error: 'بررسی فنی فقط تا قبل از تصمیم مدیرعامل ممکن است' });
    const b = req.body;
    if (b.done) {
      const n = (await pool.query('SELECT COUNT(*)::int AS n FROM tender_assignments WHERE tender_id=$1', [cur.id])).rows[0].n;
      if (!n && !str(b.referral_to)) return res.status(400).json({ error: 'حداقل یک ارجاع ثبت کنید' });
    }
    await pool.query(`UPDATE tenders SET referral_to=$1, method=$2, schedule=$3, tech_done=$4, tech_at=CASE WHEN $4 THEN NOW() ELSE NULL END, our_offer=COALESCE($6::numeric, our_offer), updated_at=NOW() WHERE id=$5`,
      [str(b.referral_to, 200) || null, str(b.method) || null, str(b.schedule) || null, !!b.done, cur.id, num(b.our_offer)]);
    if (b.done) await hist(pool, cur.id, cur.status, cur.status, req.user.id, 'بررسی فنی ثبت شد (روش انجام، زمان‌بندی و قیمت پیشنهادی)');
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ── مدیرعامل: شرکت در مناقصه بله / خیر ──
router.post('/:id/ceo', async (req, res, next) => {
  const c = await pool.connect();
  try {
    const cur = await load(req, res); if (!cur) return;
    if (!W.canCeo(req.user.role)) return deny(res);
    if (cur.status !== 'review') return res.status(400).json({ error: 'تصمیم این مناقصه قبلاً ثبت شده است' });
    const { decision, needs_guarantee, note } = req.body;
    if (!['yes', 'no'].includes(decision)) return res.status(400).json({ error: 'تصمیم نامعتبر است' });
    const yes = decision === 'yes', g = yes && !!needs_guarantee;
    const ga = g && req.body.guarantee_amount != null && req.body.guarantee_amount !== '' ? num(req.body.guarantee_amount) : cur.guarantee_amount;
    await c.query('BEGIN');
    await c.query(`UPDATE tenders SET status=$1, ceo_decision=$2, ceo_decided_at=NOW(), ceo_note=$3, needs_guarantee=$4, guarantee_status=$5, guarantee_amount=$6, closed_ack=FALSE, updated_at=NOW() WHERE id=$7`,
      [yes ? 'active' : 'closed', decision, str(note, 2000) || null, g, g ? 'pending' : null, ga, cur.id]);
    await hist(c, cur.id, cur.status, yes ? 'active' : 'closed', req.user.id,
      (yes ? 'شرکت در مناقصه تأیید شد' + (g ? ' · نیازمند ضمانت‌نامه (ارجاع به مالی)' : '') : 'شرکت در مناقصه تأیید نشد: مناقصه بسته شد') + (str(note, 2000) ? ' · ' + str(note, 2000) : ''));
    await c.query('COMMIT');
    res.json({ success: true });
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); next(e); } finally { c.release(); }
});
router.post('/:id/ceo-reset', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    if (!W.canCeo(req.user.role)) return deny(res);
    if (cur.status === 'finished' || !cur.ceo_decision) return res.status(400).json({ error: 'امکان ویرایش تصمیم وجود ندارد' });
    if (cur.guarantee_status === 'received') return res.status(400).json({ error: 'ضمانت‌نامه دریافت شده است' });
    await pool.query(`UPDATE tenders SET status='review', submit_status=NULL, ceo_decision=NULL, ceo_decided_at=NULL, needs_guarantee=FALSE, guarantee_status=NULL, closed_ack=FALSE, updated_at=NOW() WHERE id=$1`, [cur.id]);
    await hist(pool, cur.id, cur.status, 'review', req.user.id, 'تصمیم مدیرعامل بازگردانده شد');
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ── مالی: ضمانت‌نامه دریافت شد ──
router.post('/:id/guarantee', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    if (!W.canFinance(req.user.role)) return deny(res);
    if (!cur.needs_guarantee || cur.guarantee_status !== 'pending') return res.status(400).json({ error: 'درخواست ضمانت‌نامه‌ای در انتظار نیست' });
    const amt = req.body.amount != null && req.body.amount !== '' ? num(req.body.amount) : cur.guarantee_amount;
    await pool.query(`UPDATE tenders SET guarantee_status='received', guarantee_at=NOW(), guarantee_note=$1, guarantee_amount=$2, updated_at=NOW() WHERE id=$3`, [str(req.body.note, 2000) || null, amt, cur.id]);
    await hist(pool, cur.id, cur.status, cur.status, req.user.id, 'ضمانت‌نامه دریافت شد و برای کارشناس ارسال شد');
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ── کارشناس مناقصات ──
router.post('/:id/ack', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    if (!W.canProc(req.user.role)) return deny(res);
    if (cur.status !== 'closed') return res.status(400).json({ error: 'مناقصه بسته نشده است' });
    await pool.query('UPDATE tenders SET closed_ack=TRUE WHERE id=$1', [cur.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});
router.post('/:id/finish', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    if (!W.canResult(req.user.role)) return deny(res);
    if (cur.status !== 'active') return res.status(400).json({ error: 'فقط مناقصه در حال انجام را می‌توان به اتمام‌یافته برد' });
    await pool.query(`UPDATE tenders SET status='finished', submit_status=NULL, updated_at=NOW() WHERE id=$1`, [cur.id]);
    await hist(pool, cur.id, 'active', 'finished', req.user.id, str(req.body.note, 1000) || null);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ── فرم‌ها: امکان‌سنجی مدارک، چک‌لیست، نتیجه و امتیازها ──
const FORMS = { feasibility: 'feasibility', checklist: 'checklist', result: 'result_form' };
const clean = o => {
  const out = {};
  if (!o || typeof o !== 'object' || Array.isArray(o)) return out;
  Object.keys(o).slice(0, 80).forEach(k => {
    if (!/^[a-zA-Z0-9_]{1,40}$/.test(k)) return;
    const v = o[k];
    if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'number' && isFinite(v)) out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 3000);
  });
  return out;
};
router.put('/:id/forms/:name', async (req, res, next) => {
  try {
    const col = FORMS[req.params.name];
    if (!col) return res.status(404).json({ error: 'فرم نامعتبر است' });
    const cur = await load(req, res); if (!cur) return;
    if (!(req.params.name === 'result' ? W.canResult : W.canForm)(req.user.role)) return deny(res);
    const data = clean(req.body.data);
    await pool.query(`UPDATE tenders SET ${col}=$1::jsonb, updated_at=NOW() WHERE id=$2`, [JSON.stringify(data), cur.id]);
    if (req.params.name === 'result') {
      const outcome = ['won', 'lost'].includes(data.outcome) ? data.outcome : null;
      const sc = v => { const x = num(v); return x != null && x >= 0 && x <= 100000 ? x : null; };
      await pool.query(`UPDATE tenders SET result=$1, score_quality=$2, score_technical=$3, score_price=$4, score_total=$5, rank_no=$6,
          contract_amount=$7, winner_name=$8 WHERE id=$9`,
        [outcome, sc(data.score_quality), sc(data.score_technical), sc(data.score_price), sc(data.score_total),
         data.rank != null && data.rank !== '' && !isNaN(parseInt(data.rank)) ? parseInt(data.rank) : null, num(data.amount), str(data.winner, 300) || null, cur.id]);
    }
    res.json({ success: true });
  } catch (e) { next(e); }
});


// ── کامنت‌ها ──
router.post('/:id/comments', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    const body = str(req.body.body, 3000);
    if (!body) return res.status(400).json({ error: 'متن کامنت را بنویسید' });
    const r = await pool.query('INSERT INTO tender_comments (tender_id, user_id, body) VALUES ($1,$2,$3) RETURNING id', [cur.id, req.user.id, body]);
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { next(e); }
});
router.delete('/:id/comments/:cid', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    const c = (await pool.query('SELECT user_id FROM tender_comments WHERE id=$1 AND tender_id=$2', [parseInt(req.params.cid) || 0, cur.id])).rows[0];
    if (!c) return res.status(404).json({ error: 'کامنت یافت نشد' });
    if (c.user_id !== req.user.id && req.user.role !== 'super_admin') return deny(res);
    await pool.query('DELETE FROM tender_comments WHERE id=$1', [parseInt(req.params.cid)]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ── اعلان تغییرات: ثبت تغییر (مثلاً مبلغ ضمانت‌نامه یا مهلت) و اعمال اختیاری روی مشخصات مناقصه ──
const CHANGE_FIELDS = { guarantee_amount: 'مبلغ ضمانت‌نامه', budget: 'مبلغ پایه', deadline: 'مهلت ارسال پیشنهاد', our_offer: 'مبلغ پیشنهادی ما' };
router.post('/:id/changes', async (req, res, next) => {
  const c = await pool.connect();
  try {
    const cur = await load(req, res); if (!cur) return;
    if (!W.fileRoles.change(req.user.role)) return deny(res);
    if (!W.RUNNING.includes(cur.status)) return res.status(400).json({ error: 'مناقصه بسته شده است' });
    const title = str(req.body.title, 300);
    if (!title) return res.status(400).json({ error: 'عنوان تغییر را بنویسید' });
    const field = CHANGE_FIELDS[req.body.field] ? req.body.field : null;
    let oldV = null, newV = null;
    if (field) {
      const isD = field === 'deadline';
      if (isD ? !isDate(req.body.new_value) : num(req.body.new_value) == null) return res.status(400).json({ error: 'مقدار جدید معتبر نیست' });
      oldV = cur[field] == null ? null : String(isD ? String(cur[field]).slice(0, 10) : cur[field]);
      newV = isD ? req.body.new_value : String(num(req.body.new_value));
    }
    await c.query('BEGIN');
    const r = await c.query('INSERT INTO tender_changes (tender_id, title, body, field, old_value, new_value, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [cur.id, title, str(req.body.body, 4000) || null, field, oldV, newV, req.user.id]);
    if (field && req.body.apply !== false) await c.query(`UPDATE tenders SET ${field} = $1, updated_at = NOW() WHERE id = $2`, [newV, cur.id]);
    await hist(c, cur.id, cur.status, cur.status, req.user.id, 'اعلان تغییر: ' + title + (field ? ` (${CHANGE_FIELDS[field]}: ${oldV ?? '—'} ← ${newV})` : ''));
    await c.query('COMMIT');
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); next(e); } finally { c.release(); }
});
router.delete('/:id/changes/:cid', async (req, res, next) => {
  try {
    const cur = await load(req, res); if (!cur) return;
    if (!W.fileRoles.change(req.user.role)) return deny(res);
    const cid = parseInt(req.params.cid) || 0;
    const files = (await pool.query('SELECT file_path FROM tender_files WHERE change_id=$1 AND tender_id=$2', [cid, cur.id])).rows;
    await pool.query('DELETE FROM tender_files WHERE change_id=$1 AND tender_id=$2', [cid, cur.id]);
    await pool.query('DELETE FROM tender_changes WHERE id=$1 AND tender_id=$2', [cid, cur.id]);
    for (const f of files) await releaseFile(f.file_path);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ── آرشیو مناقصه‌های سال‌های قبل (ورود دستی، از اکسل یا از روی مدارک) ──
const archFields = b => {
  const y = parseInt(b.year), sc = v => { const x = num(v); return x != null && x >= 0 && x <= 100000 ? x : null; };
  const rk = parseInt(b.rank);
  return { year: y, title: str(b.title, 500), client_name: str(b.client_name, 300) || null, tender_number: str(b.tender_number, 100) || null,
    kind: W.KINDS.includes(b.kind) ? b.kind : 'exploration', result: ['won', 'lost'].includes(b.result) ? b.result : null,
    budget: num(b.budget), our_offer: num(b.our_offer), contract_amount: num(b.contract_amount), winner_name: str(b.winner_name, 300) || null,
    score_quality: sc(b.score_quality), score_technical: sc(b.score_technical), score_price: sc(b.score_price), score_total: sc(b.score_total),
    rank_no: isNaN(rk) ? null : rk, deadline: isDate(b.deadline) ? b.deadline : null, description: str(b.description) || null };
};
const archOk = f => f.title && f.year >= 1300 && f.year <= 1600;
async function archInsert(db, f, uid) {
  const rf = { outcome: f.result || '', score_quality: f.score_quality ?? '', score_technical: f.score_technical ?? '', score_price: f.score_price ?? '', score_total: f.score_total ?? '', rank: f.rank_no ?? '', amount: f.contract_amount ?? '', winner: f.winner_name || '' };
  return (await db.query(`INSERT INTO tenders (title, client_name, tender_number, kind, package_type, budget, our_offer, deadline, description, status, result, ceo_decision, is_archive, year_j,
      contract_amount, winner_name, score_quality, score_technical, score_price, score_total, rank_no, result_form, created_by, received_date)
    VALUES ($1,$2,$3,$4,'full',$5,$6,$7,$8,'finished',$9,'yes',TRUE,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$7) RETURNING id`,
    [f.title, f.client_name, f.tender_number, f.kind, f.budget, f.our_offer, f.deadline, f.description, f.result, f.year, f.contract_amount, f.winner_name,
     f.score_quality, f.score_technical, f.score_price, f.score_total, f.rank_no, JSON.stringify(rf), uid])).rows[0].id;
}
router.post('/archive', async (req, res, next) => {
  try {
    if (!W.fileRoles.archive(req.user.role)) return deny(res);
    const f = archFields(req.body);
    if (!archOk(f)) return res.status(400).json({ error: 'عنوان و سال (مثلاً ۱۴۰۳) الزامی است' });
    res.status(201).json({ id: await archInsert(pool, f, req.user.id) });
  } catch (e) { next(e); }
});
router.post('/archive/bulk', async (req, res, next) => {
  const c = await pool.connect();
  try {
    if (!W.fileRoles.archive(req.user.role)) return deny(res);
    const rows = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 500) : [];
    let created = 0, skipped = 0;
    await c.query('BEGIN');
    for (const r of rows) { const f = archFields(r); if (!archOk(f)) { skipped++; continue; } await archInsert(c, f, req.user.id); created++; }
    await c.query('COMMIT');
    res.json({ created, skipped });
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); next(e); } finally { c.release(); }
});
router.put('/archive/:id', async (req, res, next) => {
  try {
    if (!W.fileRoles.archive(req.user.role)) return deny(res);
    const id = parseInt(req.params.id) || 0, f = archFields(req.body);
    if (!archOk(f)) return res.status(400).json({ error: 'عنوان و سال (مثلاً ۱۴۰۳) الزامی است' });
    const rf = { outcome: f.result || '', score_quality: f.score_quality ?? '', score_technical: f.score_technical ?? '', score_price: f.score_price ?? '', score_total: f.score_total ?? '', rank: f.rank_no ?? '', amount: f.contract_amount ?? '', winner: f.winner_name || '' };
    const r = await pool.query(`UPDATE tenders SET title=$1, client_name=$2, tender_number=$3, kind=$4, budget=$5, our_offer=$6, deadline=$7, description=$8, result=$9, year_j=$10,
        contract_amount=$11, winner_name=$12, score_quality=$13, score_technical=$14, score_price=$15, score_total=$16, rank_no=$17, result_form=$18::jsonb, updated_at=NOW()
      WHERE id=$19 AND is_archive`, [f.title, f.client_name, f.tender_number, f.kind, f.budget, f.our_offer, f.deadline, f.description, f.result, f.year, f.contract_amount, f.winner_name,
        f.score_quality, f.score_technical, f.score_price, f.score_total, f.rank_no, JSON.stringify(rf), id]);
    if (!r.rowCount) return res.status(404).json({ error: 'مناقصهٔ آرشیوی یافت نشد' });
    res.json({ success: true });
  } catch (e) { next(e); }
});
router.delete('/archive/:id', async (req, res, next) => {
  try {
    if (!W.fileRoles.archive(req.user.role)) return deny(res);
    const id = parseInt(req.params.id) || 0;
    const files = (await pool.query('SELECT f.file_path FROM tender_files f JOIN tenders t ON t.id = f.tender_id WHERE t.id=$1 AND t.is_archive', [id])).rows;
    const r = await pool.query('DELETE FROM tenders WHERE id=$1 AND is_archive', [id]);
    if (!r.rowCount) return res.status(404).json({ error: 'مناقصهٔ آرشیوی یافت نشد' });
    for (const f of files) await releaseFile(f.file_path);
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'فقط مدیر ارشد می‌تواند حذف کند' });
    const id = parseInt(req.params.id) || 0;
    const files = await pool.query('SELECT file_path FROM tender_files WHERE tender_id=$1', [id]);
    await pool.query('DELETE FROM tender_history WHERE tender_id=$1', [id]);
    await pool.query('DELETE FROM tenders WHERE id=$1', [id]);
    for (const f of files.rows) await releaseFile(f.file_path);
    res.json({ success: true });
  } catch (e) { next(e); }
});
module.exports = router;
