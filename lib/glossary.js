// واژه‌نامهٔ محلی برای ترجمهٔ رزومه (وقتی سرویس ترجمهٔ آنلاین در دسترس نیست). عبارت‌های بلندتر اول تطبیق داده می‌شوند.
const PAIRS = [
  ['مدیر عامل', 'Chief Executive Officer'], ['مدیرعامل', 'Chief Executive Officer'], ['مدیر دفتر فنی', 'Technical Office Manager'],
  ['مدیر پروژه', 'Project Manager'], ['مدیر', 'Manager'], ['کارشناس ارشد', 'Senior Expert'], ['ارشد', 'Senior'], ['کارشناس', 'Expert'], ['سرپرست', 'Supervisor'],
  ['زمین‌شناسی', 'Geology'], ['زمین شناسی', 'Geology'], ['زمین‌شناس', 'Geologist'], ['زمین شناس', 'Geologist'], ['ژئوفیزیک', 'Geophysics'], ['ژئوشیمی', 'Geochemistry'],
  ['اکتشاف معدنی', 'Mineral Exploration'], ['اکتشاف', 'Exploration'], ['معدن', 'Mining'], ['استخراج', 'Extraction'], ['مهندسی معدن', 'Mining Engineering'],
  ['مهندسی', 'Engineering'], ['مهندس', 'Engineer'], ['مشاور', 'Consulting'], ['نظارت', 'Supervision'], ['مناقصه', 'Tender'], ['پروپوزال', 'Proposal'],
  ['حفاری', 'Drilling'], ['نمونه‌برداری', 'Sampling'], ['نقشه‌برداری', 'Surveying'], ['نقشه برداری', 'Surveying'], ['نقشه', 'Map'], ['گزارش', 'Report'],
  ['کارشناسی ارشد', "Master's Degree"], ['کارشناسی', "Bachelor's Degree"], ['دکتری', 'Ph.D.'], ['دانشگاه', 'University'], ['دانشکده', 'Faculty'],
  ['تهران', 'Tehran'], ['ایران', 'Iran'], ['شرکت', 'Company'], ['سازمان', 'Organization'], ['وزارت', 'Ministry'], ['پروژه', 'Project'],
  ['سابقه کار', 'Work Experience'], ['سابقهٔ کار', 'Work Experience'], ['سابقه', 'Experience'], ['تحصیلات', 'Education'], ['مهارت‌ها', 'Skills'], ['مهارت', 'Skill'],
  ['زبان‌ها', 'Languages'], ['فارسی', 'Persian'], ['انگلیسی', 'English'], ['مسلط', 'Fluent'], ['متوسط', 'Intermediate'], ['مقدماتی', 'Basic'],
  ['گواهینامه', 'Certificate'], ['گواهی', 'Certificate'], ['دوره', 'Course'], ['سال', 'years'], ['ماه', 'months'], ['تا‌کنون', 'Present'], ['تاکنون', 'Present'], ['حال حاضر', 'Present'],
  ['گزارش‌نویسی', 'Report Writing'], ['تحلیل داده', 'Data Analysis'], ['مدیریت پروژه', 'Project Management'], ['مدیریت', 'Management'], ['کنترل کیفیت', 'Quality Control'],
  ['تضمین کیفیت', 'Quality Assurance'], ['ایمنی', 'Safety'], ['محیط زیست', 'Environment'], ['نفت', 'Oil'], ['گاز', 'Gas'], ['مخزن', 'Reservoir'], ['چاه', 'Well'],
  ['تلفن', 'Phone'], ['نشانی', 'Address'], ['ایمیل', 'Email'], ['خلاصه', 'Summary'], ['هدف', 'Objective'], ['مسئول', 'Responsible'], ['همکاری', 'Collaboration'],
  ['کوشا معدن', 'Kousha Mining'], ['کوشا', 'Kousha'], ['برنامه‌ریزی', 'Planning'], ['برنامه ریزی', 'Planning'], ['کارگاه', 'Site'], ['سرپرست کارگاه', 'Site Supervisor'], ['مدیر فنی', 'Technical Manager'],
  ['مهندس ارشد', 'Senior Engineer'], ['نرم‌افزار', 'Software'], ['آزمایشگاه', 'Laboratory'], ['صنعت', 'Industry'], ['مناقصات', 'Tenders'], ['قرارداد', 'Contract'], ['پیمانکار', 'Contractor'], ['کارفرما', 'Employer'],
  ['مهندس معدن', 'Mining Engineer'], ['مهندس اکتشاف', 'Exploration Engineer'], ['مهندس زمین‌شناسی', 'Geological Engineer'], ['تجربه', 'Experience'], ['تا', 'to'], ['دانش‌آموخته', 'Graduate'], ['فارغ‌التحصیل', 'Graduate'],
  ['کارشناس اکتشاف', 'Exploration Expert'], ['عضو', 'Member'], ['نظام مهندسی', 'Engineering Council'], ['در', 'at'],
  ['و', 'and'], ['در', 'in'], ['با', 'with'], ['از', 'from'], ['به', 'to']
];

