/* هستهٔ مشترک رابط کاربری: API، ابزارها، پنجره‌ها، تاریخ شمسی، ترجمهٔ رابط و تم */
'use strict';
const API_URL = window.location.origin + '/api';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ───────── ترجمهٔ رابط (فارسی/انگلیسی) ─────────
   متن‌های جدید به فارسی نوشته می‌شوند؛ اگر معادل انگلیسی در DICT_EN نباشد همان فارسی نمایش داده می‌شود. */
const DICT_EN = {
  'داشبورد': 'Dashboard', 'کارتابل': 'Cartable', 'مناقصات': 'Tenders', 'مناقصات معدنی': 'Mining tenders', 'مناقصات عمومی': 'General tenders',
  'مناقصات در حال انجام': 'Tenders in progress', 'مناقصات اتمام‌یافته': 'Finished tenders', 'پروپوزال‌ها': 'Proposals', 'آرشیو مدارک': 'Document archive',
  'رزومه‌ساز': 'Resume builder', 'کاربران': 'Users', 'خروج': 'Sign out', 'ورود': 'Sign in', 'نام کاربری': 'Username', 'رمز عبور': 'Password',
  'ذخیره': 'Save', 'انصراف': 'Cancel', 'بستن': 'Close', 'حذف': 'Delete', 'ویرایش': 'Edit', 'جستجو': 'Search', 'همه': 'All', 'جدید': 'New',
  'مشاهده': 'View', 'دانلود': 'Download', 'تأیید': 'Confirm', 'تم و رنگ‌ها': 'Theme & colors', 'اعلان‌ها': 'Notifications', 'نام': 'Name',
  'شماره': 'Number', 'کارفرما': 'Client', 'مرحله': 'Stage', 'وضعیت': 'Status', 'مهلت': 'Deadline', 'مبلغ': 'Amount', 'عملیات': 'Actions',
  'تاریخ': 'Date', 'از تاریخ': 'From', 'تا تاریخ': 'To', 'برنده': 'Won', 'بازنده': 'Lost', 'ورود به سامانه': 'Sign in to the system',
  'سامانه مدیریت مناقصات': 'Tender Management System', 'کوشا معدن': 'Kusha Madan', 'بازنشانی': 'Reset', 'چاپ': 'Print', 'امتیاز': 'Score'
};
let LANG = (() => { try { return localStorage.getItem('lang') || 'fa'; } catch { return 'fa'; } })();
const isFa = () => LANG === 'fa';
const t = s => (LANG === 'en' && DICT_EN[s]) || s;
function setLang(l) { LANG = l; try { localStorage.setItem('lang', l); } catch {} document.documentElement.lang = l; document.documentElement.dir = l === 'fa' ? 'rtl' : 'ltr'; }

/* ───────── نشست و درخواست‌ها ───────── */
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
const Auth = {
  token: () => store.get('token'),
  user() { try { return JSON.parse(store.get('user')); } catch { return null; } },
  save(token, user) { if (token) store.set('token', token); store.set('user', JSON.stringify(user)); },
  clear() { store.del('token'); store.del('user'); }
};
const can = (...roles) => { const u = Auth.user(); return !!u && roles.includes(u.role); };
const isStaff = () => { const u = Auth.user(); return !!u && u.role === 'staff'; };

async function request(endpoint, { method = 'GET', body, raw } = {}) {
  const isForm = body instanceof FormData;
  const headers = {};
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';
  if (Auth.token()) headers.Authorization = 'Bearer ' + Auth.token();
  let r, data = {};
  try {
    r = await fetch(API_URL + endpoint, { method, headers, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body) });
    if (raw) return r;
    data = await r.json().catch(() => ({}));
  } catch (e) { throw new Error('ارتباط با سرور برقرار نشد'); }
  if (r.status === 401 && endpoint !== '/auth/login') { Auth.clear(); if (window.App) App.showLogin('نشست شما منقضی شده است، دوباره وارد شوید'); throw new Error(data.error || 'نشست منقضی شد'); }
  if (r.status === 403 && data.code === 'PASSWORD_CHANGE_REQUIRED') { if (window.App) App.showChangePassword(true); throw new Error(data.error); }
  if (!r.ok) throw new Error((data.error || ('خطا ' + r.status)) + (data.requirements ? ': ' + data.requirements.join('، ') : ''));
  return data;
}
const qs = o => { const p = new URLSearchParams(Object.entries(o || {}).filter(([, v]) => v !== '' && v != null && v !== false)).toString(); return p ? '?' + p : ''; };
const API = {
  get: (u, params) => request(u + qs(params)),
  post: (u, body) => request(u, { method: 'POST', body: body ?? {} }),
  put: (u, body) => request(u, { method: 'PUT', body: body ?? {} }),
  del: u => request(u, { method: 'DELETE' }),
  upload: (u, fields, file, method = 'POST') => { const f = new FormData(); Object.entries(fields || {}).forEach(([k, v]) => v != null && f.append(k, v)); if (file) f.append('file', file); return request(u, { method, body: f }); }
};
async function downloadFile(endpoint, filename) {
  try {
    const r = await request(endpoint, { raw: true });
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || ('خطا ' + r.status)); }
    saveBlob(await r.blob(), filename || 'file');
  } catch (e) { toast(e.message, 'error'); }
}
async function fetchBlob(endpoint) {
  const r = await request(endpoint, { raw: true });
  if (!r.ok) throw new Error('دریافت فایل ممکن نشد');
  return r.blob();
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 8000);
}

