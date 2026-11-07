/* آرشیو مدارک (فنی، کیفی، ایزو) با پوشه‌های تو در تو + ساخت بستهٔ PDF مرتب (سربرگ، شماره صفحه، فهرست و عنوان‌ها) */
'use strict';
const ARCH = { technical: 'مدارک فنی', quality: 'مدارک کیفی', iso: 'فرم‌ها و ایزو' };
const extOf = n => (String(n).split('.').pop() || '').toLowerCase();
const fileIcon = n => ({ pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', ppt: '📙', pptx: '📙', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', zip: '🗜️', rar: '🗜️' }[extOf(n)] || '📄');
const arch = { cur: {}, q: {} };

function archivePage(area) {
  App.register({ id: 'm/archive/' + area, title: ARCH[area], not: ['staff'], async render(el) {
    const parent = arch.cur[area] || null, q = (arch.q[area] || '').trim();
    const [d, tree] = await Promise.all([API.get('/folders', { area, parent }), q ? API.get('/folders/tree', { area }) : null]);
    const mg = d.can_manage;
    let body;
    if (q) {
      const ql = toLatin(q).toLowerCase(), byId = Object.fromEntries(tree.folders.map(f => [f.id, f]));
      const pathOf = id => { const p = []; let c = id; for (let i = 0; c && i < 30; i++) { const f = byId[c]; if (!f) break; p.unshift(f.name); c = f.parent_id; } return p.join(' / '); };
      const fs = tree.files.filter(f => f.file_name.toLowerCase().includes(ql)), dirs = tree.folders.filter(f => f.name.toLowerCase().includes(ql));
      body = `<div class="muted small" style="margin-bottom:8px">نتایج جستجو در همهٔ پوشه‌ها: ${fmtNum(fs.length + dirs.length)} مورد</div><div class="filelist">${dirs.map(f => `<div class="file" data-open="${f.id}" style="cursor:pointer">📁 <span class="name"><b>${esc(f.name)}</b> <small class="muted">${esc(pathOf(f.parent_id))}</small></span><button class="btn sm" data-open="${f.id}">باز کردن</button></div>`).join('')}
        ${fs.map(f => `<div class="file">${fileIcon(f.file_name)} <span class="name">${esc(f.file_name)} <small class="muted">${esc(pathOf(f.folder_id) || 'ریشه')}</small></span><small>${formatSize(f.file_size)}</small><button class="btn sm" data-dl="${f.id}" data-name="${esc(f.file_name)}">دانلود</button></div>`).join('')}</div>${fs.length + dirs.length ? '' : empty('موردی پیدا نشد')}`;
    } else {
      body = `${d.folders.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-bottom:16px">${d.folders.map(f => `<div class="tree-row" data-open="${f.id}" style="cursor:pointer">📁 <b style="flex:1;overflow-wrap:anywhere">${esc(f.name)}</b><small class="muted">${fmtNum(f.items)}</small>${mg ? `<button class="btn sm danger" data-rmdir="${f.id}" title="حذف پوشه">×</button>` : ''}</div>`).join('')}</div>` : ''}
        ${d.files.length ? `<div class="table-wrap"><table><thead><tr><th>فایل</th><th>حجم</th><th>بارگذاری‌کننده</th><th>تاریخ</th><th></th></tr></thead><tbody>${d.files.map(f => `<tr><td>${fileIcon(f.file_name)} ${esc(f.file_name)}</td><td class="num">${formatSize(f.file_size)}</td><td>${esc(f.uploaded_by_name || '—')}</td><td class="num">${fmtDate(f.created_at)}</td>
          <td class="acts"><button class="btn sm" data-dl="${f.id}" data-name="${esc(f.file_name)}">دانلود</button>${mg ? ` <button class="btn sm danger" data-rmfile="${f.id}">حذف</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${!d.folders.length && !d.files.length ? empty(mg ? 'این پوشه خالی است. پوشه بسازید یا فایل بارگذاری کنید.' : 'این پوشه خالی است') : ''}`;
    }
    el.innerHTML = `<div class="crumbs"><button class="link" data-open="">${ARCH[area]}</button>${d.path.map(p => `<span class="muted">/</span><button class="link" data-open="${p.id}">${esc(p.name)}</button>`).join('')}</div>
      <div class="toolbar"><label class="f grow"><span>جستجو در ${ARCH[area]}</span><input id="aq" value="${esc(q)}" placeholder="نام فایل یا پوشه"></label><span class="spacer"></span>
        ${mg && !q ? '<button class="btn" data-act="mkdir">📁 پوشهٔ جدید</button><button class="btn primary" data-act="upload">⬆️ بارگذاری فایل</button><input type="file" id="aup" multiple class="hidden">' : ''}
        <button class="btn" data-act="pdf">📑 ساخت بستهٔ PDF</button></div>${body}`;
    $('#aq', el).oninput = debounce(e => { arch.q[area] = e.target.value; App.refresh(); }, 350);
    const go = id => { arch.cur[area] = id ? +id : null; arch.q[area] = ''; App.refresh(); };
    el.onclick = async e => {
      const q = s => e.target.closest(s);
      const dl = q('[data-dl]'); if (dl) return downloadFile(`/folders/file/${dl.dataset.dl}/download`, dl.dataset.name);
      const rd = q('[data-rmdir]'); if (rd) { e.stopPropagation(); if (await confirmBox('پوشه حذف شود؟ (فقط پوشهٔ خالی حذف می‌شود)')) { try { await API.del('/folders/folder/' + rd.dataset.rmdir); App.refresh(); } catch (ex) { toast(ex.message, 'error'); } } return; }
      const rf = q('[data-rmfile]'); if (rf) { if (await confirmBox('فایل حذف شود؟')) { try { await API.del('/folders/file/' + rf.dataset.rmfile); App.refresh(); } catch (ex) { toast(ex.message, 'error'); } } return; }
      const op = q('[data-open]'); if (op) return go(op.dataset.open);
      const a = q('[data-act]'); if (!a) return;
      if (a.dataset.act === 'pdf') return App.go('m/pdf');
      if (a.dataset.act === 'upload') return $('#aup', el).click();
      if (a.dataset.act === 'mkdir') Modal.open({ title: 'پوشهٔ جدید', html: '<label class="field"><span>نام پوشه</span><input name="name"></label>', actions: [{ label: 'انصراف', cls: 'ghost', run: () => true }, { label: 'ایجاد', cls: 'primary', run: async m => { await API.post('/folders/folder', { area, name: $('[name=name]', m).value, parent_id: parent }); App.refresh(); } }] });
    };
    const up = $('#aup', el);
    if (up) up.onchange = async () => { let n = 0; for (const f of up.files) { try { await API.upload('/folders/file', { area, folder_id: parent || '' }, f); n++; } catch (ex) { toast(`${f.name}: ${ex.message}`, 'error'); } } if (n) toast(`${fmtNum(n)} فایل بارگذاری شد`, 'success'); App.refresh(); };
  } });
}
Object.keys(ARCH).forEach(archivePage);

/* ═════════ ساخت بستهٔ PDF ═════════ */
const PDF_OK = ['pdf', 'png', 'jpg', 'jpeg'];
const pk = { basket: [], opts: null, trees: {}, building: false };
const loadScriptOnce = src => window.PDFLib ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('کتابخانهٔ PDF بارگذاری نشد (pdf-lib). مطمئن شوید «npm install» اجرا شده است.')); document.head.appendChild(s); });
const loadImage = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('تصویر بارگذاری نشد')); i.src = src; });
const FONT_STACK = '"KM Body","B Nazanin","BNazanin","Vazirmatn",Tahoma,"Segoe UI",sans-serif', TITLE_STACK = '"KM Title","B Titr","BTitr","KM Body","Vazirmatn",Tahoma,sans-serif';

