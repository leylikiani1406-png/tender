// مهاجرت به نسخه ۴ بدون حذف داده‌های فعلی. اجرا: npm run migrate
// همهٔ فایل‌های migrations/v*.sql به ترتیب اجرا می‌شوند (همگی قابل تکرار هستند) و اگر خطایی رخ دهد هیچ تغییری اعمال نمی‌شود.
const fs = require('fs'), path = require('path');
const pool = require('../db');

(async () => {
  const exists = await pool.query(`SELECT to_regclass('public.tenders') AS t`);
  if (!exists.rows[0].t) { console.log('جدول‌ها هنوز ساخته نشده‌اند. اول: npm run setup-db'); return pool.end(); }
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter(f => /^v\d+.*\.sql$/.test(f)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const f of files) { await client.query(fs.readFileSync(path.join(dir, f), 'utf8')); console.log('اجرا شد:', f); }
    // یک‌بار: اسناد کیفی قدیمی به سیستم پوشه‌ها منتقل می‌شوند (فایل‌ها کپی نمی‌شوند، فقط ارجاع)
    const n = await client.query(`SELECT COUNT(*)::int AS c FROM doc_files WHERE area = 'quality'`);
    if (n.rows[0].c === 0) {
      const q = await client.query(`INSERT INTO doc_files (area, folder_id, file_name, file_path, file_size, uploaded_by, created_at)
        SELECT 'quality', NULL, file_name, file_path, file_size, uploaded_by, created_at FROM documents WHERE category = 'quality'`);
      if (q.rowCount) console.log(`منتقل شد: ${q.rowCount} سند کیفی`);
    }
    await client.query('COMMIT');
    console.log('✅ مهاجرت انجام شد.');
  } catch (e) { await client.query('ROLLBACK'); console.error('خطا (هیچ تغییری اعمال نشد):', e.message); process.exitCode = 1; }
  finally { client.release(); await pool.end(); }
})();
