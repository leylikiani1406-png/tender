// ساخت دیتابیس از صفر + کاربر مدیر + بخش‌های نمونه
// اجرا: npm run setup-db   (اگر جدول‌ها از قبل هست: npm run setup-db -- --force  → همه‌چیز پاک می‌شود)
const fs = require('fs'), path = require('path'), crypto = require('crypto'), bcrypt = require('bcrypt');
const pool = require('../db');

(async () => {
  const exists = await pool.query(`SELECT to_regclass('public.users') AS t`);
  if (exists.rows[0].t && !process.argv.includes('--force')) {
    console.log('جدول‌ها از قبل وجود دارند. برای پاک‌کردن و ساخت مجدد: npm run setup-db -- --force');
    return pool.end();
  }
  await pool.query(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
  const dir = path.join(__dirname, '..', 'migrations');
  for (const f of fs.readdirSync(dir).filter(f => /^v\d+.*\.sql$/.test(f)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })))
    await pool.query(fs.readFileSync(path.join(dir, f), 'utf8'));

  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(6).toString('base64url');
  const hash = await bcrypt.hash(pw, 10);
  await pool.query(
    `INSERT INTO users (full_name, username, password_hash, role, access_level, must_change_password)
     VALUES ('مدیر سیستم','admin',$1,'super_admin','all',TRUE)`, [hash]);

  console.log('\n✅ دیتابیس ساخته شد.\n   نام کاربری: admin\n   رمز موقت  : ' + pw + '\n   (در اولین ورود باید رمز را عوض کنید)\n');
  await pool.end();
})().catch(e => { console.error('خطا:', e.message); process.exit(1); });
