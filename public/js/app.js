/* پوسته: ورود، مسیریابی، منوی کشویی، اعلان‌ها و صفحهٔ کاربران */
'use strict';
const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0112 5c6.5 0 10.5 7 10.5 7a17.6 17.6 0 01-3.2 3.9M6.6 6.6A17.4 17.4 0 001.5 12S5.5 19 12 19a10.6 10.6 0 004.4-.95"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/></svg>';

const NAV = [
  { group: 'مناقصات معدنی', icon: '⛏️', items: [
    { id: 'm/dashboard', label: 'داشبورد', icon: '📊', not: ['staff'] },
    { id: 'm/cartable', label: 'کارتابل مدیریت مناقصات', icon: '📥', badge: true },
    { folder: 'مناقصات', icon: '📁', not: ['staff'], items: [
      { id: 'm/running', label: 'در حال انجام', icon: '⏳' }, { id: 'm/finished', label: 'اتمام‌یافته', icon: '✅' }, { id: 'm/withdrawn', label: 'انصراف از مناقصه', icon: '↩️' }] },
    { id: 'm/proposals', label: 'پروپوزال‌ها', icon: '📨', not: ['staff'] },
    { id: 'm/inquiries', label: 'استعلام قیمت', icon: '💲', not: ['staff'] },
    { folder: 'آرشیو مدارک', icon: '🗄️', not: ['staff'], items: [
      { id: 'm/archive/technical', label: 'مدارک فنی', icon: '📐' }, { id: 'm/archive/quality', label: 'مدارک کیفی', icon: '🏅' },
      { id: 'm/archive/iso', label: 'فرم‌ها و ایزو', icon: '📋' }, { id: 'm/pdf', label: 'ساخت بستهٔ PDF', icon: '📑' }] }
  ] },
  { group: 'مناقصات عمومی', icon: '🛢️', not: ['staff'], items: [
    { id: 'g/dashboard', label: 'داشبورد نفت و گاز', icon: '📈' }, { id: 'g/cartable', label: 'کارتابل نفت و گاز', icon: '📥', badge: true }, { id: 'g/list', label: 'فهرست مناقصات', icon: '🗂️' }, { id: 'g/standards', label: 'استانداردها', icon: '📚' }] },
  { id: 'resume', label: 'رزومه‌ساز', icon: '🪪', not: ['staff'] },
  { group: 'مدیریت', icon: '⚙️', roles: ['super_admin'], items: [{ id: 'users', label: 'کاربران', icon: '👥' }] }
];

