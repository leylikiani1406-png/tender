// داشبورد تحلیلی مناقصات معدنی: بر اساس بخش (اتمام‌یافته، در حال انجام، استعلام، پروپوزال) و سال شمسی
const router = require('express').Router();
const pool = require('../db');
const { authenticate, notStaff } = require('../middleware/auth');
const { yearOf, ymOf } = require('../lib/jalali');
router.use(authenticate, notStaff);

const n = v => (v == null || v === '' ? 0 : Number(v) || 0);
const pct = (a, b) => (b ? Math.round((a * 100) / b) : 0);
const bump = (map, k, f) => { const o = map.get(k) || { name: k }; f(o); map.set(k, o); };

async function loadAll() {
  const q = s => pool.query(s).then(r => r.rows);
  const [tenders, props, inqs, wds, legacy] = await Promise.all([
    q(`SELECT id, title, client_name, kind, status, result, ceo_decision, needs_guarantee, guarantee_status, submit_status, tech_done, budget, our_offer, contract_amount, guarantee_amount,
         deadline, received_date, created_at, year_j, is_archive, score_quality, score_technical, score_price, score_total, rank_no, winner_name, risk_text, opportunity_text FROM tenders`),
    q(`SELECT id, title, client_name, status, offer_amount, sent_date, created_at FROM proposals`),
    q(`SELECT id, title, party, status, amount, inquiry_date, year_j, created_at FROM inquiries`),
    q(`SELECT id, title, client_name, withdraw_date, year_j FROM tender_withdrawals`),
    q(`SELECT rows FROM result_stats WHERE id = 1`)
  ]);
  tenders.forEach(t => { t.y = t.year_j || yearOf(t.deadline || t.received_date || t.created_at); });
  props.forEach(p => { p.y = yearOf(p.sent_date || p.created_at); });
  inqs.forEach(i => { i.y = i.year_j || yearOf(i.inquiry_date || i.created_at); });
  wds.forEach(w => { w.y = w.year_j || yearOf(w.withdraw_date); });
  const lg = ((legacy[0] && legacy[0].rows) || []).map(r => ({ y: r.y, t: r.t, r: r.r, a: n(r.a), name: r.n || '' }));
  const years = [...new Set([...tenders, ...props, ...inqs, ...wds].map(x => x.y).concat(lg.map(x => x.y)).filter(Boolean))].sort((a, b) => a - b);
  return { tenders, props, inqs, wds, lg, years };
}

// ───── منطق مشترک بخش‌ها ─────
const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const decidedT = t => t.result === 'won' || t.result === 'lost';
// وضعیت ارسال مناقصهٔ جاری: review → در بررسی؛ ارسال‌شده؛ منتظر پاسخ (اعلام برنده)؛ منتظر ارسال
const grp = t => t.status === 'review' ? 'review' : (t.submit_status === 'awaiting_winner' ? 'await_resp' : (t.submit_status === 'sent' || t.submit_status === 'sending') ? 'sent' : 'await_send');
// استعلام: انتخاب‌شده = برنده، بسته = بازنده، باز/پاسخ داده‌شده = در انتظار پاسخ
const inqRes = i => i.status === 'selected' ? 'won' : i.status === 'closed' ? 'lost' : 'wait';
const propRes = p => p.status === 'won' ? 'won' : p.status === 'lost' ? 'lost' : 'wait';
const baseDate = t => t.deadline || t.received_date || t.created_at;

