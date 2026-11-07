/* مناقصات معدنی: در حال انجام، اتمام‌یافته (فرم‌ها و امتیاز)، و صفحهٔ جزئیات مناقصه (گردش‌کار، ارجاع، فایل‌ها) */
'use strict';

const FEAS = [['f1', 'سوابق اجرایی کارهای مشابه ۱۰ سال گذشته'], ['f2', 'لیست مدیران و مدارک تحصیلی و سوابق'], ['f3', 'نظام‌نامه، مستندسازی و عضویت در جوامع فنی'],
  ['f4', 'آخرین صورت‌های مالی حسابرسی‌شده'], ['f5', 'گواهی‌نامه صلاحیت مشاوره معتبر'], ['f6', 'گواهی‌نامه‌های تضمین کیفیت و رضایت کارفرمایان'],
  ['f7', 'رزومه فنی و لیست بیمه شغلی کارکنان کلیدی'], ['f8', 'لیست نرم‌افزارها و روش‌های نوین اکتشاف'], ['f9', 'ثبت شرکت یا دفتر دائم در استان اجرای پروژه']];
const CHK = [
  ['عمومی', '', [['g1', 'دریافت اسناد از سامانه ستاد و بررسی شرایط عمومی', 0], ['g2', 'مهر و امضای اوراق «روش ارزیابی پیشنهادها»', 0], ['g3', 'بارگذاری پاکت‌ها در سامانه تدارکات الکترونیکی دولت', 0], ['g4', 'ارسال پیشنهاد در مهلت تعیین‌شده', 0]]],
  ['ارزیابی کیفی (پاکت الف)', 'حداقل امتیاز لازم: ۶۰ از ۱۰۰', [['q1', 'سابقه اجرایی در زمینه کار', 30], ['q2', 'مدیریت کارآمد و سیستم اجرای کار', 20], ['q3', 'قدرت مالی و پشتیبانی', 30], ['q4', 'نظام کیفی و حسن سابقه در کارهای قبلی', 15], ['q5', 'بومی بودن', 5]]],
  ['ارزیابی فنی (پاکت ج)', 'حداقل امتیاز لازم: ۶۰ از ۱۰۰', [['t1', 'کارکنان کلیدی مؤثر در انجام خدمات', 50], ['t2', 'امتیاز ارزیابی کیفی', 20], ['t3', 'روش‌شناسی (متدولوژی)', 20], ['t4', 'روش‌های نوین و آخرین نرم‌افزارهای حوزه اکتشاف', 10]]]];
const SUBMIT_OPTS = [['running', 'در حال انجام'], ['sending', 'در حال ارسال'], ['sent', 'ارسال شده'], ['awaiting_winner', 'منتظر اعلام برنده'], ['cancelled', 'لغو شده']];
const RESULT_LBL = { won: 'برنده', lost: 'بازنده' };
const canStatus = () => can('super_admin', 'procurement', 'ceo');

/* انتخاب وضعیت یک مناقصه در حال انجام (با تأیید برای لغو) */
async function setTenderStatus(id, value) {
  let note = '';
  if (value === 'cancelled') {
    note = await new Promise(res => { let v = null; Modal.open({ title: 'لغو مناقصه', html: '<label class="field"><span>علت لغو (اختیاری)</span><textarea name="n"></textarea></label>', actions: [{ label: 'انصراف', cls: 'ghost', run: () => { res(null); } }, { label: 'لغو مناقصه', cls: 'danger', run: m => { res($('[name=n]', m).value); } }] }); });
    if (note === null) return false;
  }
  await API.post(`/tenders/${id}/status`, { value, note }); toast('وضعیت ذخیره شد', 'success'); App.loadBadges(); return true;
}
const stageCell = x => {
  if (x.status === 'review') return chip(x.tech_done ? 'منتظر تصمیم مدیرعامل' : x.ceo_decision ? 'در حال بررسی' : 'بررسی فنی و تصمیم مدیرعامل', 'warn');
  if (x.status === 'active' && canStatus()) return `<select data-st="${x.id}">${opts(SUBMIT_OPTS, x.submit_status || 'running')}</select>`;
  if (x.status === 'active') return chip(SUBMIT[x.submit_status] || 'در حال انجام', 'info');
  return chip(TH.STATUS[x.status] || x.status, TH.STATUS_CLS[x.status]);
};

/* ───────── در حال انجام ───────── */
const run = { kind: '', q: '', stage: '', from: '', to: '', sort: 'newest' };
App.register({ id: 'm/running', title: 'مناقصات در حال انجام', not: ['staff'], async render(el) {
  const from = J.toIso(run.from), to = J.toIso(run.to);
  const list = await API.get('/tenders', { bucket: 'running', kind: run.kind, q: run.q, date_from: from, date_to: to, sort: run.sort,
    status: ['review', 'active'].includes(run.stage) ? run.stage : '', submit_status: ['sending', 'sent', 'awaiting_winner'].includes(run.stage) ? run.stage : '' });
  const count = k => list.length;
  el.innerHTML = `<div class="page-head"><div class="tabs" style="margin:0;border:0"><button class="tab ${!run.kind ? 'on' : ''}" data-k="">همه</button><button class="tab ${run.kind === 'exploration' ? 'on' : ''}" data-k="exploration">اکتشافی</button><button class="tab ${run.kind === 'supervision' ? 'on' : ''}" data-k="supervision">نظارتی</button></div>${TH.canCreate() ? '<button class="btn primary" data-act="new">+ ثبت مناقصهٔ جدید</button>' : ''}</div>
    <div class="toolbar"><label class="f grow"><span>جستجو (نام، شماره، کارفرما)</span><input id="rq" value="${esc(run.q)}"></label>
      <label class="f"><span>مرحله</span><select id="rstage"><option value="">همه</option>${opts([['review', 'در حال بررسی (گردش‌کار)'], ['active', 'در حال انجام'], ['sending', 'در حال ارسال'], ['sent', 'ارسال شده'], ['awaiting_winner', 'منتظر اعلام برنده']], run.stage)}</select></label>
      <label class="f"><span>مهلت از</span>${dateField('from', from)}</label><label class="f"><span>تا</span>${dateField('to', to)}</label>
      <label class="f"><span>مرتب‌سازی</span><select id="rsort">${opts([['newest', 'جدیدترین'], ['deadline', 'نزدیک‌ترین مهلت'], ['amount_desc', 'بیشترین مبلغ'], ['name', 'نام']], run.sort)}</select></label></div>
    <div class="table-wrap"><table><thead><tr><th>شماره</th><th>نام مناقصه</th><th>کارفرما</th><th>نوع</th><th>مرحله</th><th>مهلت ارسال</th><th>مبلغ پایه</th><th></th></tr></thead><tbody>
    ${list.map(x => `<tr class="click" data-id="${x.id}"><td class="ltr num">${esc(x.tender_number || '—')}</td><td class="cell-name"><b>${esc(x.title)}</b><br><small class="muted">${chip(PACKAGE_S[x.package_type] || '')}</small></td><td>${esc(x.client_name || '—')}</td>
      <td>${chip(KIND[x.kind] || '', 'brand')}</td><td>${stageCell(x)}</td><td class="num">${TH.deadlineCell(x.deadline)}</td><td class="num">${fmtMoney(x.budget)}</td>
      <td class="acts">${x.status === 'active' && can('super_admin', 'procurement', 'ceo') ? `<button class="btn sm ok" data-fin="${x.id}">اتمام مناقصه</button> ` : ''}<button class="btn sm" data-open="${x.id}">مشاهده</button></td></tr>`).join('') || `<tr><td colspan="8">${empty('مناقصه‌ای در حال انجام نیست')}</td></tr>`}</tbody></table></div>`;
  const re = debounce(() => App.refresh(), 350);
  $('#rq', el).oninput = e => { run.q = e.target.value; re(); }; $('#rstage', el).onchange = e => { run.stage = e.target.value; App.refresh(); }; $('#rsort', el).onchange = e => { run.sort = e.target.value; App.refresh(); };
  $('[name=from]', el).onchange = e => { run.from = e.target.value; App.refresh(); }; $('[name=to]', el).onchange = e => { run.to = e.target.value; App.refresh(); };
  $$('.tab', el).forEach(b => b.onclick = () => { run.kind = b.dataset.k; App.refresh(); });
  el.onclick = async e => {
    if (e.target.closest('select')) return;
    if (e.target.closest('[data-act=new]')) return TH.newTender(id => App.go('tender/' + id));
    const f = e.target.closest('[data-fin]'); if (f) { e.stopPropagation(); if (await confirmBox('مناقصه به «اتمام‌یافته» منتقل شود؟ پس از آن می‌توانید فرم‌ها و امتیازها را ثبت کنید.', 'اتمام مناقصه', false)) { try { await API.post(`/tenders/${f.dataset.fin}/finish`, {}); toast('مناقصه به اتمام‌یافته‌ها منتقل شد', 'success'); fin.sel = +f.dataset.fin; App.go('m/finished'); } catch (ex) { toast(ex.message, 'error'); } } return; }
    const tr = e.target.closest('tr.click'); if (tr) App.go('tender/' + tr.dataset.id);
  };
  el.onchange = async e => { const s = e.target.closest('[data-st]'); if (!s) return; try { if (!await setTenderStatus(s.dataset.st, s.value)) return App.refresh(); App.refresh(); } catch (ex) { toast(ex.message, 'error'); App.refresh(); } };
} });