const App = {
  pages: {}, cur: null, notif: { items: [], unseen: 0 }, badges: {}, _dir: null,
  register(p) { this.pages[p.id] = p; },
  allowed(n) { const r = (Auth.user() || {}).role; return (!n.roles || n.roles.includes(r)) && !(n.not || []).includes(r); },

  /* ───── نمایش صفحه‌ها ───── */
  show(which) { ['loginScreen', 'pwScreen', 'appShell'].forEach(id => $('#' + id).classList.toggle('hidden', id !== which)); },
  showLogin(msg) {
    this.stopPolling(); Modal.closeAll(); this.show('loginScreen');
    const e = $('#loginError'); if (msg) { e.textContent = msg; e.classList.remove('hidden'); } else e.classList.add('hidden');
    $('#loginPass').value = ''; setTimeout(() => $('#loginUser').focus(), 30);
  },
  showChangePassword(forced) {
    this.show('pwScreen'); $('#pwError').classList.add('hidden'); ['pwCur', 'pwNew', 'pwNew2'].forEach(i => { $('#' + i).value = ''; });
    $('#pwNote').textContent = forced ? 'برای ادامه باید رمز عبور خود را تغییر دهید. اگر رمز اولیه‌تان شمارهٔ پرسنلی است، همان را به‌عنوان رمز فعلی وارد کنید.' : '';
    setTimeout(() => $('#pwCur').focus(), 30);
  },
  startApp() {
    const u = Auth.user(); this.show('appShell');
    $('#userName').textContent = u.full_name; $('#userRole').textContent = ROLES[u.role] || u.role;
    $('#btnLang').textContent = isFa() ? 'EN' : 'فا';
    this.buildNav(); this.startPolling();
    if (!location.hash || location.hash === '#/' || location.hash === '#') location.hash = '#/' + (isStaff() ? 'm/cartable' : 'm/dashboard');
    else this.route();
  },

  /* ───── منو ───── */
  buildNav() {
    const nav = $('#nav'), active = this.cur && this.cur.id;
    const openState = key => store.get('nav:' + key);
    const item = n => `<a class="nav-item" href="#/${n.id}" data-id="${n.id}"><span class="ico">${n.icon || '•'}</span><span>${esc(t(n.label))}</span>${n.badge ? `<span class="nav-badge hidden" data-badge="${n.id}"></span>` : ''}</a>`;
    const list = (items, depth) => items.filter(n => this.allowed(n)).map(n => {
      if (n.items) {
        const key = n.group || n.folder, has = this.containsId(n, active), st = openState(key);
        const open = st === '1' || (st === null && (has || n.group === 'مناقصات معدنی'));
        return `<details class="nav-group" data-key="${esc(key)}" ${open || has ? 'open' : ''}><summary class="${n.group ? 'top' : ''}"><span class="ico">${n.icon || ''}</span><span>${esc(t(key))}</span><span class="chev">◂</span></summary><div class="nav-sub">${list(n.items, depth + 1)}</div></details>`;
      }
      return item(n);
    }).join('');
    nav.innerHTML = list(NAV, 0);
    $$('details.nav-group', nav).forEach(d => d.addEventListener('toggle', () => store.set('nav:' + d.dataset.key, d.open ? '1' : '0')));
    this.markActive(); Object.entries(this.badges).forEach(([k, v]) => this.badge(k, v));
  },
  containsId(n, id) { return !!id && (n.id === id || (n.items || []).some(c => this.containsId(c, id))); },
  markActive() { $$('#nav .nav-item').forEach(a => a.classList.toggle('active', !!this.cur && a.dataset.id === (this.cur.navId || this.cur.id)));
    const on = $('#nav .nav-item.active'); if (on) { let d = on.closest('details'); while (d) { if (!d.open) d.open = true; d = d.parentElement.closest('details'); } } },
  badge(id, n) { this.badges[id] = n; const el = $(`[data-badge="${id}"]`); if (el) { el.textContent = fmtNum(n); el.classList.toggle('hidden', !n); } },

  /* ───── مسیریابی ───── */
  parseHash() { const h = decodeURIComponent((location.hash || '').replace(/^#\/?/, '')); const [path, query] = h.split('?'); return { path: path || '', query: Object.fromEntries(new URLSearchParams(query || '')) }; },
  go(path) { location.hash = '#/' + path; },
  async route() {
    if (!Auth.token() || !Auth.user()) return;
    const { path, query } = this.parseHash();
    const ids = Object.keys(this.pages).sort((a, b) => b.length - a.length);
    const id = ids.find(i => path === i || path.startsWith(i + '/'));
    let page = id && this.pages[id];
    if (!page || !this.allowed(page)) { const home = isStaff() ? 'm/cartable' : 'm/dashboard'; if (path !== home) return this.go(home); return; }
    this.cur = page; this.arg = path.slice(id.length + 1); this.query = query;
    $('#pageTitle').textContent = t(page.title);
    document.title = t(page.title) + ' — ' + t('کوشا معدن');
    this.markActive(); $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show');
    const el = $('#content'); el.innerHTML = '<div class="empty">در حال بارگذاری…</div>';
    const token = this._rt = Symbol();
    try { await page.render(el, this.arg, query); }
    catch (e) { if (token === this._rt) el.innerHTML = `<div class="card"><div class="form-error">${esc(e.message)}</div></div>`; }
    if (token === this._rt) window.scrollTo(0, 0);
  },
  refresh() { return this.route(); },
  setTitle(s) { $('#pageTitle').textContent = s; },

  /* ───── اعلان‌ها ───── */
  async loadNotifs() {
    try { this.notif = await API.get('/tenders/notifications'); } catch { return; }
    const c = $('#bellCount'); c.textContent = fmtNum(this.notif.unseen); c.classList.toggle('hidden', !this.notif.unseen);
    if (!$('#bellPanel').classList.contains('hidden')) this.renderBell();
  },
  async loadBadges() {
    try { const items = await API.get('/tenders/cartable'); this.badge('m/cartable', items.filter(x => !x.wait).length); } catch {}
    if (!isStaff()) try { const g = await API.get('/general/cartable'); this.badge('g/cartable', g.filter(x => !x.wait).length); } catch {}
  },
  renderBell() {
    const p = $('#bellPanel'), its = this.notif.items;
    const ico = { new: '🆕', deadline: '⏰', overdue: '⚠️', guarantee: '🏦', closed: '⛔', assigned: '📌', work_done: '✅', change: '🔔', comment: '💬' };
    p.innerHTML = `<div class="bell-head"><strong>${t('اعلان‌ها')}</strong>${this.notif.unseen ? '<button class="link" data-act="seen-all">علامت‌گذاری همه به‌عنوان خوانده‌شده</button>' : ''}</div>` +
      (its.length ? its.map((n, i) => `<button class="bell-item lv-${n.level} ${n.seen ? '' : 'unseen'}" data-i="${i}">${ico[n.type] || '🔔'} ${esc(n.message)}<small>${esc(n.title)}${n.tender_number ? ' · ' + esc(n.tender_number) : ''}</small></button>`).join('') : empty('اعلان جدیدی ندارید'));
  },
  async markSeen(keys) { if (!keys.length) return; try { await API.post('/tenders/notifications/seen', { keys }); } catch {} await this.loadNotifs(); },
  startPolling() { this.stopPolling(); this.loadNotifs(); this.loadBadges(); this._poll = setInterval(() => { if (!document.hidden) { this.loadNotifs(); this.loadBadges(); } }, 60000); },
  stopPolling() { clearInterval(this._poll); },

  /* ───── فهرست افراد (برای ارجاع) ───── */
  async directory() { if (!this._dir) this._dir = await API.get('/users/directory'); return this._dir; },

  /* ───── راه‌اندازی ───── */
  async boot() {
    setLang(LANG);
    // قرارداد: رمز پنهان = چشمِ خط‌خورده؛ رمز آشکار = چشمِ باز
    $('#loginEye').innerHTML = EYE_OFF; $$('[data-eye]').forEach(b => { b.innerHTML = EYE_OFF; });
    const eye = (btn, input) => btn.addEventListener('click', () => { const show = input.type === 'password'; input.type = show ? 'text' : 'password'; btn.innerHTML = show ? EYE : EYE_OFF; btn.setAttribute('aria-label', show ? 'پنهان کردن رمز' : 'نمایش رمز'); });
    eye($('#loginEye'), $('#loginPass')); $$('[data-eye]').forEach(b => eye(b, $('#' + b.dataset.eye)));

    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault(); const btn = $('#loginBtn'), err = $('#loginError'); err.classList.add('hidden');
      const username = toLatin($('#loginUser').value).trim(), password = $('#loginPass').value;
      if (!username || !password) { err.textContent = 'نام کاربری و رمز عبور را وارد کنید'; err.classList.remove('hidden'); return; }
      btn.disabled = true;
      try {
        const r = await API.post('/auth/login', { username, password });
        Auth.save(r.token, r.user); this._dir = null;
        if (r.user.must_change_password) this.showChangePassword(true); else this.startApp();
      } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
      btn.disabled = false;
    });
    $('#pwForm').addEventListener('submit', async e => {
      e.preventDefault(); const err = $('#pwError'); err.classList.add('hidden');
      try {
        await API.post('/auth/change-password', { current_password: $('#pwCur').value, new_password: $('#pwNew').value, confirm_password: $('#pwNew2').value });
        const me = await API.get('/auth/me'); Auth.save(null, me); toast('رمز عبور تغییر کرد', 'success'); this.startApp();
      } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
    });
    $('#pwLogout').addEventListener('click', () => this.logout());
    $('#btnLogout').addEventListener('click', async () => { if (await confirmBox('از سامانه خارج می‌شوید؟', 'خروج', false)) this.logout(); });
    $('#btnTheme').addEventListener('click', openThemePanel);
    $('#btnMenu').addEventListener('click', () => { $('#sidebar').classList.toggle('open'); $('#scrim').classList.toggle('show'); });
    $('#scrim').addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); });
    $('#btnLang').addEventListener('click', () => { setLang(isFa() ? 'en' : 'fa'); $('#btnLang').textContent = isFa() ? 'EN' : 'فا'; this.buildNav(); this.route(); });
    $('#btnBell').addEventListener('click', e => { e.stopPropagation(); const p = $('#bellPanel'); p.classList.toggle('hidden'); if (!p.classList.contains('hidden')) { this.renderBell(); this.loadNotifs(); } });
    $('#bellPanel').addEventListener('click', e => {
      e.stopPropagation();
      if (e.target.closest('[data-act="seen-all"]')) return this.markSeen(this.notif.items.filter(n => !n.seen).map(n => n.key));
      const b = e.target.closest('.bell-item'); if (!b) return;
      const n = this.notif.items[+b.dataset.i]; $('#bellPanel').classList.add('hidden');
      this.markSeen([n.key]); this.go('tender/' + n.tender_id);
    });
    document.addEventListener('click', () => $('#bellPanel').classList.add('hidden'));
    window.addEventListener('hashchange', () => this.route());

    if (!Auth.token()) return this.showLogin();
    try {
      const me = await API.get('/auth/me'); Auth.save(null, me);
      if (me.must_change_password) this.showChangePassword(true); else this.startApp();
    } catch { if (!Auth.token()) this.showLogin(); else this.showLogin('ارتباط با سرور برقرار نشد'); }
  },
  async logout() { try { await API.post('/auth/logout'); } catch {} Auth.clear(); this._dir = null; this.badges = {}; location.hash = ''; this.showLogin(); }
};

