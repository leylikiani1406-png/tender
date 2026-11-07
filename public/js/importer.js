/* ورود هوشمند اطلاعات از فایل (Excel / CSV / Word / PDF / TXT) برای رزومه‌ساز و آرشیو مناقصه‌های سال‌های قبل.
   اکسل و CSV در مرورگر، و Word/PDF در سرور به متن تبدیل می‌شوند؛ سپس بر اساس عنوان ستون‌ها و بخش‌ها جایگذاری می‌شوند. نتیجه همیشه قبل از ثبت قابل بازبینی است. */
'use strict';
const Imp = {
  norm: s => toLatin(s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\u200f\u200e]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(),
  isSheet: f => /\.(xlsx|csv)$/i.test(f.name),
  // → { sheets:[{name,rows}] } یا { text }
  async read(file) {
    if (this.isSheet(file)) return { sheets: await XL.read(file) };
    const r = await API.upload('/extract', {}, file);
    return { text: r.text };
  },
  // هر نوع ورودی را به متن خطی تبدیل می‌کند (برای تشخیص بخش‌ها)
  toText(src) {
    if (src.text != null) return src.text;
    return src.sheets.map(sh => '\n' + sh.name + '\n' + sh.rows.filter(r => r && r.some(c => String(c ?? '').trim())).map(r => r.map(c => String(c ?? '').trim()).filter(Boolean).join(' | ')).join('\n')).join('\n');
  },
  // «کلید: مقدار» از متن
  kv(text) {
    const m = {};
    String(text).split('\n').forEach(l => { const x = /^\s*([^:：|]{2,40})\s*[:：]\s*(.+)$/.exec(l); if (x) { const k = this.norm(x[1]); if (!(k in m)) m[k] = x[2].trim(); } });
    return m;
  },
  pick(m, re) { const k = Object.keys(m).find(k => re.test(k)); return k ? m[k] : ''; },
  num(v) { const x = parseFloat(toLatin(v).replace(/[,٬\s]/g, '')); return isNaN(x) ? null : x; },

  /* ───── مناقصه‌های سال‌های قبل ───── */
  tenderCols: [['year', /سال|year/], ['title', /عنوان|نام مناقصه|نام پروژه|پروژه|title|name|موضوع/], ['client_name', /کارفرما|client|employer/], ['tender_number', /شماره|number|no\./],
    ['kind', /نوع|kind|type/], ['result', /نتیجه|وضعیت|result|status/], ['score_quality', /امتیاز کیفی|quality/], ['score_technical', /امتیاز فنی|technical/], ['score_price', /امتیاز مالی|امتیاز قیمت|price score|financial score/],
    ['score_total', /امتیاز کل|مجموع امتیاز|total/], ['rank', /رتبه|rank/], ['budget', /مبلغ پایه|برآورد|base|estimate/], ['our_offer', /پیشنهاد|قیمت ما|our offer|offer|قیمت/], ['contract_amount', /مبلغ قرارداد|قرارداد|contract/], ['winner_name', /برنده|winner/]],
  tendersFromSheets(sheets, defYear) {
    const out = [];
    sheets.forEach(sh => {
      const hi = sh.rows.findIndex(r => r && r.filter(c => this.norm(c)).length >= 2 && r.some(c => /عنوان|نام|title|پروژه/.test(this.norm(c)))); if (hi < 0) return;
      const H = sh.rows[hi].map(c => this.norm(c)), col = {};
      this.tenderCols.forEach(([k, re]) => { let i = H.findIndex(h => re.test(h)); if (k === 'title' && i >= 0 && /کارفرما|شماره|number/.test(H[i])) i = -1; if (i >= 0 && !Object.values(col).includes(i)) col[k] = i; });
      if (col.title == null) return;
      sh.rows.slice(hi + 1).forEach(r => {
        if (!r || r.every(c => c === '' || c == null)) return;
        const g = k => col[k] == null ? '' : String(r[col[k]] ?? '').trim();
        const t = g('title'); if (!t) return;
        const y = parseInt((toLatin(g('year')).match(/\d{4}/) || [])[0], 10) || defYear || null, rs = this.norm(g('result'));
        out.push({ year: y, title: t, client_name: g('client_name'), tender_number: g('tender_number'), kind: /نظارت|supervis/.test(this.norm(g('kind'))) ? 'supervision' : 'exploration',
          result: /بازنده|باخت|lost|loss|رد/.test(rs) ? 'lost' : /برنده|برد|won|win/.test(rs) ? 'won' : '',
          score_quality: this.num(g('score_quality')), score_technical: this.num(g('score_technical')), score_price: this.num(g('score_price')), score_total: this.num(g('score_total')), rank: this.num(g('rank')),
          budget: this.num(g('budget')), our_offer: this.num(g('our_offer')), contract_amount: this.num(g('contract_amount')), winner_name: g('winner_name') });
      });
    });
    return out;
  },
  // Word/PDF/TXT → یک مناقصه (از خطوط «کلید: مقدار»)
  tenderFromText(text, defYear) {
    const m = this.kv(text), p = re => this.pick(m, re), rs = this.norm(p(/نتیجه|وضعیت|result/));
    const yr = parseInt((toLatin(p(/سال|year/) || text).match(/1[34]\d{2}/) || [])[0], 10) || defYear || null;
    return { year: yr, title: p(/عنوان|نام مناقصه|نام پروژه|موضوع|title/) || (String(text).split('\n').find(l => l.trim().length > 6) || '').trim().slice(0, 200), client_name: p(/کارفرما|client/), tender_number: p(/شماره|number/),
      kind: /نظارت|supervis/.test(this.norm(p(/نوع|kind|type/))) ? 'supervision' : 'exploration', result: /بازنده|باخت|lost/.test(rs) ? 'lost' : /برنده|برد|won/.test(rs) ? 'won' : '',
      score_quality: this.num(p(/امتیاز کیفی|quality/)), score_technical: this.num(p(/امتیاز فنی|technical/)), score_price: this.num(p(/امتیاز مالی|امتیاز قیمت/)), score_total: this.num(p(/امتیاز کل|مجموع امتیاز|total/)),
      rank: this.num(p(/رتبه|rank/)), budget: this.num(p(/مبلغ پایه|برآورد|base/)), our_offer: this.num(p(/مبلغ پیشنهادی|قیمت پیشنهادی|پیشنهاد/)), contract_amount: this.num(p(/مبلغ قرارداد|قرارداد/)), winner_name: p(/برنده|winner/) };
  },

  /* ───── رزومه ───── */
  SECT: [['summary', /^(درباره من|درباره|خلاصه|معرفی|هدف شغلی|profile|summary|objective|about)/], ['experience', /^(سوابق کاری|سوابق شغلی|سابقه کار|تجربیات|سوابق|work experience|experience|employment)/],
    ['education', /^(تحصیلات|سوابق تحصیلی|education)/], ['projects', /^(پروژه ها|پروژه‌ها|پروژه|projects)/], ['certificates', /^(گواهینامه|گواهی|دوره ها|دوره‌ها|certificates|certifications|courses)/],
    ['skills', /^(مهارت|توانایی|skills)/], ['languages', /^(زبان|languages)/]],
  _years(s) {
    s = String(s || ''); const t = toLatin(s), cut = m => (s.slice(0, m.index) + s.slice(m.index + m[0].length)).replace(/[()\[\]|،,\-–—\s]+$/, '').replace(/^[\s\-–—|،,]+/, '').trim();
    const m = /((?:13|14|19|20)\d{2})\s*(?:[-–—~]|تا|to)\s*((?:13|14|19|20)\d{2}|present|current|now|تاکنون|اکنون|امروز|ادامه)/i.exec(t);
    if (m) return { from: m[1], to: /\d/.test(m[2]) ? m[2] : '', rest: cut(m) };
    const y = /\b((?:13|14|19|20)\d{2})\b/.exec(t); return y ? { from: y[1], to: '', single: y[1], rest: cut(y) } : { from: '', to: '', rest: s };
  },
  // «کارشناسی ارشد مهندسی معدن» ← { level: 'کارشناسی ارشد', field: 'مهندسی معدن' }
  DEG: /^(دیپلم|کاردانی|فوق\s*دیپلم|کارشناسی\s*ارشد|کارشناسی|فوق\s*لیسانس|لیسانس|دکتری|دکترا|post\s*doc|phd|ph\.d|msc|m\.sc|master'?s?|bsc|b\.sc|bachelor'?s?|associate|diploma|doctorate)(?=[\s:،,\-–—]|$)[\s:،,\-–—]*(?:در\s+|رشته\s*|in\s+|of\s+)?(.*)$/i,
  splitDegree(s) { s = String(s || '').trim(); const m = this.DEG.exec(s); return m ? { level: m[1].replace(/\s+/g, ' ').trim(), field: (m[2] || '').trim() } : { level: '', field: s }; },
  _blocks(lines) {
    const out = []; let cur = [];
    lines.forEach(l => { if (!l.trim()) { if (cur.length) out.push(cur); cur = []; } else cur.push(l.replace(/^[\s•●▪◦\-–*·]+/, '').trim()); });
    if (cur.length) out.push(cur); return out;
  },
  resumeFromText(text) {
    const R = { name: '', title: '', summary: '', email: '', phone: '', address: '', website: '', years: '', experience: [], education: [], projects: [], certificates: [], skills: [], languages: [] };
    const raw = String(text || '').replace(/\r/g, ''), lat = toLatin(raw), lines = raw.split('\n');
    R.email = (/[\w.+-]+@[\w-]+(\.[\w-]+)+/.exec(lat) || [''])[0];
    R.phone = (/(\+?\d[\d\s\-()]{8,16}\d)/.exec(lat.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '')) || [''])[0].trim();
    R.website = (/(https?:\/\/[^\s|]+|www\.[^\s|]+|linkedin\.com\/[^\s|]+)/i.exec(lat) || [''])[0];
    const kv = this.kv(raw), pk = re => this.pick(kv, re);
    R.name = pk(/^(نام|نام و نام خانوادگی|name|full name)$/); R.title = pk(/^(عنوان شغلی|سمت|عنوان|job title|title|position)$/);
    R.address = pk(/^(نشانی|آدرس|address)$/); R.years = (toLatin(pk(/سابقه|years of experience/)).match(/\d+/) || [''])[0];
    // تقسیم به بخش‌ها
    const secOf = l => { const n = this.norm(l).replace(/[:：]\s*$/, ''); if (!n || n.length > 40) return null; const s = this.SECT.find(([, re]) => re.test(n)); return s ? s[0] : null; };
    const buckets = { head: [] }; let cur = 'head';
    lines.forEach(l => { const k = secOf(l); if (k) { cur = k; buckets[cur] = buckets[cur] || []; return; } (buckets[cur] = buckets[cur] || []).push(l); });
    const head = buckets.head.map(l => l.trim()).filter(Boolean).filter(l => !/@|^\+?\d|https?:|www\./i.test(toLatin(l)) && !/[:：]/.test(l));
    if (!R.name && head[0]) R.name = head[0].slice(0, 80); if (!R.title && head[1] && head[1].length < 90) R.title = head[1];
    R.summary = (buckets.summary || []).join(' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
    const split = s => { const m = /^(.+?)\s+(?:-|–|—|،|,|\||در|at|@)\s+(.+)$/.exec(s); return m ? [m[1].trim(), m[2].trim()] : [s.trim(), '']; };
    (this._blocks(buckets.experience || [])).forEach(b => { const y = this._years(b.join(' ')), first = this._years(b[0]), [role, company] = split(first.rest || b[0]);
      R.experience.push({ role: role.slice(0, 120), company: company || (b[1] && !this._years(b[1]).from ? b[1] : '').slice(0, 120), from: y.from, to: y.to, note: b.slice(company || (b[1] && !this._years(b[1]).from) ? 2 : 1).filter(l => !this._years(l).from || l.length > 25).join('\n').slice(0, 800) }); });
    (this._blocks(buckets.education || [])).forEach(b => { const y = this._years(b.join(' ')), first = this._years(b[0]); const dg = this.splitDegree((first.rest || b[0]).slice(0, 150)); R.education.push({ level: dg.level, field: dg.field, school: (b[1] && !this._years(b[1]).from ? b[1] : '').slice(0, 150), from: y.from, to: y.to, gpa: (/(?:معدل|gpa)\s*[:：]?\s*([\d.,/]+)/i.exec(toLatin(b.join(' '))) || [])[1] || '', note: b.slice(2).filter(l => this._years(l).rest && !/معدل|gpa/i.test(toLatin(l))).join('\n').slice(0, 400) }); });
    (this._blocks(buckets.projects || [])).forEach(b => { const y = this._years(b[0]), [name, client] = split(y.rest || b[0]); R.projects.push({ name: name.slice(0, 200), client: client.slice(0, 150), year: y.single || y.from || '', note: b.slice(1).join('\n').slice(0, 600) }); });
    (buckets.certificates || []).map(l => l.replace(/^[\s•●▪◦\-–*·]+/, '').trim()).filter(Boolean).forEach(l => { const y = this._years(l), [name, issuer] = split(y.rest); R.certificates.push({ name: name.slice(0, 200), issuer: issuer.slice(0, 150), year: y.single || y.from || '' }); });
    R.skills = (buckets.skills || []).join('\n').split(/[\n،,;•●▪|]+/).map(s => s.trim()).filter(s => s && s.length < 60);
    R.languages = (buckets.languages || []).map(s => s.replace(/^[\s•●▪◦\-–*·]+/, '').trim()).filter(Boolean);
    return R;
  },
  /* ───── اکسل رزومه: هر بخش یک شیت؛ هر ستون یک فیلد و هر سطر یک مورد ─────
     شیت‌ها: «مشخصات» (دو ستون: عنوان | مقدار)، «تحصیلات»، «سوابق کاری»، «پروژه‌ها»، «گواهینامه‌ها»، «مهارت‌ها»، «زبان‌ها» */
  RESUME_MAPS: {
    education: [['level', /^(مقطع|دوره تحصیل|دوره|سطح|level|degree level|degree type)/], ['field', /(رشته|گرایش|field|major|subject)/], ['school', /(دانشگاه|مؤسسه|موسسه|محل تحصیل|school|university|institution|college)/],
      ['from', /^(از|سال شروع|شروع|تاریخ شروع|from|start)/], ['to', /^(تا|سال پایان|پایان|سال فارغ|فارغ|تاریخ پایان|to|end|graduat)/], ['gpa', /(معدل|gpa|grade)/], ['note', /(توضیح|شرح|پایان نامه|thesis|note|description)/], ['degree', /(مدرک|degree)/]],
    experience: [['role', /(سمت|عنوان|پست|role|position|title|job)/], ['company', /(شرکت|سازمان|کارفرما|محل کار|company|employer|organization)/], ['from', /^(از|سال شروع|شروع|تاریخ شروع|from|start)/], ['to', /^(تا|سال پایان|پایان|تاریخ پایان|to|end)/], ['note', /(شرح|توضیح|فعالیت|note|description|duties)/]],
    projects: [['name', /(پروژه|عنوان|نام|name|project|title)/], ['client', /(کارفرما|client|employer)/], ['year', /(سال|year|تاریخ|date)/], ['role', /(سمت|نقش|role|position)/], ['note', /(شرح|توضیح|note|description)/]],
    certificates: [['name', /(گواهی|دوره|عنوان|نام|name|certificate|course|title)/], ['issuer', /(صادر|مؤسسه|موسسه|برگزار|issuer|institute|provider)/], ['year', /(سال|year|تاریخ|date)/]]
  },
  INFO_KEYS: [['last', /^(نام خانوادگی|last name|surname|family name)/], ['name', /^(نام و نام خانوادگی|نام کامل|full name|name|نام)$/], ['title', /(عنوان شغلی|سمت|job title|position|title)/], ['email', /(ایمیل|پست الکترونیک|email|e-mail)/],
    ['phone', /(تلفن|موبایل|همراه|تماس|phone|mobile|tel)/], ['address', /(نشانی|آدرس|address)/], ['website', /(وب|سایت|لینکدین|website|linkedin|url)/], ['years', /(سابقه|years)/], ['summary', /(خلاصه|درباره|معرفی|هدف|summary|profile|about|objective)/]],
  resumeFromSheets(sheets) {
    const text = this.toText({ sheets }), R = this.resumeFromText(text);
    const sectOf = n => { const x = this.norm(n).replace(/[.:]+$/, ''); if (/^(مشخصات|اطلاعات|personal|info|contact|details)/.test(x)) return 'info'; const k = this.SECT.find(([, re]) => re.test(x)); return k ? k[0] : null; };
    const filled = r => r && r.some(c => String(c ?? '').trim());
    const cell = (r, i) => i >= 0 ? String(r[i] ?? '').trim() : '';
    sheets.forEach(sh => {
      const key = sectOf(sh.name); if (!key) return;
      const rows = sh.rows.filter(filled);
      if (key === 'info') {
        // دو ستونی (عنوان | مقدار)؛ اگر ردیف اول عنوان ستون‌ها و ردیف دوم مقدارها باشد هم خوانده می‌شود
        const pairs = rows.map(r => [this.norm(r[0]), String(r[1] ?? '').trim()]).filter(([k, v]) => k && v);
        let last = '';
        pairs.forEach(([k, v]) => { const f = this.INFO_KEYS.find(([, re]) => re.test(k)); if (!f) return; if (f[0] === 'last') last = v; else if (f[0] === 'years') R.years = (toLatin(v).match(/\d+/) || [''])[0]; else if (!R[f[0]] || f[0] !== 'summary') R[f[0]] = v; });
        if (last && R.name && !R.name.includes(last)) R.name = (R.name + ' ' + last).trim();
        return;
      }
      if (key === 'skills' || key === 'languages') {
        const body = rows.filter((r, i) => !(i === 0 && /مهارت|زبان|skill|language|سطح|level/.test(this.norm(r.join(' ')))));
        const out = body.map(r => r.map(c => String(c ?? '').trim()).filter(Boolean).join(key === 'languages' ? ' — ' : ' ')).filter(Boolean);
        if (key === 'skills') { const flat = []; body.forEach(r => r.forEach(c => String(c ?? '').split(/[\n،,;|]+/).forEach(x => { x = x.trim(); if (x) flat.push(x); }))); if (flat.length) R.skills = [...new Set(flat)]; }
        else if (out.length) R.languages = out;
        return;
      }
      const MAP = this.RESUME_MAPS[key]; if (!MAP) return;
      const hi = rows.findIndex(r => r.filter(c => String(c ?? '').trim()).length >= 2); if (hi < 0) return;
      const H = rows[hi].map(c => this.norm(c)), col = {};
      MAP.forEach(([f, re]) => { const i = H.findIndex((h, j) => h && re.test(h) && !Object.values(col).includes(j)); if (i >= 0) col[f] = i; });
      if (!Object.keys(col).length) return;
      const items = rows.slice(hi + 1).map(r => { const o = {}; MAP.forEach(([f]) => { o[f] = cell(r, col[f] == null ? -1 : col[f]); }); return o; }).filter(o => Object.values(o).some(Boolean));
      if (key === 'education') items.forEach(o => { if (o.degree && !o.level && !o.field) { const d = this.splitDegree(o.degree); o.level = d.level; o.field = d.field; } delete o.degree; });
      ['from', 'to', 'year'].forEach(f => items.forEach(o => { if (f in o) o[f] = toLatin(o[f]).replace(/\.0+$/, ''); }));
      if (items.length) R[key] = items;
    });
    return R;
  },
  // قالب اکسل رزومه (برای دانلود): هر بخش یک شیت و هر ستون یک فیلد
  resumeTemplate() {
    const sh = (name, rows, widths) => ({ name, rows, widths, header: true });
    return [
      { name: 'مشخصات', rows: [['عنوان', 'مقدار'], ['نام و نام خانوادگی', 'علی رضایی'], ['عنوان شغلی', 'زمین‌شناس ارشد اکتشاف'], ['سابقه کار (سال)', 12], ['ایمیل', 'ali@example.com'], ['تلفن', '09120000000'], ['نشانی', 'تهران، خیابان ...'], ['وب‌سایت', ''], ['خلاصه', 'چند جمله دربارهٔ تخصص و تجربهٔ شما']], widths: [24, 60], header: true },
      sh('تحصیلات', [['مقطع (دوره تحصیل)', 'رشته', 'دانشگاه', 'سال شروع', 'سال پایان', 'معدل', 'توضیح'], ['کارشناسی ارشد', 'زمین‌شناسی اقتصادی', 'دانشگاه تهران', 1388, 1390, 17.5, ''], ['کارشناسی', 'مهندسی معدن', 'دانشگاه صنعتی امیرکبیر', 1384, 1388, 16.2, '']], [20, 24, 28, 12, 12, 10, 30]),
      sh('سوابق کاری', [['سمت', 'شرکت / سازمان', 'از (سال)', 'تا (سال)', 'شرح فعالیت'], ['مدیر پروژه اکتشاف', 'کوشا معدن', 1395, '', 'مدیریت عملیات اکتشاف تفصیلی'], ['زمین‌شناس', 'شرکت نمونه', 1390, 1395, 'نقشه‌برداری زمین‌شناسی و نمونه‌برداری']], [26, 28, 12, 12, 50]),
      sh('پروژه‌ها', [['عنوان پروژه', 'کارفرما', 'سال', 'سمت', 'شرح'], ['اکتشاف تفصیلی معدن الف', 'سازمان زمین‌شناسی', 1399, 'سرپرست', 'حفاری ۵۰۰۰ متر مغزه']], [32, 24, 10, 20, 50]),
      sh('گواهینامه‌ها', [['عنوان گواهی / دوره', 'صادرکننده', 'سال'], ['مدیریت پروژه PMP', 'PMI', 1398]], [32, 26, 10]),
      sh('مهارت‌ها', [['مهارت'], ['ArcGIS'], ['Leapfrog'], ['تفسیر داده‌های ژئوفیزیک']], [30]),
      sh('زبان‌ها', [['زبان', 'سطح'], ['انگلیسی', 'مسلط'], ['فارسی', 'زبان مادری']], [20, 20])
    ];
  },
  async resume(file) { const src = await this.read(file); return src.sheets ? this.resumeFromSheets(src.sheets) : this.resumeFromText(src.text); }
};
