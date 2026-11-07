/* مناقصات عمومی (نفت و گاز): داشبورد تحلیلی، خط لولهٔ فرصت‌ها (جدول/تابلو)، تصمیم شرکت/عدم شرکت، استانداردها، ماتریس ریسک، رقبا، کارها و کاتالوگ استانداردها */
'use strict';

const G = {
  STAGES: [['identified', 'شناسایی‌شده'], ['qualifying', 'در حال ارزیابی'], ['preparing', 'تهیهٔ پیشنهاد'], ['submitted', 'ارسال‌شده'], ['won', 'برنده'], ['lost', 'بازنده'], ['no_bid', 'عدم شرکت']],
  STAGE_CLS: { identified: '', qualifying: 'info', preparing: 'warn', submitted: 'brand', won: 'ok', lost: 'bad', no_bid: '' },
  STAGE_COLOR: { identified: '#8a93a6', qualifying: '#3a6fb4', preparing: '#c88a14', submitted: '#7a5ea8', won: '#2f8f5b', lost: '#c5443a', no_bid: '#b8bdc8' },
  OPEN: ['identified', 'qualifying', 'preparing', 'submitted'],
  CATS: [['upstream', 'بالادستی (اکتشاف و تولید)'], ['downstream', 'پایین‌دستی (پالایش و پتروشیمی)'], ['drilling', 'حفاری و چاه'], ['pipeline', 'خط لوله و انتقال'], ['epc', 'EPC و پیمانکاری عمومی'], ['supply', 'تأمین کالا و تجهیزات'], ['services', 'خدمات فنی و بازرسی'], ['hse', 'ایمنی و محیط زیست'], ['other', 'سایر']],
  CAT_COLOR: ['#3a6fb4', '#b95c50', '#2f8f5b', '#c88a14', '#7a5ea8', '#2a9d9d', '#8a8f98', '#c5443a', '#5b6b8c'],
  CUR: { IRR: 'ریال', USD: 'USD', EUR: 'EUR', AED: 'AED' },
  STD: [['required', 'الزامی'], ['compliant', 'منطبق'], ['gap', 'شکاف'], ['na', 'نامرتبط']],
  STD_CLS: { required: 'info', compliant: 'ok', gap: 'bad', na: '' },
  CRIT: [['fit', 'تناسب با توان و تخصص شرکت'], ['client', 'اعتبار و سابقهٔ کارفرما'], ['competition', 'شدت رقابت (۵ = رقابت کم)'], ['margin', 'حاشیهٔ سود'], ['capacity', 'ظرفیت اجرایی و منابع'], ['risk', 'ریسک کلی (۵ = ریسک کم)']],
  // چک‌لیست بستهٔ پیشنهاد مطابق رویهٔ رایج مناقصات صنعت نفت و گاز (PQ، پیشنهاد فنی و بازرگانی جداگانه، HSE، QA/QC، ضمانت‌نامه، …)
  BIDDOCS: [['pq', 'مدارک ارزیابی صلاحیت پیمانکار (PQ) و ثبت در فهرست مناقصه‌گران'], ['legal', 'مدارک حقوقی (اساسنامه، آگهی تأسیس و تغییرات، گواهی ثبت)'], ['fin', 'صورت‌های مالی حسابرسی‌شده و ظرفیت مالی'], ['exp', 'سوابق مشابه و رضایت‌نامهٔ کارفرمایان'],
    ['cert', 'گواهینامه‌ها (ISO 9001، ISO 14001، ISO 45001، API Q1 و رتبهٔ صلاحیت)'], ['tech', 'پیشنهاد فنی (Technical Proposal) — پاکت جداگانه'], ['method', 'روش اجرا و ساختار شکست کار (Method Statement / WBS)'], ['schedule', 'برنامهٔ زمان‌بندی (Level 3) و منحنی پیشرفت'],
    ['org', 'ساختار سازمانی پروژه و رزومهٔ کارکنان کلیدی'], ['equip', 'فهرست تجهیزات و ماشین‌آلات'], ['hse', 'طرح HSE / HSE-MS'], ['qaqc', 'طرح تضمین و کنترل کیفیت (QA/QC Plan)'], ['local', 'برنامهٔ ساخت و تأمین داخل / ارزش افزودهٔ داخلی (IVC)'],
    ['std', 'ماتریس انطباق با استانداردها و مشخصات فنی (IPS / API / ISO)'], ['dev', 'فهرست انحرافات و ابهامات (Deviation / Clarification List)'], ['comm', 'پیشنهاد بازرگانی و مالی (Commercial Proposal) — پاکت جداگانه'], ['bond', 'ضمانت‌نامهٔ شرکت در مناقصه (Bid Bond)'], ['coi', 'تعهدنامهٔ عدم تعارض منافع و رعایت اصول اخلاقی و ضدفساد']],
  GCODE: { tech_review: 'نیازمند بررسی فنی (روش، زمان‌بندی، قیمت)', ceo_decide: 'تصمیم شرکت / عدم شرکت', ceo_decide_early: 'تصمیم شرکت / عدم شرکت (بررسی فنی هنوز ثبت نشده)', guarantee_request: 'درخواست ضمانت‌نامه', closed: 'بسته شد (عدم شرکت)',
    preparing: 'تهیهٔ مدارک و پیشنهاد', prep_guarantee_wait: 'تهیهٔ مدارک — منتظر ضمانت‌نامه', submitted: 'ارسال شده؛ منتظر نتیجه', waiting: 'در انتظار بررسی فنی و تصمیم مدیرعامل', expert_review: 'در دست بررسی', my_task: 'کار ارجاع‌شده به من', my_task_done: 'کار من انجام شد' },
  canEdit: () => can('super_admin', 'ceo', 'technical_manager', 'technical_expert', 'procurement'),
  canDecide: () => can('super_admin', 'ceo', 'technical_manager'),
  stage: s => (G.STAGES.find(x => x[0] === s) || [s, s])[1],
  cat: c => (G.CATS.find(x => x[0] === c) || [c, c])[1],
  money: (v, c) => (v == null || v === '') ? '—' : fmtNum(v) + ' ' + (G.CUR[c] || c || ''),
  short(v) { v = Number(v) || 0; const a = Math.abs(v); const f = (x, u) => fmtNum(Math.round(x * 10) / 10) + ' ' + u; return a >= 1e9 ? f(v / 1e9, 'میلیارد') : a >= 1e6 ? f(v / 1e6, 'میلیون') : a >= 1e3 ? f(v / 1e3, 'هزار') : fmtNum(v); },
  month(m) { const p = J.parts(m + '-15'); return p ? toFaNum(p[0] + '/' + String(p[1]).padStart(2, '0')) : m; },
  stageChip: s => chip(G.stage(s), G.STAGE_CLS[s] || ''),
  daysChip(d, stage) {
    if (!d) return '<span class="muted">—</span>';
    const n = daysFromToday(d), open = ['identified', 'qualifying', 'preparing'].includes(stage);
    const c = !open || n == null ? '' : n < 0 ? ' ' + chip('گذشته', 'bad') : n <= 7 ? ' ' + chip(n === 0 ? 'امروز' : fmtNum(n) + ' روز', 'warn') : '';
    return fmtDate(d) + c;
  },
  // ───── نمودارها (SVG/HTML خالص) ─────
  donut(rows, centerLabel) {
    const tot = rows.reduce((s, r) => s + r.value, 0), R = 62, C = 2 * Math.PI * R; if (!tot) return empty('داده‌ای برای نمایش نیست');
    let acc = 0;
    const seg = rows.filter(r => r.value > 0).map(r => { const len = C * r.value / tot, s = `<circle r="${R}" cx="90" cy="90" fill="none" stroke="${r.color}" stroke-width="26" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-acc}"><title>${esc(r.label)}: ${fmtNum(r.value)}</title></circle>`; acc += len; return s; }).join('');
    return `<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;justify-content:center"><svg class="chart" viewBox="0 0 180 180" style="width:170px;height:170px" role="img" aria-label="${esc(centerLabel)}"><g transform="rotate(-90 90 90)">${seg}</g><text class="val" x="90" y="94" text-anchor="middle" style="font-size:26px">${fmtNum(tot)}</text><text x="90" y="114" text-anchor="middle">${esc(centerLabel)}</text></svg>
      <div style="display:grid;gap:5px;font-size:14.5px">${rows.filter(r => r.value > 0).map(r => `<span><i style="display:inline-block;width:11px;height:11px;border-radius:3px;background:${r.color};margin-inline-end:7px"></i>${esc(r.label)} <b>${fmtNum(r.value)}</b></span>`).join('')}</div></div>`;
  },
  bars(rows) {
    const mx = Math.max(1, ...rows.map(r => r.value));
    return `<div style="display:grid;gap:9px">${rows.map(r => `<div><div style="display:flex;justify-content:space-between;font-size:14.5px;margin-bottom:2px"><span>${esc(r.label)}</span><span class="muted">${r.note || ''} <b style="color:var(--text)">${fmtNum(r.value)}</b></span></div><div class="progress" style="height:12px"><i style="width:${Math.max(r.value ? 3 : 0, r.value * 100 / mx)}%;background:${r.color}"></i></div></div>`).join('')}</div>`;
  },
  columns(rows) {
    if (!rows.length) return empty('مناقصه‌ای با مهلت ثبت‌شده وجود ندارد');
    const W = 560, H = 210, pl = 26, pb = 30, pt = 18, mx = Math.max(2, ...rows.map(r => r.n)), n = rows.length, bw = Math.min(38, (W - pl) / n * .6), rtl = isFa();
    const x = i => pl + (W - pl) * (rtl ? n - i - .5 : i + .5) / n, y = v => pt + (H - pt - pb) * (1 - v / mx);
    const cur = G.month(new Date().toISOString().slice(0, 7));
    let g = ''; for (let i = 0; i <= 2; i++) { const v = Math.round(mx * i / 2); g += `<line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)"/><text x="${pl - 5}" y="${y(v) + 4}" text-anchor="end">${fmtNum(v)}</text>`; }
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="تعداد مهلت‌ها به تفکیک ماه">${g}${rows.map((r, i) => `<rect x="${x(i) - bw / 2}" y="${y(r.n)}" width="${bw}" height="${Math.max(2, y(0) - y(r.n))}" rx="3" fill="${G.month(r.m) === cur ? 'var(--primary)' : 'var(--info)'}"><title>${G.month(r.m)}: ${fmtNum(r.n)}</title></rect><text class="val" x="${x(i)}" y="${y(r.n) - 5}" text-anchor="middle">${fmtNum(r.n)}</text><text x="${x(i)}" y="${H - 10}" text-anchor="middle">${G.month(r.m)}</text>`).join('')}</svg>`;
  },
  gauge(score) {
    const v = score == null ? 0 : Math.max(0, Math.min(100, score)), col = v >= 70 ? 'var(--ok)' : v >= 50 ? 'var(--warn)' : 'var(--bad)', R = 70, L = Math.PI * R;
    return `<svg class="chart" viewBox="0 0 180 110" style="width:210px;max-width:100%" role="img" aria-label="امتیاز تصمیم ${v}"><path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="var(--surface2)" stroke-width="16" stroke-linecap="round"/><path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="${col}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${L * v / 100} ${L}"/><text class="val" x="90" y="84" text-anchor="middle" style="font-size:28px">${score == null ? '—' : fmtNum(v)}</text><text x="90" y="104" text-anchor="middle">از ۱۰۰</text></svg>`;
  },
  matrix(risks) {
    const S = 44, o = 30, W = o + S * 5 + 4, H = S * 5 + 34, cell = (p, i) => { const sc = p * i; return sc >= 15 ? 'var(--bad)' : sc >= 8 ? 'var(--warn)' : 'var(--ok)'; };
    let g = ''; for (let p = 1; p <= 5; p++) for (let i = 1; i <= 5; i++) {
      const items = risks.map((r, k) => ({ k: k + 1, r })).filter(x => x.r.probability === p && x.r.impact === i);
      g += `<rect x="${o + (i - 1) * S}" y="${(5 - p) * S}" width="${S - 2}" height="${S - 2}" rx="5" fill="${cell(p, i)}" opacity=".2"/>${items.length ? `<text class="val" x="${o + (i - 1) * S + S / 2 - 1}" y="${(5 - p) * S + S / 2 + 4}" text-anchor="middle">${items.map(x => fmtNum(x.k)).join('،')}</text>` : ''}`;
    }
    g += [1, 2, 3, 4, 5].map(v => `<text x="${o - 8}" y="${(5 - v) * S + S / 2 + 3}" text-anchor="middle">${fmtNum(v)}</text><text x="${o + (v - 1) * S + S / 2 - 1}" y="${5 * S + 14}" text-anchor="middle">${fmtNum(v)}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="width:100%;max-width:290px" role="img" aria-label="ماتریس ریسک"><g>${g}</g><text x="${o + S * 2.5}" y="${H - 4}" text-anchor="middle">شدت اثر ←</text></svg>`;
  }
};

/* ───────── داشبورد ───────── */
App.register({ id: 'g/dashboard', title: 'داشبورد نفت و گاز', not: ['staff'], async render(el) {
  const s = await API.get('/general/summary'), T = s.totals, st = Object.fromEntries(s.stages.map(x => [x.stage, x]));
  const openN = G.OPEN.reduce((a, k) => a + ((st[k] || {}).n || 0), 0), total = s.stages.reduce((a, x) => a + x.n, 0);
  if (!total) { el.innerHTML = `<div class="card">${empty('هنوز مناقصه‌ای ثبت نشده است.')}<div style="text-align:center">${G.canEdit() ? '<a class="btn primary" href="#/g/list">+ ثبت اولین مناقصه</a>' : ''}</div></div>`; return; }
  const urgent = s.upcoming.filter(x => x.days_left <= 7);
  const kpi = (l, v, c, sub) => `<div class="card kpi ${c || ''}"><div class="lbl">${l}</div><div class="val">${v}</div>${sub ? `<div class="muted small">${sub}</div>` : ''}</div>`;
  const catRows = s.categories.map((c, i) => ({ label: G.cat(c.category), value: c.n, color: G.CAT_COLOR[i % G.CAT_COLOR.length] }));
  el.innerHTML = `${urgent.length ? `<div class="sample-banner">⏰ ${fmtNum(urgent.length)} مناقصه در ۷ روز آینده مهلت دارد و هنوز ارسال نشده: ${urgent.map(u => `<a class="link" href="#/g/list/${u.id}">${esc(u.title)}</a>`).join('، ')}</div>` : ''}
    <div class="cards">
      ${kpi('مناقصات باز', fmtNum(openN), 'info', 'شناسایی تا ارسال')}
      ${kpi('ارزش خط لوله', G.short(T.pipeline), '', 'جمع برآورد مناقصات باز')}
      ${kpi('ارزش وزنی', G.short(T.weighted), 'warn', 'برآورد × احتمال برد')}
      ${kpi('نرخ برد', T.win_rate == null ? '—' : fmtNum(T.win_rate) + '٪', T.win_rate >= 50 ? 'ok' : 'bad', `${fmtNum(T.won)} برنده از ${fmtNum(T.won + T.lost)} نتیجه‌دار`)}
      ${kpi('شکاف استاندارد', fmtNum(T.open_gaps), T.open_gaps ? 'bad' : 'ok', 'در مناقصات باز')}
    </div>
    <div class="grid2">
      <div class="card"><h3>قیف مناقصات (تعداد در هر مرحله)</h3>${G.bars(G.STAGES.map(([k, l]) => ({ label: l, value: (st[k] || {}).n || 0, color: G.STAGE_COLOR[k], note: (st[k] || {}).value ? '<span class="muted">' + G.short(st[k].value) + '</span> · ' : '' })))}</div>
      <div class="card"><h3>تفکیک بر اساس حوزه</h3>${G.donut(catRows, 'مناقصه')}</div>
    </div>
    <div class="grid2">
      <div class="card"><h3>مهلت‌ها به تفکیک ماه</h3>${G.columns(s.deadlines_by_month)}</div>
      <div class="card"><h3>مهلت‌های نزدیک</h3>${s.upcoming.length ? `<div class="table-wrap" style="box-shadow:none"><table><tbody>${s.upcoming.map(u => `<tr class="click" data-go="${u.id}"><td><b>${esc(u.title)}</b><div class="muted small">${esc(u.client_name || '')}</div></td><td>${G.stageChip(u.stage)}</td><td class="num">${fmtDate(u.deadline)} ${u.days_left <= 7 ? chip(u.days_left === 0 ? 'امروز' : fmtNum(u.days_left) + ' روز', 'warn') : ''}</td></tr>`).join('')}</tbody></table></div>` : empty('مناقصهٔ بازِ دارای مهلت وجود ندارد')}</div>
    </div>
    <p class="muted small">ارزش‌ها بدون تبدیل ارز جمع شده‌اند؛ برای مقایسهٔ دقیق، مناقصات هم‌ارز را با یک واحد پولی ثبت کنید.</p>`;
  el.onclick = e => { const r = e.target.closest('[data-go]'); if (r) App.go('g/list/' + r.dataset.go); };
} });

/* ───────── فهرست و جزئیات ───────── */
const gl = { view: 'table', q: '', bucket: 'open', category: '', stage: '', sort: 'deadline', from: '', to: '' };

function gForm(t) {
  t = t || {};
  return `<div class="form-grid">
    <label class="field full"><span class="req">عنوان مناقصه</span><input name="title" value="${esc(t.title || '')}"></label>
    <label class="field"><span>شمارهٔ مناقصه</span><input name="tender_number" dir="ltr" value="${esc(t.tender_number || '')}"></label>
    <label class="field"><span>کارفرما</span><input name="client_name" value="${esc(t.client_name || '')}"></label>
    <label class="field"><span>حوزه</span><select name="category">${opts(G.CATS, t.category || 'other')}</select></label>
    <label class="field"><span>محل اجرا</span><input name="location" value="${esc(t.location || '')}"></label>
    <label class="field"><span>برآورد ارزش</span>${moneyField('est_value', t.est_value)}</label>
    <label class="field"><span>واحد پول</span><select name="currency">${opts(Object.entries(G.CUR), t.currency || 'IRR')}</select></label>
    <label class="field"><span>مبلغ پایهٔ مناقصه</span>${moneyField('base_amount', t.base_amount)}</label><label class="field"><span>مبلغ ضمانت‌نامه (در صورت نیاز)</span>${moneyField('guarantee_amount', t.guarantee_amount)}</label>
    <label class="field"><span>تاریخ دریافت</span>${dateField('received_date', t.received_date || (t.id ? '' : J.today()))}</label>
    <label class="field"><span>تاریخ انتشار</span>${dateField('publish_date', t.publish_date)}</label>
    <label class="field"><span>مهلت ارسال پیشنهاد</span>${dateField('deadline', t.deadline)}</label>
    <label class="field"><span>احتمال برد (٪)</span><input name="probability" type="number" min="0" max="100" value="${t.probability == null ? '' : t.probability}"></label>
    <label class="field full"><span>یادداشت</span><textarea name="notes">${esc(t.notes || '')}</textarea></label>
    <label class="field full"><span>ریسک‌ها (اختیاری)</span><textarea name="risk_text">${esc(t.risk_text || '')}</textarea></label><label class="field full"><span>فرصت‌ها (اختیاری)</span><textarea name="opportunity_text">${esc(t.opportunity_text || '')}</textarea></label></div>`;
}
function gRead(m) {
  const d = formData(m), pd = dateVal($('[name=publish_date]', m)), dl = dateVal($('[name=deadline]', m)), ev = numVal($('[name=est_value]', m));
  if (!d.title.trim()) throw new Error('عنوان مناقصه را وارد کنید');
  if (pd === null || dl === null) throw new Error('تاریخ معتبر نیست (نمونه: ۱۴۰۵/۰۲/۱۵)');
  if (ev === null) throw new Error('مبلغ معتبر نیست');
  const rd = dateVal($('[name=received_date]', m)), ba = numVal($('[name=base_amount]', m)), ga = numVal($('[name=guarantee_amount]', m));
  if (rd === null) throw new Error('تاریخ دریافت معتبر نیست'); if (ba === null || ga === null) throw new Error('مبلغ معتبر نیست');
  return { ...d, publish_date: pd, deadline: dl, est_value: ev, received_date: rd || '', base_amount: ba, guarantee_amount: ga };
}

App.register({ id: 'g/list', title: 'مناقصات عمومی', not: ['staff'], async render(el, arg) {
  if (arg) return gDetail(el, parseInt(arg) || 0);
  const params = { q: gl.q, sort: gl.sort, category: gl.category, stage: gl.stage, bucket: gl.stage ? '' : gl.bucket, date_from: J.toIso(gl.from) || '', date_to: J.toIso(gl.to) || '' };
  const rows = await API.get('/general', params);
  el.innerHTML = `<div class="page-head"><div class="tabs" style="margin:0;border:0"><button class="tab ${gl.view === 'table' ? 'on' : ''}" data-view="table">☰ جدول</button><button class="tab ${gl.view === 'board' ? 'on' : ''}" data-view="board">▦ تابلو</button></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="xls">⬇ اکسل</button>${G.canEdit() ? '<button class="btn primary" data-act="new">+ مناقصهٔ جدید</button>' : ''}</div></div>
    <div class="toolbar"><label class="f grow"><span>جستجو (عنوان، شماره، کارفرما، محل)</span><input id="gq" value="${esc(gl.q)}"></label>
      <label class="f"><span>وضعیت</span><select id="gbucket"><option value="open" ${gl.bucket === 'open' && !gl.stage ? 'selected' : ''}>در جریان</option><option value="closed" ${gl.bucket === 'closed' && !gl.stage ? 'selected' : ''}>بسته‌شده</option><option value="" ${!gl.bucket && !gl.stage ? 'selected' : ''}>همه</option></select></label>
      <label class="f"><span>مرحله</span><select id="gstage"><option value="">همه</option>${opts(G.STAGES, gl.stage)}</select></label>
      <label class="f"><span>حوزه</span><select id="gcat"><option value="">همه</option>${opts(G.CATS, gl.category)}</select></label>
      <label class="f"><span>مهلت از</span>${dateField('from', J.toIso(gl.from) || '')}</label><label class="f"><span>تا</span>${dateField('to', J.toIso(gl.to) || '')}</label>
      <label class="f"><span>مرتب‌سازی</span><select id="gsort">${opts([['deadline', 'نزدیک‌ترین مهلت'], ['newest', 'جدیدترین'], ['value_desc', 'بیشترین ارزش'], ['prob_desc', 'بیشترین احتمال برد']], gl.sort)}</select></label></div>
    ${!rows.length ? `<div class="card">${empty('مناقصه‌ای با این فیلترها پیدا نشد')}</div>` : gl.view === 'table' ? `<div class="table-wrap"><table><thead><tr><th>عنوان</th><th>شماره</th><th>کارفرما</th><th>حوزه</th><th>برآورد</th><th>مهلت</th><th>مرحله</th><th>احتمال</th><th>پیوست</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="click" data-go="${r.id}"><td class="cell-name"><b>${esc(r.title)}</b></td><td class="ltr">${esc(r.tender_number || '—')}</td><td>${esc(r.client_name || '—')}</td><td>${esc(G.cat(r.category))}</td><td class="num">${G.money(r.est_value, r.currency)}</td><td class="num">${G.daysChip(r.deadline, r.stage)}</td><td>${G.stageChip(r.stage)}</td>
        <td style="min-width:90px">${r.probability == null ? '—' : `<div class="progress"><i style="width:${r.probability}%"></i></div><small class="muted">${fmtNum(r.probability)}٪</small>`}</td><td>${r.files_count ? '📎 ' + fmtNum(r.files_count) : '—'}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted small" style="margin-top:8px">${fmtNum(rows.length)} مناقصه</p>`
      : `<div class="kanban">${G.STAGES.filter(([k]) => !gl.bucket || (gl.bucket === 'open' ? G.OPEN.includes(k) : !G.OPEN.includes(k)) || gl.stage).map(([k, l]) => { const c = rows.filter(r => r.stage === k); return `<div class="kcol"><h4><span>${l}</span><span class="muted">${fmtNum(c.length)}</span></h4>${c.map(r => `<div class="kcard" data-go="${r.id}"><b>${esc(r.title)}</b><div class="muted small">${esc(r.client_name || '')}</div><div class="small" style="margin-top:4px">${G.money(r.est_value, r.currency)}</div><div class="small">${G.daysChip(r.deadline, r.stage)}</div></div>`).join('') || '<div class="muted small" style="padding:6px">—</div>'}</div>`; }).join('')}</div>`}`;
  const bind = (id, k, ev = 'change') => $('#' + id, el).addEventListener(ev, e => { gl[k] = e.target.value; if (k === 'stage' && e.target.value) gl.bucket = ''; App.refresh(); });
  $('#gq', el).addEventListener('input', debounce(e => { gl.q = e.target.value; App.refresh(); }, 350));
  bind('gbucket', 'bucket'); bind('gstage', 'stage'); bind('gcat', 'category'); bind('gsort', 'sort');
  ['from', 'to'].forEach(n => $(`[name=${n}]`, el).addEventListener('change', e => { const iso = dateVal(e.target); if (iso === null) return toast('تاریخ معتبر نیست', 'error'); gl[n] = iso ? J.fromIso(iso) : ''; App.refresh(); }));
  el.onclick = e => {
    const v = e.target.closest('[data-view]'); if (v) { gl.view = v.dataset.view; return App.refresh(); }
    const g = e.target.closest('[data-go]'); if (g) return App.go('g/list/' + g.dataset.go);
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'xls') return saveBlob(XL.write([{ name: 'مناقصات عمومی', header: true, widths: [40, 16, 26, 22, 18, 8, 14, 16, 14, 10], rows: [['عنوان', 'شماره', 'کارفرما', 'حوزه', 'برآورد', 'واحد', 'مهلت', 'مرحله', 'تصمیم', 'احتمال برد'],
      ...rows.map(r => [r.title, r.tender_number || '', r.client_name || '', G.cat(r.category), r.est_value == null ? '' : Number(r.est_value), r.currency, r.deadline ? J.fromIso(r.deadline) : '', G.stage(r.stage), r.bid_decision === 'bid' ? 'شرکت' : r.bid_decision === 'no_bid' ? 'عدم شرکت' : '', r.probability == null ? '' : r.probability])] }]), 'general-tenders.xlsx');
    if (a.dataset.act === 'new') Modal.open({ title: 'ثبت مناقصهٔ عمومی', wide: true, html: gForm(), actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت', cls: 'primary', run: async m => { const r = await API.post('/general', gRead(m)); toast('ثبت شد', 'success'); App.go('g/list/' + r.id); } }] });
  };
} });

async function gDetail(el, id) {
  const t = await API.get('/general/' + id), std = await API.get('/general/standards');
  App.setTitle(t.title);
  const dir = t.perm.assign ? await App.directory().catch(() => []) : [];
  const S = { tab: (App.query && App.query.tab) || 'wf', chk: { ...(t.checklist || {}) }, scores: { ...(t.bid_score || {}) }, std: { ...(t.standards || {}) }, risks: (t.risks || []).map(x => ({ ...x })), comps: (t.competitors || []).map(x => ({ ...x })), tasks: (t.tasks || []).map(x => ({ ...x })), sq: '', sbody: '', sonly: false };
  const ro = !t.can_edit, dis = ro ? 'disabled' : '';
  const total = sc => { const v = Object.values(sc || {}); return v.length ? Math.round(v.reduce((a, c) => a + c, 0) / (G.CRIT.length * 5) * 100) : null; };
  const rec = sc => { const v = total(sc), n = Object.keys(sc || {}).length; if (v == null) return '<span class="muted">برای دیدن توصیه، معیارها را امتیاز دهید.</span>'; const w = n < G.CRIT.length ? ` <span class="muted small">(${fmtNum(G.CRIT.length - n)} معیار امتیازدهی نشده)</span>` : ''; return (v >= 70 ? chip('توصیه: شرکت در مناقصه', 'ok') : v >= 50 ? chip('نیازمند بررسی بیشتر', 'warn') : chip('توصیه: عدم شرکت', 'bad')) + w; };
  const doneSave = async (fn, ok = 'ذخیره شد') => { try { await fn(); toast(ok, 'success'); } catch (e) { toast(e.message, 'error'); } };
  const tabs = () => [['wf', 'گردش‌کار'], ['sum', 'خلاصه'], ['dec', 'امتیازدهی تصمیم'], ['cm', `کامنت و تاریخچه (${fmtNum(t.comments.length)})`], ['ch', `اعلان تغییرات (${fmtNum(t.changes.length)})`], ['std', `استانداردها (${fmtNum(Object.keys(S.std).length)})`], ['risk', `ریسک‌ها (${fmtNum(S.risks.length)})`], ['comp', `رقبا (${fmtNum(S.comps.length)})`], ['task', `کارها (${fmtNum(S.tasks.length)})`]];

  const panes = {
    wf: () => {
      const P = t.perm, tr = n => t[n] ? '✓' : '○';
      const steps = [['ثبت مناقصه (کارشناس مناقصات)', true], ['بررسی فنی: روش، زمان‌بندی، قیمت (مدیر دفتر فنی)', t.tech_done], ['تصمیم شرکت / عدم شرکت (مدیرعامل)', !!t.ceo_decision], ['ضمانت‌نامه (مدیر مالی)', !t.needs_guarantee || t.guarantee_status === 'received'], ['تهیهٔ مدارک بسته', ['submitted', 'won', 'lost'].includes(t.stage)], ['ارسال پیشنهاد و نتیجه', ['won', 'lost'].includes(t.stage)]];
      const stp = `<div class="card" style="margin-bottom:14px"><div style="display:flex;gap:6px;flex-wrap:wrap">${steps.map(([l, ok], i) => `<span class="chip ${ok ? 'ok' : t.stage === 'no_bid' && i > 2 ? '' : 'info'}">${ok ? '✓' : fmtNum(i + 1)} ${l}</span>`).join('')}</div>${t.stage === 'no_bid' ? '<p style="margin:8px 0 0">' + chip('تصمیم: عدم شرکت — مناقصه بسته شد', 'bad') + '</p>' : ''}</div>`;
      const gaps = Object.values(S.std).filter(v => v === 'gap').length, reqs = Object.values(S.std).filter(v => v === 'required').length;
      const tech = (P.tech || t.tech_done) ? `<div class="card" style="margin-bottom:14px"><h3>۱) بررسی فنی ${t.tech_done ? chip('ثبت شده', 'ok') : chip('در انتظار', 'warn')}</h3>
        <p class="muted small">انطباق با استانداردها (تب «استانداردها»): ${fmtNum(Object.keys(S.std).length)} مورد ارزیابی شده${gaps ? ` · <b style="color:var(--bad)">${fmtNum(gaps)} شکاف</b>` : ''}${reqs ? ` · ${fmtNum(reqs)} الزامی` : ''}</p>
        ${P.tech ? `<div class="form-grid"><label class="field full"><span>روش انجام کار</span><textarea id="wfMethod">${esc(t.method || '')}</textarea></label><label class="field full"><span>برنامهٔ زمان‌بندی</span><textarea id="wfSchedule">${esc(t.schedule || '')}</textarea></label><label class="field"><span>قیمت پیشنهادی (${esc(G.CUR[t.currency] || '')})</span>${moneyField('wf_offer', t.our_offer)}</label></div>
          <div style="display:flex;gap:8px;margin-top:10px"><button class="btn" data-act="techsave">ذخیرهٔ پیش‌نویس</button><button class="btn primary" data-act="techdone">ثبت بررسی فنی و ارسال به مدیرعامل</button></div>`
          : `<dl class="kv"><div><dt>روش انجام کار</dt><dd style="white-space:pre-wrap">${esc(t.method || '—')}</dd></div><div><dt>زمان‌بندی</dt><dd style="white-space:pre-wrap">${esc(t.schedule || '—')}</dd></div><div><dt>قیمت پیشنهادی</dt><dd>${t.our_offer ? G.money(t.our_offer, t.currency) : '—'}</dd></div></dl>`}</div>` : '';
      const ceo = `<div class="card" style="margin-bottom:14px"><h3>۲) تصمیم مدیرعامل ${t.ceo_decision ? chip(t.ceo_decision === 'yes' ? 'شرکت می‌کنیم' : 'شرکت نمی‌کنیم', t.ceo_decision === 'yes' ? 'ok' : 'bad') : chip('در انتظار', 'warn')}</h3>
        ${t.ceo_decision ? `<p class="small muted">${t.ceo_decided_at ? fmtDateTime(t.ceo_decided_at) : ''}${t.ceo_note ? ' · ' + esc(t.ceo_note) : ''}</p>${t.needs_guarantee ? `<p>نیازمند ضمانت‌نامه: ${t.guarantee_amount ? G.money(t.guarantee_amount, t.currency) : '—'} — ${t.guarantee_status === 'received' ? chip('دریافت شد', 'ok') : chip('منتظر مالی', 'warn')}</p>` : '<p class="muted small">ضمانت‌نامه لازم نیست.</p>'}` : '<p class="muted small">پس از ثبت بررسی فنی، مدیرعامل تصمیم می‌گیرد.</p>'}
        <div style="display:flex;gap:8px;flex-wrap:wrap">${P.ceo ? '<button class="btn primary" data-act="ceo">ثبت تصمیم</button>' : ''}${P.ceo_reset ? '<button class="btn" data-act="ceoreset">بازگرداندن تصمیم</button>' : ''}${P.finance ? '<button class="btn ok" data-act="gdone">ضمانت‌نامه دریافت شد</button>' : ''}</div></div>`;
      const asg = t.ceo_decision === 'yes' || t.assignments.length ? `<div class="card" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">۳) ارجاع تهیهٔ مدارک</h3>${P.assign ? '<button class="btn sm primary" data-act="asg">+ ارجاع</button>' : ''}</div>
        ${t.assignments.map(a => `<div class="tree-row" style="margin-top:8px;flex-wrap:wrap"><b>${esc(a.assignee_name)}</b><span style="flex:1">${esc(a.doc_key ? ((G.BIDDOCS.find(d => d[0] === a.doc_key) || [])[1] || '') : '')} ${esc(a.task || '')}</span>${a.due_date ? `<small class="muted">مهلت: ${fmtDate(a.due_date)}</small>` : ''}${a.status === 'done' ? chip('انجام شد', 'ok') : chip('باز', 'warn')}
          ${(P.assign || a.user_id === Auth.user().id) ? `<button class="btn sm" data-asgtoggle="${a.id}" data-st="${a.status === 'done' ? 'open' : 'done'}">${a.status === 'done' ? 'بازگشایی' : 'انجام شد'}</button>` : ''}${P.assign ? `<button class="btn sm danger" data-asgdel="${a.id}">×</button>` : ''}</div>`).join('') || '<div class="muted small" style="margin-top:6px">هنوز کاری ارجاع نشده است.</div>'}</div>` : '';
      const done = G.BIDDOCS.filter(([k]) => S.chk[k]).length;
      const chk = t.ceo_decision === 'yes' ? `<div class="card" style="margin-bottom:14px"><h3>۴) چک‌لیست بستهٔ پیشنهاد (${fmtNum(done)} از ${fmtNum(G.BIDDOCS.length)})</h3><div class="progress" style="height:10px;margin-bottom:10px"><i style="width:${Math.round(done * 100 / G.BIDDOCS.length)}%"></i></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:4px 14px">${G.BIDDOCS.map(([k, l]) => `<label class="check"><input type="checkbox" data-chk="${k}" ${S.chk[k] ? 'checked' : ''} ${dis}> ${l}</label>`).join('')}</div>${ro ? '' : '<button class="btn sm primary" data-act="savechk" style="margin-top:10px">ذخیرهٔ چک‌لیست</button>'}</div>` : '';
      const ro2 = `<div class="card"><h3>ریسک و فرصت (اختیاری)</h3><div class="ro-grid"><label class="field"><span>ریسک‌ها</span><textarea id="wfRisk" ${dis}>${esc(t.risk_text || '')}</textarea></label><label class="field"><span>فرصت‌ها</span><textarea id="wfOpp" ${dis}>${esc(t.opportunity_text || '')}</textarea></label></div>${ro ? '' : '<button class="btn sm primary" data-act="saveriskopp">ذخیره</button>'}</div>`;
      return stp + tech + ceo + asg + chk + ro2;
    },
    cm: () => `<div class="card" style="margin-bottom:14px"><h3>کامنت و پیگیری</h3><div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px"><textarea id="gcmBody" placeholder="کامنت یا پیگیری خود را بنویسید…" style="flex:1;min-height:56px"></textarea><button class="btn primary" data-act="cmadd">ثبت کامنت</button></div>
      ${t.comments.map(c => `<div class="comment"><div style="display:flex;justify-content:space-between"><b>${esc(c.full_name || '—')}</b><small>${fmtDateTime(c.created_at)}${c.user_id === Auth.user().id || can('super_admin') ? ` <button class="link" data-cmdel="${c.id}">حذف</button>` : ''}</small></div><p>${esc(c.body)}</p></div>`).join('') || '<div class="muted small">کامنتی ثبت نشده است.</div>'}</div>
      <div class="card"><h3>تاریخچهٔ گردش‌کار</h3>${t.history.map(h => `<div class="tree-row" style="margin-bottom:5px"><small class="muted nowrap">${fmtDateTime(h.created_at)}</small><span style="flex:1">${esc(h.note || '')}</span><small class="muted">${esc(h.full_name || '')}</small></div>`).join('') || '<div class="muted small">تاریخچه‌ای نیست.</div>'}</div>`,
    ch: () => { const CHF = { guarantee_amount: 'مبلغ ضمانت‌نامه', base_amount: 'مبلغ پایه', deadline: 'مهلت ارسال پیشنهاد', our_offer: 'مبلغ پیشنهادی ما' }, vv = (f, v) => v == null || v === '' ? '—' : f === 'deadline' ? fmtDate(v) : fmtNum(v);
      return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0">اعلان تغییرات</h3>${t.perm.change ? '<button class="btn sm primary" data-act="chadd">+ ثبت تغییر</button>' : ''}</div>
      ${t.changes.map(c => `<div class="change-item"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(c.title)}</b>${t.perm.change && can('super_admin', 'ceo', 'technical_manager', 'procurement') ? `<button class="btn sm danger" data-chdel="${c.id}">حذف</button>` : ''}</div><small class="muted">${fmtDateTime(c.created_at)} · ${esc(c.full_name || '')}</small>
        ${c.field ? `<div style="margin-top:4px">${CHF[c.field]}: <s class="muted">${vv(c.field, c.old_value)}</s> ← <b>${vv(c.field, c.new_value)}</b></div>` : ''}${c.body ? `<p style="margin:4px 0 0;white-space:pre-wrap">${esc(c.body)}</p>` : ''}
        ${t.files.filter(f => f.kind === 'change' && f.change_id === c.id).map(f => `<div class="file" style="margin-top:4px">📄 <span class="name">${esc(f.file_name)}</span><button class="btn sm" data-dl="${f.id}" data-name="${esc(f.file_name)}">دانلود</button></div>`).join('')}</div>`).join('') || empty('تغییری اعلام نشده است')}</div>`; },
    sum: () => `<div class="grid2"><div class="card"><dl class="kv"><div><dt>شمارهٔ مناقصه</dt><dd class="ltr">${esc(t.tender_number || '—')}</dd></div><div><dt>کارفرما</dt><dd>${esc(t.client_name || '—')}</dd></div><div><dt>حوزه</dt><dd>${esc(G.cat(t.category))}</dd></div><div><dt>محل اجرا</dt><dd>${esc(t.location || '—')}</dd></div>
        <div><dt>برآورد ارزش</dt><dd>${G.money(t.est_value, t.currency)}</dd></div><div><dt>تاریخ انتشار</dt><dd>${t.publish_date ? fmtDate(t.publish_date) : '—'}</dd></div><div><dt>مهلت ارسال</dt><dd>${G.daysChip(t.deadline, t.stage)}</dd></div><div><dt>احتمال برد</dt><dd>${t.probability == null ? '—' : fmtNum(t.probability) + '٪'}</dd></div><div><dt>مسئول</dt><dd>${esc(t.owner_name || '—')}</dd></div><div><dt>تاریخ دریافت</dt><dd>${t.received_date ? fmtDate(t.received_date) : '—'}</dd></div><div><dt>مبلغ پایه</dt><dd>${G.money(t.base_amount, t.currency)}</dd></div><div><dt>مبلغ ضمانت‌نامه</dt><dd>${t.guarantee_amount ? G.money(t.guarantee_amount, t.currency) : '—'}</dd></div><div><dt>پیشنهاد ما</dt><dd>${t.our_offer ? G.money(t.our_offer, t.currency) : '—'}</dd></div><div><dt>تصمیم</dt><dd>${t.bid_decision === 'bid' ? chip('شرکت', 'ok') : t.bid_decision === 'no_bid' ? chip('عدم شرکت') : '<span class="muted">ثبت نشده</span>'}</dd></div></dl>
        ${t.risk_text || t.opportunity_text ? `<div class="ro-grid" style="margin-top:10px">${t.risk_text ? `<div><span class="chip bad">ریسک</span><p style="margin:4px 0 0;white-space:pre-wrap">${esc(t.risk_text)}</p></div>` : ''}${t.opportunity_text ? `<div><span class="chip ok">فرصت</span><p style="margin:4px 0 0;white-space:pre-wrap">${esc(t.opportunity_text)}</p></div>` : ''}</div>` : ''}
        ${t.notes ? `<h4 class="sub">یادداشت</h4><p style="white-space:pre-line;margin:0">${esc(t.notes)}</p>` : ''}</div>
      <div class="card"><h3>پیوست‌ها</h3>${t.files.length ? `<div class="filelist">${t.files.map(f => `<div class="file">📄 <span class="name">${esc(f.file_name)}</span><small>${formatSize(f.file_size)}</small><button class="btn sm" data-dl="${f.id}" data-name="${esc(f.file_name)}">دانلود</button>${ro ? '' : `<button class="btn sm danger" data-delfile="${f.id}">حذف</button>`}</div>`).join('')}</div>` : empty('پیوستی نیست')}
        ${ro ? '' : '<label class="btn" style="margin-top:10px">+ بارگذاری فایل<input type="file" id="gfile" class="hidden"></label>'}</div></div>`,
    dec: () => `<div class="grid2"><div class="card"><h3>معیارهای تصمیم‌گیری (۱ تا ۵)</h3><div style="display:grid;gap:14px">${G.CRIT.map(([k, l]) => `<label class="field"><span style="display:flex;justify-content:space-between"><span>${l}</span><b data-sv="${k}">${S.scores[k] ? fmtNum(S.scores[k]) : '—'}</b></span><input type="range" min="1" max="5" step="1" data-score="${k}" value="${S.scores[k] || 3}" ${G.canDecide() ? '' : 'disabled'} style="${S.scores[k] ? '' : 'opacity:.45'}"></label>`).join('')}</div></div>
      <div class="card" style="text-align:center"><h3>امتیاز کل</h3><div id="ggauge">${G.gauge(total(S.scores))}</div><div id="grec" style="margin:8px 0 14px">${rec(S.scores)}</div>
        ${G.canDecide() ? '<button class="btn primary" data-act="savescore">ذخیرهٔ امتیازها</button><p class="muted small">امتیازها فقط مبنای تصمیم‌اند؛ تصمیم نهایی شرکت / عدم شرکت را مدیرعامل در تب «گردش‌کار» ثبت می‌کند.</p>' : '<p class="muted small">امتیازها را مدیرعامل و مدیر دفتر فنی ثبت می‌کنند.</p>'}</div></div>`,
    std: () => {
      const bodies = [...new Set(std.map(s => s.body))], rows = std.filter(s => (!S.sbody || s.body === S.sbody) && (!S.sonly || S.std[s.code]) && (!S.sq || (s.code + ' ' + s.title).toLowerCase().includes(S.sq.toLowerCase())));
      const vals = Object.values(S.std), c = k => vals.filter(v => v === k).length, rel = c('required') + c('compliant') + c('gap');
      return `<div class="card" style="margin-bottom:14px"><div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center"><div style="flex:1;min-width:230px"><b>پوشش انطباق</b><div class="progress" style="height:14px;margin:6px 0"><i style="width:${rel ? Math.round(c('compliant') * 100 / rel) : 0}%;background:var(--ok)"></i></div><span class="muted small">${fmtNum(c('compliant'))} منطبق از ${fmtNum(rel)} استاندارد مرتبط</span></div>
        ${G.STD.map(([k, l]) => `<div>${chip(l, G.STD_CLS[k])} <b>${fmtNum(c(k))}</b></div>`).join('')}</div></div>
      <div class="toolbar"><label class="f grow"><span>جستجو (کد یا عنوان)</span><input id="gsq" value="${esc(S.sq)}"></label><label class="f"><span>مرجع</span><select id="gsbody"><option value="">همه</option>${opts(bodies.map(b => [b, b]), S.sbody)}</select></label><label class="check"><input type="checkbox" id="gsonly" ${S.sonly ? 'checked' : ''}> فقط انتخاب‌شده‌ها</label>${ro ? '' : '<button class="btn primary" data-act="savestd">ذخیرهٔ استانداردها</button>'}</div>
      <div class="table-wrap"><table><thead><tr><th>کد</th><th>عنوان</th><th>مرجع</th><th style="width:170px">وضعیت در این مناقصه</th></tr></thead><tbody>${rows.map(s => `<tr><td class="ltr"><b>${esc(s.code)}</b></td><td class="ltr" style="text-align:start">${esc(s.title)}</td><td>${esc(s.body)}</td><td><select data-std="${esc(s.code)}" ${dis}><option value="">— مرتبط نیست —</option>${opts(G.STD, S.std[s.code])}</select></td></tr>`).join('') || `<tr><td colspan="4">${empty('استانداردی پیدا نشد')}</td></tr>`}</tbody></table></div>`;
    },
    risk: () => `<div class="grid2"><div class="card"><h3>ماتریس ریسک</h3>${S.risks.length ? `<div style="display:flex;gap:10px;align-items:center"><span class="muted small" style="writing-mode:vertical-rl">احتمال ↑</span>${G.matrix(S.risks)}</div>` : empty('ریسکی ثبت نشده است')}</div>
      <div class="card"><h3>ثبت ریسک‌ها</h3><div id="gl-risk">${S.risks.map((r, i) => `<div class="card" style="box-shadow:none;padding:10px;margin-bottom:8px"><div class="form-grid" style="grid-template-columns:1fr 1fr"><label class="field full"><span>${fmtNum(i + 1)}. عنوان ریسک</span><input data-r="${i}.title" value="${esc(r.title)}" ${dis}></label>
        <label class="field"><span>احتمال (۱–۵)</span><select data-r="${i}.probability" ${dis}>${opts([1, 2, 3, 4, 5].map(n => [n, fmtNum(n)]), r.probability)}</select></label><label class="field"><span>اثر (۱–۵)</span><select data-r="${i}.impact" ${dis}>${opts([1, 2, 3, 4, 5].map(n => [n, fmtNum(n)]), r.impact)}</select></label>
        <label class="field full"><span>اقدام کنترلی</span><input data-r="${i}.mitigation" value="${esc(r.mitigation || '')}" ${dis}></label></div>${ro ? '' : `<button class="btn sm danger" data-rm="risk:${i}" style="margin-top:6px">حذف</button>`}</div>`).join('')}</div>
        ${ro ? '' : '<button class="btn sm" data-add="risk">+ ریسک</button> <button class="btn sm primary" data-act="saverisk">ذخیره</button>'}</div></div>`,
    comp: () => {
      const ps = S.comps.filter(c => c.est_price != null && c.est_price !== ''), ours = Number(t.est_value) || 0;
      return `<div class="grid2"><div class="card"><h3>مقایسهٔ قیمت تخمینی رقبا</h3>${ps.length ? G.bars([...(ours ? [{ label: 'برآورد ما / کارفرما', value: ours, color: 'var(--primary)', note: '' }] : []), ...ps.map(c => ({ label: c.name, value: Number(c.est_price), color: 'var(--info)', note: '' }))]) : empty('قیمت تخمینی رقبا را وارد کنید تا نمودار نمایش داده شود')}</div>
      <div class="card"><h3>رقبا</h3>${S.comps.map((c, i) => `<div class="card" style="box-shadow:none;padding:10px;margin-bottom:8px"><div class="form-grid" style="grid-template-columns:1fr 1fr"><label class="field"><span>نام رقیب</span><input data-c="${i}.name" value="${esc(c.name)}" ${dis}></label><label class="field"><span>قیمت تخمینی</span><input data-c="${i}.est_price" inputmode="numeric" dir="ltr" value="${c.est_price == null ? '' : esc(c.est_price)}" ${dis}></label>
        <label class="field"><span>نقاط قوت</span><input data-c="${i}.strength" value="${esc(c.strength || '')}" ${dis}></label><label class="field"><span>نقاط ضعف</span><input data-c="${i}.weakness" value="${esc(c.weakness || '')}" ${dis}></label></div>${ro ? '' : `<button class="btn sm danger" data-rm="comp:${i}" style="margin-top:6px">حذف</button>`}</div>`).join('') || empty('رقیبی ثبت نشده است')}
        ${ro ? '' : '<button class="btn sm" data-add="comp">+ رقیب</button> <button class="btn sm primary" data-act="savecomp">ذخیره</button>'}</div></div>`;
    },
    task: () => { const done = S.tasks.filter(x => x.done).length;
      return `<div class="card"><div style="display:flex;gap:12px;align-items:center;margin-bottom:12px"><div class="progress" style="flex:1;height:12px"><i style="width:${S.tasks.length ? Math.round(done * 100 / S.tasks.length) : 0}%;background:var(--ok)"></i></div><span class="muted">${fmtNum(done)} از ${fmtNum(S.tasks.length)}</span></div>
      ${S.tasks.map((x, i) => `<div class="form-grid" style="grid-template-columns:auto 2fr 1fr 1fr auto;align-items:end;margin-bottom:8px"><label class="check" style="padding-bottom:8px"><input type="checkbox" data-k="${i}.done" ${x.done ? 'checked' : ''} ${dis}></label><label class="field"><span>کار</span><input data-k="${i}.title" value="${esc(x.title)}" ${dis}></label><label class="field"><span>مسئول</span><input data-k="${i}.owner" value="${esc(x.owner || '')}" ${dis}></label><label class="field"><span>موعد</span>${dateField('due' + i, x.due, dis)}</label>${ro ? '<span></span>' : `<button class="btn sm danger" data-rm="task:${i}">حذف</button>`}</div>`).join('') || empty('کاری ثبت نشده است')}
      ${ro ? '' : '<button class="btn sm" data-add="task">+ کار</button> <button class="btn sm primary" data-act="savetask">ذخیره</button>'}</div>`; }
  };
  const tabsHtml = () => tabs().map(([k, l]) => `<button class="tab ${S.tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('');
  const draw = () => {
    el.innerHTML = `<div class="crumbs"><a class="link" href="#/g/list">← فهرست مناقصات عمومی</a></div>
      <div class="page-head"><div><h1>${esc(t.title)}</h1><div style="margin-top:4px">${G.stageChip(t.stage)} ${chip(G.cat(t.category), 'brand')}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${ro ? '' : `<label class="f" style="display:grid;font-size:13px;color:var(--muted)">تغییر مرحله<select id="gstg">${opts(G.STAGES, t.stage)}</select></label><button class="btn" data-act="edit">ویرایش</button>`}${can('super_admin', 'ceo') ? '<button class="btn danger" data-act="del">حذف</button>' : ''}</div></div>
      <div class="tabs" id="gtabs"><span style="display:contents">${tabsHtml()}</span></div><div id="gpane">${panes[S.tab]()}</div>`;
    const stg = $('#gstg', el); if (stg) stg.onchange = async e => { try { await API.post(`/general/${id}/stage`, { stage: e.target.value }); App.refresh(); } catch (x) { toast(x.message, 'error'); e.target.value = t.stage; } };
  };
  const redrawPane = () => { $('#gpane', el).innerHTML = panes[S.tab](); $('#gtabs span', el).innerHTML = tabsHtml(); };
  draw();
  const get = (arr, p) => { const [i, f] = p.split('.'); return [arr[+i], f]; };
  el.oninput = e => {
    const x = e.target;
    if (x.dataset.score) { S.scores[x.dataset.score] = +x.value; x.style.opacity = 1; $(`[data-sv=${x.dataset.score}]`, el).textContent = fmtNum(x.value); $('#ggauge', el).innerHTML = G.gauge(total(S.scores)); $('#grec', el).innerHTML = rec(S.scores); }
    if (x.dataset.r) { const [o, f] = get(S.risks, x.dataset.r); o[f] = ['probability', 'impact'].includes(f) ? +x.value : x.value; }
    if (x.dataset.c) { const [o, f] = get(S.comps, x.dataset.c); o[f] = f === 'est_price' ? (toLatin(x.value).replace(/[,٬\s]/g, '') === '' ? '' : Number(toLatin(x.value).replace(/[,٬\s]/g, ''))) : x.value; }
    if (x.dataset.k) { const [o, f] = get(S.tasks, x.dataset.k); o[f] = x.value; }
    if (x.id === 'gsq') { S.sq = x.value; const p = x.selectionStart; redrawPane(); const n = $('#gsq', el); n.focus(); try { n.setSelectionRange(p, p); } catch {} }
  };
  el.onchange = e => {
    const x = e.target;
    if (x.dataset.r && ['probability', 'impact'].includes(x.dataset.r.split('.')[1])) { redrawPane(); return; }
    if (x.dataset.chk) { S.chk[x.dataset.chk] = x.checked; return redrawPane(); }
    if (x.dataset.k && x.type === 'checkbox') { const [o, f] = get(S.tasks, x.dataset.k); o[f] = x.checked; return redrawPane(); }
    if (x.dataset.std) { if (x.value) S.std[x.dataset.std] = x.value; else delete S.std[x.dataset.std]; redrawPane(); const nx = $(`[data-std="${CSS.escape(x.dataset.std)}"]`, el); if (nx) nx.focus(); return; }
    if (x.id === 'gsbody') { S.sbody = x.value; redrawPane(); } if (x.id === 'gsonly') { S.sonly = x.checked; redrawPane(); }
    if (x.classList.contains('jd') && /^due\d+$/.test(x.name)) { const iso = dateVal(x); if (iso === null) { toast('تاریخ معتبر نیست', 'error'); return; } S.tasks[+x.name.slice(3)].due = iso || null; }
    if (x.id === 'gfile' && x.files[0]) doneSave(async () => { await API.upload(`/general/${id}/files`, {}, x.files[0]); App.refresh(); }, 'فایل بارگذاری شد');
  };
  el.onclick = async e => {
    const q = s => e.target.closest(s);
    const tb = q('[data-tab]'); if (tb) { S.tab = tb.dataset.tab; return redrawPane(); }
    const dl = q('[data-dl]'); if (dl) return downloadFile(`/general/${id}/files/${dl.dataset.dl}/download`, dl.dataset.name);
    const df = q('[data-delfile]'); if (df) { if (await confirmBox('این فایل حذف شود؟')) doneSave(async () => { await API.del(`/general/${id}/files/${df.dataset.delfile}`); App.refresh(); }, 'حذف شد'); return; }
    const ad = q('[data-add]'); if (ad) { const k = ad.dataset.add; ({ risk: S.risks, comp: S.comps, task: S.tasks })[k].push(k === 'risk' ? { title: '', probability: 3, impact: 3, mitigation: '' } : k === 'comp' ? { name: '', strength: '', weakness: '', est_price: '' } : { title: '', owner: '', due: null, done: false }); return redrawPane(); }
    const rm = q('[data-rm]'); if (rm) { const [k, i] = rm.dataset.rm.split(':'); ({ risk: S.risks, comp: S.comps, task: S.tasks })[k].splice(+i, 1); return redrawPane(); }
    const cmx = q('[data-cmdel]'); if (cmx) { if (await confirmBox('این کامنت حذف شود؟')) doneSave(async () => { await API.del(`/general/${id}/comments/${cmx.dataset.cmdel}`); App.refresh(); }, 'حذف شد'); return; }
    const chx = q('[data-chdel]'); if (chx) { if (await confirmBox('این اعلان تغییر حذف شود؟')) doneSave(async () => { await API.del(`/general/${id}/changes/${chx.dataset.chdel}`); App.refresh(); }, 'حذف شد'); return; }
    const at = q('[data-asgtoggle]'); if (at) return doneSave(async () => { await API.put(`/general/${id}/assignments/${at.dataset.asgtoggle}`, { status: at.dataset.st }); App.refresh(); });
    const ax = q('[data-asgdel]'); if (ax) { if (await confirmBox('این ارجاع حذف شود؟')) doneSave(async () => { await API.del(`/general/${id}/assignments/${ax.dataset.asgdel}`); App.refresh(); }, 'حذف شد'); return; }
    const a = q('[data-act]'); if (!a) return; const act = a.dataset.act;
    if (act === 'edit') return Modal.open({ title: 'ویرایش مشخصات', wide: true, html: gForm(t), actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ذخیره', cls: 'primary', run: async m => { await API.put('/general/' + id, gRead(m)); toast('ذخیره شد', 'success'); App.refresh(); } }] });
    if (act === 'del') { if (await confirmBox('این مناقصه و همهٔ پیوست‌های آن حذف شود؟')) { await API.del('/general/' + id); toast('حذف شد'); App.go('g/list'); } return; }
    if (act === 'savescore') return doneSave(async () => { await API.put(`/general/${id}/decision`, { scores: S.scores }); });
    if (act === 'techsave' || act === 'techdone') return doneSave(async () => { await API.put(`/general/${id}/tech`, { method: $('#wfMethod', el).value, schedule: $('#wfSchedule', el).value, our_offer: numVal($('[name=wf_offer]', el)), done: act === 'techdone' }); App.refresh(); }, act === 'techdone' ? 'بررسی فنی ثبت شد و به مدیرعامل رفت' : 'ذخیره شد');
    if (act === 'ceo') return Modal.open({ title: 'تصمیم مدیرعامل: شرکت در مناقصه', html: `${t.tech_done ? '' : '<p style="color:var(--warn)">بررسی فنی هنوز ثبت نشده است.</p>'}<div class="form-grid"><label class="field full"><span>آیا در این مناقصه شرکت می‌کنیم؟</span><select name="decision"><option value="yes">بله، شرکت می‌کنیم</option><option value="no">خیر، شرکت نمی‌کنیم</option></select></label>
      <label class="check full" id="gW"><input type="checkbox" name="needs_guarantee" ${t.guarantee_amount ? 'checked' : ''}> نیازمند ضمانت‌نامه شرکت در مناقصه است (ارجاع به مدیر مالی)</label><label class="field" id="gA"><span>مبلغ ضمانت‌نامه</span>${moneyField('guarantee_amount', t.guarantee_amount)}</label><label class="field full"><span>توضیح (اختیاری)</span><textarea name="note"></textarea></label></div>`,
      actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت تصمیم', cls: 'primary', run: async m => { const d = formData(m); await API.post(`/general/${id}/ceo`, { decision: d.decision, needs_guarantee: d.decision === 'yes' && d.needs_guarantee, guarantee_amount: numVal($('[name=guarantee_amount]', m)), note: d.note }); toast('تصمیم ثبت شد', 'success'); App.loadBadges(); App.refresh(); } }],
      onOpen: m => { const u = () => { const y = $('[name=decision]', m).value === 'yes'; $('#gW', m).classList.toggle('hidden', !y); $('#gA', m).classList.toggle('hidden', !(y && $('[name=needs_guarantee]', m).checked)); }; m.addEventListener('change', u); u(); } });
    if (act === 'ceoreset') { if (await confirmBox('تصمیم مدیرعامل بازگردانده شود؟')) doneSave(async () => { await API.post(`/general/${id}/ceo-reset`, {}); App.loadBadges(); App.refresh(); }, 'بازگردانده شد'); return; }
    if (act === 'gdone') return Modal.open({ title: 'دریافت ضمانت‌نامه', html: `<div class="form-grid"><label class="field"><span>مبلغ ضمانت‌نامه</span>${moneyField('amount', t.guarantee_amount)}</label><label class="field full"><span>توضیح (بانک، شماره و …)</span><textarea name="note"></textarea></label><label class="field full"><span>فایل ضمانت‌نامه</span><input type="file" name="gf"></label></div>`,
      actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت دریافت', cls: 'ok', run: async m => { const f = $('[name=gf]', m).files[0]; if (f) await API.upload(`/general/${id}/files`, { kind: 'guarantee' }, f); await API.post(`/general/${id}/guarantee`, { amount: numVal($('[name=amount]', m)), note: $('[name=note]', m).value }); toast('ثبت شد', 'success'); App.loadBadges(); App.refresh(); } }] });
    if (act === 'asg') return Modal.open({ title: 'ارجاع تهیهٔ مدرک', wide: true, html: `<div class="form-grid"><label class="field full"><span class="req">نفر (از فهرست انتخاب کنید یا نام را تایپ کنید)</span><input name="assignee_name" list="gdir" autocomplete="off"><datalist id="gdir">${dir.map(u => `<option value="${esc(u.full_name)}">${esc((u.position ? u.position + ' · ' : '') + (u.personnel_no || ''))}</option>`).join('')}</datalist></label>
      <label class="field"><span>مدرک</span><select name="doc_key"><option value="">— سایر —</option>${opts(G.BIDDOCS, '')}</select></label><label class="field"><span>مهلت</span>${dateField('due_date', '')}</label><label class="field full"><span>شرح کار</span><textarea name="task"></textarea></label></div>`,
      actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت ارجاع', cls: 'primary', run: async m => { const d = formData(m), dd = dateVal($('[name=due_date]', m)); if (!d.assignee_name.trim()) throw new Error('نام فرد را وارد کنید'); if (dd === null) throw new Error('تاریخ معتبر نیست'); await API.post(`/general/${id}/assignments`, { assignee_name: d.assignee_name.trim(), doc_key: d.doc_key, task: d.task, due_date: dd }); toast('ارجاع ثبت شد', 'success'); App.refresh(); } }] });
    if (act === 'savechk') return doneSave(async () => { await API.put(`/general/${id}/checklist`, { checklist: S.chk }); });
    if (act === 'saveriskopp') return doneSave(async () => { await API.put(`/general/${id}/riskopp`, { risk_text: $('#wfRisk', el).value, opportunity_text: $('#wfOpp', el).value }); });
    if (act === 'cmadd') { const v = $('#gcmBody', el).value.trim(); if (!v) return toast('متن کامنت را بنویسید', 'error'); return doneSave(async () => { await API.post(`/general/${id}/comments`, { body: v }); App.refresh(); }, 'کامنت ثبت شد'); }
    if (act === 'chadd') return Modal.open({ title: 'ثبت اعلان تغییر', wide: true, html: `<p class="muted small">تغییر برای همهٔ دست‌اندرکاران نمایش داده می‌شود.</p><div class="form-grid"><label class="field full"><span class="req">عنوان تغییر</span><input name="title"></label>
      <label class="field"><span>مورد تغییرکرده (اختیاری)</span><select name="field"><option value="">— فقط توضیح —</option>${opts([['guarantee_amount', 'مبلغ ضمانت‌نامه'], ['base_amount', 'مبلغ پایه'], ['deadline', 'مهلت ارسال پیشنهاد'], ['our_offer', 'مبلغ پیشنهادی ما']], '')}</select></label>
      <label class="field" id="cN"><span>مقدار جدید</span>${moneyField('new_num', '')}</label><label class="field hidden" id="cD"><span>تاریخ جدید</span>${dateField('new_date', '')}</label><label class="check full" id="cA"><input type="checkbox" name="apply" checked> روی مشخصات مناقصه هم اعمال شود</label>
      <label class="field full"><span>توضیحات</span><textarea name="body"></textarea></label><label class="field full"><span>مدارک پیوست</span><input type="file" name="fs" multiple></label></div>`,
      actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت و اعلام', cls: 'primary', run: async m => { const d = formData(m); if (!d.title.trim()) throw new Error('عنوان تغییر را بنویسید'); let nv = ''; if (d.field) { nv = d.field === 'deadline' ? dateVal($('[name=new_date]', m)) : numVal($('[name=new_num]', m)); if (nv === '' || nv === null) throw new Error('مقدار جدید را درست وارد کنید'); }
        const r = await API.post(`/general/${id}/changes`, { title: d.title, body: d.body, field: d.field, new_value: nv, apply: !!d.apply }); for (const f of $('[name=fs]', m).files) { try { await API.upload(`/general/${id}/files`, { kind: 'change', change_id: r.id }, f); } catch (ex) { toast(f.name + ': ' + ex.message, 'error'); } } toast('اعلان تغییر ثبت شد', 'success'); S.tab = 'ch'; App.refresh(); } }],
      onOpen: m => { const u = () => { const f = $('[name=field]', m).value; $('#cN', m).classList.toggle('hidden', !f || f === 'deadline'); $('#cD', m).classList.toggle('hidden', f !== 'deadline'); $('#cA', m).classList.toggle('hidden', !f); }; m.addEventListener('change', u); u(); } });
    if (act === 'savestd') return doneSave(async () => { await API.put(`/general/${id}/standards`, { standards: S.std }); });
    if (act === 'saverisk') return doneSave(async () => { await API.put(`/general/${id}/risks`, { items: S.risks }); });
    if (act === 'savecomp') return doneSave(async () => { await API.put(`/general/${id}/competitors`, { items: S.comps }); });
    if (act === 'savetask') return doneSave(async () => { await API.put(`/general/${id}/tasks`, { items: S.tasks }); });
  };
}

/* ───────── کاتالوگ استانداردها ───────── */
App.register({ id: 'g/standards', title: 'استانداردها', not: ['staff'], async render(el) {
  const list = await API.get('/general/standards'), bodies = [...new Set(list.map(s => s.body))], st = { q: '', body: '' };
  el.innerHTML = `<div class="page-head"><div class="muted">فهرست مرجع استانداردهای رایج صنعت نفت و گاز. در هر مناقصه می‌توانید وضعیت انطباق را مشخص کنید. ویرایش جاری هر استاندارد را از منبع رسمی بررسی کنید.</div>${G.canDecide() ? '<button class="btn primary" data-act="add">+ استاندارد جدید</button>' : ''}</div>
    <div class="cards">${bodies.map((b, i) => `<div class="card kpi" style="cursor:pointer" data-body="${esc(b)}"><div class="lbl">${esc(b)}</div><div class="val">${fmtNum(list.filter(s => s.body === b).length)}</div></div>`).join('')}</div>
    <div class="toolbar"><label class="f grow"><span>جستجو (کد، عنوان، موضوع)</span><input id="stq"></label><label class="f"><span>مرجع</span><select id="stbody"><option value="">همه</option>${opts(bodies.map(b => [b, b]), '')}</select></label></div>
    <div class="table-wrap"><table><thead><tr><th>کد</th><th>عنوان</th><th>مرجع</th><th>موضوع</th>${G.canDecide() ? '<th></th>' : ''}</tr></thead><tbody id="stbody2"></tbody></table></div><p class="muted small" id="stcount" style="margin-top:8px"></p>`;
  const paint = () => {
    const q = st.q.toLowerCase(), rows = list.filter(s => (!st.body || s.body === st.body) && (!q || [s.code, s.title, s.topic, s.note].join(' ').toLowerCase().includes(q)));
    $('#stbody2', el).innerHTML = rows.map(s => `<tr><td class="ltr"><b>${esc(s.code)}</b></td><td class="ltr" style="text-align:start">${esc(s.title)}${s.note ? `<div class="muted small">${esc(s.note)}</div>` : ''}</td><td>${chip(s.body, 'brand')}</td><td>${esc(s.topic)}</td>${G.canDecide() ? `<td class="acts"><button class="btn sm danger" data-del="${s.id}">حذف</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="5">${empty('استانداردی پیدا نشد')}</td></tr>`;
    $('#stcount', el).textContent = fmtNum(rows.length) + ' استاندارد';
  };
  paint();
  $('#stq', el).addEventListener('input', debounce(e => { st.q = e.target.value; paint(); }, 150));
  $('#stbody', el).addEventListener('change', e => { st.body = e.target.value; paint(); });
  el.onclick = async e => {
    const b = e.target.closest('[data-body]'); if (b) { st.body = st.body === b.dataset.body ? '' : b.dataset.body; $('#stbody', el).value = st.body; return paint(); }
    const d = e.target.closest('[data-del]'); if (d) { if (await confirmBox('این استاندارد از فهرست حذف شود؟')) { await API.del('/general/standards/' + d.dataset.del); App.refresh(); } return; }
    if (e.target.closest('[data-act=add]')) Modal.open({ title: 'استاندارد جدید', html: `<div class="form-grid"><label class="field"><span class="req">کد</span><input name="code" dir="ltr" placeholder="API 6D"></label><label class="field"><span>مرجع</span><input name="body" placeholder="API" dir="ltr"></label><label class="field full"><span class="req">عنوان</span><input name="title" dir="ltr"></label><label class="field"><span>موضوع</span><input name="topic" placeholder="pipeline" dir="ltr"></label><label class="field"><span>یادداشت</span><input name="note"></label></div>`,
      actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت', cls: 'primary', run: async m => { const d = formData(m); if (!d.code.trim() || !d.title.trim()) throw new Error('کد و عنوان الزامی است'); await API.post('/general/standards', d); toast('ثبت شد', 'success'); App.refresh(); } }] });
  };
} });

/* ───────── کارتابل گردش‌کار مناقصات عمومی ───────── */
const gc = { q: '', mode: 'action' };
App.register({ id: 'g/cartable', title: 'کارتابل نفت و گاز', not: ['staff'], async render(el) {
  const all = await API.get('/general/cartable');
  const act = all.filter(x => !x.wait), q = gc.q.trim().toLowerCase();
  let rows = gc.mode === 'action' ? act : all;
  if (q) rows = rows.filter(x => [x.title, x.tender_number, x.client_name].join(' ').toLowerCase().includes(q));
  App.badge('g/cartable', act.length);
  const flagChips = f => [f.includes('new') ? chip('جدید', 'info') : '', f.includes('changed') ? chip('اعلان تغییر', 'warn') : '', f.includes('due_soon') ? chip('مهلت نزدیک', 'bad') : '', f.includes('overdue') ? chip('مهلت گذشته', 'bad') : ''].join(' ');
  el.innerHTML = `<div class="page-head"><div class="muted">کارهایی که نوبت شماست در این فهرست می‌آید و پس از انجام، از فهرست (و از عددِ قرمز کنار منو) کم می‌شود. گردش‌کار: ثبت مناقصه ← بررسی فنی ← تصمیم مدیرعامل ← ضمانت‌نامه (در صورت نیاز) ← تهیهٔ مدارک ← ارسال.</div></div>
    <div class="cards">${kpi('نیازمند اقدام من', fmtNum(act.length), act.length ? 'bad' : '')}${kpi('در جریان / در انتظار', fmtNum(all.length - act.length), 'info')}</div>
    <div class="toolbar"><label class="f"><span>نمایش</span><select id="gcm">${opts([['action', 'فقط نیازمند اقدام من'], ['all', 'همه مناقصه‌های جاری من']], gc.mode)}</select></label><label class="f grow"><span>جستجو</span><input id="gcq" value="${esc(gc.q)}"></label></div>
    <div class="table-wrap"><table><thead><tr><th>عنوان مناقصه</th><th>کارفرما</th><th>اقدام لازم</th><th>تاریخ دریافت</th><th>مهلت ارسال</th><th>مبلغ پایه</th><th>مبلغ ضمانت‌نامه</th><th>اعلان‌ها</th></tr></thead><tbody>
    ${rows.map(x => `<tr class="click" data-go="${x.id}"><td class="cell-name">${x.wait ? '' : '<span class="dot-red" title="نیازمند اقدام"></span> '}<b>${esc(x.title)}</b><br><small class="muted">${esc(x.tender_number || '')}${x.comments_count ? ' · 💬 ' + fmtNum(x.comments_count) : ''}${x.open_tasks ? ' · ' + fmtNum(x.open_tasks) + ' کار باز' : ''}</small></td><td>${esc(x.client_name || '—')}</td>
      <td>${chip(G.GCODE[x.code] || x.code, x.wait ? '' : 'warn')}${x.task ? `<div class="small muted">${esc(x.task)}</div>` : ''}</td><td class="num">${x.received_date ? fmtDate(x.received_date) : '—'}</td><td class="num">${x.deadline ? fmtDate(x.deadline) : '—'}</td>
      <td class="num">${x.base_amount ? G.money(x.base_amount, x.currency) : '—'}</td><td class="num">${x.needs_guarantee || x.guarantee_amount ? G.money(x.guarantee_amount, x.currency) : '—'}</td><td>${flagChips(x.flags)}</td></tr>`).join('') || `<tr><td colspan="8">${empty(gc.mode === 'action' ? 'کار جدیدی در کارتابل شما نیست 🎉' : 'مناقصه‌ای نیست')}</td></tr>`}</tbody></table></div>`;
  $('#gcm', el).onchange = e => { gc.mode = e.target.value; App.refresh(); };
  $('#gcq', el).oninput = debounce(e => { gc.q = e.target.value; App.refresh(); }, 300);
  el.onclick = e => { const r = e.target.closest('[data-go]'); if (r) App.go('g/list/' + r.dataset.go); };
} });