/* رسم متن فارسی روی canvas (شکل‌دهی حروف و راست‌به‌چپ را مرورگر انجام می‌دهد) و تبدیل به PNG */
const PDFR = {
  canvas(w, h, scale) { const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale); const x = c.getContext('2d'); x.scale(scale, scale); x.direction = 'rtl'; x.textBaseline = 'middle'; return [c, x]; },
  fit(x, text, maxW) { text = String(text); if (x.measureText(text).width <= maxW) return text; while (text.length > 1 && x.measureText(text + '…').width > maxW) text = text.slice(0, -1); return text + '…'; },
  toPng: c => new Promise(ok => c.toBlob(async b => ok(new Uint8Array(await b.arrayBuffer())), 'image/png')),
  async strip(w, h, draw, scale = 3) { const [c, x] = this.canvas(w, h, scale); draw(x); return this.toPng(c); }
};
const faN = n => toFaNum(String(n));

async function buildPackage(o, onProgress) {
  await loadScriptOnce('/vendor/pdf-lib.min.js');
  try { await document.fonts.load('16px "KM Body"'); await document.fonts.load('bold 16px "KM Body"'); await document.fonts.load('16px "KM Title"'); } catch {}
  const { PDFDocument } = PDFLib, warn = [], A4 = [595.28, 841.89];
  const doc = await PDFDocument.create();
  doc.setTitle(o.title); doc.setCreator('Kusha Madan Tender System'); doc.setProducer('pdf-lib');
  const logoPng = o.logo ? await doc.embedPng(await (await fetch('/images/logo.png')).arrayBuffer()) : null;

  /* گام ۱: دریافت فایل‌ها و شمارش صفحه‌ها */
  const items = []; let i = 0;
  for (const b of o.items) {
    onProgress(`دریافت «${b.name}» (${faN(++i)} از ${faN(o.items.length)})`, i / (o.items.length * 2));
    const ext = extOf(b.name), it = { ...b, ext, pages: 1, kind: 'note' };
    if (PDF_OK.includes(ext)) {
      try {
        const bytes = new Uint8Array(await (await fetchBlob(`/folders/file/${b.id}/download`)).arrayBuffer());
        if (ext === 'pdf') { const src = await PDFDocument.load(bytes, { ignoreEncryption: true }); it.kind = 'pdf'; it.src = src; it.bytes = bytes; it.pages = src.getPageCount(); }
        else { it.kind = 'img'; it.img = ext === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes); }
      } catch (e) { warn.push(`«${b.name}» خوانده نشد و رد شد (${e.message || 'فایل خراب یا رمزگذاری‌شده'})`); if (!o.placeholders) continue; }
    } else if (!o.placeholders) { warn.push(`«${b.name}» (${ext}) قابل ادغام در PDF نیست و رد شد`); continue; }
    else warn.push(`«${b.name}» (${ext}) قابل ادغام نیست؛ به‌جای آن یک صفحهٔ اطلاع‌رسانی درج شد`);
    items.push(it);
  }
  if (!items.length) throw new Error('هیچ سندی برای ساخت بسته باقی نماند');

  /* گام ۲: برنامهٔ صفحه‌ها (شماره‌گذاری از اولین صفحهٔ بعد از جلد) */
  const plan = []; let lastArea = null;
  items.forEach(it => { if (o.dividers && it.area !== lastArea) { plan.push({ type: 'divider', area: it.area, heading: it.areaLabel }); lastArea = it.area; } plan.push({ type: 'doc', it }); });
  const tocRows = items.length, tocPages = o.toc ? Math.ceil(tocRows / 26) : 0;
  let n = tocPages; plan.forEach(p => { p.start = n + 1; n += p.type === 'divider' ? 1 : p.it.pages; if (p.type === 'doc') p.it.start = p.start; });
  const total = n;
  const dateStr = faN(J.fromIso(J.today()));
  const stripH = 40, footH = 30, bodyFont = 'bold 13px ' + FONT_STACK;

  const addChrome = async (page, W, H, heading, no) => {
    const hdr = await PDFR.strip(W, stripH + 6, x => {
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, stripH + 6);
      x.font = 'bold 14px ' + TITLE_STACK; x.fillStyle = '#1d2433'; x.textAlign = 'right'; x.fillText(PDFR.fit(x, heading, W - 220), W - 28, 20);
      x.font = '11px ' + FONT_STACK; x.fillStyle = '#666'; x.textAlign = 'left'; if (!logoPng) x.fillText(o.company, 28, 20);
      x.fillStyle = o.color; x.fillRect(28, stripH, W - 56, 1.6);
    });
    page.drawImage(await doc.embedPng(hdr), { x: 0, y: H - stripH - 6, width: W, height: stripH + 6 });
    if (logoPng) { const lh = 26, lw = lh * logoPng.width / logoPng.height; page.drawImage(logoPng, { x: 28, y: H - 8 - lh - 4, width: lw, height: lh }); }
    const ftr = await PDFR.strip(W, footH, x => {
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, footH); x.fillStyle = o.color; x.fillRect(28, 2, W - 56, 1);
      x.font = '11px ' + FONT_STACK; x.fillStyle = '#555'; x.textAlign = 'right'; x.fillText(PDFR.fit(x, o.title, W / 2 - 60), W - 28, 17);
      x.textAlign = 'center'; x.fillText(`صفحه ${faN(no)} از ${faN(total)}`, W / 2, 17); x.textAlign = 'left'; x.fillText(`${o.company} · ${dateStr}`, 28, 17);
    }, 2.5);
    page.drawImage(await doc.embedPng(ftr), { x: 0, y: 0, width: W, height: footH });
  };
  const fullPage = async (draw, scale = 2) => { const png = await PDFR.strip(A4[0], A4[1], draw, scale); const pg = doc.addPage(A4); pg.drawImage(await doc.embedPng(png), { x: 0, y: 0, width: A4[0], height: A4[1] }); return pg; };

  /* جلد */
  if (o.cover) await fullPage(x => {
    const W = A4[0], H = A4[1]; x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.fillStyle = o.color; x.fillRect(0, 0, W, 14); x.fillRect(0, H - 14, W, 14);
    x.textAlign = 'center'; x.fillStyle = '#1d2433'; x.font = 'bold 32px ' + TITLE_STACK;
    const words = o.title.split(/\s+/); let line = '', y = 330; const lines = [];
    words.forEach(w => { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > W - 140 && line) { lines.push(line); line = w; } else line = t; }); lines.push(line);
    lines.slice(0, 4).forEach(l => { x.fillText(l, W / 2, y); y += 46; });
    x.fillStyle = o.color; x.fillRect(W / 2 - 60, y + 6, 120, 3);
    if (o.subtitle) { x.fillStyle = '#444'; x.font = '19px ' + FONT_STACK; x.fillText(PDFR.fit(x, o.subtitle, W - 140), W / 2, y + 44); }
    x.fillStyle = '#666'; x.font = '15px ' + FONT_STACK; x.fillText(`${o.company} — ${dateStr}`, W / 2, H - 70);
  });
  if (o.cover && logoPng) { const pg = doc.getPage(0), lw = 190, lh = lw * logoPng.height / logoPng.width; pg.drawImage(logoPng, { x: (A4[0] - lw) / 2, y: A4[1] - 140 - lh, width: lw, height: lh }); }

  /* فهرست */
  for (let tp = 0; tp < tocPages; tp++) {
    const pg = await fullPage(x => { x.fillStyle = '#fff'; x.fillRect(0, 0, A4[0], A4[1]); }), W = A4[0], H = A4[1];
    await addChrome(pg, W, H, 'فهرست مطالب', tp + 1);
    const rows = items.slice(tp * 26, tp * 26 + 26), png = await PDFR.strip(W, H - 150, x => {
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.textAlign = 'right'; let y = 24;
      rows.forEach((it, k) => { x.font = bodyFont; x.fillStyle = '#1d2433'; const no = tp * 26 + k + 1, label = `${faN(no)}. ${it.heading}`; x.fillText(PDFR.fit(x, label, W - 250), W - 40, y);
        x.fillStyle = '#999'; x.font = '12px ' + FONT_STACK; x.textAlign = 'left'; x.fillText(`صفحه ${faN(it.start)}`, 40, y); x.textAlign = 'right';
        x.strokeStyle = '#ddd'; x.setLineDash([2, 3]); x.beginPath(); x.moveTo(105, y + 2); x.lineTo(W - 260 + 60, y + 2); x.stroke(); x.setLineDash([]); y += 27; });
    }, 2);
    pg.drawImage(await doc.embedPng(png), { x: 0, y: 70, width: W, height: H - 150 });
  }

  /* بدنه */
  let pageNo = tocPages, done = 0;
  for (const p of plan) {
    onProgress(p.type === 'divider' ? 'ساخت صفحهٔ جداکننده' : `ادغام «${p.it.name}»`, 0.5 + (done++ / plan.length) / 2);
    if (p.type === 'divider') {
      const pg = await fullPage(x => { const W = A4[0], H = A4[1]; x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.fillStyle = o.color; x.fillRect(W / 2 - 80, H / 2 + 40, 160, 4); x.textAlign = 'center'; x.fillStyle = '#1d2433'; x.font = 'bold 34px ' + TITLE_STACK; x.fillText(p.heading, W / 2, H / 2 - 10); });
      await addChrome(pg, A4[0], A4[1], p.heading, ++pageNo); continue;
    }
    const it = p.it, cTop = stripH + 14, cBot = footH + 8;
    if (it.kind === 'pdf') {
      const emb = await doc.embedPdf(it.src, it.src.getPageIndices());
      for (const ep of emb) {
        const land = ep.width > ep.height * 1.1, W = land ? A4[1] : A4[0], H = land ? A4[0] : A4[1];
        const pg = doc.addPage([W, H]), cw = W - 40, ch = H - cTop - cBot, sc = Math.min(cw / ep.width, ch / ep.height, 1.4);
        pg.drawPage(ep, { x: (W - ep.width * sc) / 2, y: cBot + (ch - ep.height * sc) / 2, width: ep.width * sc, height: ep.height * sc });
        await addChrome(pg, W, H, it.heading, ++pageNo);
      }
    } else if (it.kind === 'img') {
      const land = it.img.width > it.img.height * 1.1, W = land ? A4[1] : A4[0], H = land ? A4[0] : A4[1], pg = doc.addPage([W, H]), cw = W - 60, ch = H - cTop - cBot - 20, sc = Math.min(cw / it.img.width, ch / it.img.height, 1.5);
      pg.drawImage(it.img, { x: (W - it.img.width * sc) / 2, y: cBot + 10 + (ch - it.img.height * sc) / 2, width: it.img.width * sc, height: it.img.height * sc });
      await addChrome(pg, W, H, it.heading, ++pageNo);
    } else {
      const pg = await fullPage(x => { const W = A4[0], H = A4[1]; x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.textAlign = 'center'; x.fillStyle = '#1d2433'; x.font = 'bold 22px ' + TITLE_STACK; x.fillText(PDFR.fit(x, it.heading, W - 100), W / 2, H / 2 - 30);
        x.font = '16px ' + FONT_STACK; x.fillStyle = '#555'; x.fillText(`این سند با قالب «${it.ext}» است و در بستهٔ PDF ادغام نشده است.`, W / 2, H / 2 + 12); x.fillText(`نام فایل: ${it.name}`, W / 2, H / 2 + 42); });
      await addChrome(pg, A4[0], A4[1], it.heading, ++pageNo);
    }
  }
  onProgress('ذخیرهٔ فایل نهایی', 1);
  const bytes = await doc.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), pages: total + (o.cover ? 1 : 0), warn };
}