/* ───────── اعداد، پول، تاریخ (شمسی) ───────── */
const FD = '۰۱۲۳۴۵۶۷۸۹', AD = '٠١٢٣٤٥٦٧٨٩';
const toLatin = s => String(s ?? '').replace(/[۰-۹]/g, c => FD.indexOf(c)).replace(/[٠-٩]/g, c => AD.indexOf(c));
const toFaNum = s => String(s ?? '').replace(/[0-9]/g, c => FD[+c]);
const fmtNum = v => (v == null || v === '' || isNaN(Number(v))) ? '—' : new Intl.NumberFormat(isFa() ? 'fa-IR' : 'en-US').format(Number(v));
const fmtMoney = (v, cur) => (v == null || v === '' || isNaN(Number(v))) ? '—' : fmtNum(v) + ' ' + (cur || (isFa() ? 'ریال' : 'IRR'));
function formatSize(b) { b = Number(b) || 0; return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }

const pFmt = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
const J = {
  // 'YYYY-MM-DD' (میلادی) → [jy, jm, jd]
  parts(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
    const o = {}; pFmt.formatToParts(d).forEach(p => { if (p.type !== 'literal') o[p.type] = p.value; });
    const y = parseInt(o.year), mo = parseInt(o.month), da = parseInt(o.day);
    return isNaN(y) ? null : [y, mo, da];
  },
  fromIso(iso) { const p = this.parts(iso); return p ? p[0] + '/' + String(p[1]).padStart(2, '0') + '/' + String(p[2]).padStart(2, '0') : ''; },
  // رشتهٔ شمسی ('1405/02/15' یا با ارقام فارسی) → 'YYYY-MM-DD' میلادی؛ نامعتبر = null
  toIso(s) {
    const m = /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/.exec(toLatin(s).trim()); if (!m) return null;
    const jy = +m[1], jm = +m[2], jd = +m[3];
    if (jy < 1200 || jy > 1700 || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
    let g = Date.UTC(jy + 621, 2, 21, 12) + ((jm - 1) * 30.4 + (jd - 1)) * 86400000;       // حدس اولیه، سپس اصلاح تا تطابق
    for (let i = 0; i < 12; i++) {
      const iso = new Date(g).toISOString().slice(0, 10), p = this.parts(iso); if (!p) return null;
      if (p[0] === jy && p[1] === jm && p[2] === jd) return iso;
      const diff = ((jy - p[0]) * 372 + (jm - p[1]) * 31 + (jd - p[2]));
      g += Math.sign(diff) * Math.max(1, Math.min(Math.abs(diff), 20)) * 86400000;
    }
    return null;
  },
  today() { return new Date().toISOString().slice(0, 10); }
};
function fmtDate(d) {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  if (!isFa()) return s;
  const j = J.fromIso(s); return j ? toFaNum(j) : s;
}
function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d); if (isNaN(dt)) return String(d);
  return isFa() ? toFaNum(J.fromIso(dt.toISOString().slice(0, 10))) + ' ' + toFaNum(dt.toTimeString().slice(0, 5)) : dt.toLocaleString('en-GB');
}
const daysFromToday = iso => iso ? Math.round((new Date(String(iso).slice(0, 10) + 'T12:00:00Z') - new Date(J.today() + 'T12:00:00Z')) / 86400000) : null;