// خلاصهٔ چهار بخش برای کارت‌های بالای داشبورد (تعداد، ضریب موفقیت، سال‌های هر بخش و روند سالانه)
router.get('/overview', async (req, res, next) => {
  try {
    const { tenders, props, inqs, lg, years } = await loadAll();
    const fin = tenders.filter(t => t.status === 'finished'), run = tenders.filter(t => ['review', 'active'].includes(t.status));
    const ys = a => [...new Set(a.filter(Boolean))].sort((x, y) => x - y);
    const fw = fin.filter(t => t.result === 'won').length + lg.filter(r => r.t === 't' && r.r === 'w').length, ft = fin.filter(decidedT).length + lg.filter(r => r.t === 't').length;
    const iw = inqs.filter(i => inqRes(i) === 'won').length, il = inqs.filter(i => inqRes(i) === 'lost').length;
    const pw = props.filter(p => propRes(p) === 'won').length, pl = props.filter(p => propRes(p) === 'lost').length;
    const trend = (arr, f = () => true) => years.map(y => arr.filter(x => x.y === y && f(x)).length);
    res.json({ years,
      years_by: { finished: ys([...fin.map(t => t.y), ...lg.filter(r => r.t === 't').map(r => r.y)]), running: ys(run.map(t => t.y)), inquiries: ys(inqs.map(i => i.y)), proposals: ys(props.map(p => p.y)) },
      trend_years: years, trend: { finished: trend(fin, decidedT), running: trend(run), inquiries: trend(inqs), proposals: trend(props) },
      finished: { total: ft, won: fw, rate: pct(fw, ft) },
      running: { total: run.length, sent: run.filter(t => grp(t) === 'sent').length, await_send: run.filter(t => grp(t) === 'await_send').length, await_resp: run.filter(t => grp(t) === 'await_resp').length },
      inquiries: { total: inqs.length, won: iw, rate: pct(iw, iw + il) },
      proposals: { total: props.length, won: pw, rate: pct(pw, pw + pl) } });
  } catch (e) { next(e); }
});

