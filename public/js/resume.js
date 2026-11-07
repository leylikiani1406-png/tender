/* رزومه‌ساز: هر رزومه دو نسخهٔ فارسی/انگلیسی، چهار قالب، تم رنگی (پیش‌فرض قرمز و سفید با لوگوی کوشا معدن)، ترجمهٔ خودکار و خروجی PDF (چاپ) */
'use strict';
const R_LABELS = {
  fa: { summary: 'دربارهٔ من', experience: 'سوابق کاری', education: 'سوابق تحصیلی', projects: 'پروژه‌ها', certificates: 'گواهینامه‌ها و دوره‌ها', skills: 'مهارت‌ها', languages: 'زبان‌ها', contact: 'اطلاعات تماس', present: 'تاکنون', years: 'سال سابقه',
    col: { no: 'ردیف', level: 'مقطع تحصیلی', field: 'رشته / گرایش', school: 'دانشگاه / مؤسسه', from: 'سال شروع', to: 'سال پایان', gpa: 'معدل', role: 'سمت', company: 'شرکت / سازمان', note: 'شرح', name: 'عنوان پروژه', client: 'کارفرما', year: 'سال', prole: 'نقش', issuer: 'صادرکننده', cert: 'عنوان گواهی / دوره', lang: 'زبان', lvl: 'سطح', phone: 'تلفن', email: 'ایمیل', website: 'وب‌سایت', address: 'نشانی' } },
  en: { summary: 'Profile', experience: 'Work Experience', education: 'Education', projects: 'Projects', certificates: 'Certificates & Courses', skills: 'Skills', languages: 'Languages', contact: 'Contact', present: 'Present', years: 'years of experience',
    col: { no: '#', level: 'Degree Level', field: 'Field of Study', school: 'University / Institution', from: 'Start', to: 'End', gpa: 'GPA', role: 'Position', company: 'Company', note: 'Description', name: 'Project', client: 'Client', year: 'Year', prole: 'Role', issuer: 'Issuer', cert: 'Certificate / Course', lang: 'Language', lvl: 'Level', phone: 'Phone', email: 'Email', website: 'Website', address: 'Address' } }
};
const R_TEMPLATES = { table: 'رسمی جدولی (پیشنهادی)', classic: 'کلاسیک', modern: 'مدرن (دو ستونه)', compact: 'فشرده', timeline: 'خط زمانی' };
const R_THEMES = { red: ['قرمز و سفید (پیش‌فرض)', '#b3202a', '#7d1219'], navy: ['سرمه‌ای', '#1f3a68', '#12264a'], green: ['سبز معدنی', '#2f7a58', '#1b5239'], gold: ['طلایی', '#b0842a', '#7a5a16'], gray: ['خاکستری', '#4a5568', '#2d3748'] };
const R_LISTS = {
  experience: { fields: [['role', 'سمت / عنوان'], ['company', 'شرکت / سازمان'], ['from', 'از (سال)'], ['to', 'تا (سال) — خالی = تاکنون'], ['note', 'شرح فعالیت']], title: 'سوابق کاری', blank: { role: '', company: '', from: '', to: '', note: '' } },
  education: { fields: [['level', 'مقطع (دوره تحصیل)'], ['field', 'رشته / گرایش'], ['school', 'نام دانشگاه / مؤسسه'], ['from', 'سال شروع'], ['to', 'سال پایان'], ['gpa', 'معدل'], ['note', 'توضیح (اختیاری)']], title: 'سوابق تحصیلی', blank: { level: '', field: '', school: '', from: '', to: '', gpa: '', note: '' } },
  projects: { fields: [['name', 'عنوان پروژه'], ['client', 'کارفرما'], ['year', 'سال'], ['role', 'سمت / نقش'], ['note', 'شرح']], title: 'پروژه‌ها', blank: { name: '', client: '', year: '', role: '', note: '' } },
  certificates: { fields: [['name', 'عنوان گواهی / دوره'], ['issuer', 'صادرکننده'], ['year', 'سال']], title: 'گواهینامه‌ها و دوره‌ها', blank: { name: '', issuer: '', year: '' } }
};
const R_TEXT_KEYS = { experience: ['role', 'company', 'note'], education: ['level', 'field', 'school', 'note'], projects: ['name', 'client', 'role', 'note'], certificates: ['name', 'issuer'] };
const R_CSS = `
.rpage{--rp:#b3202a;--ra:#7d1219;--rpaper:#fff;--rink:#1d2433;width:794px;min-height:1123px;background:var(--rpaper);color:var(--rink);font-family:'KM Body','B Nazanin','Vazirmatn',Tahoma,sans-serif;font-size:14.5px;line-height:1.7;box-sizing:border-box}
.rpage.s-s{font-size:13px}.rpage.s-l{font-size:16px}.rpage *{box-sizing:border-box}.rpage h1,.rpage h2,.rpage h3{font-family:'KM Title','B Titr','KM Body',Tahoma,sans-serif;margin:0;font-weight:700}
.rpage .muted{opacity:.72}.rpage img.lg{height:54px;width:auto;display:block}
.rpage .item{break-inside:avoid;page-break-inside:avoid;margin:0 0 11px}.rpage .item .t{font-weight:700}.rpage .item .m{opacity:.75;font-size:.92em}.rpage .item p{margin:2px 0 0;white-space:pre-line}
.rpage .tags{display:flex;flex-wrap:wrap;gap:6px}.rpage .tag{padding:1px 11px;border-radius:99px;border:1px solid var(--rp);color:var(--ra);font-size:.92em}
.rpage .sec{margin:0 0 16px}.rpage .sec>h2{font-size:1.12em;color:var(--rp);border-bottom:1.6px solid var(--ra);padding-bottom:2px;margin-bottom:9px}
.rpage .contact{display:flex;flex-wrap:wrap;gap:6px 22px;font-size:.93em}.rpage .contact span{direction:ltr;unicode-bidi:embed}
.t-classic .hd{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:34px 44px 18px;border-bottom:5px solid var(--rp)}.t-classic .hd h1{font-size:2em;color:var(--rp);line-height:1.35}.t-classic .hd .job{font-size:1.1em;opacity:.8}
.t-classic .ct{padding:9px 44px;background:color-mix(in srgb,var(--rp) 9%,var(--rpaper))}.t-classic .bd{padding:20px 44px 36px}
.t-modern{display:grid;grid-template-columns:262px 1fr}.t-modern .sd{background:var(--rp);color:#fff;padding:34px 24px}.t-modern .sd .sec>h2{color:#fff;border-color:rgba(255,255,255,.55)}.t-modern .sd .tag{border-color:#fff;color:#fff}.t-modern .sd .lgbox{background:#fff;border-radius:8px;padding:8px 10px;margin-bottom:22px}
.t-modern .sd .contact{flex-direction:column;gap:5px}.t-modern .mn{padding:36px 34px}.t-modern .mn h1{font-size:2.05em;color:var(--rp);line-height:1.35}.t-modern .mn .job{font-size:1.1em;opacity:.8;margin-bottom:18px}
.t-compact{font-size:13px}.t-compact .hd{display:flex;justify-content:space-between;align-items:center;padding:26px 36px 12px;border-bottom:3px solid var(--rp)}.t-compact .hd h1{font-size:1.7em;color:var(--rp)}.t-compact .ct{padding:7px 36px;border-bottom:1px solid #ddd}.t-compact .bd{padding:14px 36px 28px;columns:1}.t-compact .sec{margin-bottom:11px}.t-compact .item{margin-bottom:7px}
.t-timeline .hd{display:flex;justify-content:space-between;align-items:center;padding:34px 44px 14px}.t-timeline .hd h1{font-size:2em;color:var(--rp)}.t-timeline .bar{height:7px;background:linear-gradient(90deg,var(--rp),var(--ra))}.t-timeline .ct{padding:10px 44px}.t-timeline .bd{padding:14px 44px 36px}
.t-timeline .tl .item{position:relative;padding-inline-start:22px;border-inline-start:2px solid var(--rp);margin-bottom:0;padding-bottom:12px}.t-timeline .tl .item::before{content:'';position:absolute;inset-inline-start:-7px;top:7px;width:12px;height:12px;border-radius:50%;background:var(--rp);border:2px solid var(--rpaper)}
.rpage{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.t-table .hd{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:30px 40px 22px;background:linear-gradient(120deg,var(--rp),var(--ra));color:#fff}
.t-table .hd h1{font-size:2em;line-height:1.35;color:#fff}.t-table .hd .job{font-size:1.1em;opacity:.93}.rpage.t-table .hd .muted{opacity:1;color:rgba(255,255,255,.92)}.t-table .lgbox{background:#fff;border-radius:10px;padding:8px 12px;flex:none}
.t-table .ct{display:grid;grid-template-columns:1fr 1fr;gap:6px 28px;padding:12px 40px;background:color-mix(in srgb,var(--rp) 8%,var(--rpaper));border-bottom:2px solid var(--rp);font-size:.92em}
.t-table .kv{display:flex;gap:8px;align-items:baseline}.t-table .kv b{color:var(--ra);min-width:60px;font-weight:700}.t-table .kv span{unicode-bidi:plaintext}
.t-table .bd{padding:18px 40px 34px}.t-table .sec>h2{display:flex;align-items:center;gap:8px;border:0;color:var(--ra);font-size:1.15em;margin-bottom:7px;padding:0}
.t-table .sec>h2::before{content:'';width:6px;height:1.05em;background:var(--rp);border-radius:2px;flex:none}
.rtab{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.92em}.rtab th{background:var(--rp);color:#fff;font-weight:700;padding:6px 6px;text-align:start;border:1px solid var(--rp);overflow-wrap:anywhere;line-height:1.5}.rtab th.c{text-align:center}
.rtab td{padding:6px 8px;border:1px solid color-mix(in srgb,var(--rp) 28%,#cfd4dc);vertical-align:top;overflow-wrap:anywhere;white-space:pre-line}.rtab tr:nth-child(even) td{background:color-mix(in srgb,var(--rp) 5%,var(--rpaper))}
.rtab tr{break-inside:avoid;page-break-inside:avoid}.rtab .c{text-align:center}.rtab td b{font-weight:700}
@media print{.rpage{zoom:1!important;box-shadow:none!important}}`;
function injectRCss() { if (!$('#rcss')) { const s = document.createElement('style'); s.id = 'rcss'; s.textContent = R_CSS; document.head.appendChild(s); } }

