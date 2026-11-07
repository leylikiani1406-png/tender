// ترجمهٔ خودکار بین فارسی و انگلیسی. ترتیب: سرویس تنظیم‌شده در .env (سازگار با LibreTranslate) ← MyMemory ← واژه‌نامهٔ محلی
const router = require('express').Router();
const { authenticate, notStaff } = require('../middleware/auth');
const { translate } = require('../lib/glossary');
router.use(authenticate, notStaff);

const TIMEOUT = 8000;
async function fetchJson(url, opt) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try { const r = await fetch(url, { ...opt, signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
async function viaConfigured(q, from, to) {
  if (!process.env.TRANSLATE_URL) throw new Error('not configured');
  const j = await fetchJson(process.env.TRANSLATE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, source: from, target: to, format: 'text', api_key: process.env.TRANSLATE_API_KEY || undefined }) });
  if (!j.translatedText) throw new Error('empty');
  return j.translatedText;
}
async function viaMyMemory(q, from, to) {
  const j = await fetchJson('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) + '&langpair=' + from + '|' + to);
  const t = j && j.responseData && j.responseData.translatedText;
  if (!t || /MYMEMORY WARNING|INVALID/i.test(t) || Number(j.responseStatus) !== 200) throw new Error('bad');
  return t;
}
async function one(q, from, to, state) {
  if (!String(q || '').trim()) return { text: '', via: 'none' };
  for (const [name, fn] of [['service', viaConfigured], ['mymemory', viaMyMemory]]) {
    if (state.off.has(name)) continue;
    try { return { text: await fn(q, from, to), via: name }; }
    catch (e) { if (name !== 'service' || process.env.TRANSLATE_URL) state.off.add(name); }  // سرویسی که خطا داد برای بقیهٔ متن‌ها تکرار نمی‌شود
  }
  const g = translate(q, from, to);
  return { text: g.text, via: 'glossary', coverage: g.coverage };
}
router.post('/', async (req, res, next) => {
  try {
    const { texts, from, to } = req.body || {};
    if (!['fa', 'en'].includes(from) || !['fa', 'en'].includes(to) || from === to) return res.status(400).json({ error: 'زبان مبدأ و مقصد نامعتبر است' });
    if (!Array.isArray(texts) || !texts.length || texts.length > 80) return res.status(400).json({ error: 'فهرست متن‌ها نامعتبر است (حداکثر ۸۰ مورد)' });
    const state = { off: new Set() };
    const out = [];
    for (const t of texts) out.push(await one(String(t == null ? '' : t).slice(0, 500), from, to, state));
    res.json({ translations: out });
  } catch (e) { next(e); }
});
module.exports = router;
