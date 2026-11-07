const multer = require('multer'), path = require('path'), fs = require('fs'), crypto = require('crypto');
const pool = require('../db');
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg', '.zip', '.rar', '.txt', '.csv'];

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase())
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // multer نام فایل را latin1 می‌خواند؛ برای نام فارسی به utf8 برمی‌گردانیم
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    ALLOWED.includes(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(new Error('FILE_TYPE'));
  }
}).single('file');

// middleware: خطای آپلود را به پیام قابل فهم تبدیل می‌کند
const handleUpload = (req, res, next) => upload(req, res, err => {
  if (!err) return next();
  const msg = err.message === 'FILE_TYPE' ? 'نوع فایل مجاز نیست' : err.code === 'LIMIT_FILE_SIZE' ? 'حجم فایل بیشتر از ۲۵ مگابایت است' : 'خطا در آپلود فایل';
  res.status(400).json({ error: msg });
});

const removeFile = p => { if (p) fs.unlink(path.join(UPLOAD_DIR, path.basename(p)), () => {}); };

function sendFile(res, storedName, downloadName) {
  const full = path.join(UPLOAD_DIR, path.basename(storedName || ''));
  if (!storedName || !fs.existsSync(full)) return res.status(404).json({ error: 'فایل پیدا نشد' });
  res.download(full, downloadName);
}
// حذف فایل از دیسک فقط وقتی هیچ جدولی دیگر به آن اشاره نمی‌کند (چند رکورد ممکن است یک فایل را مشترک داشته باشند)
const REFS = [['documents', 'file_path'], ['proposals', 'file_path'], ['proposal_files', 'file_path'], ['doc_files', 'file_path'],
  ['tender_files', 'file_path'], ['personnel', 'cv_path'], ['resumes', 'attach_path'], ['gen_files', 'file_path'], ['inquiry_files', 'file_path'], ['withdrawal_files', 'file_path']];
async function releaseFile(stored) {
  if (!stored) return;
  for (const [tbl, col] of REFS) {
    try {
      const r = await pool.query(`SELECT 1 FROM ${tbl} WHERE ${col} = $1 LIMIT 1`, [stored]);
      if (r.rows.length) return;
    } catch (e) { /* جدول وجود ندارد */ }
  }
  removeFile(stored);
}
module.exports = { handleUpload, removeFile, releaseFile, sendFile };