function resumeHtml(d, o) {
  const lang = o.lang === 'en' ? 'en' : 'fa', L = R_LABELS[lang], x = (d && d[lang]) || {}, th = o.theme || {}, fa = lang === 'fa';
  const num = v => fa ? toFaNum(String(v ?? '')) : toLatin(String(v ?? ''));
  const range = (a, b) => { a = a ? num(a) : ''; b = b ? num(b) : (a ? L.present : ''); return a || b ? `${a}${a && b ? ' – ' : ''}${b}` : ''; };
  const logo = th.logo !== false ? `<img class="lg" src="${location.origin}/images/logo.png" alt="">` : '';
  const items = (key, f) => (x[key] || []).filter(i => i && Object.values(i).some(v => String(v).trim())).map(f).join('');
  const sec = (key, body, cls = '') => body ? `<div class="sec ${cls}"><h2>${L[key]}</h2>${body}</div>` : '';
  const exp = sec('experience', items('experience', i => `<div class="item"><div class="t">${esc(i.role)}${i.company ? ` — ${esc(i.company)}` : ''}</div><div class="m">${esc(range(i.from, i.to))}</div>${i.note ? `<p>${esc(i.note)}</p>` : ''}</div>`), 'tl');
  const eduT = i => [i.level, i.field].filter(Boolean).join(' — ') || i.degree || '';
  const edu = sec('education', items('education', i => `<div class="item"><div class="t">${esc(eduT(i))}</div><div class="m">${esc(i.school)}${i.school && (i.from || i.to) ? ' · ' : ''}${esc(range(i.from, i.to))}${i.gpa ? ` · ${L.col.gpa}: ${esc(num(i.gpa))}` : ''}</div>${i.note ? `<p>${esc(i.note)}</p>` : ''}</div>`), 'tl');
  const prj = sec('projects', items('projects', i => `<div class="item"><div class="t">${esc(i.name)}</div><div class="m">${esc(i.client)}${i.client && i.year ? ' · ' : ''}${esc(num(i.year))}${i.role ? ` · ${esc(i.role)}` : ''}</div>${i.note ? `<p>${esc(i.note)}</p>` : ''}</div>`));
  const crt = sec('certificates', items('certificates', i => `<div class="item"><div class="t">${esc(i.name)}</div><div class="m">${esc(i.issuer)}${i.issuer && i.year ? ' · ' : ''}${esc(num(i.year))}</div></div>`));
  const tags = a => (a || []).filter(s => String(s).trim()).map(s => `<span class="tag">${esc(typeof s === 'string' ? s : Object.values(s)[0])}</span>`).join('');
  const skills = sec('skills', tags(x.skills) ? `<div class="tags">${tags(x.skills)}</div>` : ''), langs = sec('languages', tags(x.languages) ? `<div class="tags">${tags(x.languages)}</div>` : '');
  const sum = x.summary ? sec('summary', `<p style="margin:0;white-space:pre-line">${esc(x.summary)}</p>`) : '';
  const yrs = x.years ? `<div class="muted" style="margin-top:2px">${esc(num(x.years))} ${L.years}</div>` : '';
  const contact = [x.phone && `<span>${esc(x.phone)}</span>`, x.email && `<span>${esc(x.email)}</span>`, x.website && `<span>${esc(x.website)}</span>`, x.address && `<b style="font-weight:400;direction:${fa ? 'rtl' : 'ltr'}">${esc(x.address)}</b>`].filter(Boolean).join('');
  const style = `--rp:${th.primary || '#b3202a'};--ra:${th.accent || '#7d1219'};--rpaper:${th.paper || '#fff'};--rink:${th.ink || '#1d2433'}`;
  const cls = `rpage t-${o.template || 'table'} s-${th.size || 'm'}`, dir = fa ? 'rtl' : 'ltr';
  const head = `<div><h1>${esc(x.name)}</h1><div class="job">${esc(x.title)}</div>${yrs}</div>`;
  // قالب جدولی: هر بخش یک جدول با ستون‌های مرتب؛ هر ردیف اکسل یک سطر. ستونی که در هیچ سطری مقدار ندارد نمایش داده نمی‌شود.
  const tbl = (key, spec) => {
    const arr = (x[key] || []).filter(i => i && Object.values(i).some(v => String(v).trim())); if (!arr.length) return '';
    const cell = (c, i) => { const v = c.get ? c.get(i) : i[c.k]; return String(v ?? '').trim() ? (c.num ? num(v) : v) : ''; };
    const cols = spec.filter(c => c.always || arr.some(i => cell(c, i))), tw = cols.reduce((a, c) => a + c.w, 0);
    return `<table class="rtab"><thead><tr><th class="c" style="width:6%">${L.col.no}</th>${cols.map(c => `<th class="${c.c ? 'c' : ''}" style="width:${(94 * c.w / tw).toFixed(1)}%">${L.col[c.lab || c.k]}</th>`).join('')}</tr></thead>
      <tbody>${arr.map((i, n) => `<tr><td class="c">${num(n + 1)}</td>${cols.map(c => `<td class="${c.c ? 'c' : ''}">${esc(cell(c, i)) || '—'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  };
  const tEdu = tbl('education', [{ k: 'level', w: 16, always: 1 }, { k: 'field', w: 20, always: 1 }, { k: 'school', w: 24, always: 1 }, { k: 'from', w: 10, c: 1, num: 1 }, { k: 'to', w: 10, c: 1, num: 1 }, { k: 'gpa', w: 9, c: 1, num: 1 }, { k: 'note', w: 22 }]);
  const tExp = tbl('experience', [{ k: 'role', w: 22, always: 1 }, { k: 'company', w: 22, always: 1 }, { k: 'from', w: 12, c: 1, num: 1 }, { k: 'to', w: 12, c: 1, get: i => i.to ? num(i.to) : (i.from ? L.present : '') }, { k: 'note', w: 32 }]);
  const tPrj = tbl('projects', [{ k: 'name', w: 28, always: 1 }, { k: 'client', w: 20 }, { k: 'year', w: 9, c: 1, num: 1 }, { k: 'role', lab: 'prole', w: 14 }, { k: 'note', w: 29 }]);
  const tCrt = tbl('certificates', [{ k: 'name', lab: 'cert', w: 40, always: 1 }, { k: 'issuer', w: 30 }, { k: 'year', w: 12, c: 1, num: 1 }]);
  const langRows = (x.languages || []).map(s => String(typeof s === 'string' ? s : Object.values(s)[0] || '').trim()).filter(Boolean).map(s => { const m = /^(.+?)\s*(?:—|–|-|:|،|\|)\s*(.+)$/.exec(s); return m ? [m[1].trim(), m[2].trim()] : [s, '']; });
  const tLang = langRows.length ? `<table class="rtab"><thead><tr><th class="c" style="width:6%">${L.col.no}</th><th style="width:47%">${L.col.lang}</th><th style="width:47%">${L.col.lvl}</th></tr></thead><tbody>${langRows.map((r, n) => `<tr><td class="c">${num(n + 1)}</td><td>${esc(r[0])}</td><td>${esc(r[1]) || '—'}</td></tr>`).join('')}</tbody></table>` : '';
  const dir0 = fa ? 'rtl' : 'ltr';
  const kv = (lab, v) => v ? `<div class="kv"><b>${lab}</b><span dir="${/[\u0600-\u06FF]/.test(v) ? dir0 : 'ltr'}">${esc(v)}</span></div>` : '';
  let inner;
  if (o.template === 'table') inner = `<div class="hd">${head}${logo ? `<div class="lgbox">${logo}</div>` : ''}</div><div class="ct">${kv(L.col.phone, x.phone)}${kv(L.col.email, x.email)}${kv(L.col.website, x.website)}${kv(L.col.address, x.address)}</div>
    <div class="bd">${sum}${sec('education', tEdu)}${sec('experience', tExp)}${sec('projects', tPrj)}${sec('certificates', tCrt)}${skills}${sec('languages', tLang)}</div>`;
  else if (o.template === 'modern') inner = `<div class="sd">${logo ? `<div class="lgbox">${logo}</div>` : ''}${contact ? `<div class="sec"><h2>${L.contact}</h2><div class="contact">${contact}</div></div>` : ''}${skills}${langs}${crt}</div><div class="mn">${head.replace('class="job"', 'class="job"')}${sum}${exp}${edu}${prj}</div>`;
  else if (o.template === 'compact') inner = `<div class="hd">${head}${logo}</div><div class="ct"><div class="contact">${contact}</div></div><div class="bd">${sum}${exp}${edu}${prj}${skills}${langs}${crt}</div>`;
  else if (o.template === 'timeline') inner = `<div class="bar"></div><div class="hd">${head}${logo}</div><div class="ct"><div class="contact">${contact}</div></div><div class="bd">${sum}${exp}${edu}${prj}${skills}${langs}${crt}</div>`;
  else inner = `<div class="hd">${head}${logo}</div><div class="ct"><div class="contact">${contact}</div></div><div class="bd">${sum}${exp}${edu}${prj}${skills}${langs}${crt}</div>`;
  return `<div class="${cls}" dir="${dir}" lang="${lang}" style="${style}">${inner}</div>`;
}
function printResume(html, lang) {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  const d = f.contentDocument; d.open();
  d.write(`<!doctype html><html lang="${lang}" dir="${lang === 'fa' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>Resume</title><style>@page{size:A4;margin:0}html,body{margin:0;padding:0}${R_CSS}</style></head><body>${html}</body></html>`); d.close();
  f.onload = () => setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { toast('چاپ ممکن نشد؛ از مرورگر خود گزینهٔ Print را بزنید', 'error'); } setTimeout(() => f.remove(), 60000); }, 500);
}

/* ───── فهرست رزومه‌ها ───── */
const blankData = () => ({ fa: { name: '', title: '', summary: '', email: '', phone: '', address: '', website: '', years: '', experience: [], education: [], projects: [], certificates: [], skills: [], languages: [] }, en: { name: '', title: '', summary: '', email: '', phone: '', address: '', website: '', years: '', experience: [], education: [], projects: [], certificates: [], skills: [], languages: [] } });
App.register({ id: 'resume', title: 'رزومه‌ساز', not: ['staff'], async render(el, arg) {
  injectRCss();
  if (arg) return editor(el, +arg);
  const q = App.query.q || '', list = await API.get('/resumes', { q });
  el.innerHTML = `<div class="page-head"><div class="muted">برای هر فرد رزومهٔ فارسی و انگلیسی بسازید، قالب و رنگ را انتخاب کنید و خروجی PDF بگیرید.</div><button class="btn primary" data-act="new">+ رزومهٔ جدید</button></div>
    <div class="toolbar"><label class="f grow"><span>جستجو (نام فرد یا عنوان رزومه)</span><input id="rq" value="${esc(q)}"></label></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px">${list.map(r => `<div class="card" data-open="${r.id}" style="cursor:pointer"><div style="display:flex;justify-content:space-between;gap:8px"><h3 style="margin:0">${esc(r.name_fa || r.name_en || r.title)}</h3>${chip(r.lang === 'en' ? 'English' : 'فارسی', 'brand')}</div>
      <div class="muted">${esc(r.job_fa || '')}</div><div class="muted small" style="margin-top:4px">${esc(r.title)} · ${esc(R_TEMPLATES[r.template] || '')}</div><div class="muted small">ویرایش: ${fmtDate(r.updated_at)}${r.owner_name ? ' · ' + esc(r.owner_name) : ''}</div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn sm primary" data-open="${r.id}">${r.can_edit ? 'ویرایش' : 'مشاهده'}</button><button class="btn sm" data-dup="${r.id}">کپی</button>${r.attach_name ? `<button class="btn sm" data-att="${r.id}" data-name="${esc(r.attach_name)}">📎 فایل</button>` : ''}${r.can_edit ? `<button class="btn sm danger" data-del="${r.id}">حذف</button>` : ''}</div></div>`).join('') || `<div class="card" style="grid-column:1/-1">${empty('رزومه‌ای ثبت نشده است')}</div>`}</div>`;
  $('#rq', el).oninput = debounce(e => { App.query.q = e.target.value; const u = '#/resume' + (e.target.value ? '?q=' + encodeURIComponent(e.target.value) : ''); history.replaceState(null, '', u); App.route(); }, 350);
  el.onclick = async e => {
    const q = s => e.target.closest(s);
    const dl = q('[data-att]'); if (dl) { e.stopPropagation(); return downloadFile(`/resumes/${dl.dataset.att}/attach`, dl.dataset.name); }
    const dp = q('[data-dup]'); if (dp) { e.stopPropagation(); const r = await API.post(`/resumes/${dp.dataset.dup}/duplicate`); return App.go('resume/' + r.id); }
    const dd = q('[data-del]'); if (dd) { e.stopPropagation(); if (await confirmBox('این رزومه حذف شود؟')) { await API.del('/resumes/' + dd.dataset.del); App.refresh(); } return; }
    const op = q('[data-open]'); if (op) return App.go('resume/' + op.dataset.open);
    if (q('[data-act=new]')) Modal.open({ title: 'رزومهٔ جدید', html: `<div class="form-grid"><label class="field full"><span class="req">نام رزومه (برای تشخیص خودتان)</span><input name="title" placeholder="مثلاً رزومهٔ مهندس رضایی — اکتشاف"></label>
      <label class="field"><span>زبان خروجی</span><select name="lang"><option value="fa">فارسی</option><option value="en">English</option></select></label><label class="field"><span>قالب</span><select name="template">${opts(Object.entries(R_TEMPLATES), 'table')}</select></label></div>`,
      actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ساخت', cls: 'primary', run: async m => { const d = formData(m); const r = await API.post('/resumes', { ...d, theme: { primary: R_THEMES.red[1], accent: R_THEMES.red[2], logo: true }, data: blankData() }); App.go('resume/' + r.id); } }] });
  };
} });

/* ───── ویرایشگر ───── */
async function editor(el, id) {
  const rec = await API.get('/resumes/' + id), ro = !rec.can_edit;
  const data = { fa: { ...blankData().fa, ...(rec.data.fa || {}) }, en: { ...blankData().en, ...(rec.data.en || {}) } };
  // رزومه‌های قدیمی: «مدرک و رشته» در یک فیلد بود؛ به دو ستون مقطع و رشته شکسته می‌شود
  ['fa', 'en'].forEach(l => (data[l].education || []).forEach(it => { if (it.degree && !it.level && !it.field) { const d = Imp.splitDegree(it.degree); it.level = d.level; it.field = d.field; } delete it.degree; }));
  const S = { title: rec.title, lang: rec.lang, template: rec.template, theme: { primary: '#b3202a', accent: '#7d1219', paper: '#fff', ink: '#1d2433', logo: true, size: 'm', ...(rec.theme || {}) }, data, ed: rec.lang === 'en' ? 'en' : 'fa', dirty: false };
  App.setTitle('رزومه: ' + rec.title);
  const preview = () => { const st = $('#rstage', el), page = $('#rprev', el); if (!st || !page) return; page.innerHTML = resumeHtml(S.data, S); const z = Math.min(1, (st.clientWidth - 24) / 794); page.style.zoom = z; };
  const setDirty = v => { S.dirty = v; const b = $('#rsave', el); if (b) { b.textContent = v ? '💾 ذخیره' : '✓ ذخیره شده'; b.disabled = !v || ro; } };
  const save = async (quiet) => { if (ro) return; try { await API.put('/resumes/' + id, { title: S.title, lang: S.lang, template: S.template, theme: S.theme, data: S.data }); setDirty(false); if (!quiet) toast('ذخیره شد', 'success'); } catch (e) { toast(e.message, 'error'); } };
  const autosave = debounce(() => save(true), 2500);
  const touch = () => { setDirty(true); preview(); autosave(); };

  const dis = ro ? 'disabled' : '', E = () => S.data[S.ed], ph = S.ed === 'fa' ? 'rtl' : 'ltr';
  const inp = (key, label, extra = '') => `<label class="field"><span>${label}</span><input data-p="${key}" value="${esc(E()[key] || '')}" ${extra} ${dis}></label>`;
  const listForm = k => { const cfg = R_LISTS[k], arr = E()[k] || []; return `<details class="acc" open style="box-shadow:none"><summary style="font-size:15px;padding:8px 12px">${cfg.title} <small class="muted">(${fmtNum(arr.length)})</small></summary><div class="acc-body">${arr.map((it, i) => `<div class="card" style="padding:10px;margin-bottom:8px;box-shadow:none"><div class="form-grid" style="grid-template-columns:1fr 1fr">${cfg.fields.map(([f, l]) => (f === 'note' ? `<label class="field full"><span>${l}</span><textarea data-p="${k}.${i}.${f}" ${dis}>${esc(it[f] || '')}</textarea></label>` : `<label class="field"><span>${l}</span><input data-p="${k}.${i}.${f}" value="${esc(it[f] || '')}" ${dis}></label>`)).join('')}</div>${ro ? '' : `<div style="display:flex;gap:6px;margin-top:6px"><button class="btn sm" data-mv="${k}:${i}:-1">↑</button><button class="btn sm" data-mv="${k}:${i}:1">↓</button><button class="btn sm danger" data-rm="${k}:${i}">حذف</button></div>`}</div>`).join('')}${ro ? '' : `<button class="btn sm" data-add="${k}">+ افزودن</button>`}</div></details>`; };
  const form = () => `<div class="tabs"><button class="tab ${S.ed === 'fa' ? 'on' : ''}" data-ed="fa">محتوای فارسی</button><button class="tab ${S.ed === 'en' ? 'on' : ''}" data-ed="en">English content</button></div>
    <div class="form-grid" dir="${ph}" style="margin-bottom:10px">${inp('name', 'نام و نام خانوادگی')}${inp('title', 'عنوان شغلی')}${inp('years', 'سابقه کار (سال)', 'inputmode="numeric"')}${inp('email', 'ایمیل', 'dir="ltr"')}${inp('phone', 'تلفن', 'dir="ltr"')}${inp('website', 'وب‌سایت', 'dir="ltr"')}${inp('address', 'نشانی')}
      <label class="field full"><span>دربارهٔ من / خلاصه</span><textarea data-p="summary" ${dis}>${esc(E().summary || '')}</textarea></label></div>
    <div dir="${ph}">${['experience', 'education', 'projects', 'certificates'].map(listForm).join('')}
      <label class="field" style="margin-top:8px"><span>مهارت‌ها (هر مورد در یک خط یا با ویرگول جدا کنید)</span><textarea data-lines="skills" ${dis}>${esc((E().skills || []).join('\n'))}</textarea></label>
      <label class="field" style="margin-top:8px"><span>زبان‌ها (مثلاً: انگلیسی — مسلط)</span><textarea data-lines="languages" ${dis}>${esc((E().languages || []).join('\n'))}</textarea></label></div>`;
  const head = () => `<div class="page-head"><div><button class="link" data-back>← فهرست رزومه‌ها</button></div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn" id="rsave" data-act="save">✓ ذخیره شده</button><button class="btn" data-act="import" ${ro ? 'disabled' : ''}>📥 ورود از فایل</button><button class="btn" data-act="translate" ${ro ? 'disabled' : ''}>🌐 ترجمهٔ خودکار</button><button class="btn" data-act="attach">📎 فایل پیوست</button><button class="btn primary" data-act="print">🖨️ چاپ / ذخیره PDF</button></div></div>`;
  const side = () => `<div class="card" style="margin-bottom:12px"><div class="form-grid" style="grid-template-columns:1fr 1fr"><label class="field full"><span>نام رزومه</span><input id="rtitle" value="${esc(S.title)}" ${dis}></label>
    <label class="field"><span>زبان خروجی (پیش‌نمایش و چاپ)</span><select id="rlang"><option value="fa" ${S.lang === 'fa' ? 'selected' : ''}>فارسی</option><option value="en" ${S.lang === 'en' ? 'selected' : ''}>English</option></select></label>
    <label class="field"><span>قالب</span><select id="rtpl" ${dis}>${opts(Object.entries(R_TEMPLATES), S.template)}</select></label>
    <label class="field"><span>تم رنگی</span><select id="rtheme" ${dis}><option value="">سفارشی</option>${Object.entries(R_THEMES).map(([k, v]) => `<option value="${k}" ${S.theme.primary === v[1] && S.theme.accent === v[2] ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
    <label class="field"><span>اندازهٔ متن</span><select id="rsize" ${dis}>${opts([['s', 'کوچک'], ['m', 'متوسط'], ['l', 'بزرگ']], S.theme.size)}</select></label>
    <label class="field"><span>رنگ اصلی</span><input type="color" id="rcp" value="${S.theme.primary}" ${dis}></label><label class="field"><span>رنگ تیره</span><input type="color" id="rca" value="${S.theme.accent}" ${dis}></label>
    <label class="check full"><input type="checkbox" id="rlogo" ${S.theme.logo !== false ? 'checked' : ''} ${dis}> نمایش لوگوی کوشا معدن</label></div></div>${ro ? '<div class="sample-banner">فقط می‌توانید این رزومه را ببینید. سازندهٔ آن یا مدیر می‌تواند آن را ویرایش کند.</div>' : ''}<div id="rform">${form()}</div>`;
  el.innerHTML = `${head()}<div class="resume-layout"><div class="resume-form card" style="padding:12px">${side()}</div><div class="resume-stage" id="rstage"><div id="rprev"></div></div></div>
    <input type="file" id="rfile" class="hidden"><p class="muted small" style="margin-top:8px">برای خروجی PDF در پنجرهٔ چاپ گزینهٔ «Save as PDF / ذخیره به‌صورت PDF» را بزنید و «Background graphics» را فعال کنید تا رنگ‌ها حفظ شود.</p>`;
  preview(); setDirty(false); window.addEventListener('resize', preview, { once: true });
  const redrawForm = () => { $('#rform', el).innerHTML = form(); };
  const path = (p, v) => { const [k, i, f] = p.split('.'); if (f !== undefined) E()[k][+i][f] = v; else E()[k] = v; };
  el.oninput = e => {
    const t = e.target;
    if (t.dataset.p) { path(t.dataset.p, t.value); return touch(); }
    if (t.dataset.lines) { E()[t.dataset.lines] = t.value.split(/[\n،,]+/).map(s => s.trim()).filter(Boolean); return touch(); }
    if (t.id === 'rtitle') { S.title = t.value; return touch(); }
    if (t.id === 'rcp') { S.theme.primary = t.value; return touch(); } if (t.id === 'rca') { S.theme.accent = t.value; return touch(); }
  };
  el.onchange = async e => {
    const t = e.target;
    if (t.id === 'rlang') { S.lang = t.value; S.ed = t.value; redrawForm(); $$('.tab', el).forEach(b => b.classList.toggle('on', b.dataset.ed === S.ed)); return touch(); }
    if (t.id === 'rtpl') { S.template = t.value; return touch(); } if (t.id === 'rsize') { S.theme.size = t.value; return touch(); } if (t.id === 'rlogo') { S.theme.logo = t.checked; return touch(); }
    if (t.id === 'rtheme') { const th = R_THEMES[t.value]; if (th) { S.theme.primary = th[1]; S.theme.accent = th[2]; $('#rcp', el).value = th[1]; $('#rca', el).value = th[2]; touch(); } return; }
    if (t.id === 'rfile' && t.files[0]) { try { await API.upload(`/resumes/${id}/attach`, {}, t.files[0]); toast('فایل پیوست شد', 'success'); } catch (ex) { toast(ex.message, 'error'); } t.value = ''; }
  };
  el.onclick = async e => {
    const q = s => e.target.closest(s);
    if (q('[data-back]')) { if (S.dirty) await save(true); return App.go('resume'); }
    const ed = q('[data-ed]'); if (ed) { S.ed = ed.dataset.ed; $$('.tab', el).forEach(b => b.classList.toggle('on', b.dataset.ed === S.ed)); return redrawForm(); }
    const ad = q('[data-add]'); if (ad) { E()[ad.dataset.add].push({ ...R_LISTS[ad.dataset.add].blank }); redrawForm(); const d = $$('#rform details', el); return touch(); }
    const rm = q('[data-rm]'); if (rm) { const [k, i] = rm.dataset.rm.split(':'); E()[k].splice(+i, 1); redrawForm(); return touch(); }
    const mv = q('[data-mv]'); if (mv) { const [k, i, d] = mv.dataset.mv.split(':'), a = E()[k], j = +i + +d; if (a[j]) { [a[+i], a[j]] = [a[j], a[+i]]; redrawForm(); touch(); } return; }
    const act = q('[data-act]'); if (!act) return;
    if (act.dataset.act === 'save') return save();
    if (act.dataset.act === 'print') { if (S.dirty) await save(true); return printResume(resumeHtml(S.data, S), S.lang); }
    if (act.dataset.act === 'attach') { if (rec.attach_name) { return Modal.open({ title: 'فایل پیوست', html: `<p>${esc(rec.attach_name)}</p>`, actions: [{ label: 'دانلود', cls: 'primary', close: false, run: () => downloadFile(`/resumes/${id}/attach`, rec.attach_name) }, ...(ro ? [] : [{ label: 'جایگزینی', run: () => { $('#rfile', el).click(); } }, { label: 'حذف فایل', cls: 'danger', run: async () => { await API.del(`/resumes/${id}/attach`); rec.attach_name = null; } }]), { label: 'بستن', cls: 'ghost', run: () => true }] }); } return ro ? toast('فایلی پیوست نشده است') : $('#rfile', el).click(); }
    if (act.dataset.act === 'import') return importDialog();
    if (act.dataset.act === 'translate') return translateDialog();
  };
  /* ورود از فایل: Excel / CSV / Word / PDF → جایگذاری در همین قالب (زبانِ در حال ویرایش) */
  function importDialog() {
    const lng = S.ed === 'fa' ? 'فارسی' : 'انگلیسی';
    Modal.open({ title: 'ورود اطلاعات از فایل', wide: true, html: `<p>فایل رزومه یا اطلاعات فرد را انتخاب کنید (Excel، CSV، Word با پسوند docx، PDF یا TXT). اطلاعات خوانده‌شده در محتوای <b>${lng}</b> همین رزومه و در قالب انتخاب‌شده‌تان جایگذاری می‌شود.</p>
      <p class="muted small">بهترین نتیجه با «قالب اکسل رزومه» است: هر بخش یک شیت (مشخصات، تحصیلات، سوابق کاری، پروژه‌ها، گواهینامه‌ها، مهارت‌ها، زبان‌ها)، هر ستون یک فیلد (مثلاً مقطع، رشته، دانشگاه، سال شروع، سال پایان) و هر سطر یک مورد. در رزومه هر مورد در سطر خودش و زیر ستون خودش قرار می‌گیرد. در Word/PDF بخش‌ها با عنوانشان شناسایی می‌شوند؛ PDFِ اسکن‌شده خوانده نمی‌شود.</p>
      <p><button class="btn" id="riTpl" type="button">⬇️ دریافت قالب اکسل رزومه</button></p>
      <label class="field"><span>فایل</span><input type="file" id="riFile" accept=".xlsx,.csv,.docx,.pdf,.txt"></label>
      <label class="field" style="margin-top:8px"><span>روش جایگذاری</span><select id="riMode"><option value="merge">افزودن به محتوای فعلی (فیلدهای خالی پر شود، فهرست‌ها اضافه شود)</option><option value="replace">جایگزین کردن همهٔ محتوای فعلی</option></select></label><div id="riOut" style="margin-top:10px"></div>`,
    actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'جایگذاری در رزومه', cls: 'primary', run: async m => {
      const R = m._res; if (!R) throw new Error('ابتدا فایل را انتخاب کنید');
      const E_ = S.data[S.ed], rep_ = $('#riMode', m).value === 'replace', LISTS = ['experience', 'education', 'projects', 'certificates'];
      ['name', 'title', 'summary', 'email', 'phone', 'website', 'address', 'years'].forEach(k => { if (R[k] && (rep_ || !E_[k])) E_[k] = R[k]; });
      LISTS.forEach(k => { if (R[k].length) E_[k] = rep_ ? R[k] : (E_[k] || []).concat(R[k]); });
      ['skills', 'languages'].forEach(k => { if (R[k].length) E_[k] = rep_ ? R[k] : [...new Set((E_[k] || []).concat(R[k]))]; });
      redrawForm(); touch(); toast('اطلاعات جایگذاری شد؛ لطفاً بازبینی کنید', 'success'); } }],
    onOpen: m => { $('#riTpl', m).onclick = () => saveBlob(XL.write(Imp.resumeTemplate()), 'resume-template.xlsx'); const f = $('#riFile', m), out = $('#riOut', m); f.onchange = async () => {
      const file = f.files[0]; if (!file) return; out.innerHTML = '<span class="muted">در حال خواندن فایل…</span>'; m._res = null;
      try { const R = await Imp.resume(file); m._res = R; const n = k => fmtNum(R[k].length);
        out.innerHTML = `<div class="card" style="box-shadow:none"><b>${esc(R.name || '(نام پیدا نشد)')}</b> ${R.title ? '· ' + esc(R.title) : ''}<div class="muted small" style="margin-top:4px">${R.email ? esc(R.email) + ' · ' : ''}${R.phone ? esc(R.phone) : ''}</div>
          <div style="margin-top:6px">${chip('سوابق کاری: ' + n('experience'))} ${chip('تحصیلات: ' + n('education'))} ${chip('پروژه‌ها: ' + n('projects'))} ${chip('گواهی‌ها: ' + n('certificates'))} ${chip('مهارت‌ها: ' + n('skills'))} ${chip('زبان‌ها: ' + n('languages'))}</div></div>`;
      } catch (e) { out.innerHTML = `<span style="color:var(--bad)">${esc(e.message)}</span>`; } }; } });
  }
  /* ترجمهٔ خودکار: از زبان در حال ویرایش به زبان دیگر */
  function translateDialog() {
    const from = S.ed, to = from === 'fa' ? 'en' : 'fa', names = { fa: 'فارسی', en: 'انگلیسی' };
    Modal.open({ title: `ترجمهٔ خودکار ${names[from]} ← ${names[to]}`, html: `<p>محتوای ${names[from]} (عنوان شغلی، خلاصه، سوابق، تحصیلات، پروژه‌ها، مهارت‌ها و …) به ${names[to]} ترجمه و در نسخهٔ ${names[to]} قرار می‌گیرد. نام، ایمیل، تلفن و تاریخ‌ها فقط کپی/تبدیل ارقام می‌شوند.</p>
      <label class="check"><input type="checkbox" name="over"> متن‌های موجود در نسخهٔ ${names[to]} هم جایگزین شود</label><p class="muted small">ترجمهٔ ماشینی همیشه نیاز به بازبینی دارد، به‌ویژه اصطلاحات تخصصی و نام شرکت‌ها.</p>`,
    actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ترجمه کن', cls: 'primary', run: async m => {
      const over = $('[name=over]', m).checked, src = S.data[from], dst = S.data[to], jobs = [];
      const add = (get, set) => { const v = get(); if (String(v || '').trim()) jobs.push({ text: String(v), set }); };
      const empty0 = v => !String(v || '').trim();
      ['title', 'summary', 'address'].forEach(k => { if (over || empty0(dst[k])) add(() => src[k], r => { dst[k] = r; }); });
      ['name', 'email', 'phone', 'website', 'years'].forEach(k => { if (over || empty0(dst[k])) dst[k] = k === 'years' ? (to === 'fa' ? toFaNum(toLatin(src[k])) : toLatin(src[k])) : (src[k] || ''); });
      ['experience', 'education', 'projects', 'certificates'].forEach(k => { if (!over && (dst[k] || []).length) return; dst[k] = (src[k] || []).map(it => { const o = { ...it }; Object.keys(o).forEach(f => { if (!(R_TEXT_KEYS[k] || []).includes(f)) o[f] = to === 'fa' ? toFaNum(toLatin(o[f])) : toLatin(o[f]); }); (R_TEXT_KEYS[k] || []).forEach(f => add(() => it[f], r => { o[f] = r; })); return o; }); });
      ['skills', 'languages'].forEach(k => { if (!over && (dst[k] || []).length) return; dst[k] = (src[k] || []).map(s => s); (src[k] || []).forEach((s, i) => add(() => s, r => { dst[k][i] = r; })); });
      if (!jobs.length) { toast('چیزی برای ترجمه پیدا نشد (نسخهٔ مقصد پر است؟)'); return; }
      const via = {}; let low = 0;
      for (let i = 0; i < jobs.length; i += 60) {
        const chunk = jobs.slice(i, i + 60), r = await API.post('/translate', { texts: chunk.map(j => j.text), from, to });
        r.translations.forEach((t, k) => { chunk[k].set(t.text); via[t.via] = (via[t.via] || 0) + 1; if (t.via === 'glossary' && t.coverage < 0.7) low++; });
      }
      S.ed = to; redrawForm(); $$('.tab', el).forEach(b => b.classList.toggle('on', b.dataset.ed === S.ed)); touch();
      const how = via.service ? 'سرویس ترجمه' : via.mymemory ? 'سرویس آنلاین MyMemory' : 'واژه‌نامهٔ داخلی (سرویس آنلاین در دسترس نبود)';
      Modal.open({ title: 'ترجمه انجام شد', html: `<p>روش ترجمه: <b>${how}</b>.</p>${via.glossary ? `<div class="sample-banner">⚠️ ترجمهٔ داخلی فقط واژه‌به‌واژه است${low ? ` و ${fmtNum(low)} مورد کم‌پوشش بود` : ''}؛ حتماً نسخهٔ ${names[to]} را بازبینی و اصلاح کنید.</div>` : '<p class="muted">لطفاً نسخهٔ ترجمه‌شده را بازبینی کنید.</p>'}`, actions: [{ label: 'باشه', cls: 'primary', run: () => true }] });
    } }] });
  }
}
