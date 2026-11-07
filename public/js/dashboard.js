/* داشبورد مناقصات معدنی — چهار کارت در بالای صفحه (اتمام‌یافته، در حال انجام، استعلام قیمت، پروپوزال).
   هر کارت یک «کشوی سال» دارد؛ با کلیک روی کارت، نمودارهای گرافیکی و دیتاتیبل همان بخش در پایین صفحه می‌آید.
   نمودارها با SVG خالص (بدون کتابخانهٔ بیرونی) کشیده می‌شوند: حلقه‌ای، ستونی، ناحیه‌ای، شعاعی، گل‌سرخی و افقی، با گرادیان و انیمیشن.
   تصمیم شرکت/عدم شرکت و ریسک و فرصت در «کارتابل مدیریت مناقصات» هم با همین نمودارها نمایش داده می‌شود (DC.decisionPanel). */
'use strict';
const DC = (() => {
  const pct = (a, b) => b ? Math.round(a * 100 / b) : 0;
  const short = v => { v = Number(v) || 0; const a = Math.abs(v), f = (x, u) => fmtNum(Math.round(x * 10) / 10) + ' ' + u; return a >= 1e9 ? f(v / 1e9, 'میلیارد') : a >= 1e6 ? f(v / 1e6, 'میلیون') : a >= 1e3 ? f(v / 1e3, 'هزار') : fmtNum(v); };
  const P = { blue: ['#5b9bff', '#5b5cf0'], green: ['#3ee0a8', '#0fa57a'], red: ['#ff7b8a', '#e0245e'], amber: ['#ffd166', '#f59e0b'], purple: ['#b79cff', '#7c4dff'], cyan: ['#4fe3ff', '#0ea5e9'], gray: ['#9fb0c8', '#64748b'], pink: ['#ff8ad0', '#d6338f'] };
  const SEQ = ['blue', 'amber', 'green', 'purple', 'red', 'cyan', 'pink'];
  const G_LBL = { await_send: 'منتظر ارسال', sent: 'ارسال شده', await_resp: 'منتظر پاسخ', review: 'در حال بررسی' }, G_PAL = { await_send: 'amber', sent: 'blue', await_resp: 'purple', review: 'gray' };
  const R_LBL = { won: 'برنده', lost: 'بازنده', wait: 'در انتظار پاسخ' }, R_PAL = { won: 'green', lost: 'red', wait: 'amber' };
  let uid = 0;
  const gid = () => 'g' + (++uid);
  const tip = s => ` data-tip="${esc(s)}"`;
  const lg = (id, pal, dir = 'v') => `<linearGradient id="${id}" ${dir === 'v' ? 'x1="0" y1="0" x2="0" y2="1"' : 'x1="0" y1="0" x2="1" y2="0"'}><stop offset="0" stop-color="${P[pal][0]}"/><stop offset="1" stop-color="${P[pal][1]}"/></linearGradient>`;
  const nice = (mx, integer) => { if (integer) { const st = mx <= 4 ? 1 : Math.ceil(mx / 4); return st * 4; } const p = Math.pow(10, Math.floor(Math.log10(mx || 1))), f = mx / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
  const smooth = pts => { if (pts.length < 2) return `M${pts[0][0]},${pts[0][1]}`; let d = `M${pts[0][0]},${pts[0][1]}`; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = .17; d += ` C${p1[0] + (p2[0] - p0[0]) * t},${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t},${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]},${p2[1]}`; } return d; };
  const noData = (m = 'داده‌ای برای نمایش نیست') => `<div class="ch-empty">${esc(m)}</div>`;
  const legend = items => `<div class="ch-leg">${items.map(i => `<span><i style="background:linear-gradient(135deg,${P[i.pal][0]},${P[i.pal][1]})"></i>${esc(i.name)}${i.n != null ? ` <b>${i.n}</b>` : ''}</span>`).join('')}</div>`;

  /* ───── نمودارها ───── */
  // حلقه (دونات) با گرادیان و سر گرد
  function donut(slices, o = {}) {
    const tt = slices.reduce((a, s) => a + s.v, 0); if (!tt) return noData();
    const R = 72, C = 2 * Math.PI * R, live = slices.filter(s => s.v > 0), gap = live.length > 1 ? 13 : 0; let off = 0, defs = '';
    const arcs = live.map((s, i) => { const id = gid(), len = C * s.v / tt, seg = Math.max(1, len - gap); defs += lg(id, s.pal, 'v');
      const el = `<circle class="ch-arc" style="--l:${seg};--c:${C};animation-delay:${i * 90}ms;filter:drop-shadow(0 0 5px ${P[s.pal][0]}88)" cx="100" cy="100" r="${R}" fill="none" stroke="url(#${id})" stroke-width="15" stroke-linecap="round" stroke-dasharray="${seg} ${C}" stroke-dashoffset="${-(off + gap / 2)}" transform="rotate(-90 100 100)"${tip(`${s.label}: ${fmtNum(s.v)} (${fmtNum(pct(s.v, tt))}٪)`)}/>`; off += len; return el; }).join('');
    return `<div class="ch-donut"><svg viewBox="0 0 200 200"><defs>${defs}</defs><circle cx="100" cy="100" r="${R}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="15"/>${arcs}
      <text x="100" y="${o.sub ? 104 : 112}" text-anchor="middle" class="ch-big">${o.center ?? fmtNum(tt)}</text>${o.sub ? `<text x="100" y="128" text-anchor="middle" class="ch-sm">${esc(o.sub)}</text>` : ''}</svg>
      <div class="ch-leg">${slices.map(s => `<span><i style="background:linear-gradient(135deg,${P[s.pal][0]},${P[s.pal][1]})"></i>${esc(s.label)} <b>${fmtNum(s.v)}</b> <small>${fmtNum(pct(s.v, tt))}٪</small></span>`).join('')}</div></div>`;
  }
  // ستونی (چیده‌شده یا کنار هم) + خط درصد اختیاری روی همان نمودار
  // rows: [{ label, vals:[...] }]؛ o: { series:[{name,pal}], stacked, line:{ name, vals:[%], pal }, money }
  function bars(rows, o = {}) {
    if (!rows.length) return noData();
    const W = 680, H = rows.length > 8 ? 310 : 280, pl = 46, pr = o.line ? 44 : 14, pt = 30, pb = rows.length > 8 ? 62 : 36, rtl = isFa(), n = rows.length, S = o.series, stacked = o.stacked !== false, fmt = o.money ? short : fmtNum;
    const tot = r => stacked ? r.vals.reduce((a, b) => a + b, 0) : Math.max(...r.vals), mx = Math.max(1, ...rows.map(tot)), top = nice(mx, !o.money);
    const x = i => pl + (W - pl - pr) * (rtl ? n - i - .5 : i + .5) / n, y = v => pt + (H - pt - pb) * (1 - v / top), slot = (W - pl - pr) / n, bw = Math.min(54, slot * .6);
    const base = uid++;
    const defs = S.map((s, i) => lg('b' + base + '_' + i, s.pal)).join('');
    let grid = ''; for (let i = 0; i <= 4; i++) { const v = top * i / 4; grid += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="ch-grid"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end" class="ch-ax">${fmt(Math.round(v * 10) / 10)}</text>`; }
    const col = rows.map((r, i) => {
      let acc = 0, segs = '';
      if (stacked) r.vals.forEach((v, k) => { if (!v) return; const y1 = y(acc + v), h = Math.max(0, y(acc) - y1); acc += v; segs += `<rect class="ch-bar" style="--i:${i}" x="${x(i) - bw / 2}" y="${y1}" width="${bw}" height="${h}" rx="6" fill="url(#b${base}_${k})"${tip(`${r.label} — ${S[k].name}: ${fmt(v)}`)}/>`; });
      else { const w1 = bw / S.length; r.vals.forEach((v, k) => { const hh = Math.max(0, y(0) - y(v)); segs += `<rect class="ch-bar" style="--i:${i + k}" x="${x(i) - bw / 2 + k * w1}" y="${y(v)}" width="${w1 - 3}" height="${hh}" rx="5" fill="url(#b${base}_${k})"${tip(`${r.label} — ${S[k].name}: ${fmt(v)}`)}/>`; }); }
      const t = tot(r);
      const lab = n > 8 ? `<text transform="translate(${x(i)} ${H - 22}) rotate(-38)" text-anchor="end" class="ch-ax">${esc(r.label)}</text>` : `<text x="${x(i)}" y="${H - 12}" text-anchor="middle" class="ch-ax">${esc(r.label)}</text>`;
      return `${segs}${lab}${t && !o.line ? `<text x="${x(i)}" y="${y(t) - 7}" text-anchor="middle" class="ch-val">${fmt(t)}</text>` : ''}`;
    }).join('');
    let line = '';
    if (o.line) {
      const ly = v => pt + (H - pt - pb) * (1 - v / 100), pts = rows.map((_, i) => [x(i), ly(o.line.vals[i] || 0)]), lid = 'l' + base, aid = 'a' + base, pal = o.line.pal || 'cyan';
      line = `<defs><linearGradient id="${aid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P[pal][0]}" stop-opacity=".30"/><stop offset="1" stop-color="${P[pal][0]}" stop-opacity="0"/></linearGradient>${lg(lid, pal, 'h')}</defs>
        <path class="ch-area" d="${smooth(pts)} L${pts[n - 1][0]},${ly(0)} L${pts[0][0]},${ly(0)} Z" fill="url(#${aid})"/><path class="ch-line" pathLength="1" d="${smooth(pts)}" fill="none" stroke="url(#${lid})" stroke-width="3" stroke-linecap="round" style="filter:drop-shadow(0 0 5px ${P[pal][0]}99)"/>
        ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#0f1320" stroke="${P[pal][0]}" stroke-width="2.5"${tip(`${rows[i].label} — ${o.line.name}: ${fmtNum(o.line.vals[i] || 0)}٪`)}/><text x="${p[0]}" y="${p[1] - 11}" text-anchor="middle" class="ch-val" style="fill:${P[pal][0]}">${fmtNum(o.line.vals[i] || 0)}٪</text>`).join('')}
        ${[0, 50, 100].map(v => `<text x="${W - pr + 8}" y="${ly(v) + 4}" class="ch-ax">${fmtNum(v)}٪</text>`).join('')}`;
    }
    const leg = legend([...S.map(s => ({ name: s.name, pal: s.pal })), ...(o.line ? [{ name: o.line.name, pal: o.line.pal || 'cyan' }] : [])]);
    return `${leg}<svg class="ch-svg" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${grid}${col}${line}</svg>`;
  }
  // ناحیه‌ای نرم: rows [{ label, v }]
  function trend(rows, o = {}) {
    if (!rows.length) return noData();
    const W = o.w || 680, H = o.h || 240, pl = o.w ? 40 : 46, pr = 18, pt = 30, pb = 34, rtl = isFa(), n = rows.length, pal = o.pal || 'blue', fmt = o.money ? short : fmtNum, id = gid(), top = nice(Math.max(1, ...rows.map(r => r.v)), !o.money);
    const x = i => n === 1 ? (W + pl - pr) / 2 : pl + (W - pl - pr) * (rtl ? n - 1 - i : i) / (n - 1), y = v => pt + (H - pt - pb) * (1 - v / top), pts = rows.map((r, i) => [x(i), y(r.v)]);
    let grid = ''; for (let i = 0; i <= 4; i++) { const v = top * i / 4; grid += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="ch-grid"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end" class="ch-ax">${fmt(Math.round(v * 10) / 10)}</text>`; }
    return `<svg class="ch-svg" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P[pal][0]}" stop-opacity=".45"/><stop offset="1" stop-color="${P[pal][0]}" stop-opacity="0"/></linearGradient>${lg(id + 'l', pal, 'h')}</defs>${grid}
      ${n > 1 ? `<path class="ch-area" d="${smooth(pts)} L${pts[n - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z" fill="url(#${id}a)"/>` : ''}<path class="ch-line" pathLength="1" d="${smooth(pts)}" fill="none" stroke="url(#${id}l)" stroke-width="3.2" stroke-linecap="round" style="filter:drop-shadow(0 0 6px ${P[pal][0]}99)"/>
      ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="5.5" fill="#0f1320" stroke="${P[pal][0]}" stroke-width="2.5"${tip(`${rows[i].label}: ${fmt(rows[i].v)}`)}/><text x="${p[0]}" y="${p[1] - 12}" text-anchor="middle" class="ch-val">${fmt(rows[i].v)}</text><text x="${p[0]}" y="${H - 12}" text-anchor="middle" class="ch-ax">${esc(rows[i].label)}</text>`).join('')}</svg>`;
  }
  // افقی: rows [{ name, v, pal, label, id, tip }]
  function hbars(rows) {
    if (!rows.length) return noData();
    const mx = Math.max(1, ...rows.map(r => r.v));
    return rows.map((r, i) => `<div class="ch-h ${r.id ? 'click' : ''}" ${r.id ? `data-tender="${r.id}"` : ''}${tip(r.tip || `${r.name}: ${r.label ?? fmtNum(r.v)}`)}><span class="nm">${esc(r.name)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span><b>${r.label ?? fmtNum(r.v)}</b><div class="trk"><i style="width:${Math.max(2, r.v * 100 / mx)}%;background:linear-gradient(90deg,${P[r.pal || 'blue'][1]},${P[r.pal || 'blue'][0]});box-shadow:0 0 12px ${P[r.pal || 'blue'][0]}66;animation-delay:${i * 60}ms"></i></div></div>`).join('');
  }
  // حلقه‌های هم‌مرکز (درصد از ۱۰۰): items [{ label, v, pal }]
  function radial(items) {
    items = items.filter(i => i.v != null); if (!items.length) return noData('امتیازی ثبت نشده است');
    const rad = [86, 68, 50, 32], id = gid();
    const arcs = items.slice(0, 4).map((it, i) => { const R = rad[i], C = 2 * Math.PI * R, l = C * Math.min(100, Math.max(0, it.v)) / 100; return `<defs>${lg(id + i, it.pal, 'h')}</defs><circle cx="110" cy="110" r="${R}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="11"/><circle class="ch-arc" style="--l:${l};--c:${C};animation-delay:${i * 120}ms;filter:drop-shadow(0 0 5px ${P[it.pal][0]}88)" cx="110" cy="110" r="${R}" fill="none" stroke="url(#${id + i})" stroke-width="11" stroke-linecap="round" stroke-dasharray="${l} ${C}" transform="rotate(-90 110 110)"${tip(`${it.label}: ${fmtNum(it.v)}`)}/>`; }).join('');
    return `<div class="ch-radial"><svg viewBox="0 0 220 220">${arcs}</svg><div class="ch-leg col">${items.slice(0, 4).map(it => `<span><i style="background:linear-gradient(135deg,${P[it.pal][0]},${P[it.pal][1]})"></i>${esc(it.label)} <b>${fmtNum(it.v)}</b></span>`).join('')}</div></div>`;
  }
  // گل‌سرخ (Nightingale): items [{ label, v, pal }]
  function rose(items) {
    items = items.filter(i => i.v > 0); if (!items.length) return noData();
    const n = items.length, mx = Math.max(...items.map(i => i.v)), cx = 110, cy = 110, R0 = 18, R1 = 98, id = gid(), step = 2 * Math.PI / n, gap = n > 1 ? .035 : 0, rtl = isFa();
    const pt = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
    const sec = items.map((it, i) => { const a0 = (rtl ? -1 : 1) * (i * step + gap), a1 = (rtl ? -1 : 1) * ((i + 1) * step - gap), r = R0 + (R1 - R0) * Math.sqrt(it.v / mx), p0 = pt(R0, a0), p1 = pt(r, a0), p2 = pt(r, a1), p3 = pt(R0, a1), sw = rtl ? 0 : 1, big = (step - 2 * gap) > Math.PI ? 1 : 0;
      return `<defs>${lg(id + i, it.pal, 'v')}</defs><path class="ch-rose" style="--i:${i}" d="M${p0} L${p1} A${r},${r} 0 ${big} ${sw} ${p2} L${p3} A${R0},${R0} 0 ${big} ${1 - sw} ${p0} Z" fill="url(#${id + i})" stroke="#0f1320" stroke-width="1.2"${tip(`${it.label}: ${fmtNum(it.v)}`)}/>`; }).join('');
    return `<div class="ch-radial"><svg viewBox="0 0 220 220">${[.33, .66, 1].map(f => `<circle cx="${cx}" cy="${cy}" r="${R0 + (R1 - R0) * f}" fill="none" stroke="rgba(255,255,255,.07)" stroke-dasharray="2 4"/>`).join('')}${sec}</svg>
      <div class="ch-leg col">${items.map(it => `<span><i style="background:linear-gradient(135deg,${P[it.pal][0]},${P[it.pal][1]})"></i>${esc(it.label)} <b>${fmtNum(it.v)}</b></span>`).join('')}</div></div>`;
  }
  // خط کوچک روند برای کارت‌ها
  function spark(vals, pal) {
    const n = vals.length; if (n < 2 || !vals.some(Boolean)) return '';
    const W = 130, H = 38, mx = Math.max(1, ...vals), rtl = isFa(), id = gid(), pts = vals.map((v, i) => [(rtl ? n - 1 - i : i) * W / (n - 1), H - 4 - (H - 10) * v / mx]).sort((a, b) => a[0] - b[0]);
    return `<svg class="dt-spark" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path d="${smooth(pts)} L${W},${H} L0,${H} Z" fill="url(#${id})"/><path d="${smooth(pts)}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  }
  function miniRing(v) {
    const R = 17, C = 2 * Math.PI * R;
    return `<svg class="dt-ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="${R}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="5"/><circle cx="22" cy="22" r="${R}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C * v / 100} ${C}" transform="rotate(-90 22 22)"/><text x="22" y="26" text-anchor="middle">${fmtNum(v)}٪</text></svg>`;
  }

  /* ───── اجزای صفحه ───── */
  const kpis = items => `<div class="dkpis">${items.map(k => `<div class="dkpi" style="--c1:${P[k.pal || 'blue'][0]};--c2:${P[k.pal || 'blue'][1]}"><b>${k.v}</b><span>${esc(k.l)}</span></div>`).join('')}</div>`;
  const card = (title, body, cls = '') => `<div class="dcard ${cls}"><h4>${esc(title)}</h4>${body}</div>`;
  const insights = a => { a = a.filter(Boolean); return a.length ? `<div class="dins">${a.map(t => `<span>💡 ${t}</span>`).join('')}</div>` : ''; };
  const chip = (t, pal) => `<span class="dchip" style="--c1:${P[pal][0]};--c2:${P[pal][1]}">${esc(t)}</span>`;
  const yLbl = y => y ? 'سال ' + fmtYear(y) : 'همه سال‌ها';

  /* ───── دیتاتیبل: جستجو، مرتب‌سازی، خروجی اکسل(CSV) ───── */
  function dataTable(host, cfg) {
    const st = { q: '', sort: -1, dir: 1, lim: 15 };
    const val = (c, r) => c.sort ? c.sort(r) : r[c.k];
    const draw = () => {
      const q = toLatin(st.q).toLowerCase();
      let rows = cfg.rows.filter(r => !q || cfg.cols.some(c => String(c.csv ? c.csv(r) : (r[c.k] ?? '')).toLowerCase().includes(q)));
      if (st.sort >= 0) { const c = cfg.cols[st.sort]; rows = rows.slice().sort((a, b) => { const x = val(c, a), y = val(c, b); return (x == null ? 1 : y == null ? -1 : typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fa')) * st.dir; }); }
      $('.dt-body', host).innerHTML = rows.slice(0, st.lim).map(r => `<tr ${cfg.go && r.id ? `class="click" data-tender="${r.id}"` : ''}>${cfg.cols.map(c => `<td class="${c.cls || ''}">${c.fmt ? c.fmt(r) : esc(r[c.k] ?? '—')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cfg.cols.length}">${noData('موردی پیدا نشد')}</td></tr>`;
      $('.dt-count', host).textContent = `${fmtNum(Math.min(st.lim, rows.length))} از ${fmtNum(rows.length)} ردیف`;
      $('.dt-more', host).classList.toggle('hidden', rows.length <= st.lim);
      $$('th', host).forEach((th, i) => { th.dataset.dir = i === st.sort ? (st.dir > 0 ? '▲' : '▼') : ''; });
      host._rows = rows;
    };
    host.innerHTML = `<div class="dt-tools"><input type="search" class="dt-q" placeholder="جستجو در جدول…"><span class="dt-count muted"></span><span class="spacer"></span><button class="dbtn" data-x="csv" type="button">⬇ خروجی اکسل</button></div>
      <div class="dt-wrap"><table class="dtbl"><thead><tr>${cfg.cols.map((c, i) => `<th data-i="${i}" class="${c.cls || ''}">${esc(c.l)}</th>`).join('')}</tr></thead><tbody class="dt-body"></tbody></table></div><button class="dbtn dt-more" data-x="more" type="button">نمایش بیشتر</button>`;
    host.addEventListener('input', e => { if (e.target.classList.contains('dt-q')) { st.q = e.target.value; st.lim = 15; draw(); } });
    host.addEventListener('click', e => {
      const th = e.target.closest('th[data-i]'); if (th) { const i = +th.dataset.i; st.dir = st.sort === i ? -st.dir : 1; st.sort = i; return draw(); }
      const b = e.target.closest('[data-x]'); if (!b) return;
      if (b.dataset.x === 'more') { st.lim += 25; draw(); }
      if (b.dataset.x === 'csv') { const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"'; const lines = [cfg.cols.map(c => q(c.l)).join(',')].concat((host._rows || []).map(r => cfg.cols.map(c => q(c.csv ? c.csv(r) : r[c.k])).join(','))); saveBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), (cfg.name || 'table') + '.csv'); }
    });
    draw();
  }
  const money = v => v == null || v === '' ? '—' : fmtNum(v);
  const resChip = r => r ? chip(R_LBL[r] || r, R_PAL[r] || 'gray') : '<span class="muted">—</span>';

  /* ───── محتوای هر بخش ───── */
  const VIEW = {
    finished(d, year) {
      const T = d.totals, avgs = [{ label: 'میانگین امتیاز کیفی', v: T.avg_quality, pal: 'blue' }, { label: 'میانگین امتیاز فنی', v: T.avg_technical, pal: 'green' }, { label: 'میانگین امتیاز مالی', v: T.avg_price, pal: 'amber' }, { label: 'میانگین امتیاز کل', v: T.avg_total, pal: 'purple' }];
      const bestY = d.per_year.slice().sort((a, b) => b.rate - a.rate || b.won - a.won)[0], big = d.rows.filter(r => r.result === 'won' && r.contract).sort((a, b) => b.contract - a.contract)[0];
      const cl = c => ({ name: c.name, v: c.rate, pal: c.rate >= 50 ? 'green' : 'red', label: `${fmtNum(c.rate)}٪ · ${fmtNum(c.won)} از ${fmtNum(c.won + c.lost)}` });
      const html = `${kpis([{ v: fmtNum(T.total), l: 'مناقصهٔ دارای نتیجه', pal: 'blue' }, { v: fmtNum(T.won), l: 'برنده', pal: 'green' }, { v: fmtNum(T.lost), l: 'بازنده', pal: 'red' }, { v: fmtNum(T.rate) + '٪', l: 'ضریب موفقیت', pal: 'cyan' }, { v: fmtNum(T.pending), l: 'در انتظار نتیجه', pal: 'amber' }, { v: short(T.won_amount), l: 'مجموع قراردادهای برنده', pal: 'purple' }])}
        ${insights([bestY && `بهترین سال: <b>${fmtYear(bestY.y)}</b> با ضریب موفقیت <b>${fmtNum(bestY.rate)}٪</b>`, big && `بزرگ‌ترین قرارداد: <b>${esc(big.title)}</b> (${short(big.contract)})`, T.closed ? `<b>${fmtNum(T.closed)}</b> مناقصه را شرکت نکردیم (بسته‌شده)` : ''])}
        <div class="dgrid">
          ${card('ضریب موفقیت', donut([{ v: T.won, pal: 'green', label: 'برنده' }, { v: T.lost, pal: 'red', label: 'بازنده' }], { center: fmtNum(T.rate) + '٪', sub: `${fmtNum(T.total)} مناقصه` }))}
          ${card('اکتشافی در برابر نظارتی', d.by_kind.map(k => `<div class="dsub">${esc(KIND[k.kind])}</div>${hbars([{ name: 'ضریب موفقیت', v: k.rate, pal: k.rate >= 50 ? 'green' : 'red', label: `${fmtNum(k.rate)}٪ · ${fmtNum(k.won)} از ${fmtNum(k.won + k.lost)}` }])}`).join(''))}
          ${card('امتیازهای مناقصه‌های برنده', radial(avgs))}
          ${card('برد و باخت در هر سال + ضریب موفقیت', bars(d.per_year.map(p => ({ label: fmtYear(p.y), vals: [p.won, p.lost] })), { series: [{ name: 'برنده', pal: 'green' }, { name: 'بازنده', pal: 'red' }], line: { name: 'ضریب موفقیت', vals: d.per_year.map(p => p.rate), pal: 'cyan' } }), 'span2')}
          ${card('مبلغ قراردادهای برنده در هر سال', trend(d.per_year.map(p => ({ label: fmtYear(p.y), v: p.amount })), { money: true, pal: 'purple', w: 360, h: 280 }))}
          ${card('کارفرماهایی که بیشتر برنده شده‌ایم', hbars(d.best_clients.map(cl)))}${card('کارفرماهایی که کمتر برنده شده‌ایم', hbars(d.worst_clients.map(cl)))}
        </div>`;
      return { html, table: { name: 'finished-tenders', go: true, rows: d.rows, cols: [
        { k: 'y', l: 'سال', fmt: r => fmtYear(r.y), cls: 'num' }, { k: 'title', l: 'مناقصه', fmt: r => `<b>${esc(r.title)}</b>` }, { k: 'client', l: 'کارفرما' }, { k: 'kind', l: 'نوع', fmt: r => esc(KIND[r.kind] || '—'), csv: r => KIND[r.kind] || '' },
        { k: 'result', l: 'نتیجه', fmt: r => resChip(r.result === 'won' ? 'won' : r.result === 'lost' ? 'lost' : 'wait'), csv: r => r.result === 'won' ? 'برنده' : r.result === 'lost' ? 'بازنده' : 'در انتظار' },
        { k: 'rank', l: 'رتبه', cls: 'num', fmt: r => r.rank ?? '—' }, { k: 'score', l: 'امتیاز کل', cls: 'num', fmt: r => r.score ?? '—' }, { k: 'offer', l: 'پیشنهاد ما', cls: 'num', fmt: r => money(r.offer) }, { k: 'contract', l: 'مبلغ قرارداد', cls: 'num', fmt: r => money(r.contract) }] } };
    },
    running(d, year) {
      const T = d.totals, g = k => (d.groups.find(x => x.g === k) || { n: 0 }).n, near = d.upcoming[0];
      const dl = u => { const n = Math.max(0, daysFromToday(u.deadline) ?? 0); return { name: u.title, v: Math.max(2, 60 - Math.min(60, n)), pal: n <= 3 ? 'red' : n <= 7 ? 'amber' : 'blue', label: n === 0 ? 'امروز' : fmtNum(n) + ' روز مانده', id: u.id, tip: `${u.title} — مهلت ${fmtDate(u.deadline)}` }; };
      const R = d.risk, html = `${kpis([{ v: fmtNum(T.total), l: 'مناقصهٔ جاری', pal: 'blue' }, { v: fmtNum(g('await_send')), l: 'منتظر ارسال', pal: 'amber' }, { v: fmtNum(g('sent')), l: 'ارسال شده', pal: 'cyan' }, { v: fmtNum(g('await_resp')), l: 'منتظر پاسخ', pal: 'purple' }, { v: short(T.offer), l: 'مجموع مبلغ پیشنهادی', pal: 'green' }, { v: short(T.guarantee), l: 'مجموع ضمانت‌نامه‌ها', pal: 'pink' }])}
        ${insights([near && `نزدیک‌ترین مهلت: <b>${esc(near.title)}</b> (${fmtDate(near.deadline)})`, T.guarantee_pending ? `<b>${fmtNum(T.guarantee_pending)}</b> ضمانت‌نامه در انتظار واحد مالی است` : '', 'ضریب موفقیت برای مناقصه‌های در حال انجام محاسبه نمی‌شود'])}
        <div class="dgrid">
          ${card('وضعیت ارسال', donut(d.groups.map(x => ({ v: x.n, pal: G_PAL[x.g], label: G_LBL[x.g] })), { sub: 'مناقصه' }))}
          ${card(`تعداد مناقصه‌ها به تفکیک ماه و وضعیت${year ? ' — ' + fmtYear(year) : ''}`, bars(d.months.map(m => ({ label: year ? m.label : m.label + ' ' + String(fmtYear(m.y)).slice(-2), vals: ['await_send', 'sent', 'await_resp', 'review'].map(k => m.g[k]) })), { series: ['await_send', 'sent', 'await_resp', 'review'].map(k => ({ name: G_LBL[k], pal: G_PAL[k] })) }), 'span2')}
          ${card('مبلغ پیشنهادی و ضمانت‌نامه در هر ماه', bars(d.months.map(m => ({ label: m.label, vals: [m.offer, m.guarantee] })), { stacked: false, money: true, series: [{ name: 'مبلغ پیشنهادی', pal: 'green' }, { name: 'ضمانت‌نامه', pal: 'pink' }] }), 'span2')}
          ${card('کارفرماها (تعداد مناقصه)', rose(d.clients.map((c, i) => ({ label: c.name, v: c.n, pal: SEQ[i % SEQ.length] }))))}
          ${card('نزدیک‌ترین مهلت‌ها — نوار بلندتر یعنی فوری‌تر', hbars(d.upcoming.map(dl)))}
          ${card('ریسک و فرصت', `${hbars([{ name: 'دارای ریسک ثبت‌شده', v: R.with_risk, pal: 'red' }, { name: 'دارای فرصت ثبت‌شده', v: R.with_opp, pal: 'green' }, { name: 'بدون ثبت', v: R.none, pal: 'gray' }])}${R.items.slice(0, 5).map(i => `<div class="dri" data-tender="${i.id}"><b>${esc(i.title)}</b>${i.risk ? `<div>${chip('ریسک', 'red')} ${esc(i.risk)}</div>` : ''}${i.opp ? `<div>${chip('فرصت', 'green')} ${esc(i.opp)}</div>` : ''}</div>`).join('')}`, 'span2')}
        </div>`;
      return { html, table: { name: 'running-tenders', go: true, rows: d.rows, cols: [
        { k: 'title', l: 'مناقصه', fmt: r => `<b>${esc(r.title)}</b>` }, { k: 'client', l: 'کارفرما' }, { k: 'group', l: 'وضعیت', fmt: r => chip(G_LBL[r.group], G_PAL[r.group]), csv: r => G_LBL[r.group] },
        { k: 'deadline', l: 'مهلت ارسال', cls: 'num', fmt: r => r.deadline ? esc(fmtDate(r.deadline)) : '—', csv: r => r.deadline ? fmtDate(r.deadline) : '' }, { k: 'budget', l: 'مبلغ پایه', cls: 'num', fmt: r => money(r.budget) },
        { k: 'offer', l: 'مبلغ پیشنهادی', cls: 'num', fmt: r => money(r.offer) }, { k: 'guarantee', l: 'ضمانت‌نامه', cls: 'num', fmt: r => `${money(r.guarantee)} ${r.g_status === 'received' ? chip('دریافت شد', 'green') : r.g_status === 'pending' ? chip('در انتظار', 'amber') : ''}`, csv: r => r.guarantee ?? '' }] } };
    },
    inquiries(d, year) {
      const T = d.totals, top = d.rows.filter(r => r.amount).sort((a, b) => b.amount - a.amount).slice(0, 12);
      const html = `${kpis([{ v: fmtNum(T.total), l: 'استعلام', pal: 'blue' }, { v: fmtNum(T.won), l: 'برنده', pal: 'green' }, { v: fmtNum(T.lost), l: 'بازنده', pal: 'red' }, { v: fmtNum(T.wait), l: 'در انتظار پاسخ', pal: 'amber' }, { v: fmtNum(T.rate) + '٪', l: 'ضریب موفقیت', pal: 'cyan' }, { v: short(T.amount), l: 'مجموع قیمت پیشنهادی', pal: 'purple' }])}
        <div class="dgrid">
          ${card('نتیجهٔ استعلام‌ها', donut([{ v: T.won, pal: 'green', label: 'برنده' }, { v: T.lost, pal: 'red', label: 'بازنده' }, { v: T.wait, pal: 'amber', label: 'در انتظار پاسخ' }], { center: fmtNum(T.rate) + '٪', sub: 'ضریب موفقیت' }))}
          ${card('استعلام‌ها در هر سال به تفکیک نتیجه', bars(d.per_year.map(p => ({ label: fmtYear(p.y), vals: [p.won, p.lost, p.wait] })), { series: [{ name: 'برنده', pal: 'green' }, { name: 'بازنده', pal: 'red' }, { name: 'در انتظار پاسخ', pal: 'amber' }] }), 'span2')}
          ${card('قیمت پیشنهادی هر استعلام (نام استعلام ‹ طرف / کارفرما ›)', legend([{ name: 'برنده', pal: 'green' }, { name: 'بازنده', pal: 'red' }, { name: 'در انتظار پاسخ', pal: 'amber' }]) + hbars(top.map(r => ({ name: r.title, sub: r.client || '', v: r.amount, pal: R_PAL[r.result], label: short(r.amount), tip: `${r.title}${r.client ? ' — ' + r.client : ''} · ${R_LBL[r.result]} · ${fmtNum(r.amount)}` }))), 'span3')}
        </div>`;
      return { html, table: { name: 'inquiries', rows: d.rows, cols: [
        { k: 'title', l: 'نام استعلام / مناقصه', fmt: r => `<b>${esc(r.title)}</b>` }, { k: 'client', l: 'طرف / کارفرما' }, { k: 'date', l: 'تاریخ', cls: 'num', fmt: r => r.date ? esc(fmtDate(r.date)) : '—', csv: r => r.date ? fmtDate(r.date) : '' },
        { k: 'amount', l: 'قیمت پیشنهادی', cls: 'num', fmt: r => money(r.amount) }, { k: 'result', l: 'نتیجه', fmt: r => resChip(r.result), csv: r => R_LBL[r.result] }] } };
    },
    proposals(d, year) {
      const T = d.totals, bc = d.clients[0];
      const html = `${kpis([{ v: fmtNum(T.total), l: 'پروپوزال', pal: 'blue' }, { v: fmtNum(T.won), l: 'برنده', pal: 'green' }, { v: fmtNum(T.lost), l: 'بازنده', pal: 'red' }, { v: fmtNum(T.wait), l: 'در انتظار نتیجه', pal: 'amber' }, { v: fmtNum(T.rate) + '٪', l: 'ضریب موفقیت', pal: 'cyan' }, { v: short(T.amount), l: 'مجموع مبلغ پیشنهادی', pal: 'purple' }])}
        ${insights([bc && `بیشترین موفقیت با کارفرمای <b>${esc(bc.name)}</b> (${fmtNum(bc.won)} برنده)`])}
        <div class="dgrid">
          ${card('ضریب موفقیت', donut([{ v: T.won, pal: 'green', label: 'برنده' }, { v: T.lost, pal: 'red', label: 'بازنده' }, { v: T.wait, pal: 'amber', label: 'در انتظار نتیجه' }], { center: fmtNum(T.rate) + '٪', sub: 'ضریب موفقیت' }))}
          ${card('برد و باخت در هر سال + ضریب موفقیت', bars(d.per_year.map(p => ({ label: fmtYear(p.y), vals: [p.won, p.lost] })), { series: [{ name: 'برنده', pal: 'green' }, { name: 'بازنده', pal: 'red' }], line: { name: 'ضریب موفقیت', vals: d.per_year.map(p => p.rate), pal: 'cyan' } }), 'span2')}
          ${card('وضعیت پروپوزال‌ها', rose(d.by_status.map((x, i) => ({ label: PROP_STATUS[x.status] || x.status, v: x.n, pal: SEQ[i % SEQ.length] }))))}
          ${card('مبلغ پیشنهادی در هر سال', trend(d.per_year.map(p => ({ label: fmtYear(p.y), v: p.amount })), { money: true, pal: 'purple' }), 'span2')}
          ${card('کارفرماها — ضریب موفقیت', hbars(d.clients.map(c => ({ name: c.name, v: c.rate, pal: c.rate >= 50 ? 'green' : 'red', label: `${fmtNum(c.rate)}٪ · ${fmtNum(c.won)} از ${fmtNum(c.won + c.lost)}` }))), 'span3')}
        </div>`;
      return { html, table: { name: 'proposals', rows: d.rows, cols: [
        { k: 'title', l: 'پروپوزال', fmt: r => `<b>${esc(r.title)}</b>` }, { k: 'client', l: 'کارفرما' }, { k: 'date', l: 'تاریخ ارسال', cls: 'num', fmt: r => r.date ? esc(fmtDate(r.date)) : '—', csv: r => r.date ? fmtDate(r.date) : '' },
        { k: 'amount', l: 'مبلغ پیشنهادی', cls: 'num', fmt: r => money(r.amount) }, { k: 'status', l: 'وضعیت', fmt: r => esc(PROP_STATUS[r.status] || r.status), csv: r => PROP_STATUS[r.status] || r.status }, { k: 'result', l: 'نتیجه', fmt: r => resChip(r.result), csv: r => R_LBL[r.result] }] } };
    }
  };

  /* ───── راهنمای نمودار (tooltip سراسری) ───── */
  function ensureTip() {
    if (window._chTip) return; const t = document.createElement('div'); t.className = 'ch-tip'; document.body.appendChild(t); window._chTip = t;
    document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (!el) { t.style.opacity = 0; return; } t.textContent = el.getAttribute('data-tip'); t.style.opacity = 1; });
    document.addEventListener('mousemove', e => { if (t.style.opacity === '1') { t.style.left = Math.min(innerWidth - t.offsetWidth - 8, e.clientX + 14) + 'px'; t.style.top = (e.clientY + 16) + 'px'; } });
  }

  /* ───── صفحهٔ داشبورد ───── */
  const TILES = [
    { k: 'finished', ico: '✅', t: 'مناقصه‌های اتمام‌یافته', pal: 'green' }, { k: 'running', ico: '⏳', t: 'مناقصه‌های در حال انجام', pal: 'blue' },
    { k: 'inquiries', ico: '💲', t: 'استعلام قیمت', pal: 'amber' }, { k: 'proposals', ico: '📨', t: 'پروپوزال‌ها', pal: 'purple' }];
  const sel = { sec: '', year: { finished: '', running: '', inquiries: '', proposals: '' } };
  function tileSub(k, ov) {
    if (k === 'finished') return `${fmtNum(ov.finished.won)} برنده از ${fmtNum(ov.finished.total)} · ضریب موفقیت`;
    if (k === 'running') return `${fmtNum(ov.running.await_send)} منتظر ارسال · ${fmtNum(ov.running.sent)} ارسال‌شده · ${fmtNum(ov.running.await_resp)} منتظر پاسخ`;
    if (k === 'inquiries') return `${fmtNum(ov.inquiries.won)} برنده · ضریب موفقیت`;
    return `${fmtNum(ov.proposals.won)} برنده · ضریب موفقیت`;
  }
  const countUp = el => { const to = +el.dataset.n || 0, t0 = performance.now(); const f = now => { const p = Math.min(1, (now - t0) / 700); el.textContent = fmtNum(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); };

  App.register({ id: 'm/dashboard', title: 'داشبورد', not: ['staff'], async render(el) {
    ensureTip();
    const ov = await API.get('/dashboard/overview');
    const rate = k => k === 'finished' ? ov.finished : k === 'inquiries' ? ov.inquiries : k === 'proposals' ? ov.proposals : null;
    const total = k => ov[k].total;
    el.innerHTML = `<div class="dtiles">${TILES.map((t, i) => { const r = rate(t.k), ys = ov.years_by[t.k].slice().reverse();
      return `<div class="dtile" data-sec="${t.k}" tabindex="0" role="button" style="--c1:${P[t.pal][0]};--c2:${P[t.pal][1]};--d:${i * 80}ms">
        <div class="dt-top"><span class="dt-ico">${t.ico}</span><b>${t.t}</b></div>
        <div class="dt-mid"><div class="dt-num" data-n="${total(t.k)}">0</div>${r ? miniRing(r.rate) : ''}</div>
        <div class="dt-sub">${tileSub(t.k, ov)}${r ? ` <b>${fmtNum(r.rate)}٪</b>` : ''}</div>
        ${spark(ov.trend[t.k], t.pal)}
        <select class="dt-year" data-y="${t.k}" aria-label="سال"><option value="">همه سال‌ها</option>${ys.map(y => `<option value="${y}" ${String(sel.year[t.k]) === String(y) ? 'selected' : ''}>سال ${fmtYear(y)}</option>`).join('')}</select></div>`; }).join('')}</div>
      <div id="dpanel" class="dpanel-host"></div>`;
    $$('.dt-num', el).forEach(countUp);
    const host = $('#dpanel', el);
    const open = async k => {
      sel.sec = k; $$('.dtile', el).forEach(t => t.classList.toggle('on', t.dataset.sec === k));
      const tl = TILES.find(t => t.k === k), year = sel.year[k];
      host.innerHTML = `<section class="dpanel" style="--c1:${P[tl.pal][0]};--c2:${P[tl.pal][1]}"><header><div><h3>${tl.ico} ${tl.t}</h3><small>${yLbl(year)}</small></div><button class="dbtn" data-x="refresh" type="button">⟳ به‌روزرسانی</button></header><div class="dp-body"><div class="ch-empty">در حال بارگذاری…</div></div></section>`;
      host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const body = $('.dp-body', host), mine = sel._tok = Symbol();
      try {
        const d = await API.get('/dashboard/panel', { section: k, year }); if (mine !== sel._tok) return;
        const v = VIEW[k](d, year ? +year : null);
        body.innerHTML = `${v.html}<div class="dcard dtable"><h4>جدول اطلاعات — ${yLbl(year)}</h4><div class="dtable-host"></div></div>`;
        $('small', host).textContent = `${yLbl(year)} · به‌روزرسانی ${new Date(d.generated).toLocaleTimeString(isFa() ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}`;
        dataTable($('.dtable-host', body), v.table);
      } catch (e) { if (mine === sel._tok) body.innerHTML = `<div class="form-error">${esc(e.message)}</div>`; }
    };
    el.onclick = e => {
      if (e.target.closest('.dt-year')) return;
      const tn = e.target.closest('[data-tender]'); if (tn) return App.go('tender/' + tn.dataset.tender);
      if (e.target.closest('[data-x=refresh]')) return open(sel.sec);
      const t = e.target.closest('.dtile'); if (t) open(t.dataset.sec);
    };
    el.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('dtile')) { e.preventDefault(); open(e.target.dataset.sec); } };
    el.onchange = e => { const s = e.target.closest('.dt-year'); if (!s) return; sel.year[s.dataset.y] = s.value; open(s.dataset.y); };
    open(sel.sec || 'finished');
  } });

  /* ───── پنل تصمیم در کارتابل مدیریت مناقصات ───── */
  function decisionPanel(host) {
    if (!host) return;
    host.innerHTML = `<details class="acc dcacc"><summary>📊 تحلیل تصمیم شرکت / عدم شرکت و ریسک و فرصت</summary><div class="acc-body"></div></details>`;
    const det = $('details', host); ensureTip();
    det.addEventListener('toggle', async () => {
      const body = $('.acc-body', det); if (!det.open || body.dataset.ready) return; body.dataset.ready = '1';
      try {
        const ov = await API.get('/dashboard/overview'); let year = '';
        body.innerHTML = `<div class="dpanel inl"><div class="dyp"><select class="dyear"><option value="">همه سال‌ها</option>${ov.years.slice().reverse().map(y => `<option value="${y}">سال ${fmtYear(y)}</option>`).join('')}</select></div><div class="dp-body"></div></div>`;
        const out = $('.dp-body', body), draw = async () => {
          out.innerHTML = '<div class="ch-empty">در حال بارگذاری…</div>';
          try {
            const d = await API.get('/dashboard/mining', { section: 'running', year }), D = d.decisions, tot = D.yes + D.no + D.pending + D.withdrawn, per = d.decisions_per_year.filter(p => p.yes + p.no + p.pending + p.withdrawn);
            out.innerHTML = `<div class="dgrid">${card('تصمیم شرکت / عدم شرکت', tot ? donut([{ v: D.yes, pal: 'green', label: 'شرکت می‌کنیم' }, { v: D.no, pal: 'red', label: 'شرکت نمی‌کنیم' }, { v: D.pending, pal: 'amber', label: 'منتظر تصمیم' }, { v: D.withdrawn, pal: 'gray', label: 'انصراف داده‌ایم' }], { center: fmtNum(pct(D.yes, D.yes + D.no)) + '٪', sub: 'نرخ شرکت' }) : noData('تصمیمی ثبت نشده است'))}
              ${card('تصمیم‌ها در هر سال', bars(per.map(p => ({ label: fmtYear(p.y), vals: [p.yes, p.no, p.pending, p.withdrawn] })), { series: [{ name: 'شرکت', pal: 'green' }, { name: 'عدم شرکت', pal: 'red' }, { name: 'منتظر تصمیم', pal: 'amber' }, { name: 'انصراف', pal: 'gray' }] }), 'span2')}
              ${card('ریسک و فرصت (مناقصه‌های جاری)', d.risks.length ? d.risks.map(r => `<div class="dri" data-tender="${r.id}"><b>${esc(r.title)}</b> <small>${esc(r.client_name || '')}</small>${r.risk ? `<div>${chip('ریسک', 'red')} ${esc(r.risk)}</div>` : ''}${r.opportunity ? `<div>${chip('فرصت', 'green')} ${esc(r.opportunity)}</div>` : ''}</div>`).join('') : noData('ریسک یا فرصتی ثبت نشده است'), 'span3')}</div>`;
          } catch (e) { out.innerHTML = `<div class="form-error">${esc(e.message)}</div>`; }
        };
        body.onchange = e => { if (e.target.classList.contains('dyear')) { year = e.target.value; draw(); } };
        body.onclick = e => { const tn = e.target.closest('[data-tender]'); if (tn) App.go('tender/' + tn.dataset.tender); };
        draw();
      } catch (e) { body.innerHTML = `<div class="form-error">${esc(e.message)}</div>`; body.dataset.ready = ''; }
    });
  }
  return { donut, bars, trend, hbars, radial, rose, decisionPanel };
})();
window.DC = DC;
