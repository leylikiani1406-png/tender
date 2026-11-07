const jwt = require('jsonwebtoken');
const pool = require('../db');

async function authenticate(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'نشست شما منقضی شده است' });
    let payload;
    try { payload = jwt.verify(token, process.env.JWT_SECRET); }
    catch { return res.status(401).json({ error: 'نشست شما منقضی شده است' }); }

    const r = await pool.query(
      `SELECT id, full_name, username, email, phone, role, access_level, position, department, personnel_no, is_active, must_change_password
       FROM users WHERE id = $1`, [payload.id]);
    const user = r.rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: 'نشست شما منقضی شده است' });

    // اجبار تغییر رمز: فقط مسیرهای /api/auth آزادند
    if (user.must_change_password && !req.originalUrl.startsWith('/api/auth/')) {
      return res.status(403).json({ error: 'ابتدا رمز عبور را تغییر دهید', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    user.sector_ids = null;                 // بخش‌ها حذف شده‌اند؛ برای سازگاری با کدهای قدیمی
    user.restricted = user.role === 'staff'; // همکار: فقط کارهای ارجاع‌شده به خودش
    req.user = user;
    next();
  } catch (e) {
    console.error('Auth error:', e);
    res.status(500).json({ error: 'خطای احراز هویت' });
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'دسترسی مجاز نیست' });
// همکارِ دسترسی‌محدود به این مسیرها راه ندارد
const notStaff = (req, res, next) =>
  req.user.role === 'staff' ? res.status(403).json({ error: 'دسترسی مجاز نیست' }) : next();

module.exports = { authenticate, requireRole, notStaff };
