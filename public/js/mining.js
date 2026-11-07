/* مناقصات معدنی: داشبورد (اکسل)، کارتابل، پروپوزال‌ها + ابزارهای مشترک مناقصه (TH) */
'use strict';

const TH = {
  CODE: { tech_review: 'نیازمند بررسی فنی و ارجاع', ceo_decide: 'منتظر تصمیم مدیرعامل', guarantee_request: 'درخواست ضمانت‌نامه', expert_review: 'در حال بررسی دفتر فنی', closed: 'مناقصه بسته شد',
    active: 'در حال انجام', active_guarantee_ok: 'ضمانت‌نامه دریافت شد', active_guarantee_wait: 'در انتظار ضمانت‌نامه', waiting: 'در انتظار تصمیم', my_task: 'کار ارجاع‌شده به شما', my_task_done: 'انجام شد' },
  CODE_CLS: { tech_review: 'warn', ceo_decide: 'warn', guarantee_request: 'warn', closed: 'bad', active_guarantee_ok: 'ok', my_task: 'warn', my_task_done: 'ok', active: 'info' },
  STATUS: { review: 'در حال بررسی', active: 'در حال انجام', closed: 'بسته شد', cancelled: 'لغو شده', finished: 'اتمام‌یافته' },
  STATUS_CLS: { review: 'warn', active: 'info', closed: 'bad', cancelled: 'bad', finished: 'ok' },
  canCreate: () => can('super_admin', 'procurement', 'ceo'),
  canPackage: () => can('super_admin', 'procurement', 'ceo', 'technical_manager'),
  flagChips(x) {
    const f = x.flags || [], o = [];
    if (f.includes('new')) o.push(chip('جدید', 'info'));
    if (f.includes('uploaded')) o.push(chip('بارگذاری جدید', 'brand'));
    if (f.includes('changed')) o.push(chip('اعلان تغییر', 'warn'));
    if (f.includes('overdue')) o.push(chip('مهلت گذشته', 'bad'));
    else if (f.includes('due_soon')) o.push(chip(x.days_left === 0 ? 'امروز آخرین مهلت' : `${fmtNum(x.days_left)} روز مانده`, 'warn'));
    return o.join(' ') || '<span class="muted">—</span>';
  },
  deadlineCell(d) {
    if (!d) return '—';
    const n = daysFromToday(d);
    return `${fmtDate(d)}${n != null && n >= 0 && n <= 7 ? ' ' + chip(n === 0 ? 'امروز' : fmtNum(n) + ' روز', 'warn') : n != null && n < 0 ? ' ' + chip('گذشته', 'bad') : ''}`;
  },
  filesBtn(x) { const n = (x.files || []).length || x.docs_count || 0; return n ? `<button class="btn sm" data-act="files" data-id="${x.id}">📎 ${fmtNum(n)}</button>` : '<span class="muted">—</span>'; },
  async showFiles(id, files) {
    if (!files) files = (await API.get('/tenders/' + id)).files;
    const KINDL = { tender: 'اسناد مناقصه', feasibility: 'امکان‌سنجی', guarantee: 'ضمانت‌نامه', work: 'خروجی کار ارجاعی' };
    Modal.open({ title: 'پیوست‌ها', html: files.length ? `<div class="filelist">${files.map(f => `<div class="file">📄 <span class="name">${esc(f.file_name)}</span><small>${esc(KINDL[f.kind] || '')} · ${formatSize(f.file_size)}</small><button class="btn sm" data-dl="${f.id}" data-name="${esc(f.file_name)}">دانلود</button></div>`).join('')}</div>` : empty('فایلی نیست'),
      onOpen: m => m.addEventListener('click', e => { const b = e.target.closest('[data-dl]'); if (b) downloadFile(`/tenders/${id}/files/${b.dataset.dl}/download`, b.dataset.name); }) });
  },
  // فرم ثبت مناقصهٔ جدید (گام اول گردش‌کار: بارگذاری اسناد برای مدیر دفتر فنی و مدیرعامل)
  newTender(done) {
    Modal.open({ title: 'ثبت مناقصهٔ جدید', wide: true, html: `<div class="form-grid">
      <label class="field full"><span class="req">نام مناقصه</span><input name="title"></label>
      <label class="field"><span>شمارهٔ مناقصه</span><input name="tender_number" dir="ltr"></label>
      <label class="field"><span>کارفرما</span><input name="client_name"></label>
      <label class="field"><span class="req">نوع</span><select name="kind">${opts(Object.entries(KIND), 'exploration')}</select></label>
      <label class="field"><span>دستهٔ مرحله</span><select name="package_type">${opts(Object.entries(PACKAGE), 'full')}</select></label>
      <label class="field"><span>مبلغ پایه (برآورد کارفرما)</span>${moneyField('budget')}</label>
      <label class="field"><span>مبلغ ضمانت‌نامه</span>${moneyField('guarantee_amount')}</label>
      <label class="field"><span>تاریخ دریافت مناقصه</span>${dateField('received_date', J.today())}</label>
      <label class="field"><span>مهلت ارسال پیشنهاد</span>${dateField('deadline')}</label>
      <label class="field full"><span>ریسک‌ها (اختیاری)</span><textarea name="risk_text"></textarea></label><label class="field full"><span>فرصت‌ها (اختیاری)</span><textarea name="opportunity_text"></textarea></label>
      <label class="field full"><span>توضیحات</span><textarea name="description"></textarea></label>
      <label class="field full"><span>اسناد مناقصه (می‌توانید چند فایل انتخاب کنید)</span><input type="file" name="docs" multiple></label></div>
      <p class="muted small">پس از ثبت، مناقصه همزمان به کارتابل مدیر دفتر فنی و مدیرعامل می‌رود.</p>`,
    actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت و ارسال', cls: 'primary', run: async m => {
      const d = formData(m), dl = dateVal($('[name=deadline]', m)), rd = dateVal($('[name=received_date]', m));
      if (!d.title.trim()) throw new Error('نام مناقصه را وارد کنید');
      if (dl === null) throw new Error('تاریخ مهلت معتبر نیست (نمونه: ۱۴۰۵/۰۲/۱۵)');
      const r = await API.post('/tenders', { ...d, deadline: dl, received_date: rd || '', budget: numVal($('[name=budget]', m)), guarantee_amount: numVal($('[name=guarantee_amount]', m)) });
      let bad = 0; for (const f of $('[name=docs]', m).files) { try { await API.upload(`/tenders/${r.id}/files`, { kind: 'tender' }, f); } catch (e) { bad++; toast(`${f.name}: ${e.message}`, 'error'); } }
      toast('مناقصه ثبت شد' + (bad ? ` (${fmtNum(bad)} فایل بارگذاری نشد)` : ''), 'success'); App.loadBadges(); if (done) done(r.id);
    } }] });
  }
};