App.register({ id: 'm/pdf', title: 'ساخت بستهٔ PDF', not: ['staff'], async render(el) {
  const saved = (() => { try { return JSON.parse(store.get('pkopts')) || {}; } catch { return {}; } })();
  const O = pk.opts = pk.opts || { title: saved.title || 'مدارک شرکت', subtitle: saved.subtitle || '', company: saved.company || 'کوشا معدن', color: saved.color || '#b3202a', cover: saved.cover !== false, toc: saved.toc !== false, dividers: saved.dividers !== false, logo: saved.logo !== false, placeholders: saved.placeholders !== false };
  const trees = await Promise.all(Object.keys(ARCH).map(a => API.get('/folders/tree', { area: a }).then(t => [a, t])));
  trees.forEach(([a, t]) => { pk.trees[a] = t; });
  const fileMap = {}; trees.forEach(([a, t]) => t.files.forEach(f => { fileMap[f.id] = { ...f, area: a }; }));
  pk.basket = pk.basket.filter(b => fileMap[b.id]);
  const treeHtml = (a, parent) => {
    const t = pk.trees[a], dirs = t.folders.filter(f => f.parent_id === parent), fs = t.files.filter(f => f.folder_id === parent);
    return dirs.map(f => `<details class="acc" style="margin:4px 0;box-shadow:none"><summary style="font-size:15px;padding:6px 10px"><label class="check" onclick="event.stopPropagation()"><input type="checkbox" data-dirsel="${a}:${f.id}"> </label>📁 ${esc(f.name)}</summary><div class="acc-body" style="padding:0 10px 8px">${treeHtml(a, f.id)}</div></details>`).join('') +
      fs.map(f => { const ok = PDF_OK.includes(extOf(f.file_name)); return `<label class="check tree-row" style="margin:3px 0"><input type="checkbox" data-pick="${f.id}" ${pk.basket.some(b => b.id === f.id) ? 'checked' : ''}><span style="flex:1;overflow-wrap:anywhere">${fileIcon(f.file_name)} ${esc(f.file_name)}</span>${ok ? '' : chip('غیر قابل ادغام', 'warn')}</label>`; }).join('');
  };
  const left = Object.keys(ARCH).map((a, i) => `<details class="acc" ${i === 0 ? 'open' : ''}><summary>${ARCH[a]} <small class="muted">(${fmtNum(pk.trees[a].files.length)} فایل)</small></summary><div class="acc-body">${treeHtml(a, null) || '<span class="muted">خالی است</span>'}</div></details>`).join('');
  const draw = () => {
    $('#pkBasket', el).innerHTML = pk.basket.length ? pk.basket.map((b, i) => `<div class="tree-row" data-i="${i}" style="margin-bottom:5px"><b class="muted" style="width:26px">${fmtNum(i + 1)}</b><input value="${esc(b.heading)}" data-head="${i}" style="flex:1;padding:3px 8px" aria-label="عنوان"><small class="muted nowrap">${esc(ARCH[b.area])}</small>
      <button class="btn sm" data-up="${i}" ${i ? '' : 'disabled'} aria-label="بالا">↑</button><button class="btn sm" data-down="${i}" ${i < pk.basket.length - 1 ? '' : 'disabled'} aria-label="پایین">↓</button><button class="btn sm danger" data-del="${i}" aria-label="حذف">×</button></div>`).join('') : empty('هنوز سندی انتخاب نشده است. از فهرست سمت راست، سند اضافه کنید.');
    $('#pkCount', el).textContent = fmtNum(pk.basket.length);
  };
  el.innerHTML = `<div class="resume-layout" style="grid-template-columns:minmax(300px,420px) 1fr"><div><h3 style="margin-bottom:8px">۱. انتخاب مدارک از آرشیو</h3>${left}</div>
    <div><div class="card" style="margin-bottom:12px"><h3>۲. ترتیب و عنوان مدارک (<span id="pkCount">۰</span> سند)</h3><div id="pkBasket"></div></div>
    <div class="card"><h3>۳. تنظیمات بسته</h3><div class="form-grid"><label class="field full"><span>عنوان بسته (روی جلد و پایین هر صفحه)</span><input id="o_title" value="${esc(O.title)}"></label>
      <label class="field"><span>زیرعنوان جلد (مثلاً نام مناقصه)</span><input id="o_sub" value="${esc(O.subtitle)}"></label><label class="field"><span>نام شرکت (پایین صفحه)</span><input id="o_company" value="${esc(O.company)}"></label>
      <label class="field"><span>رنگ خط سربرگ</span><input type="color" id="o_color" value="${O.color}"></label>
      <div class="full" style="display:flex;gap:18px;flex-wrap:wrap"><label class="check"><input type="checkbox" id="o_cover" ${O.cover ? 'checked' : ''}> صفحهٔ جلد</label><label class="check"><input type="checkbox" id="o_toc" ${O.toc ? 'checked' : ''}> فهرست مطالب</label><label class="check"><input type="checkbox" id="o_div" ${O.dividers ? 'checked' : ''}> صفحهٔ جداکنندهٔ هر بخش</label><label class="check"><input type="checkbox" id="o_logo" ${O.logo ? 'checked' : ''}> لوگو در سربرگ</label><label class="check"><input type="checkbox" id="o_ph" ${O.placeholders ? 'checked' : ''}> صفحهٔ اطلاع‌رسانی برای فایل‌های غیر PDF</label></div></div>
      <p class="muted small">فقط فایل‌های PDF و تصویر (PNG/JPG) در بسته ادغام می‌شوند. هر صفحه سربرگ (عنوان سند) و شمارهٔ صفحه می‌گیرد.</p>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn primary" id="pkBuild">📑 ساخت و دانلود PDF</button><div class="progress" style="flex:1;min-width:160px;display:none" id="pkBar"><i style="width:0"></i></div><span class="muted small" id="pkMsg"></span></div><div id="pkWarn"></div></div></div></div>`;
  draw();
  const toggle = (id, on) => { const f = fileMap[id]; if (!f) return; const has = pk.basket.some(b => b.id === id); if (on && !has) pk.basket.push({ id, name: f.file_name, area: f.area, areaLabel: ARCH[f.area], heading: f.file_name.replace(/\.[^.]+$/, '') }); if (!on && has) pk.basket = pk.basket.filter(b => b.id !== id); };
  el.onchange = e => {
    const p = e.target.closest('[data-pick]'); if (p) { toggle(+p.dataset.pick, p.checked); return draw(); }
    const d = e.target.closest('[data-dirsel]'); if (d) { const [a, fid] = d.dataset.dirsel.split(':'); const ids = []; const walk = f => { pk.trees[a].files.filter(x => x.folder_id === f).forEach(x => ids.push(x.id)); pk.trees[a].folders.filter(x => x.parent_id === f).forEach(x => walk(x.id)); }; walk(+fid); ids.forEach(i => toggle(i, d.checked)); $$('[data-pick]', el).forEach(c => { c.checked = pk.basket.some(b => b.id === +c.dataset.pick); }); draw(); }
  };
  el.oninput = e => { const h = e.target.closest('[data-head]'); if (h) pk.basket[+h.dataset.head].heading = h.value; };
  el.onclick = e => {
    const q = s => e.target.closest(s), u = q('[data-up]'), dn = q('[data-down]'), rm = q('[data-del]');
    if (u) { const i = +u.dataset.up; [pk.basket[i - 1], pk.basket[i]] = [pk.basket[i], pk.basket[i - 1]]; draw(); }
    if (dn) { const i = +dn.dataset.down; [pk.basket[i + 1], pk.basket[i]] = [pk.basket[i], pk.basket[i + 1]]; draw(); }
    if (rm) { const b = pk.basket.splice(+rm.dataset.del, 1)[0]; const c = $(`[data-pick="${b.id}"]`, el); if (c) c.checked = false; draw(); }
  };
  $('#pkBuild', el).onclick = async () => {
    if (pk.building) return; if (!pk.basket.length) return toast('ابتدا چند سند انتخاب کنید', 'error');
    Object.assign(O, { title: $('#o_title', el).value.trim() || 'مدارک شرکت', subtitle: $('#o_sub', el).value.trim(), company: $('#o_company', el).value.trim() || 'کوشا معدن', color: $('#o_color', el).value, cover: $('#o_cover', el).checked, toc: $('#o_toc', el).checked, dividers: $('#o_div', el).checked, logo: $('#o_logo', el).checked, placeholders: $('#o_ph', el).checked });
    store.set('pkopts', JSON.stringify(O));
    const btn = $('#pkBuild', el), bar = $('#pkBar', el), msg = $('#pkMsg', el); btn.disabled = true; pk.building = true; bar.style.display = ''; $('#pkWarn', el).innerHTML = '';
    try {
      const r = await buildPackage({ ...O, items: pk.basket.map(b => ({ ...b })) }, (m, f) => { msg.textContent = m; $('i', bar).style.width = Math.round(f * 100) + '%'; });
      saveBlob(r.blob, (O.title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'package') + '.pdf');
      msg.textContent = `✅ ساخته شد: ${fmtNum(r.pages)} صفحه · ${formatSize(r.blob.size)}`;
      if (r.warn.length) $('#pkWarn', el).innerHTML = `<div class="sample-banner" style="margin-top:10px"><div><b>هشدارها:</b><ul style="margin:4px 0 0">${r.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div></div>`;
      window.__lastPkg = r;
    } catch (ex) { msg.textContent = ''; toast(ex.message, 'error'); }
    btn.disabled = false; pk.building = false;
  };
} });
