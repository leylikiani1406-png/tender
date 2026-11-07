// تبدیل تاریخ میلادی به شمسی (فقط برای محاسبهٔ سال در گزارش‌ها)
function g2j(gy, gm, gd) {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + gdm[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053); days %= 12053;
  jy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}
// 'YYYY-MM-DD' یا Date → سال شمسی (یا null)
function yearOf(d) {
  if (!d) return null;
  const s = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (!m) return null;
  return g2j(+m[1], +m[2], +m[3])[0];
}
// 'YYYY-MM-DD' یا Date → [سال، ماه] شمسی (یا null)
function ymOf(d) {
  if (!d) return null;
  const x = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x); if (!m) return null;
  const j = g2j(+m[1], +m[2], +m[3]); return [j[0], j[1]];
}
module.exports = { g2j, yearOf, ymOf };