// فیلد تاریخ شمسی: متن + دکمهٔ تقویم (انتخابگر مرورگر) — مقدار با dateVal() خوانده می‌شود
function dateField(name, iso, attrs = '') {
  const v = iso ? J.fromIso(String(iso).slice(0, 10)) : '';
  return `<span class="datefield"><input type="text" class="jd" name="${esc(name)}" inputmode="numeric" dir="ltr" placeholder="۱۴۰۵/۰۱/۱۵" value="${esc(v)}" ${attrs}>` +
    `<button type="button" class="jd-pick" tabindex="-1" title="تقویم" aria-label="تقویم">▾</button><input type="date" class="jd-native" tabindex="-1"></span>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('.jd-pick'); if (!b) return;
  const wrap = b.closest('.datefield'), nat = $('.jd-native', wrap), txt = $('.jd', wrap);
  nat.value = J.toIso(txt.value) || J.today();
  try { nat.showPicker(); } catch { nat.focus(); }
});
document.addEventListener('change', e => {
  if (!e.target.classList.contains('jd-native') || !e.target.value) return;
  const txt = $('.jd', e.target.closest('.datefield')); txt.value = J.fromIso(e.target.value); txt.dispatchEvent(new Event('change', { bubbles: true }));
});
// '' = خالی، null = نامعتبر، وگرنه 'YYYY-MM-DD'
function dateVal(el) { const v = (el.value || '').trim(); if (!v) return ''; return J.toIso(v); }

// فیلد مبلغ با جداکنندهٔ هزارگان
function moneyField(name, v, attrs = '') {
  return `<input type="text" class="money" name="${esc(name)}" inputmode="numeric" dir="ltr" value="${v == null || v === '' ? '' : esc(Number(v).toLocaleString('en-US'))}" ${attrs}>`;
}
document.addEventListener('input', e => {
  if (!e.target.classList.contains('money')) return;
  const el = e.target, d = toLatin(el.value).replace(/[^\d.]/g, '');
  const [i, f] = d.split('.'); el.value = (i ? Number(i).toLocaleString('en-US') : '') + (f !== undefined ? '.' + f : '');
});
const numVal = el => { const v = toLatin(el.value).replace(/[,٬\s]/g, ''); return v === '' ? '' : (isNaN(Number(v)) ? null : Number(v)); };

/* ───────── پیام، پنجره، تأیید ───────── */
function toast(message, type = 'info') {
  const c = $('#toastContainer'); if (!c) return;
  const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = message; c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, type === 'error' ? 5000 : 3000);
}
const Modal = {
  stack: [],
  open({ title, html, wide, actions, onOpen }) {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="modal-head"><h3>${esc(title || '')}</h3><button class="x" data-close aria-label="بستن">×</button></div><div class="modal-body">${html || ''}</div>${actions ? '<div class="modal-foot"></div>' : ''}</div>`;
    document.body.appendChild(bg);
    const m = $('.modal', bg);
    bg.addEventListener('mousedown', e => { if (e.target === bg) bg._down = true; });
    bg.addEventListener('mouseup', e => { if (e.target === bg && bg._down) this.close(bg); bg._down = false; });
    $('[data-close]', bg).onclick = () => this.close(bg);
    if (actions) {
      const foot = $('.modal-foot', bg);
      actions.forEach(a => { const b = document.createElement('button'); b.className = 'btn ' + (a.cls || ''); b.textContent = a.label; b.onclick = async () => { b.disabled = true; try { const r = await a.run(m, bg); if (r !== false && a.close !== false) this.close(bg); } catch (e) { toast(e.message, 'error'); } b.disabled = false; }; foot.appendChild(b); });
    }
    this.stack.push(bg);
    const first = $('input:not([type=hidden]):not(.jd-native),select,textarea', m); if (first) setTimeout(() => first.focus(), 30);
    if (onOpen) onOpen(m, bg);
    return bg;
  },
  close(bg) { bg = bg || this.stack[this.stack.length - 1]; if (!bg) return; this.stack = this.stack.filter(x => x !== bg); bg.remove(); },
  closeAll() { this.stack.slice().forEach(b => this.close(b)); }
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && Modal.stack.length) Modal.close(); });
const confirmBox = (msg, okLabel = 'تأیید', danger = true) => new Promise(res => {
  let done = false; const fin = v => { if (!done) { done = true; res(v); } };
  const bg = Modal.open({ title: 'تأیید', html: `<p class="confirm-msg">${esc(msg)}</p>`, actions: [
    { label: 'انصراف', cls: 'ghost', run: () => { fin(false); } }, { label: okLabel, cls: danger ? 'danger' : 'primary', run: () => { fin(true); } }] });
  const obs = new MutationObserver(() => { if (!document.body.contains(bg)) { fin(false); obs.disconnect(); } });
  obs.observe(document.body, { childList: true });
});
// خواندن فرم داخل پنجره
const formData = root => { const o = {}; $$('[name]', root).forEach(el => { if (el.type === 'checkbox') o[el.name] = el.checked; else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; } else o[el.name] = el.value; }); return o; };
const debounce = (fn, ms = 300) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };
const opts = (pairs, sel) => pairs.map(([v, l]) => `<option value="${esc(v)}" ${String(sel) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('');

/* ───────── برچسب‌های مشترک ───────── */
const ROLES = { super_admin: 'مدیر ارشد', ceo: 'مدیرعامل', technical_manager: 'مدیر دفتر فنی', technical_expert: 'کارشناس فنی', financial: 'مالی', procurement: 'کارشناس مناقصات', staff: 'همکار (دسترسی محدود)' };
const KIND = { exploration: 'اکتشافی', supervision: 'نظارتی' };
const PACKAGE = { quality: 'ارزیابی کیفی (مرحلهٔ اول)', technical: 'فنی', price: 'مالی', full: 'کامل (کیفی + فنی + مالی)' };
const PACKAGE_S = { quality: 'کیفی (مرحلهٔ اول)', technical: 'فنی', price: 'مالی', full: 'کامل' };
const fmtYear = y => (y == null || y === '') ? '—' : toFaNum(String(y));
const SUBMIT = { sending: 'در حال ارسال', sent: 'ارسال شده', awaiting_winner: 'منتظر اعلام برنده' };
const PROP_STATUS = { draft: 'پیش‌نویس', sent: 'ارسال شده', awaiting: 'منتظر نتیجه', won: 'برنده', lost: 'بازنده', cancelled: 'لغو شده' };
const PART = { schedule: 'برنامه زمان‌بندی', technical_proposal: 'پیشنهاد فنی', quality_docs: 'مدارک کیفی', price: 'پیشنهاد قیمت', other: 'سایر' };
const chip = (text, cls = '') => `<span class="chip ${cls}">${esc(text)}</span>`;
const empty = msg => `<div class="empty">${esc(msg)}</div>`;

/* ───────── تم و رنگ‌ها ───────── */
const THEMES = {
  navy: { name: 'سرمه‌ای و آجری (پیش‌فرض)', primary: '#b95c50', nav: '#0f1f3a', bg: '#f3f1ee', surface: '#ffffff', text: '#1d2433', dark: false },
  night: { name: 'شب (تیره)', primary: '#d0786b', nav: '#0a1426', bg: '#121c30', surface: '#1a2640', text: '#e8ecf4', dark: true },
  mine: { name: 'سبز معدنی', primary: '#4f8a6b', nav: '#12302a', bg: '#f1f4f2', surface: '#ffffff', text: '#1b2a26', dark: false },
  gold: { name: 'طلایی و سرمه‌ای', primary: '#b88a2c', nav: '#18233f', bg: '#f6f3ec', surface: '#ffffff', text: '#222a3d', dark: false },
  light: { name: 'روشن ساده', primary: '#3b6fb6', nav: '#2b3a55', bg: '#f5f7fa', surface: '#ffffff', text: '#1f2937', dark: false }
};
const Theme = {
  current() { try { return JSON.parse(store.get('theme')) || { preset: 'navy' }; } catch { return { preset: 'navy' }; } },
  apply(th) {
    th = th || this.current();
    const base = THEMES[th.preset] || THEMES.navy, c = { ...base, ...(th.custom || {}) };
    const r = document.documentElement.style;
    r.setProperty('--primary', c.primary); r.setProperty('--nav', c.nav); r.setProperty('--bg', c.bg); r.setProperty('--surface', c.surface); r.setProperty('--text', c.text);
    document.documentElement.dataset.dark = base.dark ? '1' : '0';
  },
  save(th) { store.set('theme', JSON.stringify(th)); this.apply(th); },
  reset() { store.del('theme'); const r = document.documentElement.style; ['--primary', '--nav', '--bg', '--surface', '--text'].forEach(k => r.removeProperty(k)); this.apply({ preset: 'navy' }); }
};
Theme.apply();

/* ───────── فونت فارسی و انگلیسی (برای کل سایت) ─────────
   فونتی که روی دستگاه نصب نباشد به‌جای آن جایگزین می‌شود. فایل فونت را می‌توان در public/fonts گذاشت یا از پنل «افزودن فونت» بارگذاری کرد. */
const FA_FONTS = { default: ['B Nazanin (پیش‌فرض)', "'KM Body','B Nazanin','Vazirmatn','Tahoma'"], vazirmatn: ['وزیرمتن', "'Vazirmatn'"], iransans: ['ایران‌سنس', "'IRANSans','IRANSansWeb'"], shabnam: ['شبنم', "'Shabnam'"], sahel: ['ساحل', "'Sahel'"], samim: ['صمیم', "'Samim'"],
  yekan: ['یکان', "'Yekan','BYekan'"], mitra: ['B Mitra', "'B Mitra','BMitra'"], titr: ['B Titr', "'KM Title','B Titr'"], tahoma: ['Tahoma', "'Tahoma'"], segoe: ['Segoe UI', "'Segoe UI'"], system: ['فونت سیستم', "system-ui"] };
const EN_FONTS = { default: ['همان فونت فارسی (پیش‌فرض)', ''], inter: ['Inter', "'Inter'"], segoe: ['Segoe UI', "'Segoe UI'"], roboto: ['Roboto', "'Roboto'"], arial: ['Arial', "'Arial'"], calibri: ['Calibri', "'Calibri'"], times: ['Times New Roman', "'Times New Roman'"], georgia: ['Georgia', "'Georgia'"], consolas: ['Consolas (تک‌فاصله)', "'Consolas','Courier New'"], system: ['فونت سیستم', 'system-ui'] };
const Fonts = {
  current() { try { return { fa: 'default', en: 'default', title: 'default', size: 100, ...(JSON.parse(store.get('fonts')) || {}) }; } catch { return { fa: 'default', en: 'default', title: 'default', size: 100 }; } },
  custom() { try { return JSON.parse(store.get('fonts-custom')) || []; } catch { return []; } },
  faces() { let st = document.getElementById('customFonts'); if (!st) { st = document.createElement('style'); st.id = 'customFonts'; document.head.appendChild(st); }
    st.textContent = this.custom().map(f => `@font-face{font-family:'${f.name.replace(/'/g, '')}';src:url(${f.data});font-display:swap}`).join('\n'); },
  stack(kind, id) { const c = this.custom().find(f => 'c:' + f.name === id); if (c) return `'${c.name.replace(/'/g, '')}'`; return (kind === 'fa' ? FA_FONTS : EN_FONTS)[id] ? (kind === 'fa' ? FA_FONTS : EN_FONTS)[id][1] : ''; },
  apply(f) {
    f = f || this.current(); this.faces();
    const fa = this.stack('fa', f.fa) || FA_FONTS.default[1], en = this.stack('en', f.en), ti = f.title === 'default' ? '' : this.stack('fa', f.title);
    const body = [en, fa, "'Vazirmatn'", "'Tahoma'", "'Segoe UI'", 'sans-serif'].filter(Boolean).join(', ');
    const r = document.documentElement.style;
    r.setProperty('--font', body); r.setProperty('--font-title', [ti, en, "'KM Title'", "'B Titr'", fa, 'sans-serif'].filter(Boolean).join(', '));
    r.fontSize = (f.size || 100) + '%';
  },
  save(f) { store.set('fonts', JSON.stringify(f)); this.apply(f); },
  addFile(file) { return new Promise((res, rej) => {
    if (!/\.(woff2?|ttf|otf)$/i.test(file.name)) return rej(new Error('فقط فایل woff2 ،woff ،ttf یا otf'));
    if (file.size > 2.5 * 1024 * 1024) return rej(new Error('حجم فونت بیشتر از ۲٫۵ مگابایت است؛ آن را در پوشهٔ public/fonts بگذارید'));
    const rd = new FileReader(); rd.onerror = () => rej(new Error('خواندن فایل ممکن نشد'));
    rd.onload = () => { const list = this.custom().filter(x => x.name !== file.name.replace(/\.[^.]+$/, '')); list.push({ name: file.name.replace(/\.[^.]+$/, ''), data: rd.result });
      try { store.set('fonts-custom', JSON.stringify(list)); if (store.get('fonts-custom') == null) throw 0; } catch { return rej(new Error('ذخیرهٔ فونت در مرورگر ممکن نشد (فضای کافی نیست)')); } this.faces(); res(file.name.replace(/\.[^.]+$/, '')); };
    rd.readAsDataURL(file); }); }
};
Fonts.apply();
function fontRows() {
  const f = Fonts.current(), cu = Fonts.custom().map(c => ['c:' + c.name, c.name + ' (افزوده‌شده)']);
  const sel = (key, label, map, extra = []) => `<label class="colorrow"><span>${label}</span><select data-font="${key}">${[...Object.entries(map).map(([k, v]) => [k, v[0]]), ...extra].map(([k, l]) => `<option value="${esc(k)}" ${f[key] === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  return sel('fa', 'فونت متن فارسی', FA_FONTS, cu) + sel('en', 'فونت انگلیسی و اعداد لاتین', EN_FONTS, cu) + sel('title', 'فونت تیترها', { default: ['همان فونت متن (پیش‌فرض)'], ...FA_FONTS }, cu)
    + `<label class="colorrow"><span>اندازهٔ متن سایت</span><select data-font="size">${[85, 92, 100, 110, 120].map(v => `<option value="${v}" ${f.size === v ? 'selected' : ''}>${v}٪</option>`).join('')}</select></label>`;
}
function openThemePanel() {
  const th = Theme.current(), base = THEMES[th.preset] || THEMES.navy, c = { ...base, ...(th.custom || {}) };
  const sw = Object.entries(THEMES).map(([k, v]) => `<button type="button" class="swatch ${th.preset === k ? 'on' : ''}" data-preset="${k}"><i style="background:${v.nav}"></i><i style="background:${v.primary}"></i><i style="background:${v.bg}"></i><span>${esc(v.name)}</span></button>`).join('');
  const field = (k, l) => `<label class="colorrow"><span>${l}</span><input type="color" name="${k}" value="${c[k]}"></label>`;
  Modal.open({ title: t('تم و رنگ‌ها'), html: `<div class="swatches">${sw}</div><h4 class="sub">رنگ دلخواه</h4><div class="colorgrid">${field('primary', 'رنگ اصلی (دکمه‌ها)')}${field('nav', 'نوار کناری و سربرگ')}${field('bg', 'پس‌زمینه')}${field('surface', 'کارت‌ها')}${field('text', 'رنگ متن')}</div>
    <h4 class="sub">فونت</h4><div class="colorgrid" id="fontGrid">${fontRows()}</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px"><button class="btn sm" type="button" id="fontAdd">+ افزودن فونت از فایل</button><input type="file" id="fontFile" class="hidden" accept=".woff,.woff2,.ttf,.otf"><span class="muted small">فونت‌های نصب‌نشده روی این دستگاه جایگزین می‌شوند؛ یا فایلشان را اضافه کنید.</span></div>
    <p class="muted small">تنظیمات در همین مرورگر ذخیره می‌شود.</p>`,
    actions: [{ label: 'بازنشانی به پیش‌فرض', cls: 'ghost', run: () => { Theme.reset(); store.del('fonts'); Fonts.apply({ fa: 'default', en: 'default', title: 'default', size: 100 }); } }, { label: t('بستن'), cls: 'primary', run: () => true }],
    onOpen: m => {
      m.addEventListener('click', e => { const b = e.target.closest('[data-preset]'); if (!b) return; Theme.save({ preset: b.dataset.preset }); Modal.close(); openThemePanel(); });
      m.addEventListener('change', async e => {
        const t = e.target, f = Fonts.current();
        if (t.dataset.font) { f[t.dataset.font] = t.dataset.font === 'size' ? +t.value : t.value; Fonts.save(f); return; }
        if (t.id === 'fontFile' && t.files[0]) { try { const nm = await Fonts.addFile(t.files[0]); f.fa = 'c:' + nm; Fonts.save(f); toast('فونت اضافه و برای متن فارسی انتخاب شد', 'success'); $('#fontGrid', m).innerHTML = fontRows(); } catch (ex) { toast(ex.message, 'error'); } t.value = ''; }
      });
      m.addEventListener('click', e => { if (e.target.closest('#fontAdd')) $('#fontFile', m).click(); });
      m.addEventListener('input', e => { if (e.target.type !== 'color') return; const cur = Theme.current(); cur.custom = { ...(cur.custom || {}), [e.target.name]: e.target.value }; Theme.save(cur); });
    } });
}