/* ───────── فرم‌های امکان‌سنجی، چک‌لیست و نتیجه ───────── */
function mountForms(box, t, perm, onSaved) {
  const feas = t.feasibility || {}, chk = t.checklist || {}, res = t.result_form || {};
  const canF = perm.form, canR = perm.result;
  let tab = store.get('ftab') || 'feas';
  const feasFiles = () => (t.files || []).filter(f => f.kind === 'feasibility');
  const draw = () => {
    const ready = FEAS.filter(([k]) => (feas[k] || '') === 'ready').length;
    const tabs = [['feas', 'Document Feasibility'], ['check', 'Tender Checklist'], ['result', 'Result Form']];
    let body = '';
    if (tab === 'feas') body = `<div class="card"><h3>امکان‌سنجی مدارک مورد نیاز</h3><div style="display:flex;gap:10px;align-items:center;margin-bottom:8px"><div class="progress" style="flex:1"><i style="width:${pct(ready, FEAS.length)}%"></i></div><span class="muted">${fmtNum(ready)} از ${fmtNum(FEAS.length)} مدرک آماده است</span></div>
      ${FEAS.map(([k, n]) => `<div class="tree-row" style="margin-bottom:6px"><span style="flex:1">${n}</span><select style="width:150px" name="${k}" ${canF ? '' : 'disabled'}>${opts([['', '—'], ['ready', 'آماده است'], ['prep', 'در حال تهیه'], ['none', 'موجود نیست']], feas[k] || '')}</select></div>`).join('')}
      <div class="form-grid" style="margin-top:10px"><label class="field"><span>جمع‌بندی</span><select name="conclusion" ${canF ? '' : 'disabled'}>${opts([['', 'انتخاب کنید'], ['ok', 'امکان‌پذیر است'], ['act', 'نیازمند اقدام'], ['no', 'امکان‌پذیر نیست']], feas.conclusion || '')}</select></label>
        <label class="field full"><span>توضیحات</span><textarea name="notes" ${canF ? '' : 'disabled'}>${esc(feas.notes || '')}</textarea></label></div>
      <h4 class="sub">پیوست‌های امکان‌سنجی</h4><div class="filelist">${feasFiles().map(f => `<div class="file">📄 <span class="name">${esc(f.file_name)}</span><button class="btn sm" data-dl="${f.id}" data-name="${esc(f.file_name)}">دانلود</button>${perm.files.feasibility ? `<button class="btn sm danger" data-rm="${f.id}">حذف</button>` : ''}</div>`).join('') || '<span class="muted">پیوستی نیست</span>'}</div>
      ${perm.files.feasibility ? '<label class="field" style="margin-top:8px"><span>افزودن پیوست</span><input type="file" id="feasAdd" multiple></label>' : ''}</div>`;
    if (tab === 'check') body = '<p class="muted">بر اساس جدول‌های ارزیابی کیفی و فنی اسناد مناقصه. امتیاز نمایش‌داده‌شده، مجموع وزن مواردِ انجام‌شده است.</p>' + CHK.map(([title, hint, items]) => {
      const sc = items.reduce((a, i) => a + (chk[i[0]] ? i[2] : 0), 0), w = items.reduce((a, i) => a + i[2], 0);
      return `<div class="card" style="margin-bottom:12px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px"><h3 style="margin:0">${title}</h3><span class="muted small">${hint}</span><span class="spacer"></span>${w ? chip(`امتیاز ${fmtNum(sc)} از ${fmtNum(w)}`, sc >= 60 ? 'ok' : 'warn') : chip(`${fmtNum(items.filter(i => chk[i[0]]).length)} از ${fmtNum(items.length)}`)}</div>
        ${items.map(([k, n, wt]) => `<label class="check tree-row" style="margin-bottom:5px"><input type="checkbox" name="${k}" ${chk[k] ? 'checked' : ''} ${canF ? '' : 'disabled'}><span style="flex:1">${n}</span>${wt ? `<small class="muted">${fmtNum(wt)} امتیاز</small>` : ''}</label>`).join('')}</div>`; }).join('');
    if (tab === 'result') body = `<div class="card"><h3>نتیجهٔ مناقصه و امتیازها</h3>${t.status !== 'finished' ? '<p class="muted small">نتیجه معمولاً پس از اتمام مناقصه ثبت می‌شود.</p>' : ''}<div class="form-grid">
      <label class="field"><span>نتیجه</span><select name="outcome" ${canR ? '' : 'disabled'}>${opts([['', 'در انتظار اعلام'], ['won', 'برنده شدیم'], ['lost', 'بازنده شدیم']], res.outcome || '')}</select></label>
      <label class="field"><span>روش برنده شدن</span><select name="via" ${canR ? '' : 'disabled'}>${opts([['tender', 'مناقصه'], ['proposal', 'پروپوزال']], res.via || 'tender')}</select></label>
      <label class="field"><span>مبلغ قرارداد</span>${moneyField('amount', res.amount, canR ? '' : 'disabled')}</label>
      <label class="field"><span>رتبهٔ ما</span><input name="rank" inputmode="numeric" value="${esc(res.rank ?? '')}" ${canR ? '' : 'disabled'}></label>
      <label class="field"><span>امتیاز کیفی</span><input name="score_quality" inputmode="decimal" dir="ltr" value="${esc(res.score_quality ?? '')}" ${canR ? '' : 'disabled'}></label>
      <label class="field"><span>امتیاز فنی</span><input name="score_technical" inputmode="decimal" dir="ltr" value="${esc(res.score_technical ?? '')}" ${canR ? '' : 'disabled'}></label>
      <label class="field"><span>امتیاز مالی (قیمت)</span><input name="score_price" inputmode="decimal" dir="ltr" value="${esc(res.score_price ?? '')}" ${canR ? '' : 'disabled'}></label>
      <label class="field"><span>امتیاز کل</span><input name="score_total" inputmode="decimal" dir="ltr" value="${esc(res.score_total ?? '')}" ${canR ? '' : 'disabled'}></label>
      <label class="field full"><span>نام برنده (در صورت باخت)</span><input name="winner" value="${esc(res.winner || '')}" ${canR ? '' : 'disabled'}></label>
      <label class="field full"><span>توضیحات و درس‌آموخته‌ها</span><textarea name="note" ${canR ? '' : 'disabled'}>${esc(res.note || '')}</textarea></label></div></div>`;
    box.innerHTML = `<div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>${body}
      ${(tab === 'result' ? canR : canF) ? '<div style="margin-top:12px"><button class="btn primary" data-save>ذخیرهٔ این فرم</button></div>' : '<p class="muted small" style="margin-top:10px">شما فقط اجازهٔ مشاهدهٔ این فرم را دارید.</p>'}`;
  };
  const collect = () => {
    const o = {};
    $$('[name]', box).forEach(el => { if (el.disabled) return; if (el.type === 'checkbox') o[el.name] = el.checked; else if (el.classList.contains('money')) { const v = numVal(el); if (v !== '' && v !== null) o[el.name] = v; } else o[el.name] = el.value.trim(); });
    return o;
  };
  box.onclick = async e => {
    const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; store.set('ftab', tab); return draw(); }
    const dl = e.target.closest('[data-dl]'); if (dl) return downloadFile(`/tenders/${t.id}/files/${dl.dataset.dl}/download`, dl.dataset.name);
    const rm = e.target.closest('[data-rm]'); if (rm) { if (await confirmBox('این پیوست حذف شود؟')) { try { await API.del(`/tenders/${t.id}/files/${rm.dataset.rm}`); t.files = t.files.filter(f => f.id !== +rm.dataset.rm); draw(); } catch (ex) { toast(ex.message, 'error'); } } return; }
    if (e.target.closest('[data-save]')) {
      try {
        const name = tab === 'feas' ? 'feasibility' : tab === 'check' ? 'checklist' : 'result', data = collect();
        if (name === 'result') for (const k of ['score_quality', 'score_technical', 'score_price', 'score_total']) { const v = toLatin(data[k] || ''); if (v !== '' && isNaN(Number(v))) throw new Error('امتیازها باید عدد باشند'); data[k] = v === '' ? '' : Number(v); }
        if (name === 'result' && data.rank) data.rank = toLatin(data.rank);
        const merged = { ...(name === 'feasibility' ? feas : name === 'checklist' ? chk : res), ...data };
        await API.put(`/tenders/${t.id}/forms/${name}`, { data: merged });
        if (name === 'feasibility') Object.assign(feas, merged); else if (name === 'checklist') Object.assign(chk, merged); else Object.assign(res, merged);
        toast('ذخیره شد', 'success'); draw(); if (onSaved) onSaved();
      } catch (ex) { toast(ex.message, 'error'); }
    }
  };
  box.onchange = async e => {
    if (e.target.id !== 'feasAdd') return;
    for (const f of e.target.files) { try { await API.upload(`/tenders/${t.id}/files`, { kind: 'feasibility' }, f); } catch (ex) { toast(ex.message, 'error'); } }
    const n = await API.get('/tenders/' + t.id); t.files = n.files; draw();
  };
  draw();
}

