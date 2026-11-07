/* xlsx-lite: خواندن و نوشتن فایل اکسل (xlsx) و CSV بدون هیچ کتابخانهٔ بیرونی
   خواندن:  await XL.read(arrayBuffer|File)  → [{ name, rows:[[...]] }]   (xlsx یا csv)
   نوشتن:   XL.write([{ name, rows:[[...]], rtl:true, widths:[..] }]) → Blob          */
(function (root) {
  'use strict';
  const td = new TextDecoder('utf-8'), te = new TextEncoder();

  /* ───── ZIP: خواندن (فهرست مرکزی + deflate-raw) ───── */
  async function inflateRaw(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const w = ds.writable.getWriter(); w.write(bytes); w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  async function unzip(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let e = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('فایل اکسل معتبر نیست (zip)');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    const files = {};
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('ساختار فایل خراب است');
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = td.decode(u8.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + xl + cl;
      const lnl = dv.getUint16(off + 26, true), lxl = dv.getUint16(off + 28, true), start = off + 30 + lnl + lxl;
      files[name] = { method, data: u8.subarray(start, start + csize) };
    }
    const get = async name => { const f = files[name]; if (!f) return null; const raw = f.method === 0 ? f.data : await inflateRaw(f.data); return td.decode(raw); };
    return { names: Object.keys(files), get };
  }

  /* ───── XML کوچک ───── */
  const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const textOf = xml => { let o = ''; const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g; let m; while ((m = re.exec(xml))) o += unesc(m[1]); return o; };
  const colIdx = ref => { const l = /^[A-Z]+/.exec(ref)[0]; let n = 0; for (const c of l) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
  const colName = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
  const attr = (tag, k) => { const m = new RegExp('\\b' + k + '="([^"]*)"').exec(tag); return m ? unesc(m[1]) : null; };

  async function readXlsx(buf) {
    const z = await unzip(buf);
    const wb = await z.get('xl/workbook.xml'); if (!wb) throw new Error('این فایل، اکسل (xlsx) نیست');
    const rels = (await z.get('xl/_rels/workbook.xml.rels')) || '';
    const relMap = {}; (rels.match(/<Relationship\b[^>]*>/g) || []).forEach(r => { relMap[attr(r, 'Id')] = attr(r, 'Target'); });
    const shared = []; const ss = await z.get('xl/sharedStrings.xml');
    if (ss) (ss.match(/<si\b[\s\S]*?<\/si>|<si\s*\/>/g) || []).forEach(si => shared.push(textOf(si)));
    const sheets = [];
    for (const tag of wb.match(/<sheet\b[^>]*>/g) || []) {
      const name = attr(tag, 'name'), rid = attr(tag, 'r:id') || attr(tag, 'id');
      let target = relMap[rid] || ''; target = target.replace(/^\/?(xl\/)?/, '');
      const xml = await z.get('xl/' + target); if (!xml) continue;
      const rows = [];
      (xml.match(/<row\b[\s\S]*?<\/row>|<row\b[^>]*\/>/g) || []).forEach(rowXml => {
        const rn = parseInt(attr(rowXml.match(/<row\b[^>]*>/)[0], 'r')) || (rows.length + 1);
        const arr = [];
        const re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let m;
        while ((m = re.exec(rowXml))) {
          const a = m[1], inner = m[2] || '', ref = attr(a, 'r'), ty = attr(a, 't'); if (!ref) continue;
          let v = '';
          if (ty === 'inlineStr') v = textOf(inner);
          else { const vm = /<v>([\s\S]*?)<\/v>/.exec(inner); if (vm) { const raw = unesc(vm[1]); v = ty === 's' ? (shared[+raw] ?? '') : ty === 'b' ? (raw === '1') : (ty === 'str' || ty === 'e') ? raw : (raw !== '' && !isNaN(Number(raw)) ? Number(raw) : raw); } }
          arr[colIdx(ref)] = v;
        }
        for (let i = 0; i < arr.length; i++) if (arr[i] === undefined) arr[i] = '';
        rows[rn - 1] = arr;
      });
      for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
      sheets.push({ name, rows });
    }
    return sheets;
  }

  /* ───── CSV ───── */
  function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] || '', sep = [',', ';', '\t'].map(s => [s, first.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return [{ name: 'CSV', rows }];
  }
  async function read(src) {
    const buf = src instanceof ArrayBuffer || src instanceof Uint8Array ? src : await src.arrayBuffer();
    const u8 = new Uint8Array(buf);
    if (u8[0] === 0x50 && u8[1] === 0x4b) return readXlsx(u8);
    if (u8[0] === 0xd0 && u8[1] === 0xcf) throw new Error('فرمت قدیمی xls پشتیبانی نمی‌شود؛ فایل را با «ذخیره به‌عنوان» در قالب xlsx یا csv ذخیره کنید');
    return parseCsv(td.decode(u8));
  }

  /* ───── ZIP: نوشتن (بدون فشرده‌سازی) ───── */
  const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(entries) {
    const parts = [], central = []; let off = 0;
    entries.forEach(([name, text]) => {
      const nm = te.encode(name), data = te.encode(text), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(lh.buffer), nm, data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nm);
      off += 30 + nm.length + data.length;
    });
    const csize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function write(sheets) {
    const used = new Set();
    const safe = (n, i) => { let s = String(n || 'Sheet' + (i + 1)).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31).trim() || 'Sheet' + (i + 1), k = s, c = 2; while (used.has(k.toLowerCase())) k = s.slice(0, 28) + ' ' + c++; used.add(k.toLowerCase()); return k; };
    const names = sheets.map((s, i) => safe(s.name, i));
    const files = [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']
    ];
    sheets.forEach((s, i) => {
      const rows = s.rows || [];
      const cols = s.widths ? '<cols>' + s.widths.map((w, k) => `<col min="${k + 1}" max="${k + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>' : '';
      const body = rows.map((r, ri) => `<row r="${ri + 1}">` + (r || []).map((v, ci) => {
        if (v === '' || v == null) return '';
        const ref = colName(ci) + (ri + 1), st = s.header && ri === 0 ? ' s="1"' : '';
        return typeof v === 'number' && isFinite(v) ? `<c r="${ref}"${st}><v>${v}</v></c>` : typeof v === 'boolean' ? `<c r="${ref}" t="b"${st}><v>${v ? 1 : 0}</v></c>` : `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
      }).join('') + '</row>').join('');
      files.push([`xl/worksheets/sheet${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"${s.rtl === false ? '' : ' rightToLeft="1"'}/></sheetViews>${cols}<sheetData>${body}</sheetData></worksheet>`]);
    });
    return zip(files);
  }
  root.XL = { read, write, parseCsv, colName };
  if (typeof module !== 'undefined') module.exports = root.XL;
})(typeof window !== 'undefined' ? window : globalThis);