/* ───────── کارتابل ───────── */
const ct = { q: '', flag: '', pkg: '', kind: '', from: '', to: '' };
App.register({ id: 'm/cartable', title: 'کارتابل مدیریت مناقصات', async render(el) {
  const items = await API.get('/tenders/cartable'), staff = isStaff();
  App.badge('m/cartable', items.filter(x => !x.wait).length);
  const canPkg = TH.canPackage() && !staff;
  const draw = () => {
    const q = toLatin(ct.q).toLowerCase(), from = J.toIso(ct.from), to = J.toIso(ct.to);
    const rows = items.filter(x => (!ct.flag || (x.flags || []).includes(ct.flag) || (ct.flag === 'action' && !x.wait)) && (!ct.pkg || x.package_type === ct.pkg) && (!ct.kind || x.kind === ct.kind)
      && (!q || [x.title, x.tender_number, x.client_name].some(s => String(s || '').toLowerCase().includes(q))) && (!from || (x.deadline || '9999') >= from) && (!to || (x.deadline || '0000') <= to));
    $('#ctBody', el).innerHTML = rows.map(x => `<tr class="click" data-id="${x.id}">
      <td class="num ltr">${esc(x.tender_number || '—')}</td>
      <td class="cell-name"><b>${esc(x.title)}</b><br><small class="muted">${esc(x.client_name || '')}${x.comments_count ? ' · 💬 ' + fmtNum(x.comments_count) : ''}${x.assignees && !staff ? ' · ارجاع: ' + esc(x.assignees) : ''}${staff && x.task ? ' · ' + esc(PART[x.part] || '') + (x.task ? ': ' + esc(x.task) : '') : ''}</small></td>
      <td>${chip(KIND[x.kind] || '', 'brand')}</td>
      <td>${canPkg && x.status !== 'finished' ? `<select data-pkg="${x.id}" aria-label="دسته">${opts(Object.entries(PACKAGE_S), x.package_type)}</select>` : chip(PACKAGE_S[x.package_type] || '')}</td>
      <td class="num">${fmtDate(x.received_date)}</td><td class="num">${TH.deadlineCell(x.deadline)}</td>
      ${staff ? '' : `<td class="num">${fmtMoney(x.budget)}</td><td class="num">${x.needs_guarantee || x.guarantee_amount ? fmtMoney(x.guarantee_amount) + (x.guarantee_status === 'received' ? ' ' + chip('دریافت شد', 'ok') : x.guarantee_status === 'pending' ? ' ' + chip('در انتظار', 'warn') : '') : '—'}</td>`}
      <td>${TH.flagChips(x)}</td><td>${TH.filesBtn(x)}</td>
      <td>${chip(TH.CODE[x.code] || x.code, TH.CODE_CLS[x.code] || '')}${x.wait ? '' : ' <b style="color:var(--primary)">●</b>'}</td></tr>`).join('') || `<tr><td colspan="12">${empty('مناقصه‌ای با این شرایط در کارتابل نیست')}</td></tr>`;
  };
  el.innerHTML = `<div class="page-head"><div class="muted">مناقصه‌های منتظر اقدام شما با نقطهٔ ● مشخص شده‌اند.</div>${TH.canCreate() ? '<button class="btn primary" data-act="new">+ ثبت مناقصهٔ جدید</button>' : ''}</div>
    ${staff ? '' : '<div id="ctDecision"></div>'}
    <div class="toolbar"><label class="f grow"><span>جستجو (نام، شماره، کارفرما)</span><input id="ctq" value="${esc(ct.q)}"></label>
      <label class="f"><span>اعلان</span><select id="ctflag"><option value="">همه</option>${opts([['action', 'نیازمند اقدام من'], ['new', 'جدید'], ['changed', 'اعلان تغییر'], ['uploaded', 'بارگذاری جدید'], ['due_soon', 'مهلت نزدیک'], ['overdue', 'مهلت گذشته']], ct.flag)}</select></label>
      <label class="f"><span>دسته</span><select id="ctpkg"><option value="">همه</option>${opts(Object.entries(PACKAGE), ct.pkg)}</select></label>
      <label class="f"><span>نوع</span><select id="ctkind"><option value="">همه</option>${opts(Object.entries(KIND), ct.kind)}</select></label>
      <label class="f"><span>مهلت از</span>${dateField('from', ct.from ? J.toIso(ct.from) : '')}</label><label class="f"><span>تا</span>${dateField('to', ct.to ? J.toIso(ct.to) : '')}</label></div>
    <div class="table-wrap"><table><thead><tr><th>شماره</th><th>نام مناقصه</th><th>نوع</th><th>دسته مرحله</th><th>تاریخ دریافت</th><th>مهلت ارسال</th>${staff ? '' : '<th>مبلغ پایه</th><th>مبلغ ضمانت‌نامه</th>'}<th>اعلان</th><th>پیوست</th><th>وضعیت من</th></tr></thead><tbody id="ctBody"></tbody></table></div>`;
  draw();
  if (!staff && window.DC) DC.decisionPanel($('#ctDecision', el));
  const bind = (id, k, ev = 'input') => $('#' + id, el).addEventListener(ev, e => { ct[k] = e.target.value; draw(); });
  bind('ctq', 'q'); bind('ctflag', 'flag', 'change'); bind('ctpkg', 'pkg', 'change'); bind('ctkind', 'kind', 'change');
  $('[name=from]', el).addEventListener('change', e => { ct.from = e.target.value; draw(); }); $('[name=to]', el).addEventListener('change', e => { ct.to = e.target.value; draw(); });
  el.onclick = async e => {
    if (e.target.closest('select')) return;
    const nb = e.target.closest('[data-act=new]'); if (nb) return TH.newTender(id => App.go('tender/' + id));
    const fb = e.target.closest('[data-act=files]'); if (fb) { e.stopPropagation(); const x = items.find(i => i.id === +fb.dataset.id); return TH.showFiles(x.id, x.files); }
    const tr = e.target.closest('tr.click'); if (tr) App.go('tender/' + tr.dataset.id);
  };
  el.onchange = async e => {
    const s = e.target.closest('[data-pkg]'); if (!s) return;
    try { await API.put(`/tenders/${s.dataset.pkg}/package`, { package_type: s.value }); items.find(i => i.id === +s.dataset.pkg).package_type = s.value; toast('دستهٔ مرحله تغییر کرد', 'success'); } catch (ex) { toast(ex.message, 'error'); App.refresh(); }
  };
} });

