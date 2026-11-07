const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

// محدودکننده ساده‌ی تلاش ناموفق (۸ بار در ۱۵ دقیقه برای هر IP+نام کاربری)
const fails = new Map();
const key = (req, u) => req.ip + '|' + String(u).toLowerCase();
const blocked = k => { const f = fails.get(k); return f && f.n >= 8 && Date.now() - f.t < 15 * 60 * 1000; };
const addFail = k => { const f = fails.get(k); fails.set(k, { n: (f && Date.now() - f.t < 15 * 60 * 1000 ? f.n : 0) + 1, t: Date.now() }); };

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
    const k = key(req, username);
    if (blocked(k)) return res.status(429).json({ error: 'تلاش بیش از حد. ۱۵ دقیقه بعد دوباره امتحان کنید' });

    const r = await pool.query('SELECT * FROM users WHERE username = $1', [String(username).trim()]);
    const u = r.rows[0];
    const ok = u && await bcrypt.compare(password, u.password_hash);
    if (!ok) { addFail(k); return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' }); }
    if (!u.is_active) return res.status(403).json({ error: 'حساب کاربری شما غیرفعال است' });
    fails.delete(k);

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [u.id]);
    const sectors = await pool.query(
      'SELECT s.id, s.name, s.name_en, s.code FROM user_sectors us JOIN sectors s ON s.id = us.sector_id WHERE us.user_id = $1', [u.id]);
    const token = jwt.sign({ id: u.id, username: u.username, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: {
      id: u.id, full_name: u.full_name, username: u.username, email: u.email, phone: u.phone, role: u.role,
      access_level: u.access_level, position: u.position, department: u.department,
      must_change_password: u.must_change_password, sectors: sectors.rows } });
  } catch (e) { console.error('Login error:', e); res.status(500).json({ error: 'خطا در ورود' }); }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const s = await pool.query(
      'SELECT s.id, s.name, s.name_en, s.code FROM user_sectors us JOIN sectors s ON s.id = us.sector_id WHERE us.user_id = $1', [req.user.id]);
    res.json({ ...req.user, sectors: s.rows });
  } catch (e) { res.status(500).json({ error: 'خطا در خواندن اطلاعات کاربر' }); }
});

router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body || {};
    if (!current_password || !new_password || !confirm_password) return res.status(400).json({ error: 'همه فیلدها الزامی هستند' });
    if (new_password !== confirm_password) return res.status(400).json({ error: 'رمز جدید و تأیید آن یکسان نیستند' });
    if (new_password === current_password) return res.status(400).json({ error: 'رمز جدید باید با رمز فعلی متفاوت باشد' });
    const errs = [];
    if (new_password.length < 8) errs.push('حداقل ۸ کاراکتر');
    if (!/[A-Z]/.test(new_password)) errs.push('یک حرف بزرگ انگلیسی');
    if (!/[a-z]/.test(new_password)) errs.push('یک حرف کوچک انگلیسی');
    if (!/[0-9]/.test(new_password)) errs.push('یک عدد');
    if (errs.length) return res.status(400).json({ error: 'رمز جدید ضعیف است', requirements: errs });

    const cur = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!await bcrypt.compare(current_password, cur.rows[0].password_hash)) return res.status(400).json({ error: 'رمز عبور فعلی اشتباه است' });
    await pool.query(
      'UPDATE users SET password_hash=$1, must_change_password=FALSE, password_changed_at=NOW(), updated_at=NOW() WHERE id=$2',
      [await bcrypt.hash(new_password, 10), req.user.id]);
    res.json({ success: true });
  } catch (e) { console.error('Change password error:', e); res.status(500).json({ error: 'خطا در تغییر رمز عبور' }); }
});

router.post('/logout', authenticate, (req, res) => res.json({ success: true }));
module.exports = router;