/* ───────── صفحهٔ کاربران (مدیر ارشد) ───────── */
const ROLE_BY_LABEL = (() => { const m = {}; Object.entries(ROLES).forEach(([k, v]) => { m[v] = k; m[k] = k; }); m['همکار'] = 'staff'; m['مدیر فنی'] = 'technical_manager'; m['کارشناس'] = 'staff'; return m; })();

App.register({ id: 'users', title: 'کاربران', roles: ['super_admin'], async render(el) {
  const draw = async () => {
    const users = await API.get('/users');
    el.innerHTML = `<div class="page-head"><h1>کاربران</h1><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="import">📥 افزودن از اکسل</button><button class="btn primary" data-act="add">+ کاربر جدید</button></div></div>
      <div class="toolbar"><label class="f grow"><span>جستجو</span><input id="uq" placeholder="نام، نام کاربری یا شمارهٔ پرسنلی"></label><label class="f"><span>نقش</span><select id="urole"><option value="">همه</option>${opts(Object.entries(ROLES), '')}</select></label></div>
      <div class="table-wrap"><table><thead><tr><th>نام</th><th>نام کاربری</th><th>شمارهٔ پرسنلی</th><th>نقش</th><th>سمت</th><th>وضعیت</th><th></th></tr></thead><tbody id="ubody"></tbody></table></div>
      <p class="muted small" style="margin-top:10px">نام کاربری و رمز اولیهٔ هر کاربر جدید، شمارهٔ پرسنلی اوست و در اولین ورود تغییر رمز اجباری است. حساب «admin» مستقل از این قاعده است.</p>`;
    const paint = () => {
      const q = toLatin($('#uq', el).value).toLowerCase(), r = $('#urole', el).value;
      const rows = users.filter(u => (!r || u.role === r) && (!q || [u.full_name, u.username, u.personnel_no, u.position].some(x => String(x || '').toLowerCase().includes(q))));
      $('#ubody', el).innerHTML = rows.map(u => `<tr><td><b>${esc(u.full_name)}</b></td><td class="ltr">${esc(u.username)}</td><td class="ltr">${esc(u.personnel_no || '—')}</td><td>${chip(ROLES[u.role] || u.role, u.role === 'staff' ? '' : 'brand')}</td><td>${esc(u.position || '—')}</td>
        <td>${u.is_active ? chip('فعال', 'ok') : chip('غیرفعال', 'bad')}${u.must_change_password ? ' ' + chip('رمز اولیه', 'warn') : ''}</td>
        <td class="acts"><button class="btn sm" data-act="edit" data-id="${u.id}">ویرایش</button> <button class="btn sm" data-act="pw" data-id="${u.id}">بازنشانی رمز</button> ${u.id === (Auth.user() || {}).id || u.username === 'admin' ? '' : `<button class="btn sm danger" data-act="del" data-id="${u.id}">حذف</button>`}</td></tr>`).join('') || `<tr><td colspan="7">${empty('کاربری یافت نشد')}</td></tr>`;
    };
    $('#uq', el).addEventListener('input', debounce(paint, 150)); $('#urole', el).addEventListener('change', paint); paint();
    el._users = users;
  };
  await draw();
  const userForm = u => `<div class="form-grid">
      <label class="field full"><span class="req">نام کامل</span><input name="full_name" value="${esc(u.full_name || '')}"></label>
      <label class="field"><span>شمارهٔ پرسنلی</span><input name="personnel_no" dir="ltr" value="${esc(u.personnel_no || '')}"></label>
      <label class="field"><span>${u.id ? 'نام کاربری' : 'نام کاربری (خالی = شمارهٔ پرسنلی)'}</span><input name="username" dir="ltr" value="${esc(u.username || '')}" ${u.id ? 'disabled' : ''}></label>
      <label class="field"><span>نقش</span><select name="role">${opts(Object.entries(ROLES), u.role || 'staff')}</select></label>
      <label class="field"><span>سمت</span><input name="position" value="${esc(u.position || '')}"></label>
      <label class="field"><span>ایمیل</span><input name="email" dir="ltr" value="${esc(u.email || '')}"></label>
      <label class="field"><span>تلفن</span><input name="phone" dir="ltr" value="${esc(u.phone || '')}"></label>
      ${u.id ? `<label class="check full"><input type="checkbox" name="is_active" ${u.is_active ? 'checked' : ''}> کاربر فعال است</label>` : `<label class="field full"><span>رمز اولیه (خالی = شمارهٔ پرسنلی)</span><input name="password" dir="ltr"></label>`}</div>`;
  el.onclick = async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, u = (el._users || []).find(x => x.id === +b.dataset.id);
    if (act === 'add') Modal.open({ title: 'کاربر جدید', html: userForm({}), actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت', cls: 'primary', run: async m => { await API.post('/users', formData(m)); toast('کاربر ثبت شد', 'success'); App._dir = null; await draw(); } }] });
    if (act === 'edit') Modal.open({ title: 'ویرایش کاربر', html: userForm(u), actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ذخیره', cls: 'primary', run: async m => { await API.put('/users/' + u.id, formData(m)); toast('ذخیره شد', 'success'); App._dir = null; await draw(); } }] });
    if (act === 'pw') Modal.open({ title: 'بازنشانی رمز: ' + u.full_name, html: `<label class="field"><span>رمز موقت جدید (حداقل ۴ کاراکتر)</span><input name="pw" dir="ltr" value="${esc(u.personnel_no || '')}"></label><p class="muted small">کاربر در اولین ورود باید رمز را تغییر دهد.</p>`,
      actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'بازنشانی', cls: 'primary', run: async m => { await API.post(`/users/${u.id}/reset-password`, { new_password: $('[name=pw]', m).value }); toast('رمز بازنشانی شد', 'success'); await draw(); } }] });
    if (act === 'del' && u && await confirmBox(`کاربر «${u.full_name}» حذف شود؟ اگر در سامانه سابقه‌ای داشته باشد (مناقصه، کامنت و …) به‌جای حذف، غیرفعال می‌شود.`, 'حذف')) {
      try { const r = await API.del('/users/' + u.id); toast(r.deleted ? 'کاربر حذف شد' : 'کاربر سابقه دارد؛ حذف کامل ممکن نبود و غیرفعال شد', r.deleted ? 'success' : 'info'); App._dir = null; await draw(); } catch (ex) { toast(ex.message, 'error'); }
    }
    if (act === 'import') importUsers(draw);
  };
} });

function importUsers(done) {
  const HEAD = ['نام و نام خانوادگی', 'شماره پرسنلی', 'سمت', 'نقش', 'ایمیل', 'تلفن'];
  let rows = [];
  const bg = Modal.open({ title: 'افزودن گروهی کاربران از اکسل', wide: true, html: `
    <p>فایل اکسل (xlsx یا csv) با ستون‌های <b>نام و نام خانوادگی</b>، <b>شماره پرسنلی</b> و در صورت نیاز <b>سمت</b>، <b>نقش</b>، <b>ایمیل</b>، <b>تلفن</b> را بارگذاری کنید. نام کاربری و رمز اولیه همان شمارهٔ پرسنلی است. اگر ستون نقش خالی باشد، «همکار» ثبت می‌شود.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><button class="btn" id="uTpl">⬇️ دریافت قالب نمونه</button><input type="file" id="uFile" accept=".xlsx,.csv" class="hidden"><button class="btn primary" id="uPick">انتخاب فایل</button></div>
    <div id="uPrev"></div>`,
  actions: [{ label: 'بستن', cls: 'ghost', run: () => true }, { label: 'ثبت کاربران', cls: 'primary', close: false, run: async m => {
    if (!rows.length) throw new Error('ابتدا فایل را انتخاب کنید');
    const rep = { created: 0, skipped: [], errors: [] };
    for (let i = 0; i < rows.length; i += 200) {
      const r = await API.post('/users/bulk', { rows: rows.slice(i, i + 200) });
      rep.created += r.created; r.skipped.forEach(x => rep.skipped.push({ ...x, row: x.row + i })); r.errors.forEach(x => rep.errors.push({ ...x, row: x.row + i }));
    }
    App._dir = null; Modal.close(bg);
    Modal.open({ title: 'نتیجهٔ افزودن کاربران', html: `<p><b>${fmtNum(rep.created)}</b> کاربر ثبت شد.</p>${rep.skipped.length ? `<h4 class="sub">ردشده (تکراری) — ${fmtNum(rep.skipped.length)}</h4><ul>${rep.skipped.map(x => `<li>ردیف ${fmtNum(x.row)}: ${esc(x.name)}</li>`).join('')}</ul>` : ''}${rep.errors.length ? `<h4 class="sub">دارای خطا — ${fmtNum(rep.errors.length)}</h4><ul>${rep.errors.map(x => `<li>ردیف ${fmtNum(x.row)} (${esc(x.name || '—')}): ${esc(x.reason)}</li>`).join('')}</ul>` : ''}`, actions: [{ label: 'بستن', cls: 'primary', run: () => true }] });
    done();
  } }] });
  $('#uTpl', bg).onclick = () => saveBlob(XL.write([{ name: 'کاربران', header: true, widths: [28, 16, 22, 22, 26, 16], rows: [HEAD, ['علی رضایی', '10234', 'کارشناس اکتشاف', 'همکار', '', ''], ['مریم احمدی', '10235', 'کارشناس مناقصات', 'کارشناس مناقصات', '', '']] }]), 'users-template.xlsx');
  $('#uPick', bg).onclick = () => $('#uFile', bg).click();
  $('#uFile', bg).onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const sh = (await XL.read(f))[0], norm = s => toLatin(s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();
      const hi = sh.rows.findIndex(r => (r || []).some(c => /نام/.test(norm(c)))); if (hi < 0) throw new Error('ستون «نام و نام خانوادگی» پیدا نشد');
      const H = sh.rows[hi].map(norm), ix = re => H.findIndex(h => re.test(h));
      const c = { n: ix(/نام/), p: ix(/پرسنلی|personnel/i), s: ix(/سمت|position/i), r: ix(/نقش|role/i), e: ix(/ایمیل|email/i), t: ix(/تلفن|phone/i) };
      if (c.p < 0) throw new Error('ستون «شماره پرسنلی» پیدا نشد');
      rows = sh.rows.slice(hi + 1).filter(r => r && r.some(x => String(x).trim())).map(r => {
        const g = i => i >= 0 ? String(r[i] ?? '').trim() : '', rl = norm(g(c.r));
        return { full_name: g(c.n), personnel_no: toLatin(g(c.p)), position: g(c.s), role: ROLE_BY_LABEL[rl] || (rl ? 'staff' : 'staff'), email: g(c.e), phone: toLatin(g(c.t)) };
      });
      $('#uPrev', bg).innerHTML = `<p><b>${fmtNum(rows.length)}</b> ردیف خوانده شد. پیش‌نمایش ۱۰ ردیف اول:</p><div class="table-wrap"><table><thead><tr><th>نام</th><th>شمارهٔ پرسنلی</th><th>سمت</th><th>نقش</th></tr></thead><tbody>${rows.slice(0, 10).map(r => `<tr><td>${esc(r.full_name)}</td><td class="ltr">${esc(r.personnel_no)}</td><td>${esc(r.position)}</td><td>${esc(ROLES[r.role])}</td></tr>`).join('')}</tbody></table></div>`;
    } catch (ex) { rows = []; $('#uPrev', bg).innerHTML = `<div class="form-error">${esc(ex.message)}</div>`; }
    ev.target.value = '';
  };
}

// فایل‌های ماژول‌ها هنگام بارگذاری خودشان را ثبت می‌کنند؛ اگر هنوز ننوشته شده باشند خطایی نمی‌دهد