/* ───────── پروپوزال‌ها ───────── */
const pr = { bucket: 'running', q: '', status: '', from: '', to: '', sort: 'newest' };
App.register({ id: 'm/proposals', title: 'پروپوزال‌ها', not: ['staff'], async render(el) {
  const manage = can('super_admin', 'ceo', 'technical_manager', 'technical_expert', 'procurement');
  const from = J.toIso(pr.from), to = J.toIso(pr.to);
  const list = await API.get('/proposals', { bucket: pr.bucket, q: pr.q, status: pr.status, date_from: from, date_to: to, sort: pr.sort });
  el.innerHTML = `<div class="page-head"><div class="tabs" style="margin:0;border:0"><button class="tab ${pr.bucket === 'running' ? 'on' : ''}" data-b="running">در حال انجام</button><button class="tab ${pr.bucket === 'done' ? 'on' : ''}" data-b="done">نتیجه‌گرفته</button><button class="tab ${pr.bucket === '' ? 'on' : ''}" data-b="">همه</button></div>${manage ? '<button class="btn primary" data-act="add">+ پروپوزال جدید</button>' : ''}</div>
    <div class="toolbar"><label class="f grow"><span>جستجو (نام، شمارهٔ مناقصه، کارفرما)</span><input id="prq" value="${esc(pr.q)}"></label>
      <label class="f"><span>وضعیت</span><select id="prst"><option value="">همه</option>${opts(Object.entries(PROP_STATUS), pr.status)}</select></label>
      <label class="f"><span>ارسال از</span>${dateField('from', from)}</label><label class="f"><span>تا</span>${dateField('to', to)}</label>
      <label class="f"><span>مرتب‌سازی</span><select id="prsort">${opts([['newest', 'جدیدترین'], ['sent', 'تاریخ ارسال'], ['amount_desc', 'بیشترین مبلغ'], ['amount_asc', 'کمترین مبلغ'], ['name', 'نام']], pr.sort)}</select></label>
      <button class="btn" data-act="xls">⬇️ خروجی اکسل</button></div>
    <div class="table-wrap"><table><thead><tr><th>نام پروپوزال</th><th>تاریخ ارسال</th><th>وضعیت</th><th>مبلغ پیشنهادی</th><th>شمارهٔ مناقصه</th><th>پیوست</th><th></th></tr></thead><tbody>
    ${list.map(p => `<tr><td><b>${esc(p.title)}</b><br><small class="muted">${esc(p.client_name || '')}</small></td><td class="num">${fmtDate(p.sent_date)}</td>
      <td>${manage ? `<select data-st="${p.id}">${opts(Object.entries(PROP_STATUS), p.status)}</select>` : chip(PROP_STATUS[p.status])}</td><td class="num">${fmtMoney(p.offer_amount)}</td><td class="ltr">${esc(p.tender_number || '—')}</td>
      <td><button class="btn sm" data-act="open" data-id="${p.id}">📎 ${fmtNum(p.files_count)}</button></td><td class="acts"><button class="btn sm" data-act="open" data-id="${p.id}">${manage ? 'ویرایش' : 'مشاهده'}</button></td></tr>`).join('') || `<tr><td colspan="7">${empty('پروپوزالی یافت نشد')}</td></tr>`}</tbody></table></div>`;
  const re = debounce(() => App.refresh(), 350);
  $('#prq', el).oninput = e => { pr.q = e.target.value; re(); };
  $('#prst', el).onchange = e => { pr.status = e.target.value; App.refresh(); }; $('#prsort', el).onchange = e => { pr.sort = e.target.value; App.refresh(); };
  $('[name=from]', el).onchange = e => { pr.from = e.target.value; App.refresh(); }; $('[name=to]', el).onchange = e => { pr.to = e.target.value; App.refresh(); };
  $$('.tab', el).forEach(b => b.onclick = () => { pr.bucket = b.dataset.b; App.refresh(); });
  const form = p => `<div class="form-grid"><label class="field full"><span class="req">نام پروپوزال</span><input name="title" value="${esc(p.title || '')}"></label>
      <label class="field"><span>شمارهٔ مناقصه</span><input name="tender_number" dir="ltr" value="${esc(p.tender_number || '')}"></label><label class="field"><span>کارفرما</span><input name="client_name" value="${esc(p.client_name || '')}"></label>
      <label class="field"><span>تاریخ ارسال</span>${dateField('sent_date', p.sent_date)}</label><label class="field"><span>وضعیت</span><select name="status">${opts(Object.entries(PROP_STATUS), p.status || 'draft')}</select></label>
      <label class="field"><span>مبلغ پیشنهادی</span>${moneyField('offer_amount', p.offer_amount)}</label><label class="field full"><span>توضیحات</span><textarea name="description">${esc(p.description || '')}</textarea></label></div>`;
  const save = async (m, id) => {
    const d = formData(m), sd = dateVal($('[name=sent_date]', m)); if (!d.title.trim()) throw new Error('نام پروپوزال را وارد کنید'); if (sd === null) throw new Error('تاریخ ارسال معتبر نیست');
    const body = { ...d, sent_date: sd, offer_amount: numVal($('[name=offer_amount]', m)) };
    return id ? (await API.put('/proposals/' + id, body), id) : (await API.post('/proposals', body)).id;
  };
  el.onclick = async e => {
    if (e.target.closest('select')) return;
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'add') Modal.open({ title: 'پروپوزال جدید', wide: true, html: form({}) + '<label class="field" style="margin-top:12px"><span>پیوست‌ها (چند فایل)</span><input type="file" name="fs" multiple></label>',
      actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت', cls: 'primary', run: async m => { const id = await save(m); for (const f of $('[name=fs]', m).files) { try { await API.upload(`/proposals/${id}/files`, {}, f); } catch (ex) { toast(ex.message, 'error'); } } toast('ثبت شد', 'success'); App.refresh(); } }] });
    if (b.dataset.act === 'open') openProposal(+b.dataset.id, manage);
    if (b.dataset.act === 'xls') saveBlob(XL.write([{ name: 'پروپوزال‌ها', header: true, widths: [34, 14, 14, 18, 16, 26], rows: [['نام پروپوزال', 'تاریخ ارسال', 'وضعیت', 'مبلغ پیشنهادی', 'شماره مناقصه', 'کارفرما'], ...list.map(p => [p.title, p.sent_date ? fmtDate(p.sent_date) : '', PROP_STATUS[p.status], p.offer_amount == null ? '' : Number(p.offer_amount), p.tender_number || '', p.client_name || ''])] }]), 'proposals.xlsx');
  };
  el.onchange = async e => { const s = e.target.closest('[data-st]'); if (!s) return; try { await API.put(`/proposals/${s.dataset.st}/status`, { status: s.value }); toast('وضعیت تغییر کرد', 'success'); App.refresh(); } catch (ex) { toast(ex.message, 'error'); } };
  async function openProposal(id, mg) {
    const p = await API.get('/proposals/' + id);
    const filesHtml = () => p.files.length ? `<div class="filelist">${p.files.map(f => `<div class="file">📄 <span class="name">${esc(f.file_name)}</span><small>${formatSize(f.file_size)}</small><button class="btn sm" data-dl="${f.id}" data-name="${esc(f.file_name)}">دانلود</button>${mg ? `<button class="btn sm danger" data-rm="${f.id}">حذف</button>` : ''}</div>`).join('')}</div>` : empty('پیوستی نیست');
    const bg = Modal.open({ title: p.title, wide: true, html: (mg ? form(p) : `<dl class="kv"><div><dt>تاریخ ارسال</dt><dd>${fmtDate(p.sent_date)}</dd></div><div><dt>وضعیت</dt><dd>${esc(PROP_STATUS[p.status])}</dd></div><div><dt>مبلغ</dt><dd>${fmtMoney(p.offer_amount)}</dd></div></dl>`) +
      `<h4 class="sub">پیوست‌ها</h4><div id="pfiles">${filesHtml()}</div>${mg ? '<label class="field" style="margin-top:10px"><span>افزودن پیوست</span><input type="file" id="pfAdd" multiple></label>' : ''}`,
    actions: mg ? [{ label: 'حذف پروپوزال', cls: 'danger', run: async () => { if (!await confirmBox('پروپوزال و پیوست‌هایش حذف شود؟')) return false; await API.del('/proposals/' + id); toast('حذف شد', 'success'); App.refresh(); } },
      { label: 'بستن', cls: 'ghost', run: () => true }, { label: 'ذخیره', cls: 'primary', run: async m => { await save(m, id); toast('ذخیره شد', 'success'); App.refresh(); } }] : [{ label: 'بستن', cls: 'primary', run: () => true }] });
    const refreshFiles = async () => { const n = await API.get('/proposals/' + id); p.files = n.files; $('#pfiles', bg).innerHTML = filesHtml(); };
    bg.addEventListener('click', async e => {
      const d = e.target.closest('[data-dl]'), r = e.target.closest('[data-rm]');
      if (d) downloadFile(`/proposals/${id}/files/${d.dataset.dl}/download`, d.dataset.name);
      if (r && await confirmBox('این پیوست حذف شود؟')) { try { await API.del(`/proposals/${id}/files/${r.dataset.rm}`); await refreshFiles(); } catch (ex) { toast(ex.message, 'error'); } }
    });
    const add = $('#pfAdd', bg); if (add) add.onchange = async () => { for (const f of add.files) { try { await API.upload(`/proposals/${id}/files`, {}, f); } catch (ex) { toast(ex.message, 'error'); } } add.value = ''; await refreshFiles(); };
  }
} });