/* ───────── اتمام‌یافته: انتخابگر، سه فرم، امتیازدهی، مرتب‌سازی و خروجی اکسل ───────── */
const fin = { sel: null, q: '', from: '', to: '', result: '', kind: '', sort: 'newest', year: '' };
const tYear = x => x.year_j || ((J.parts(String(x.deadline || x.received_date || x.created_at || '').slice(0, 10)) || [])[0]) || null;
App.register({ id: 'm/finished', title: 'مناقصات اتمام‌یافته', not: ['staff'], async render(el) {
  const from = J.toIso(fin.from), to = J.toIso(fin.to);
  const all = await API.get('/tenders', { bucket: 'done', q: fin.q, kind: fin.kind, result: fin.result, date_from: from, date_to: to, sort: fin.sort });
  const yc = {}; all.forEach(x => { const y = tYear(x); if (y) yc[y] = (yc[y] || 0) + 1; });
  const yrs = Object.keys(yc).map(Number).sort((a, b) => b - a), list = fin.year ? all.filter(x => tYear(x) === +fin.year) : all;
  const canR = can('super_admin', 'procurement', 'ceo');
  if (fin.sel && !list.some(x => x.id === fin.sel)) fin.sel = null;
  const lbl = x => (x.tender_number ? x.tender_number + ' — ' : '') + x.title;
  el.innerHTML = `<div class="page-head"><div class="muted">مناقصه‌های هر سال در یک پوشه نگه‌داری می‌شود؛ داشبورد از همین اطلاعات می‌خواند.</div>${canR ? '<button class="btn primary" data-act="arch-add">+ افزودن مناقصهٔ سال‌های قبل</button>' : ''}</div>
    <div class="year-folders"><div class="yf ${!fin.year ? 'on' : ''}" data-year="">📁<b>همه</b><small class="muted">${fmtNum(all.length)} مناقصه</small></div>${yrs.map(y => `<div class="yf ${+fin.year === y ? 'on' : ''}" data-year="${y}">📁<b>${fmtYear(y)}</b><small class="muted">${fmtNum(yc[y])} مناقصه</small></div>`).join('')}</div>
    <div class="card" style="margin-bottom:14px"><h3>انتخاب مناقصه</h3><div style="display:flex;gap:10px;flex-wrap:wrap"><select id="fsel" style="flex:1;min-width:260px"><option value="">— یک مناقصه را برای ثبت یا مشاهدهٔ فرم‌ها انتخاب کنید —</option>${list.map(x => `<option value="${x.id}" ${fin.sel === x.id ? 'selected' : ''}>${esc(lbl(x))}</option>`).join('')}</select></div><div id="fforms" style="margin-top:14px"></div></div>
    <div class="toolbar"><label class="f grow"><span>جستجو (نام، شماره، کارفرما، برنده)</span><input id="fq" value="${esc(fin.q)}"></label>
      <label class="f"><span>نتیجه</span><select id="fres"><option value="">همه</option>${opts([['won', 'برنده'], ['lost', 'بازنده']], fin.result)}</select></label>
      <label class="f"><span>نوع</span><select id="fkind"><option value="">همه</option>${opts(Object.entries(KIND), fin.kind)}</select></label>
      <label class="f"><span>مهلت از</span>${dateField('from', from)}</label><label class="f"><span>تا</span>${dateField('to', to)}</label>
      <label class="f"><span>مرتب‌سازی</span><select id="fsort">${opts([['newest', 'جدیدترین'], ['score_desc', 'امتیاز: بیشترین ← کمترین'], ['score_asc', 'امتیاز: کمترین ← بیشترین'], ['amount_desc', 'بیشترین مبلغ'], ['name', 'نام']], fin.sort)}</select></label>
      <button class="btn" id="fxls">⬇️ خروجی اکسل</button></div>
    <div class="table-wrap"><table><thead><tr><th>شماره</th><th>نام مناقصه</th><th>نوع</th><th>وضعیت</th><th>امتیاز کیفی</th><th>امتیاز فنی</th><th>امتیاز مالی</th><th>امتیاز کل</th><th>رتبه</th><th>مبلغ قرارداد</th><th>برنده</th>${canR ? '<th></th>' : ''}</tr></thead><tbody>
    ${list.map(x => { const sc = k => canR && x.status === 'finished' ? `<input class="sc" data-id="${x.id}" data-k="${k}" inputmode="decimal" dir="ltr" value="${x[k] ?? ''}" style="width:72px;padding:3px 6px">` : (x[k] ?? '—');
      return `<tr class="click ${fin.sel === x.id ? 'sel' : ''}" data-id="${x.id}" ${fin.sel === x.id ? 'style="background:var(--primary-l)"' : ''}><td class="ltr num">${esc(x.tender_number || '—')}</td><td class="cell-name"><b>${esc(x.title)}</b><br><small class="muted">${esc(x.client_name || '')}</small></td><td>${chip(KIND[x.kind] || '', 'brand')}</td>
      <td>${x.status === 'finished' ? (x.result ? chip(RESULT_LBL[x.result], x.result === 'won' ? 'ok' : 'bad') : chip('در انتظار نتیجه', 'warn')) : chip(TH.STATUS[x.status], 'bad')}</td>
      <td>${sc('score_quality')}</td><td>${sc('score_technical')}</td><td>${sc('score_price')}</td><td>${sc('score_total')}</td><td class="num">${x.rank_no ?? '—'}</td><td class="num">${fmtMoney(x.contract_amount)}</td><td>${esc(x.winner_name || '—')}</td>${canR ? `<td class="acts">${x.is_archive ? `<button class="btn sm" data-arch-docs="${x.id}" title="مدارک">📎</button> <button class="btn sm" data-arch-edit="${x.id}">ویرایش</button> <button class="btn sm danger" data-arch-del="${x.id}">حذف</button>` : ''}</td>` : ''}</tr>`; }).join('') || `<tr><td colspan="12">${empty('مناقصهٔ اتمام‌یافته‌ای یافت نشد')}</td></tr>`}</tbody></table></div>
    <p class="muted small" style="margin-top:8px">${canR ? 'امتیازها را می‌توانید همین‌جا در جدول وارد کنید؛ با تغییر هر خانه، ذخیره می‌شود. ' : ''}مناقصه‌های بسته‌شده یا لغوشده نیز در این فهرست دیده می‌شوند.</p>`;
  const re = debounce(() => App.refresh(), 350);
  $('#fq', el).oninput = e => { fin.q = e.target.value; re(); }; $('#fres', el).onchange = e => { fin.result = e.target.value; App.refresh(); }; $('#fkind', el).onchange = e => { fin.kind = e.target.value; App.refresh(); };
  $('#fsort', el).onchange = e => { fin.sort = e.target.value; App.refresh(); };
  $('[name=from]', el).onchange = e => { fin.from = e.target.value; App.refresh(); }; $('[name=to]', el).onchange = e => { fin.to = e.target.value; App.refresh(); };
  $('#fxls', el).onclick = () => saveBlob(XL.write([{ name: 'مناقصات اتمام‌یافته', header: true, widths: [14, 44, 28, 10, 14, 12, 12, 12, 12, 8, 18, 24], rows: [['شماره', 'نام مناقصه', 'کارفرما', 'نوع', 'وضعیت', 'امتیاز کیفی', 'امتیاز فنی', 'امتیاز مالی', 'امتیاز کل', 'رتبه', 'مبلغ قرارداد', 'برنده'],
    ...list.map(x => [x.tender_number || '', x.title, x.client_name || '', KIND[x.kind] || '', x.status === 'finished' ? (RESULT_LBL[x.result] || 'در انتظار نتیجه') : TH.STATUS[x.status], x.score_quality == null ? '' : +x.score_quality, x.score_technical == null ? '' : +x.score_technical, x.score_price == null ? '' : +x.score_price, x.score_total == null ? '' : +x.score_total, x.rank_no ?? '', x.contract_amount == null ? '' : +x.contract_amount, x.winner_name || ''])] }]), 'finished-tenders.xlsx');
  const showForms = async () => {
    const box = $('#fforms', el); if (!fin.sel) { box.innerHTML = '<div class="muted">پس از انتخاب مناقصه، سه فرم Document Feasibility، Tender Checklist و Result Form اینجا باز می‌شود.</div>'; return; }
    box.innerHTML = '<div class="muted">در حال بارگذاری…</div>'; const t = await API.get('/tenders/' + fin.sel);
    box.innerHTML = `<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap"><b>${esc(t.title)}</b>${chip(KIND[t.kind], 'brand')}<button class="btn sm" id="fopen">باز کردن صفحهٔ مناقصه</button></div><div id="fbox"></div>`;
    $('#fopen', box).onclick = () => App.go('tender/' + t.id); mountForms($('#fbox', box), t, t.perm, () => {});
  };
  $('#fsel', el).onchange = e => { fin.sel = +e.target.value || null; App.refresh(); };
  el.onclick = async e => {
    const yf = e.target.closest('[data-year]'); if (yf) { fin.year = yf.dataset.year; fin.sel = null; return App.refresh(); }
    if (e.target.closest('[data-act=arch-add]')) return archiveDialog(null, () => App.refresh());
    const ae = e.target.closest('[data-arch-edit]'); if (ae) return archiveDialog(list.find(x => x.id === +ae.dataset.archEdit), () => App.refresh());
    const ad = e.target.closest('[data-arch-docs]'); if (ad) return archiveDocs(+ad.dataset.archDocs);
    const ax = e.target.closest('[data-arch-del]'); if (ax) { if (await confirmBox('این مناقصهٔ آرشیوی با مدارکش حذف شود؟')) { try { await API.del('/tenders/archive/' + ax.dataset.archDel); toast('حذف شد', 'success'); App.refresh(); } catch (ex) { toast(ex.message, 'error'); } } return; }
    if (e.target.closest('input,select,button,.sc')) return; const tr = e.target.closest('tr.click'); if (tr) { fin.sel = +tr.dataset.id; App.refresh(); }
  };
  el.onchange = async e => {
    const s = e.target.closest('.sc'); if (!s) return;
    try {
      const v = toLatin(s.value).trim(); if (v !== '' && (isNaN(Number(v)) || Number(v) < 0)) throw new Error('امتیاز باید عدد باشد');
      const t = await API.get('/tenders/' + s.dataset.id), rf = { ...(t.result_form || {}), [s.dataset.k]: v === '' ? '' : Number(v) };
      await API.put(`/tenders/${s.dataset.id}/forms/result`, { data: rf }); toast('امتیاز ذخیره شد', 'success');
    } catch (ex) { toast(ex.message, 'error'); }
  };
  await showForms();
  if (fin.sel) $('#fforms', el).scrollIntoView({ block: 'nearest' });
} });

