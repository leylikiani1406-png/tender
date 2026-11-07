require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('❌ متغیر JWT_SECRET در .env تنظیم نشده (حداقل ۱۶ کاراکتر).');
  process.exit(1);
}
const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));
const mount = (url, file) => { if (fs.existsSync(path.join(__dirname, 'routes', file + '.js'))) app.use(url, require('./routes/' + file)); };
mount('/api/auth', 'auth-v2');
mount('/api/users', 'users');
mount('/api/tenders', 'tenders');
mount('/api/proposals', 'proposals');
mount('/api/folders', 'folders');
mount('/api/results', 'results');
mount('/api/resumes', 'resumes');
mount('/api/translate', 'translate');
mount('/api/general', 'general');
mount('/api/inquiries', 'inquiries');
mount('/api/withdrawals', 'withdrawals');
mount('/api/dashboard', 'dashboard');
mount('/api/extract', 'extract');
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// pdf-lib برای ساخت بستهٔ PDF مدارک از خود سرور سرو می‌شود (بدون وابستگی به CDN)
let pdfLibDist = path.join(__dirname, 'node_modules', 'pdf-lib', 'dist');
try { pdfLibDist = path.join(path.dirname(require.resolve('pdf-lib/package.json')), 'dist'); } catch (e) { /* npm install اجرا نشده */ }
app.use('/vendor', express.static(pdfLibDist));
app.use(express.static(path.join(__dirname, 'public')));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.type === 'entity.parse.failed' ? 400 : 500).json({ error: 'خطای سرور' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('Server running on port ' + PORT));