// دادهٔ کامل یک بخش (نمودارها + ردیف‌های دیتاتیبل) برای سال انتخابی؛ سال خالی = همهٔ سال‌ها
router.get('/panel', async (req, res, next) => {
  try {
    const section = ['finished', 'running', 'inquiries', 'proposals'].includes(req.query.section) ? req.query.section : 'finished';
    const year = parseInt(req.query.year) || null, inY = x => !year || x.y === year;
    const { tenders, props, inqs, lg, years } = await loadAll();
    const out = { section, year, generated: new Date().toISOString() };

    if (section === 'finished') {
      const fin = tenders.filter(t => t.status === 'finished'), cur = fin.filter(inY), dec = cur.filter(decidedT), w = dec.filter(t => t.result === 'won').length;
      const legY = lg.filter(r => r.t === 't' && inY(r)), lw = legY.filter(r => r.r === 'w').length;
      const per_year = years.map(y => { const a = fin.filter(t => t.y === y && decidedT(t)), l = lg.filter(r => r.y === y && r.t === 't'); const ww = a.filter(t => t.result === 'won').length + l.filter(r => r.r === 'w').length, tot = a.length + l.length;
        return { y, won: ww, lost: tot - ww, rate: pct(ww, tot), amount: a.filter(t => t.result === 'won').reduce((s, t) => s + n(t.contract_amount), 0) + l.filter(r => r.r === 'w').reduce((s, r) => s + r.a, 0) }; }).filter(p => p.won + p.lost);
      const cl = new Map();
      dec.forEach(t => bump(cl, t.client_name || 'نامشخص', o => { o.won = (o.won || 0) + (t.result === 'won' ? 1 : 0); o.lost = (o.lost || 0) + (t.result === 'lost' ? 1 : 0); }));
      const clients = [...cl.values()].map(o => ({ name: o.name, won: o.won || 0, lost: o.lost || 0, rate: pct(o.won || 0, (o.won || 0) + (o.lost || 0)) }));
      const avg = k => { const v = dec.filter(t => t.result === 'won' && t[k] != null).map(t => n(t[k])); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
      out.totals = { total: dec.length + legY.length, won: w + lw, lost: dec.length - w + legY.length - lw, rate: pct(w + lw, dec.length + legY.length), pending: cur.filter(t => !decidedT(t)).length,
        closed: tenders.filter(t => inY(t) && t.status === 'closed').length, won_amount: dec.filter(t => t.result === 'won').reduce((s, t) => s + n(t.contract_amount), 0),
        avg_quality: avg('score_quality'), avg_technical: avg('score_technical'), avg_price: avg('score_price'), avg_total: avg('score_total') };
      out.per_year = per_year;
      out.by_kind = ['exploration', 'supervision'].map(k => { const d = dec.filter(t => t.kind === k), ww = d.filter(t => t.result === 'won').length; return { kind: k, won: ww, lost: d.length - ww, rate: pct(ww, d.length) }; });
      out.best_clients = clients.filter(c => c.won > 0).sort((a, b) => b.won - a.won || b.rate - a.rate).slice(0, 8);
      out.worst_clients = clients.filter(c => c.lost > 0).sort((a, b) => b.lost - a.lost || a.rate - b.rate).slice(0, 8);
      out.rows = cur.sort((a, b) => (b.y || 0) - (a.y || 0) || b.id - a.id).slice(0, 1000).map(t => ({ id: t.id, y: t.y, title: t.title, client: t.client_name, kind: t.kind, result: t.result || '', rank: t.rank_no, score: t.score_total, offer: t.our_offer, contract: t.contract_amount }));
    }

    if (section === 'running') {
      const run = tenders.filter(t => ['review', 'active'].includes(t.status) && inY(t));
      const G = ['await_send', 'sent', 'await_resp', 'review'], cnt = g => run.filter(t => grp(t) === g).length;
      out.totals = { total: run.length, offer: run.reduce((s, t) => s + n(t.our_offer), 0), guarantee: run.reduce((s, t) => s + n(t.guarantee_amount), 0), budget: run.reduce((s, t) => s + n(t.budget), 0), guarantee_pending: run.filter(t => t.needs_guarantee && t.guarantee_status === 'pending').length };
      out.groups = G.map(g => ({ g, n: cnt(g), offer: run.filter(t => grp(t) === g).reduce((s, t) => s + n(t.our_offer), 0) }));
      // به تفکیک ماه (تاریخ مهلت؛ در نبود آن تاریخ دریافت). با سال مشخص: ۱۲ ماه همان سال؛ بدون سال: ۱۲ ماهِ آخرِ دارای مناقصه
      const mm = new Map();
      run.forEach(t => { const ym = ymOf(baseDate(t)); if (!ym) return; const k = ym[0] * 100 + ym[1], o = mm.get(k) || { y: ym[0], m: ym[1], total: 0, offer: 0, guarantee: 0, g: { await_send: 0, sent: 0, await_resp: 0, review: 0 } }; o.total++; o.offer += n(t.our_offer); o.guarantee += n(t.guarantee_amount); o.g[grp(t)]++; mm.set(k, o); });
      let months = [];
      if (year) for (let m = 1; m <= 12; m++) months.push(mm.get(year * 100 + m) || { y: year, m, total: 0, offer: 0, guarantee: 0, g: { await_send: 0, sent: 0, await_resp: 0, review: 0 } });
      else months = [...mm.entries()].sort((a, b) => a[0] - b[0]).slice(-12).map(e => e[1]);
      out.months = months.map(o => ({ ...o, label: MONTHS[o.m - 1], key: o.y + '/' + String(o.m).padStart(2, '0') }));
      const cl = new Map(); run.forEach(t => bump(cl, t.client_name || 'نامشخص', o => { o.n = (o.n || 0) + 1; }));
      out.clients = [...cl.values()].sort((a, b) => b.n - a.n).slice(0, 8);
      const today = new Date().toISOString().slice(0, 10);
      out.upcoming = run.filter(t => t.deadline && String(t.deadline).slice(0, 10) >= today).sort((a, b) => String(a.deadline).localeCompare(String(b.deadline))).slice(0, 8).map(t => ({ id: t.id, title: t.title, deadline: t.deadline }));
      const wr = run.filter(t => t.risk_text || t.opportunity_text);
      out.risk = { with_risk: run.filter(t => t.risk_text).length, with_opp: run.filter(t => t.opportunity_text).length, none: run.length - wr.length,
        items: wr.slice(0, 12).map(t => ({ id: t.id, title: t.title, client: t.client_name, risk: t.risk_text, opp: t.opportunity_text })) };
      out.rows = run.sort((a, b) => String(a.deadline || '9').localeCompare(String(b.deadline || '9'))).slice(0, 1000).map(t => ({ id: t.id, title: t.title, client: t.client_name, group: grp(t), deadline: t.deadline, budget: t.budget, offer: t.our_offer, guarantee: t.guarantee_amount, g_status: t.needs_guarantee ? (t.guarantee_status || 'pending') : '' }));
    }

    if (section === 'inquiries') {
      const cur = inqs.filter(inY), c = r => cur.filter(i => inqRes(i) === r).length;
      out.totals = { total: cur.length, won: c('won'), lost: c('lost'), wait: c('wait'), rate: pct(c('won'), c('won') + c('lost')), amount: cur.reduce((s, i) => s + n(i.amount), 0) };
      out.per_year = years.map(y => { const a = inqs.filter(i => i.y === y), w = a.filter(i => inqRes(i) === 'won').length, l = a.filter(i => inqRes(i) === 'lost').length; return { y, n: a.length, won: w, lost: l, wait: a.length - w - l, amount: a.reduce((s, i) => s + n(i.amount), 0) }; }).filter(p => p.n);
      out.rows = cur.sort((a, b) => b.id - a.id).slice(0, 1000).map(i => ({ id: i.id, y: i.y, title: i.title, client: i.party, date: i.inquiry_date, amount: i.amount, result: inqRes(i) }));
    }

    if (section === 'proposals') {
      const cur = props.filter(inY), c = r => cur.filter(p => propRes(p) === r).length;
      out.totals = { total: cur.length, won: c('won'), lost: c('lost'), wait: c('wait'), rate: pct(c('won'), c('won') + c('lost')), amount: cur.reduce((s, p) => s + n(p.offer_amount), 0) };
      out.per_year = years.map(y => { const a = props.filter(p => p.y === y), w = a.filter(p => propRes(p) === 'won').length, l = a.filter(p => propRes(p) === 'lost').length; return { y, n: a.length, won: w, lost: l, rate: pct(w, w + l), amount: a.reduce((s, p) => s + n(p.offer_amount), 0) }; }).filter(p => p.n);
      const cl = new Map(); cur.filter(p => propRes(p) !== 'wait').forEach(p => bump(cl, p.client_name || 'نامشخص', o => { o.won = (o.won || 0) + (propRes(p) === 'won' ? 1 : 0); o.lost = (o.lost || 0) + (propRes(p) === 'lost' ? 1 : 0); }));
      out.clients = [...cl.values()].map(o => ({ name: o.name, won: o.won || 0, lost: o.lost || 0, rate: pct(o.won || 0, (o.won || 0) + (o.lost || 0)) })).sort((a, b) => b.won - a.won).slice(0, 8);
      out.by_status = [...cur.reduce((m, p) => m.set(p.status, (m.get(p.status) || 0) + 1), new Map()).entries()].map(([status, n]) => ({ status, n }));
      out.rows = cur.sort((a, b) => b.id - a.id).slice(0, 1000).map(p => ({ id: p.id, y: p.y, title: p.title, client: p.client_name, date: p.sent_date, amount: p.offer_amount, status: p.status, result: propRes(p) }));
    }
    res.json(out);
  } catch (e) { next(e); }
});

router.get('/mining', async (req, res, next) => {
  try {
    const section = ['finished', 'running', 'inquiries', 'proposals'].includes(req.query.section) ? req.query.section : 'finished';
    const year = parseInt(req.query.year) || null;
    const { tenders, props, inqs, wds, lg, years } = await loadAll();
    const inY = x => !year || x.y === year;
    const out = { section, year, years };

    // ریسک و فرصت و تصمیم شرکت/عدم شرکت (برای همهٔ بخش‌ها، در سال انتخابی)
    const sel = tenders.filter(inY);
    out.decisions = { yes: sel.filter(t => t.ceo_decision === 'yes').length, no: sel.filter(t => t.ceo_decision === 'no').length, pending: sel.filter(t => !t.ceo_decision && t.status === 'review').length, withdrawn: wds.filter(inY).length };
    out.decisions_per_year = years.map(y => { const a = tenders.filter(t => t.y === y); return { y, yes: a.filter(t => t.ceo_decision === 'yes').length, no: a.filter(t => t.ceo_decision === 'no').length, pending: a.filter(t => !t.ceo_decision && t.status === 'review').length, withdrawn: wds.filter(w => w.y === y).length }; });
    out.risks = sel.filter(t => (t.risk_text || t.opportunity_text) && ['review', 'active'].includes(t.status)).slice(0, 25)
      .map(t => ({ id: t.id, title: t.title, client_name: t.client_name, risk: t.risk_text, opportunity: t.opportunity_text }));

    if (section === 'finished') {
      const fin = tenders.filter(t => t.status === 'finished');
      const decided = t => t.result === 'won' || t.result === 'lost';
      const perYear = years.map(y => {
        const a = fin.filter(t => t.y === y && decided(t)), l = lg.filter(r => r.y === y && r.t === 't');
        const w = a.filter(t => t.result === 'won').length + l.filter(r => r.r === 'w').length, lo = a.length + l.length - w;
        return { y, won: w, lost: lo, rate: pct(w, w + lo), amount: a.filter(t => t.result === 'won').reduce((s, t) => s + n(t.contract_amount), 0) + l.filter(r => r.r === 'w').reduce((s, r) => s + r.a, 0) };
      });
      const cur = fin.filter(inY), dec = cur.filter(decided);
      const cl = new Map();
      dec.forEach(t => bump(cl, t.client_name || 'نامشخص', o => { o.won = (o.won || 0) + (t.result === 'won' ? 1 : 0); o.lost = (o.lost || 0) + (t.result === 'lost' ? 1 : 0); o.amount = (o.amount || 0) + (t.result === 'won' ? n(t.contract_amount) : 0); }));
      const clients = [...cl.values()].map(o => ({ ...o, rate: pct(o.won, o.won + o.lost) })).sort((a, b) => b.won - a.won || b.rate - a.rate);
      const won = cur.filter(t => t.result === 'won').map(t => ({ id: t.id, y: t.y, title: t.title, client_name: t.client_name, kind: t.kind, sq: t.score_quality, st: t.score_technical, sp: t.score_price, stot: t.score_total, rank: t.rank_no, offer: t.our_offer, contract: t.contract_amount, budget: t.budget }));
      const w = dec.filter(t => t.result === 'won').length;
      const avg = k => { const v = dec.filter(t => t.result === 'won' && t[k] != null).map(t => n(t[k])); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
      out.finished = { per_year: perYear, totals: { total: dec.length, won: w, lost: dec.length - w, rate: pct(w, dec.length), pending: cur.filter(t => !decided(t)).length, closed: tenders.filter(t => inY(t) && t.status === 'closed').length,
        won_amount: won.reduce((s, t) => s + n(t.contract), 0), avg_quality: avg('score_quality'), avg_technical: avg('score_technical'), avg_price: avg('score_price'), avg_total: avg('score_total'),
        by_kind: ['exploration', 'supervision'].map(k => { const d = dec.filter(t => t.kind === k), ww = d.filter(t => t.result === 'won').length; return { kind: k, won: ww, lost: d.length - ww, rate: pct(ww, d.length) }; }) },
        clients, best_clients: clients.filter(c => c.won > 0).slice(0, 8), worst_clients: clients.filter(c => c.lost > 0).sort((a, b) => b.lost - a.lost || a.rate - b.rate).slice(0, 8), won };
    }

    if (section === 'running') {
      const run = tenders.filter(t => ['review', 'active'].includes(t.status) && inY(t));
      const stage = t => t.status === 'review' ? (t.tech_done ? 'await_ceo' : 'await_tech') : (t.submit_status || 'running');
      const st = new Map();
      run.forEach(t => bump(st, stage(t), o => { o.n = (o.n || 0) + 1; o.budget = (o.budget || 0) + n(t.budget); o.offer = (o.offer || 0) + n(t.our_offer); }));
      const cl = new Map(); run.forEach(t => bump(cl, t.client_name || 'نامشخص', o => { o.n = (o.n || 0) + 1; o.budget = (o.budget || 0) + n(t.budget); }));
      const today = new Date().toISOString().slice(0, 10);
      out.running = { total: run.length, budget: run.reduce((s, t) => s + n(t.budget), 0), offer: run.reduce((s, t) => s + n(t.our_offer), 0), guarantee: run.reduce((s, t) => s + n(t.guarantee_amount), 0),
        guarantee_pending: run.filter(t => t.needs_guarantee && t.guarantee_status === 'pending').length,
        stages: [...st.entries()].map(([k, o]) => ({ stage: k, n: o.n, budget: o.budget, offer: o.offer })),
        clients: [...cl.values()].sort((a, b) => b.n - a.n).slice(0, 8),
        upcoming: run.filter(t => t.deadline && String(t.deadline).slice(0, 10) >= today).sort((a, b) => String(a.deadline).localeCompare(String(b.deadline))).slice(0, 10)
          .map(t => ({ id: t.id, title: t.title, client_name: t.client_name, deadline: t.deadline, stage: stage(t), budget: t.budget })),
        by_kind: ['exploration', 'supervision'].map(k => ({ kind: k, n: run.filter(t => t.kind === k).length })) };
    }

    if (section === 'inquiries') {
      const cur = inqs.filter(inY), by = new Map(), pt = new Map();
      cur.forEach(i => { bump(by, i.status, o => { o.n = (o.n || 0) + 1; o.amount = (o.amount || 0) + n(i.amount); }); bump(pt, i.party || 'نامشخص', o => { o.n = (o.n || 0) + 1; o.amount = (o.amount || 0) + n(i.amount); }); });
      out.inquiries = { total: cur.length, amount: cur.reduce((s, i) => s + n(i.amount), 0), by_status: [...by.entries()].map(([k, o]) => ({ status: k, n: o.n, amount: o.amount })),
        per_year: years.map(y => ({ y, n: inqs.filter(i => i.y === y).length, amount: inqs.filter(i => i.y === y).reduce((s, i) => s + n(i.amount), 0) })),
        parties: [...pt.values()].sort((a, b) => b.n - a.n).slice(0, 8), recent: cur.slice().sort((a, b) => b.id - a.id).slice(0, 8).map(i => ({ id: i.id, title: i.title, party: i.party, status: i.status, amount: i.amount, date: i.inquiry_date })) };
    }

    if (section === 'proposals') {
      const cur = props.filter(inY), by = new Map(), cl = new Map();
      cur.forEach(p => { bump(by, p.status, o => { o.n = (o.n || 0) + 1; o.amount = (o.amount || 0) + n(p.offer_amount); }); if (['won', 'lost'].includes(p.status)) bump(cl, p.client_name || 'نامشخص', o => { o.won = (o.won || 0) + (p.status === 'won' ? 1 : 0); o.lost = (o.lost || 0) + (p.status === 'lost' ? 1 : 0); }); });
      const dc = cur.filter(p => ['won', 'lost'].includes(p.status)), w = dc.filter(p => p.status === 'won').length;
      out.proposals = { total: cur.length, amount: cur.reduce((s, p) => s + n(p.offer_amount), 0), won: w, lost: dc.length - w, rate: pct(w, dc.length), by_status: [...by.entries()].map(([k, o]) => ({ status: k, n: o.n, amount: o.amount })),
        per_year: years.map(y => { const a = props.filter(p => p.y === y && ['won', 'lost'].includes(p.status)), ww = a.filter(p => p.status === 'won').length; return { y, won: ww, lost: a.length - ww, rate: pct(ww, a.length) }; }),
        clients: [...cl.values()].map(o => ({ ...o, won: o.won || 0, lost: o.lost || 0, rate: pct(o.won || 0, (o.won || 0) + (o.lost || 0)) })).sort((a, b) => b.won - a.won).slice(0, 8) };
    }
    res.json(out);
  } catch (e) { next(e); }
});
module.exports = router;