/* ───────── صفحهٔ جزئیات مناقصه ───────── */
App.register({ id: 'tender', title: 'مناقصه', navId: 'm/cartable', async render(el, arg) {
  const id = parseInt(arg); if (!id) throw new Error('شناسهٔ مناقصه نامعتبر است');
  const t = await API.get('/tenders/' + id), perm = t.perm, staff = perm.staff;
  App.setTitle('جزئیات مناقصه');
  const open = ['review', 'active'].includes(t.status);
  const dir = perm.assign ? await App.directory().catch(() => []) : [];
  const stepsHtml = () => {
    const s = [['ثبت و بارگذاری اسناد', 'done']];
    s.push(['بررسی مدیر دفتر فنی', t.tech_done || t.status !== 'review' ? 'done' : 'cur']);
    s.push(['تصمیم مدیرعامل', t.ceo_decision === 'yes' ? 'done' : t.ceo_decision === 'no' ? 'bad' : 'cur']);
    if (t.needs_guarantee) s.push(['ضمانت‌نامه', t.guarantee_status === 'received' ? 'done' : 'cur']);
    if (t.ceo_decision !== 'no') { s.push([SUBMIT[t.submit_status] || 'ارسال پیشنهاد', t.status === 'finished' || ['sent', 'awaiting_winner'].includes(t.submit_status) ? 'done' : t.status === 'active' ? 'cur' : '']); s.push(['اتمام', t.status === 'finished' ? 'done' : '']); }
    if (t.status === 'cancelled') s.push(['لغو شده', 'bad']);
    return `<div class="steps">${s.map(([l, c]) => `<span class="step ${c}">${esc(l)}</span>`).join('')}</div>`;
  };
  const kv = (l, v) => `<div><dt>${l}</dt><dd>${v == null || v === '' ? '—' : v}</dd></div>`;
  const info = staff ? `<dl class="kv">${kv('شماره', esc(t.tender_number))}${kv('کارفرما', esc(t.client_name))}${kv('نوع', KIND[t.kind])}${kv('دستهٔ مرحله', PACKAGE[t.package_type])}${kv('تاریخ دریافت', t.received_date ? fmtDate(t.received_date) : '')}${kv('مهلت ارسال', TH.deadlineCell(t.deadline))}</dl>${t.description ? `<p>${esc(t.description)}</p>` : ''}`
    : `<dl class="kv">${kv('شماره', esc(t.tender_number))}${kv('کارفرما', esc(t.client_name))}${kv('نوع', KIND[t.kind])}${kv('دستهٔ مرحله', PACKAGE[t.package_type])}${kv('تاریخ دریافت', t.received_date ? fmtDate(t.received_date) : '')}${kv('مبلغ پایه', fmtMoney(t.budget))}${kv('مبلغ ضمانت‌نامه', t.guarantee_amount ? fmtMoney(t.guarantee_amount) + (t.guarantee_status === 'received' ? ' ' + chip('دریافت شد', 'ok') : t.guarantee_status === 'pending' ? ' ' + chip('در انتظار', 'warn') : '') : '')}${kv('مبلغ پیشنهادی ما', t.our_offer ? fmtMoney(t.our_offer) : '')}${kv('مهلت ارسال', TH.deadlineCell(t.deadline))}${kv('تاریخ ارسال', t.sent_date ? fmtDate(t.sent_date) : '')}${kv('تصمیم مدیرعامل', t.ceo_decision ? (t.ceo_decision === 'yes' ? 'شرکت می‌کنیم' : 'شرکت نمی‌کنیم') + (t.ceo_note ? ' — ' + esc(t.ceo_note) : '') : 'در انتظار')}</dl>${t.risk_text || t.opportunity_text ? `<div class="ro-grid" style="margin-top:10px">${t.risk_text ? `<div><span class="chip bad">ریسک</span><p style="margin:4px 0 0;white-space:pre-wrap">${esc(t.risk_text)}</p></div>` : ''}${t.opportunity_text ? `<div><span class="chip ok">فرصت</span><p style="margin:4px 0 0;white-space:pre-wrap">${esc(t.opportunity_text)}</p></div>` : ''}</div>` : ''}${t.description ? `<p style="margin-top:10px">${esc(t.description)}</p>` : ''}`;

  const filesSection = (kind, title, canUp) => {
    const fl = t.files.filter(f => f.kind === kind);
    if (!fl.length && !canUp) return '';
    return `<div class="card" style="margin-bottom:12px"><h3>${title}</h3><div class="filelist">${fl.map(f => `<div class="file">📄 <span class="name">${esc(f.file_name)}</span><small>${formatSize(f.file_size)} · ${esc(f.uploaded_by_name || '')} · ${fmtDate(f.created_at)}</small><button class="btn sm" data-dl="${f.id}" data-name="${esc(f.file_name)}">دانلود</button>${canUp && !staff ? `<button class="btn sm danger" data-rm="${f.id}">حذف</button>` : ''}</div>`).join('') || '<span class="muted">فایلی نیست</span>'}</div>
      ${canUp && !staff ? `<label class="field" style="margin-top:8px"><span>افزودن فایل</span><input type="file" data-up="${kind}" multiple></label>` : ''}</div>`;
  };
  const assignRows = (staff ? t.assignments : t.assignments).map(a => {
    const wf = t.files.filter(f => f.kind === 'work' && f.assignment_id === a.id);
    return `<tr><td><b>${esc(a.assignee_name)}</b>${a.user_id ? '' : '<br><small class="muted">خارج از سامانه</small>'}</td><td>${esc(PART[a.part] || '')}</td><td>${esc(a.task || '—')}</td><td class="num">${a.share_percent != null ? fmtNum(a.share_percent) + '٪' : '—'}</td><td class="num">${fmtDate(a.due_date)}</td>
      <td>${a.status === 'done' ? chip('انجام شد', 'ok') : chip('باز', 'warn')}</td>
      <td>${wf.map(f => `<div class="file" style="margin-bottom:4px">📄 <span class="name">${esc(f.file_name)}</span><button class="btn sm" data-dl="${f.id}" data-name="${esc(f.file_name)}">دانلود</button></div>`).join('')}${perm.files.work && (staff ? true : perm.assign || perm.proc) && open ? `<input type="file" data-work="${a.id}" multiple style="font-size:13px">` : ''}</td>
      <td class="acts">${staff && a.status === 'open' ? `<button class="btn sm ok" data-adone="${a.id}">تمام شد</button>` : ''}${perm.assign ? `<button class="btn sm" data-aedit="${a.id}">ویرایش</button> <button class="btn sm danger" data-adel="${a.id}">حذف</button>` : ''}</td></tr>`;
  }).join('');
  const assignCard = (t.assignments.length || perm.assign) ? `<div class="card" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0">${staff ? 'کارهای ارجاع‌شده به شما' : 'ارجاع کار (برنامه زمان‌بندی، پیشنهاد فنی و …)'}</h3>${perm.assign ? '<button class="btn primary sm" data-aadd>+ ارجاع جدید</button>' : ''}</div>
    <div class="table-wrap"><table><thead><tr><th>نفر</th><th>بخش کار</th><th>شرح</th><th>سهم</th><th>مهلت</th><th>وضعیت</th><th>خروجی کار</th><th></th></tr></thead><tbody>${assignRows || `<tr><td colspan="8">${empty('هنوز کاری ارجاع نشده است')}</td></tr>`}</tbody></table></div></div>` : '';

  /* پنل اقدام‌ها بر اساس نقش */
  let actions = '';
  if (perm.tech) actions += `<div class="card" style="margin-bottom:12px"><h3>بررسی فنی مدیر دفتر فنی</h3><div class="form-grid"><label class="field full"><span>روش انجام کار / ارجاع (توضیح)</span><textarea name="method">${esc(t.method || '')}</textarea></label><label class="field full"><span>برنامهٔ زمان‌بندی</span><textarea name="schedule">${esc(t.schedule || '')}</textarea></label><label class="field"><span>ارجاع به (نام یا توضیح کوتاه)</span><input name="referral_to" value="${esc(t.referral_to || '')}"></label><label class="field"><span>قیمت پیشنهادی (مبلغ پیشنهاد ما)</span>${moneyField('our_offer', t.our_offer)}</label></div>
    <div style="display:flex;gap:8px;margin-top:10px"><button class="btn" data-tech="0">ذخیرهٔ پیش‌نویس</button><button class="btn primary" data-tech="1">ثبت بررسی فنی ${t.tech_done ? '(ثبت مجدد)' : ''}</button></div><p class="muted small">قبل از ثبت، حداقل یک ارجاع کار در جدول «ارجاع کار» اضافه کنید.</p></div>`;
  else if (!staff && (t.method || t.schedule || t.referral_to)) actions += `<div class="card" style="margin-bottom:12px"><h3>بررسی فنی</h3><dl class="kv">${kv('روش انجام کار', esc(t.method))}${kv('برنامهٔ زمان‌بندی', esc(t.schedule))}${kv('ارجاع به', esc(t.referral_to))}${kv('قیمت پیشنهادی', t.our_offer ? fmtMoney(t.our_offer) : '')}</dl></div>`;
  const btns = [];
  if (perm.ceo && t.status === 'review') btns.push('<button class="btn primary" data-ceo>تصمیم مدیرعامل: شرکت در مناقصه؟</button>');
  if (perm.ceo && t.ceo_decision && !['finished'].includes(t.status) && t.guarantee_status !== 'received') btns.push('<button class="btn" data-ceoreset>بازگرداندن تصمیم</button>');
  if (perm.finance && t.needs_guarantee && t.guarantee_status === 'pending') btns.push('<button class="btn ok" data-gr>ضمانت‌نامه دریافت شد</button>');
  if (perm.proc && t.status === 'closed' && !t.closed_ack) btns.push('<button class="btn" data-ack>مشاهده شد — مناقصه بسته شد</button>');
  if (perm.status && t.status === 'active') btns.push(`<label class="f" style="display:inline-grid;gap:2px"><span class="muted small">وضعیت ارسال</span><select data-st style="min-width:180px">${opts(SUBMIT_OPTS, t.submit_status || 'running')}</select></label>`);
  if (perm.result && t.status === 'active') btns.push('<button class="btn ok" data-finish>اتمام مناقصه</button>');
  if (perm.edit) btns.push('<button class="btn" data-edit>ویرایش مشخصات</button>');
  if (can('super_admin')) btns.push('<button class="btn danger" data-del>حذف مناقصه</button>');
  if (btns.length) actions = `<div class="card" style="margin-bottom:12px"><h3>اقدام‌ها</h3><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">${btns.join('')}</div></div>` + actions;
  const CHF = { guarantee_amount: 'مبلغ ضمانت‌نامه', budget: 'مبلغ پایه', deadline: 'مهلت ارسال پیشنهاد', our_offer: 'مبلغ پیشنهادی ما' };
  const chVal = (f, v) => v == null || v === '' ? '—' : f === 'deadline' ? fmtDate(v) : fmtMoney(v);
  const changesCard = (t.changes.length || perm.change) ? `<div class="card" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0">📢 اعلان تغییرات</h3>${perm.change ? '<button class="btn primary sm" data-chadd>+ ثبت تغییر</button>' : ''}</div>
    ${t.changes.map(c => `<div class="change-item"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(c.title)}</b>${perm.change && !staff ? `<button class="btn sm danger" data-chdel="${c.id}">حذف</button>` : ''}</div><small class="muted">${fmtDateTime(c.created_at)} · ${esc(c.full_name || '')}</small>
      ${c.field ? `<div style="margin-top:4px">${CHF[c.field]}: <s class="muted">${chVal(c.field, c.old_value)}</s> ← <b>${chVal(c.field, c.new_value)}</b></div>` : ''}${c.body ? `<p style="margin:4px 0 0;white-space:pre-wrap">${esc(c.body)}</p>` : ''}
      ${t.files.filter(f => f.kind === 'change' && f.change_id === c.id).map(f => `<div class="file" style="margin-top:4px">📄 <span class="name">${esc(f.file_name)}</span><button class="btn sm" data-dl="${f.id}" data-name="${esc(f.file_name)}">دانلود</button></div>`).join('')}</div>`).join('') || empty('تغییری اعلام نشده است')}</div>` : '';
  const timeline = `<div class="card" style="margin-bottom:12px"><h3>💬 کامنت‌ها و پیگیری</h3>
    <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px"><textarea id="cmBody" placeholder="کامنت یا پیگیری خود را بنویسید…" style="flex:1;min-height:56px"></textarea><button class="btn primary" data-cmadd>ثبت کامنت</button></div>
    ${t.comments.map(c => `<div class="comment"><div style="display:flex;justify-content:space-between"><b>${esc(c.full_name || '—')}</b><small>${fmtDateTime(c.created_at)}${c.user_id === Auth.user().id || can('super_admin') ? ` <button class="link" data-cmdel="${c.id}">حذف</button>` : ''}</small></div><p>${esc(c.body)}</p></div>`).join('') || '<div class="muted small">هنوز کامنتی ثبت نشده است.</div>'}
    ${!staff && t.history.length ? `<details class="acc" style="margin-top:10px"><summary>تاریخچهٔ گردش‌کار (${fmtNum(t.history.length)})</summary><div class="acc-body">${t.history.map(h => `<div class="tree-row" style="margin-bottom:5px"><small class="muted nowrap">${fmtDateTime(h.created_at)}</small><span style="flex:1">${esc(h.note || '')}</span><small class="muted">${esc(h.full_name || '')}</small></div>`).join('')}</div></details>` : ''}</div>`;

  el.innerHTML = `<div class="page-head"><div><button class="link" data-back>← بازگشت</button><div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center"><h1 style="font-size:21px">${esc(t.title)}</h1>${chip(TH.STATUS[t.status], TH.STATUS_CLS[t.status])}${chip(KIND[t.kind] || '', 'brand')}</div></div></div>
    ${stepsHtml()}<div class="card" style="margin-bottom:12px">${info}</div>${actions}${assignCard}${changesCard}
    ${filesSection('tender', 'اسناد مناقصه', perm.files.tender)}${perm.files.guarantee || t.files.some(f => f.kind === 'guarantee') ? filesSection('guarantee', 'ضمانت‌نامه', perm.files.guarantee) : ''}
    ${staff ? '' : `<details class="acc" ${store.get('forms-open') === '1' ? 'open' : ''}><summary>فرم‌های مناقصه: امکان‌سنجی مدارک، چک‌لیست و نتیجه</summary><div class="acc-body" id="tforms"></div></details>`}${timeline}`;
  if (!staff) { mountForms($('#tforms', el), t, perm, () => {}); $('details.acc', el).addEventListener('toggle', e => store.set('forms-open', e.target.open ? '1' : '0')); }
  const reload = () => App.refresh();
  const guard = fn => async (...a) => { try { await fn(...a); } catch (ex) { toast(ex.message, 'error'); } };

  el.onclick = guard(async e => {
    const q = s => e.target.closest(s);
    if (q('[data-back]')) return history.length > 1 ? history.back() : App.go('m/cartable');
    if (q('#tforms')) return;   // دکمه‌های داخل بخش فرم‌ها را خود فرم‌ها مدیریت می‌کنند
    const dl = q('[data-dl]'); if (dl) return downloadFile(`/tenders/${id}/files/${dl.dataset.dl}/download`, dl.dataset.name);
    const rm2 = q('[data-rm]'); if (rm2) { if (await confirmBox('این فایل حذف شود؟')) { await API.del(`/tenders/${id}/files/${rm2.dataset.rm}`); reload(); } return; }
    const tc = q('[data-tech]'); if (tc) { const d = { method: $('[name=method]', el).value, schedule: $('[name=schedule]', el).value, referral_to: $('[name=referral_to]', el).value, our_offer: numVal($('[name=our_offer]', el)), done: tc.dataset.tech === '1' }; await API.put(`/tenders/${id}/tech`, d); toast('ذخیره شد', 'success'); App.loadBadges(); return reload(); }
    if (q('[data-chadd]')) return changeDialog(t, reload);
    const chd = q('[data-chdel]'); if (chd) { if (await confirmBox('این اعلان تغییر حذف شود؟')) { await API.del(`/tenders/${id}/changes/${chd.dataset.chdel}`); reload(); } return; }
    if (q('[data-cmadd]')) { const v = $('#cmBody', el).value.trim(); if (!v) return toast('متن کامنت را بنویسید', 'error'); await API.post(`/tenders/${id}/comments`, { body: v }); toast('کامنت ثبت شد', 'success'); return reload(); }
    const cmd = q('[data-cmdel]'); if (cmd) { if (await confirmBox('این کامنت حذف شود؟')) { await API.del(`/tenders/${id}/comments/${cmd.dataset.cmdel}`); reload(); } return; }
    if (q('[data-ceo]')) return ceoDialog(t, reload);
    if (q('[data-ceoreset]')) { if (await confirmBox('تصمیم مدیرعامل بازگردانده شود؟', 'بازگردانی', false)) { await API.post(`/tenders/${id}/ceo-reset`); reload(); } return; }
    if (q('[data-gr]')) return guaranteeDialog(t, reload);
    if (q('[data-ack]')) { await API.post(`/tenders/${id}/ack`); App.loadBadges(); toast('ثبت شد', 'success'); return App.go('m/cartable'); }
    if (q('[data-finish]')) { if (await confirmBox('مناقصه به «اتمام‌یافته» منتقل شود؟', 'اتمام مناقصه', false)) { await API.post(`/tenders/${id}/finish`, {}); fin.sel = id; toast('منتقل شد', 'success'); App.go('m/finished'); } return; }
    if (q('[data-edit]')) return editDialog(t, perm, reload);
    if (q('[data-del]')) { if (await confirmBox('مناقصه با همهٔ فایل‌ها و تاریخچه حذف شود؟ این کار برگشت‌پذیر نیست.')) { await API.del('/tenders/' + id); toast('حذف شد', 'success'); App.go('m/running'); } return; }
    if (q('[data-aadd]')) return assignDialog(t, dir, null, reload);
    const ae = q('[data-aedit]'); if (ae) return assignDialog(t, dir, t.assignments.find(a => a.id === +ae.dataset.aedit), reload);
    const ad = q('[data-adel]'); if (ad) { if (await confirmBox('این ارجاع حذف شود؟')) { await API.del(`/tenders/${id}/assignments/${ad.dataset.adel}`); reload(); } return; }
    const dn = q('[data-adone]'); if (dn) { await API.put(`/tenders/${id}/assignments/${dn.dataset.adone}`, { status: 'done' }); toast('ثبت شد؛ مدیر دفتر فنی مطلع می‌شود', 'success'); App.loadBadges(); reload(); }
  });
  el.onchange = guard(async e => {
    if (e.target.closest('#tforms')) return;
    const st = e.target.closest('[data-st]'); if (st) { if (await setTenderStatus(id, st.value)) reload(); else reload(); return; }
    const up = e.target.closest('[data-up]'); if (up) { for (const f of up.files) await API.upload(`/tenders/${id}/files`, { kind: up.dataset.up }, f); toast('بارگذاری شد', 'success'); return reload(); }
    const wk = e.target.closest('[data-work]'); if (wk) { for (const f of wk.files) await API.upload(`/tenders/${id}/files`, { kind: 'work', assignment_id: wk.dataset.work }, f); toast('خروجی کار بارگذاری شد', 'success'); reload(); }
  });
} });