const norm = s => String(s || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[‌‏]/g, '‌');
const key = s => norm(s).replace(/‌/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const mk = rows => { const m = new Map(); rows.forEach(([a, b]) => { const k = key(a); if (k && !m.has(k)) m.set(k, b); }); return m; };
const MAPS = { fa: mk(PAIRS.map(([f, e]) => [f, e])), en: mk(PAIRS.map(([f, e]) => [e, f])) };
const MAXN = 4;
const FD = '۰۱۲۳۴۵۶۷۸۹', AD = '٠١٢٣٤٥٦٧٨٩';
const toEnDigits = s => s.replace(/[۰-۹]/g, c => FD.indexOf(c)).replace(/[٠-٩]/g, c => AD.indexOf(c));
const toFaDigits = s => s.replace(/[0-9]/g, c => FD[+c]);
const PUNCT = /^([\s]*)(.*?)([\s]*[.,;:!?،؛)\]»"']*)$/s;

// ترجمهٔ کلمه‌به‌کلمه با تطبیق عبارت‌های بلندتر؛ فقط کل کلمه تطبیق می‌خورد (نه بخشی از کلمه)
// خروجی: { text, coverage } که coverage نسبت کلمه‌های ترجمه‌شده است (۰ تا ۱)
function translate(text, from, to) {
  text = String(text || '');
  if (from === to || !text.trim()) return { text, coverage: 1 };
  const map = MAPS[from];
  const src = from === 'fa' ? toEnDigits(text) : text;
  const out = []; let hits = 0, words = 0;
  const lines = src.split('\n');
  const res = lines.map(line => {
    const toks = line.split(/\s+/).filter(Boolean), r = [];
    for (let i = 0; i < toks.length;) {
      let done = false;
      for (let n = Math.min(MAXN, toks.length - i); n >= 1 && !done; n--) {
        const chunk = toks.slice(i, i + n), pre = chunk[0].match(/^[(\["«']*/)[0], last = chunk[n - 1].match(/[.,;:!?،؛)\]»"']*$/)[0];
        let core = chunk.join(' ').slice(pre.length); core = last ? core.slice(0, core.length - last.length) : core;
        let k = key(core), dst = map.get(k);
        if (dst === undefined && from === 'fa' && n === 1) {                   // جمع «ها»: پروژه‌ها ← Projects
          const m = k.match(/^(.+?)\s?ها$/); const b = m && map.get(m[1]);
          if (b) dst = /s$/i.test(b) ? b : b + 's';
        }
        if (dst !== undefined) { r.push(pre + dst + (to === 'fa' ? last.replace(/[,;?]/g, c => ({ ',': '،', ';': '؛', '?': '؟' }[c])) : last.replace(/[،؛؟]/g, c => ({ '،': ',', '؛': ';', '؟': '?' }[c])))); hits += n; words += n; i += n; done = true; }
      }
      if (!done) { r.push(toks[i]); words++; i++; }
    }
    return r.join(' ');
  });
  let o = res.join('\n');
  if (to === 'fa') o = toFaDigits(o);
  return { text: o, coverage: words ? Math.min(1, hits / words) : 1 };
}
module.exports = { translate };
