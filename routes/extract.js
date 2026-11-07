// استخراج متن از فایل‌های PDF و Word برای ورود خودکار اطلاعات (رزومه‌ساز و آرشیو مناقصه‌ها). اکسل/CSV در مرورگر خوانده می‌شود.
const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { authenticate, notStaff } = require('../middleware/auth');
router.use(authenticate, notStaff);
const up = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }).single('file');

router.post('/', (req, res) => up(req, res, async err => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'حجم فایل بیشتر از ۲۵ مگابایت است' : 'خطا در دریافت فایل' });
  if (!req.file) return res.status(400).json({ error: 'فایل را انتخاب کنید' });
  const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8'), ext = path.extname(name).toLowerCase();
  try {
    let text = '';
    if (ext === '.pdf') {
      const r = await require('pdf-parse')(req.file.buffer);
      text = r.text || '';
      if (text.replace(/\s/g, '').length < 20) return res.status(422).json({ error: 'این PDF متن قابل‌خواندن ندارد (احتمالاً اسکن است). نسخهٔ Word یا اکسل را بارگذاری کنید.' });
    } else if (ext === '.docx') {
      text = ((await require('mammoth').extractRawText({ buffer: req.file.buffer })).value || '').replace(/\n\n/g, '\n');  // هر پاراگراف یک خط؛ پاراگراف خالی = خط خالی
    } else if (['.txt', '.csv', '.md'].includes(ext)) {
      text = req.file.buffer.toString('utf8');
    } else return res.status(400).json({ error: 'این نوع فایل برای خواندن خودکار پشتیبانی نمی‌شود (PDF، Word با پسوند docx، اکسل، CSV و TXT)' });
    text = text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, 400000);
    res.json({ name, ext, text });
  } catch (e) { console.error('extract:', e.message); res.status(422).json({ error: 'خواندن فایل ممکن نشد؛ فایل خراب یا رمزدار است' }); }
}));
module.exports = router;