/* ───── آرشیو مناقصه‌های سال‌های قبل: ورود دستی، از اکسل (گروهی) یا از روی مدارک Word/PDF ───── */
const ARCH_FIELDS = [['title', 'عنوان مناقصه', 'full'], ['client_name', 'کارفرما'], ['tender_number', 'شمارهٔ مناقصه'], ['winner_name', 'برندهٔ مناقصه'],
  ['budget', 'مبلغ پایه', 'm'], ['our_offer', 'مبلغ پیشنهادی ما', 'm'], ['contract_amount', 'مبلغ قرارداد', 'm'], ['rank', 'رتبه'],
  ['score_quality', 'امتیاز کیفی'], ['score_technical', 'امتیاز فنی'], ['score_price', 'امتیاز مالی'], ['score_total', 'امتیاز کل']];
function archiveDialog(x, done) {
  const cy = (J.parts(J.today()) || [1404])[0], y0 = x ? tYear(x) : (+fin.year || cy), edit = !!x;
  const v = k => x ? (k === 'rank' ? x.rank_no : x[k]) ?? '' : '';
  const years = []; for (let y = cy + 1; y >= cy - 15; y--) years.push([y, toFaNum(y)]);
  const fld = ([k, l, t]) => t === 'm' ? `<label class="field"><span>${l}</span>${moneyField(k, v(k))}</label>` : `<label class="field ${t || ''}"><span>${l}</span><input name="${k}" value="${esc(v(k))}" ${t ? '' : 'dir="ltr" inputmode="decimal"'} ${['client_name', 'winner_name', 'tender_number'].includes(k) ? '' : ''}></label>`;
  Modal.open({ title: edit ? 'ویرایش مناقصهٔ آرشیوی' : 'افزودن مناقصهٔ سال‌های قبل', wide: true, html: `${edit ? '' : `<div class="card" style="box-shadow:none;margin-bottom:12px"><b>پر کردن خودکار از فایل</b><p class="muted small">فایل اکسل (چند مناقصه با هم، با ستون‌های سال، عنوان، کارفرما، نتیجه، امتیازها و مبلغ‌ها) یا فایل Word/PDF یک مناقصه (به شکل «عنوان: …») را انتخاب کنید. اطلاعات خوانده‌شده قبل از ثبت قابل بازبینی است.</p><input type="file" id="arImp" accept=".xlsx,.csv,.docx,.pdf,.txt"></div>`}
    <div class="form-grid"><label class="field"><span class="req">سال (شمسی)</span><select name="year">${opts(years, y0)}</select></label>
    <label class="field"><span>نوع</span><select name="kind">${opts(Object.entries(KIND), x ? x.kind : 'exploration')}</select></label><label class="field"><span>نتیجه</span><select name="result"><option value="">نامشخص</option>${opts([['won', 'برنده'], ['lost', 'بازنده']], x ? x.result : '')}</select></label>
    ${ARCH_FIELDS.map(fld).join('')}${edit ? '' : '<label class="field full"><span>مدارک این مناقصه (اختیاری — چند فایل)</span><input type="file" name="docs" multiple></label>'}</div>`,
  actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: edit ? 'ذخیره' : 'ثبت در آرشیو', cls: 'primary', run: async m => {
    const d = formData(m); if (!d.title.trim()) throw new Error('عنوان مناقصه را وارد کنید');
    const body = { ...d, rank: toLatin(d.rank) };
    ['budget', 'our_offer', 'contract_amount'].forEach(k => { body[k] = numVal($(`[name=${k}]`, m)); });
    ['score_quality', 'score_technical', 'score_price', 'score_total'].forEach(k => { body[k] = toLatin(d[k]); });
    let id = edit ? x.id : null;
    if (edit) await API.put('/tenders/archive/' + id, body); else id = (await API.post('/tenders/archive', body)).id;
    if (!edit) for (const f of $('[name=docs]', m).files) { try { await API.upload(`/tenders/${id}/files`, { kind: 'archive' }, f); } catch (ex) { toast(f.name + ': ' + ex.message, 'error'); } }
    fin.year = String(body.year); toast('ذخیره شد', 'success'); done(); } }],
  onOpen: m => {
    const imp = $('#arImp', m); if (!imp) return;
    imp.onchange = async () => {
      const f = imp.files[0]; if (!f) return; imp.disabled = true;
      try {
        const src = await Imp.read(f), yr = +$('[name=year]', m).value;
        const rows = src.sheets ? Imp.tendersFromSheets(src.sheets, yr) : [Imp.tenderFromText(src.text, yr)];
        if (!rows.length || !rows[0].title) throw new Error('اطلاعات مناقصه‌ای در فایل پیدا نشد. عنوان ستون‌ها یا «کلید: مقدار»ها را بررسی کنید.');
        if (rows.length > 1) { Modal.close(); return archiveBulk(rows, yr, done); }
        const r = rows[0]; $('[name=year]', m).value = r.year || yr;
        ['title', 'client_name', 'tender_number', 'winner_name', 'rank', 'score_quality', 'score_technical', 'score_price', 'score_total'].forEach(k => { if (r[k] != null && r[k] !== '') $(`[name=${k}]`, m).value = r[k]; });
        ['budget', 'our_offer', 'contract_amount'].forEach(k => { if (r[k] != null) $(`[name=${k}]`, m).value = Number(r[k]).toLocaleString('en-US'); });
        $('[name=kind]', m).value = r.kind; $('[name=result]', m).value = r.result || ''; toast('اطلاعات خوانده شد؛ لطفاً بازبینی و ثبت کنید', 'success');
      } catch (ex) { toast(ex.message, 'error'); }
      imp.disabled = false; imp.value = '';
    };
  } });
}
function archiveBulk(rows, defYear, done) {
  const bad = rows.filter(r => !r.year).length;
  Modal.open({ title: 'ورود گروهی از اکسل', wide: true, html: `<p><b>${fmtNum(rows.length)}</b> مناقصه خوانده شد${bad ? ` (${fmtNum(bad)} ردیف سال ندارد و با سال ${fmtYear(defYear)} ثبت می‌شود)` : ''}. پیش‌نمایش ۱۰ ردیف اول:</p>
    <div class="table-wrap"><table><thead><tr><th>سال</th><th>عنوان</th><th>کارفرما</th><th>نتیجه</th><th>امتیاز فنی</th><th>مبلغ قرارداد</th></tr></thead><tbody>${rows.slice(0, 10).map(r => `<tr><td>${fmtYear(r.year || defYear)}</td><td>${esc(r.title)}</td><td>${esc(r.client_name || '—')}</td><td>${r.result ? chip(RESULT_LBL[r.result], r.result === 'won' ? 'ok' : 'bad') : '—'}</td><td class="num">${r.score_technical ?? '—'}</td><td class="num">${r.contract_amount == null ? '—' : fmtNum(r.contract_amount)}</td></tr>`).join('')}</tbody></table></div>`,
  actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت همه در آرشیو', cls: 'primary', run: async () => {
    let c = 0, sk = 0; for (let i = 0; i < rows.length; i += 200) { const r = await API.post('/tenders/archive/bulk', { rows: rows.slice(i, i + 200).map(x => ({ ...x, year: x.year || defYear })) }); c += r.created; sk += r.skipped; }
    toast(`${fmtNum(c)} مناقصه ثبت شد` + (sk ? ` · ${fmtNum(sk)} ردیف رد شد` : ''), 'success'); done(); } }] });
}
async function archiveDocs(id) {
  const draw = async bg => { const t = await API.get('/tenders/' + id), fl = t.files.filter(f => f.kind === 'archive');
    $('.modal-body', bg).innerHTML = `<h4 class="sub">${esc(t.title)}</h4>${fl.length ? `<div class="filelist">${fl.map(f => `<div class="file">📄 <span class="name">${esc(f.file_name)}</span><small>${formatSize(f.file_size)}</small><button class="btn sm" data-dl="${f.id}" data-name="${esc(f.file_name)}">دانلود</button><button class="btn sm danger" data-rm="${f.id}">حذف</button></div>`).join('')}</div>` : empty('مدرکی بارگذاری نشده است')}<label class="field" style="margin-top:10px"><span>بارگذاری مدرک (چند فایل)</span><input type="file" id="arUp" multiple></label>`; };
  const bg = Modal.open({ title: 'مدارک مناقصه', wide: true, html: '' }); await draw(bg);
  bg.addEventListener('click', async e => { const d = e.target.closest('[data-dl]'), r = e.target.closest('[data-rm]');
    if (d) return downloadFile(`/tenders/${id}/files/${d.dataset.dl}/download`, d.dataset.name);
    if (r && await confirmBox('این مدرک حذف شود؟')) { try { await API.del(`/tenders/${id}/files/${r.dataset.rm}`); await draw(bg); } catch (ex) { toast(ex.message, 'error'); } } });
  bg.addEventListener('change', async e => { if (e.target.id !== 'arUp') return; for (const f of e.target.files) { try { await API.upload(`/tenders/${id}/files`, { kind: 'archive' }, f); } catch (ex) { toast(f.name + ': ' + ex.message, 'error'); } } await draw(bg); });
}

