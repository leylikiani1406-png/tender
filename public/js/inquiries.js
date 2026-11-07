/* استعلام قیمت (پوشه‌های دلخواه + ردیف استعلام + پیوست) و انصراف از مناقصه (بر اساس سال) */
'use strict';
const INQ_ST = { open: 'باز', answered: 'پاسخ داده شد', selected: 'انتخاب شد', closed: 'بسته' };
const inq = { cur: null, q: '' };

App.register({ id: 'm/inquiries', title: 'استعلام قیمت', not: ['staff'], async render(el) {
  const d = await API.get('/inquiries', { parent: inq.cur, q: inq.q }), mg = d.can_manage, q = inq.q.trim();
  const form = (i, folderId) => `<div class="form-grid"><label class="field full"><span class="req">عنوان استعلام</span><input name="title" value="${esc(i.title || '')}"></label>
    <label class="field"><span>طرف استعلام (تأمین‌کننده / شرکت)</span><input name="party" value="${esc(i.party || '')}"></label><label class="field"><span>تاریخ استعلام</span>${dateField('inquiry_date', i.inquiry_date)}</label>
    <label class="field"><span>مبلغ</span>${moneyField('amount', i.amount)}</label><label class="field"><span>وضعیت</span><select name="status">${opts(Object.entries(INQ_ST), i.status || 'open')}</select></label>
    <label class="field full"><span>توضیحات</span><textarea name="description">${esc(i.description || '')}</textarea></label></div><input type="hidden" name="folder_id" value="${folderId ?? ''}">`;
  const read = m => { const b = formData(m), dt = dateVal($('[name=inquiry_date]', m)); if (!b.title.trim()) throw new Error('عنوان استعلام را وارد کنید'); if (dt === null) throw new Error('تاریخ معتبر نیست'); return { ...b, inquiry_date: dt, amount: numVal($('[name=amount]', m)) }; };
  el.innerHTML = `<div class="crumbs"><button class="link" data-open="">استعلام قیمت</button>${d.path.map(p => `<span class="muted">/</span><button class="link" data-open="${p.id}">${esc(p.name)}</button>`).join('')}</div>
    <div class="toolbar"><label class="f grow"><span>جستجو در همهٔ استعلام‌ها</span><input id="iq" value="${esc(inq.q)}" placeholder="عنوان، طرف استعلام یا توضیحات"></label><span class="spacer"></span>
      ${mg && !q ? '<button class="btn" data-act="mkdir">📁 پوشهٔ جدید</button><button class="btn primary" data-act="add">+ استعلام جدید</button>' : ''}</div>
    ${!q && d.folders.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-bottom:16px">${d.folders.map(f => `<div class="tree-row" data-open="${f.id}" style="cursor:pointer">📁 <b style="flex:1;overflow-wrap:anywhere">${esc(f.name)}</b><small class="muted">${fmtNum(f.items)}</small>${mg ? `<button class="btn sm" data-rename="${f.id}" data-name="${esc(f.name)}" title="تغییر نام">✎</button><button class="btn sm danger" data-rmdir="${f.id}" title="حذف پوشه">×</button>` : ''}</div>`).join('')}</div>` : ''}
    ${d.items.length ? `<div class="table-wrap"><table><thead><tr><th>عنوان</th><th>طرف</th><th>تاریخ</th><th>مبلغ</th><th>وضعیت</th><th>پیوست</th></tr></thead><tbody>${d.items.map(i => `<tr class="click" data-item="${i.id}"><td class="cell-name"><b>${esc(i.title)}</b></td><td>${esc(i.party || '—')}</td><td class="num">${fmtDate(i.inquiry_date)}</td><td class="num">${fmtMoney(i.amount)}</td><td>${chip(INQ_ST[i.status] || i.status, i.status === 'selected' ? 'ok' : i.status === 'closed' ? '' : 'info')}</td><td>${i.files_count ? '📎 ' + fmtNum(i.files_count) : '—'}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${!d.items.length && (q || !d.folders.length) ? empty(q ? 'موردی پیدا نشد' : mg ? 'این پوشه خالی است. پوشه بسازید یا استعلام جدید ثبت کنید.' : 'این پوشه خالی است') : ''}`;
  $('#iq', el).oninput = debounce(e => { inq.q = e.target.value; App.refresh(); }, 350);
  const go = id => { inq.cur = id ? +id : null; inq.q = ''; App.refresh(); };
  const openItem = async id => {
    const i = await API.get('/inquiries/item/' + id), files = () => i.files.length ? `<div class="filelist">${i.files.map(f => `<div class="file">📄 <span class="name">${esc(f.file_name)}</span><small>${formatSize(f.file_size)}</small><button class="btn sm" data-dl="${f.id}" data-name="${esc(f.file_name)}">دانلود</button>${mg ? `<button class="btn sm danger" data-rm="${f.id}">حذف</button>` : ''}</div>`).join('')}</div>` : empty('پیوستی نیست');
    const bg = Modal.open({ title: i.title, wide: true, html: (mg ? form(i, i.folder_id) : `<dl class="kv"><div><dt>طرف</dt><dd>${esc(i.party || '—')}</dd></div><div><dt>تاریخ</dt><dd>${fmtDate(i.inquiry_date)}</dd></div><div><dt>مبلغ</dt><dd>${fmtMoney(i.amount)}</dd></div><div><dt>وضعیت</dt><dd>${esc(INQ_ST[i.status])}</dd></div></dl><p>${esc(i.description || '')}</p>`) + `<h4 class="sub">پیوست‌ها</h4><div id="ifiles">${files()}</div>${mg ? '<label class="field" style="margin-top:10px"><span>افزودن پیوست (چند فایل)</span><input type="file" id="iAdd" multiple></label>' : ''}`,
      actions: mg ? [{ label: 'حذف استعلام', cls: 'danger', run: async () => { if (!await confirmBox('استعلام و پیوست‌هایش حذف شود؟')) return false; await API.del('/inquiries/item/' + id); toast('حذف شد', 'success'); App.refresh(); } }, { label: 'بستن', cls: 'ghost', run: () => true },
        { label: 'ذخیره', cls: 'primary', run: async m => { await API.put('/inquiries/item/' + id, read(m)); toast('ذخیره شد', 'success'); App.refresh(); } }] : [{ label: 'بستن', cls: 'primary', run: () => true }] });
    const refresh = async () => { i.files = (await API.get('/inquiries/item/' + id)).files; $('#ifiles', bg).innerHTML = files(); };
    bg.addEventListener('click', async e => { const d = e.target.closest('[data-dl]'), r = e.target.closest('[data-rm]'); if (d) downloadFile(`/inquiries/item/${id}/files/${d.dataset.dl}/download`, d.dataset.name);
      if (r && await confirmBox('این پیوست حذف شود؟')) { try { await API.del(`/inquiries/item/${id}/files/${r.dataset.rm}`); await refresh(); } catch (ex) { toast(ex.message, 'error'); } } });
    const add = $('#iAdd', bg); if (add) add.onchange = async () => { for (const f of add.files) { try { await API.upload(`/inquiries/item/${id}/files`, {}, f); } catch (ex) { toast(ex.message, 'error'); } } add.value = ''; await refresh(); };
  };
  el.onclick = async e => {
    const c = s => e.target.closest(s);
    const rn = c('[data-rename]'); if (rn) { e.stopPropagation(); return Modal.open({ title: 'تغییر نام پوشه', html: `<label class="field"><span>نام پوشه</span><input name="name" value="${esc(rn.dataset.name)}"></label>`, actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ذخیره', cls: 'primary', run: async m => { await API.put('/inquiries/folder/' + rn.dataset.rename, { name: $('[name=name]', m).value }); App.refresh(); } }] }); }
    const rd = c('[data-rmdir]'); if (rd) { e.stopPropagation(); if (await confirmBox('پوشه حذف شود؟ (فقط پوشهٔ خالی حذف می‌شود)')) { try { await API.del('/inquiries/folder/' + rd.dataset.rmdir); App.refresh(); } catch (ex) { toast(ex.message, 'error'); } } return; }
    const op = c('[data-open]'); if (op) return go(op.dataset.open);
    const it = c('[data-item]'); if (it) return openItem(+it.dataset.item);
    const a = c('[data-act]'); if (!a) return;
    if (a.dataset.act === 'mkdir') Modal.open({ title: 'پوشهٔ جدید', html: '<label class="field"><span>نام پوشه (مثلاً: استعلام تجهیزات ۱۴۰۴)</span><input name="name"></label>', actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ایجاد', cls: 'primary', run: async m => { await API.post('/inquiries/folder', { name: $('[name=name]', m).value, parent_id: inq.cur }); App.refresh(); } }] });
    if (a.dataset.act === 'add') Modal.open({ title: 'استعلام جدید', wide: true, html: form({ inquiry_date: J.today() }, inq.cur) + '<label class="field" style="margin-top:12px"><span>پیوست‌ها (چند فایل)</span><input type="file" name="fs" multiple></label>',
      actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت', cls: 'primary', run: async m => { const r = await API.post('/inquiries/item', read(m)); for (const f of $('[name=fs]', m).files) { try { await API.upload(`/inquiries/item/${r.id}/files`, {}, f); } catch (ex) { toast(ex.message, 'error'); } } toast('ثبت شد', 'success'); App.refresh(); } }] });
  };
} });

/* ───────── انصراف از مناقصه ───────── */
const wd = { year: '', q: '' };
App.register({ id: 'm/withdrawn', title: 'انصراف از مناقصه', not: ['staff'], async render(el) {
  const d = await API.get('/withdrawals', { year: wd.year, q: wd.q }), mg = d.can_manage;
  const form = x => `<div class="form-grid"><label class="field full"><span class="req">عنوان مناقصه</span><input name="title" value="${esc(x.title || '')}"></label><label class="field"><span>کارفرما</span><input name="client_name" value="${esc(x.client_name || '')}"></label>
    <label class="field"><span>تاریخ انصراف</span>${dateField('withdraw_date', x.withdraw_date)}</label><label class="field full"><span>دلیل انصراف</span><textarea name="reason">${esc(x.reason || '')}</textarea></label></div>`;
  const read = m => { const b = formData(m), dt = dateVal($('[name=withdraw_date]', m)); if (!b.title.trim()) throw new Error('عنوان مناقصه را وارد کنید'); if (dt === null) throw new Error('تاریخ معتبر نیست'); return { ...b, withdraw_date: dt }; };
  el.innerHTML = `<div class="page-head"><div class="muted">نامه‌ها و مدارک مناقصه‌هایی که از آن‌ها انصراف داده‌ایم؛ بر اساس سال قابل انتخاب است.</div>${mg ? '<button class="btn primary" data-act="add">+ ثبت انصراف</button>' : ''}</div>
    <div class="year-folders"><div class="yf ${!wd.year ? 'on' : ''}" data-year="">📁<b>همه</b></div>${d.years.map(y => `<div class="yf ${+wd.year === y ? 'on' : ''}" data-year="${y}">📁<b>${fmtYear(y)}</b></div>`).join('')}</div>
    <div class="toolbar"><label class="f grow"><span>جستجو (عنوان، کارفرما، دلیل)</span><input id="wq" value="${esc(wd.q)}"></label></div>
    <div class="table-wrap"><table><thead><tr><th>عنوان مناقصه</th><th>کارفرما</th><th>تاریخ انصراف</th><th>دلیل انصراف</th><th>پیوست</th><th></th></tr></thead><tbody>
    ${d.items.map(x => `<tr><td class="cell-name"><b>${esc(x.title)}</b></td><td>${esc(x.client_name || '—')}</td><td class="num">${fmtDate(x.withdraw_date)}</td><td style="max-width:320px">${esc(x.reason || '—')}</td><td>${x.files_count ? '📎 ' + fmtNum(x.files_count) : '—'}</td><td class="acts"><button class="btn sm" data-open="${x.id}">${mg ? 'ویرایش / نامه‌ها' : 'مشاهده'}</button></td></tr>`).join('') || `<tr><td colspan="6">${empty('انصرافی ثبت نشده است')}</td></tr>`}</tbody></table></div>`;
  $('#wq', el).oninput = debounce(e => { wd.q = e.target.value; App.refresh(); }, 350);
  const openOne = async id => {
    const x = await API.get('/withdrawals/' + id), files = () => x.files.length ? `<div class="filelist">${x.files.map(f => `<div class="file">📄 <span class="name">${esc(f.file_name)}</span><small>${formatSize(f.file_size)}</small><button class="btn sm" data-dl="${f.id}" data-name="${esc(f.file_name)}">دانلود</button>${mg ? `<button class="btn sm danger" data-rm="${f.id}">حذف</button>` : ''}</div>`).join('')}</div>` : empty('نامه‌ای پیوست نشده است');
    const bg = Modal.open({ title: x.title, wide: true, html: (mg ? form(x) : `<dl class="kv"><div><dt>کارفرما</dt><dd>${esc(x.client_name || '—')}</dd></div><div><dt>تاریخ انصراف</dt><dd>${fmtDate(x.withdraw_date)}</dd></div></dl><p>${esc(x.reason || '')}</p>`) + `<h4 class="sub">نامه‌ها و پیوست‌ها</h4><div id="wfiles">${files()}</div>${mg ? '<label class="field" style="margin-top:10px"><span>افزودن نامه / پیوست (چند فایل)</span><input type="file" id="wAdd" multiple></label>' : ''}`,
      actions: mg ? [{ label: 'حذف', cls: 'danger', run: async () => { if (!await confirmBox('این انصراف با پیوست‌هایش حذف شود؟')) return false; await API.del('/withdrawals/' + id); toast('حذف شد', 'success'); App.refresh(); } }, { label: 'بستن', cls: 'ghost', run: () => true }, { label: 'ذخیره', cls: 'primary', run: async m => { await API.put('/withdrawals/' + id, read(m)); toast('ذخیره شد', 'success'); App.refresh(); } }] : [{ label: 'بستن', cls: 'primary', run: () => true }] });
    const refresh = async () => { x.files = (await API.get('/withdrawals/' + id)).files; $('#wfiles', bg).innerHTML = files(); };
    bg.addEventListener('click', async e => { const dl = e.target.closest('[data-dl]'), r = e.target.closest('[data-rm]'); if (dl) downloadFile(`/withdrawals/${id}/files/${dl.dataset.dl}/download`, dl.dataset.name);
      if (r && await confirmBox('این پیوست حذف شود؟')) { try { await API.del(`/withdrawals/${id}/files/${r.dataset.rm}`); await refresh(); } catch (ex) { toast(ex.message, 'error'); } } });
    const add = $('#wAdd', bg); if (add) add.onchange = async () => { for (const f of add.files) { try { await API.upload(`/withdrawals/${id}/files`, {}, f); } catch (ex) { toast(ex.message, 'error'); } } add.value = ''; await refresh(); };
  };
  el.onclick = e => {
    const y = e.target.closest('[data-year]'); if (y) { wd.year = y.dataset.year; return App.refresh(); }
    const o = e.target.closest('[data-open]'); if (o) return openOne(+o.dataset.open);
    if (e.target.closest('[data-act=add]')) Modal.open({ title: 'ثبت انصراف از مناقصه', wide: true, html: form({ withdraw_date: J.today() }) + '<label class="field" style="margin-top:12px"><span>نامه‌ها و پیوست‌ها (چند فایل)</span><input type="file" name="fs" multiple></label>',
      actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت', cls: 'primary', run: async m => { const r = await API.post('/withdrawals', read(m)); for (const f of $('[name=fs]', m).files) { try { await API.upload(`/withdrawals/${r.id}/files`, {}, f); } catch (ex) { toast(ex.message, 'error'); } } toast('ثبت شد', 'success'); App.refresh(); } }] });
  };
} });