function ceoDialog(t, done) {
  Modal.open({ title: 'تصمیم مدیرعامل', html: `<p><b>${esc(t.title)}</b></p><div class="form-grid"><label class="field full"><span>آیا در این مناقصه شرکت می‌کنیم؟</span><select name="decision"><option value="yes">بله، شرکت می‌کنیم</option><option value="no">خیر، مناقصه بسته شود</option></select></label>
    <label class="check full" id="gWrap"><input type="checkbox" name="needs_guarantee"> نیازمند ضمانت‌نامه است (درخواست به واحد مالی ارسال شود)</label>
    <label class="field" id="gAmt"><span>مبلغ ضمانت‌نامه</span>${moneyField('guarantee_amount', t.guarantee_amount)}</label><label class="field full"><span>توضیح (اختیاری)</span><textarea name="note"></textarea></label></div>`,
  actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت تصمیم', cls: 'primary', run: async m => { const d = formData(m); await API.post(`/tenders/${t.id}/ceo`, { decision: d.decision, needs_guarantee: d.decision === 'yes' && d.needs_guarantee, guarantee_amount: numVal($('[name=guarantee_amount]', m)), note: d.note });
    toast(d.decision === 'yes' ? 'ثبت شد: به کارتابل کارشناس مناقصات رفت' : 'ثبت شد: مناقصه بسته شد', 'success'); App.loadBadges(); done(); } }],
  onOpen: m => { const upd = () => { const y = $('[name=decision]', m).value === 'yes'; $('#gWrap', m).classList.toggle('hidden', !y); $('#gAmt', m).classList.toggle('hidden', !(y && $('[name=needs_guarantee]', m).checked)); }; m.addEventListener('change', upd); upd(); } });
}
function changeDialog(t, done) {
  Modal.open({ title: 'ثبت اعلان تغییر', wide: true, html: `<p class="muted small">تغییر برای همهٔ دست‌اندرکاران این مناقصه نمایش داده می‌شود و در اعلان‌ها (🔔) و کارتابل‌شان می‌آید.</p><div class="form-grid">
    <label class="field full"><span class="req">عنوان تغییر</span><input name="title" placeholder="مثلاً: افزایش مبلغ ضمانت‌نامه طبق اصلاحیهٔ کارفرما"></label>
    <label class="field"><span>مورد تغییرکرده (اختیاری)</span><select name="field"><option value="">— فقط توضیح —</option>${opts(Object.entries({ guarantee_amount: 'مبلغ ضمانت‌نامه', budget: 'مبلغ پایه', deadline: 'مهلت ارسال پیشنهاد', our_offer: 'مبلغ پیشنهادی ما' }), '')}</select></label>
    <label class="field" id="chNum"><span>مقدار جدید</span>${moneyField('new_num', '')}</label><label class="field hidden" id="chDate"><span>تاریخ جدید</span>${dateField('new_date', '')}</label>
    <label class="check full" id="chApply"><input type="checkbox" name="apply" checked> مقدار جدید روی مشخصات مناقصه هم اعمال شود</label>
    <label class="field full"><span>توضیحات</span><textarea name="body"></textarea></label><label class="field full"><span>مدارک پیوست (اصلاحیه، نامه و …)</span><input type="file" name="fs" multiple></label></div>`,
  actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت و اعلام', cls: 'primary', run: async m => {
    const d = formData(m); if (!d.title.trim()) throw new Error('عنوان تغییر را بنویسید');
    let nv = ''; if (d.field) { nv = d.field === 'deadline' ? dateVal($('[name=new_date]', m)) : numVal($('[name=new_num]', m)); if (nv === '' || nv === null) throw new Error('مقدار جدید را درست وارد کنید'); }
    const r = await API.post(`/tenders/${t.id}/changes`, { title: d.title, body: d.body, field: d.field, new_value: nv, apply: !!d.apply });
    for (const f of $('[name=fs]', m).files) { try { await API.upload(`/tenders/${t.id}/files`, { kind: 'change', change_id: r.id }, f); } catch (ex) { toast(f.name + ': ' + ex.message, 'error'); } }
    toast('اعلان تغییر ثبت شد', 'success'); done(); } }],
  onOpen: m => { const upd = () => { const f = $('[name=field]', m).value; $('#chNum', m).classList.toggle('hidden', !f || f === 'deadline'); $('#chDate', m).classList.toggle('hidden', f !== 'deadline'); $('#chApply', m).classList.toggle('hidden', !f); }; m.addEventListener('change', upd); upd(); } });
}
function guaranteeDialog(t, done) {
  Modal.open({ title: 'دریافت ضمانت‌نامه', html: `<p>پس از ثبت، خبر آن به کارتابل کارشناس مناقصات می‌رود. فایل ضمانت‌نامه را (در صورت وجود) اینجا بارگذاری کنید.</p><div class="form-grid"><label class="field"><span>مبلغ ضمانت‌نامه</span>${moneyField('amount', t.guarantee_amount)}</label><label class="field full"><span>توضیح (بانک، شماره و …)</span><textarea name="note"></textarea></label><label class="field full"><span>فایل ضمانت‌نامه</span><input type="file" name="gf"></label></div>`,
  actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت دریافت', cls: 'ok', run: async m => { const f = $('[name=gf]', m).files[0]; if (f) await API.upload(`/tenders/${t.id}/files`, { kind: 'guarantee' }, f);
    await API.post(`/tenders/${t.id}/guarantee`, { amount: numVal($('[name=amount]', m)), note: $('[name=note]', m).value }); toast('ثبت شد', 'success'); App.loadBadges(); done(); } }] });
}
function editDialog(t, perm, done) {
  const b = perm.edit_basic, o = perm.edit_offer;
  Modal.open({ title: 'ویرایش مشخصات مناقصه', wide: true, html: `<div class="form-grid">${b ? `<label class="field full"><span class="req">نام مناقصه</span><input name="title" value="${esc(t.title)}"></label><label class="field"><span>شمارهٔ مناقصه</span><input name="tender_number" dir="ltr" value="${esc(t.tender_number || '')}"></label>
    <label class="field"><span>کارفرما</span><input name="client_name" value="${esc(t.client_name || '')}"></label><label class="field"><span>نوع</span><select name="kind">${opts(Object.entries(KIND), t.kind)}</select></label><label class="field"><span>دستهٔ مرحله</span><select name="package_type">${opts(Object.entries(PACKAGE), t.package_type)}</select></label>
    <label class="field"><span>مبلغ پایه</span>${moneyField('budget', t.budget)}</label><label class="field"><span>تاریخ دریافت</span>${dateField('received_date', t.received_date)}</label><label class="field"><span>مهلت ارسال</span>${dateField('deadline', t.deadline)}</label>` : ''}
    <label class="field"><span>مبلغ ضمانت‌نامه</span>${moneyField('guarantee_amount', t.guarantee_amount)}</label>${o ? `<label class="field"><span>مبلغ پیشنهادی ما</span>${moneyField('our_offer', t.our_offer)}</label>` : ''}
    ${b ? `<label class="field full"><span>ریسک‌ها (اختیاری)</span><textarea name="risk_text">${esc(t.risk_text || '')}</textarea></label><label class="field full"><span>فرصت‌ها (اختیاری)</span><textarea name="opportunity_text">${esc(t.opportunity_text || '')}</textarea></label><label class="field full"><span>توضیحات</span><textarea name="description">${esc(t.description || '')}</textarea></label>` : ''}</div>`,
  actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ذخیره', cls: 'primary', run: async m => {
    const body = {}; if (b) { Object.assign(body, formData(m)); const dl = dateVal($('[name=deadline]', m)); if (dl === null) throw new Error('تاریخ مهلت معتبر نیست'); body.deadline = dl; const rd = dateVal($('[name=received_date]', m)); if (rd === null) throw new Error('تاریخ دریافت معتبر نیست'); body.received_date = rd || ''; body.budget = numVal($('[name=budget]', m)); }
    body.guarantee_amount = numVal($('[name=guarantee_amount]', m)); if (o) body.our_offer = numVal($('[name=our_offer]', m));
    await API.put('/tenders/' + t.id, body); toast('ذخیره شد', 'success'); done(); } }] });
}
function assignDialog(t, dir, a, done) {
  const names = dir.map(u => `<option value="${esc(u.full_name)}">${esc((u.position ? u.position + ' · ' : '') + (u.personnel_no || ''))}</option>`).join('');
  Modal.open({ title: a ? 'ویرایش ارجاع' : 'ارجاع کار', wide: true, html: `<div class="form-grid"><label class="field full"><span class="req">نفر (از فهرست انتخاب کنید یا نام را تایپ کنید)</span><input name="assignee_name" list="dirList" value="${esc(a ? a.assignee_name : '')}" autocomplete="off"><datalist id="dirList">${names}</datalist></label>
    <label class="field"><span>بخش کار</span><select name="part">${opts(Object.entries(PART), a ? a.part : 'schedule')}</select></label><label class="field"><span>سهم از این بخش (٪) — برای تقسیم کار بین چند نفر</span><input name="share_percent" inputmode="numeric" dir="ltr" value="${a && a.share_percent != null ? a.share_percent : ''}" placeholder="مثلاً ۵۰"></label>
    <label class="field"><span>مهلت انجام</span>${dateField('due_date', a ? a.due_date : '')}</label><label class="field full"><span>شرح کار</span><textarea name="task">${esc(a ? a.task || '' : '')}</textarea></label></div>
    <p class="muted small">اگر نام با یکی از کاربران سامانه (نام کامل، نام کاربری یا شمارهٔ پرسنلی) یکی باشد، کار در کارتابل او می‌آید و او فقط همین کار را می‌بیند.</p>`,
  actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ثبت', cls: 'primary', run: async m => {
    const d = formData(m); const dd = dateVal($('[name=due_date]', m)); if (!d.assignee_name.trim()) throw new Error('نام فرد را وارد کنید'); if (dd === null) throw new Error('تاریخ معتبر نیست');
    const body = { assignee_name: d.assignee_name.trim(), part: d.part, task: d.task, share_percent: toLatin(d.share_percent), due_date: dd };
    if (a) await API.put(`/tenders/${t.id}/assignments/${a.id}`, body); else await API.post(`/tenders/${t.id}/assignments`, body);
    toast('ارجاع ثبت شد', 'success'); done(); } }] });
}
