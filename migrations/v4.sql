-- مهاجرت نسخه ۴ (بدون حذف داده؛ چندبار اجرا شود مشکلی ندارد)
-- اجرا: npm run migrate

-- ── کاربران: شماره پرسنلی و نقش «همکار» (دسترسی محدود به کارهای ارجاع‌شده) ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS personnel_no VARCHAR(50);
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN
  ('super_admin','ceo','technical_manager','technical_expert','financial','procurement','staff'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_personnel_no ON users(personnel_no) WHERE personnel_no IS NOT NULL;

-- ── مناقصات ──
ALTER TABLE tenders ALTER COLUMN sector_id DROP NOT NULL;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS tender_number VARCHAR(100);
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS package_type VARCHAR(20) NOT NULL DEFAULT 'full';
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS guarantee_amount NUMERIC;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS submit_status VARCHAR(20);
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS sent_date DATE;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS score_quality NUMERIC;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS score_technical NUMERIC;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS score_price NUMERIC;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS score_total NUMERIC;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS rank_no INTEGER;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS contract_amount NUMERIC;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS winner_name VARCHAR(300);

ALTER TABLE tenders DROP CONSTRAINT IF EXISTS tenders_package_type_check;
ALTER TABLE tenders ADD CONSTRAINT tenders_package_type_check CHECK (package_type IN ('quality','technical','price','full'));
ALTER TABLE tenders DROP CONSTRAINT IF EXISTS tenders_submit_status_check;
ALTER TABLE tenders ADD CONSTRAINT tenders_submit_status_check CHECK (submit_status IS NULL OR submit_status IN ('sending','sent','awaiting_winner'));
ALTER TABLE tenders DROP CONSTRAINT IF EXISTS tenders_status_check;
ALTER TABLE tenders ADD CONSTRAINT tenders_status_check CHECK (status IN ('review','active','closed','cancelled','finished'));

-- نمرهٔ قدیمیِ متنی در فرم نتیجه به ستون‌های عددی منتقل می‌شود (فقط اگر عدد معتبر باشد)
UPDATE tenders SET score_quality = (result_form->>'q')::numeric
  WHERE score_quality IS NULL AND result_form->>'q' ~ '^[0-9]+(\.[0-9]+)?$';
UPDATE tenders SET score_technical = (result_form->>'t')::numeric
  WHERE score_technical IS NULL AND result_form->>'t' ~ '^[0-9]+(\.[0-9]+)?$';
UPDATE tenders SET contract_amount = (result_form->>'amount')::numeric
  WHERE contract_amount IS NULL AND result_form->>'amount' ~ '^[0-9]+(\.[0-9]+)?$';
UPDATE tenders SET winner_name = NULLIF(result_form->>'winner','')
  WHERE winner_name IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenders_number ON tenders(tender_number);

-- ── ارجاع کار (مدیر دفتر فنی به همکاران؛ می‌تواند کار را بین چند نفر تقسیم کند) ──
CREATE TABLE IF NOT EXISTS tender_assignments (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assignee_name VARCHAR(200) NOT NULL,
  part VARCHAR(30) NOT NULL DEFAULT 'other' CHECK (part IN ('schedule','technical_proposal','quality_docs','price','other')),
  task TEXT,
  share_percent INTEGER CHECK (share_percent IS NULL OR (share_percent >= 0 AND share_percent <= 100)),
  due_date DATE,
  status VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  done_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_assign_tender ON tender_assignments(tender_id);
CREATE INDEX IF NOT EXISTS idx_assign_user ON tender_assignments(user_id);

ALTER TABLE tender_files ADD COLUMN IF NOT EXISTS assignment_id INTEGER REFERENCES tender_assignments(id) ON DELETE SET NULL;
ALTER TABLE tender_files DROP CONSTRAINT IF EXISTS tender_files_kind_check;
ALTER TABLE tender_files ADD CONSTRAINT tender_files_kind_check CHECK (kind IN ('tender','feasibility','guarantee','work','change','archive'));

-- ── اعلان‌ها: کدام اعلان را هر کاربر دیده است ──
CREATE TABLE IF NOT EXISTS notif_seen (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, key)
);

-- ── پروپوزال‌ها: ردیفی با نام، تاریخ ارسال، وضعیت، مبلغ پیشنهادی، شماره مناقصه ──
ALTER TABLE proposals ALTER COLUMN sector_id DROP NOT NULL;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS tender_number VARCHAR(100);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS client_name VARCHAR(300);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS sent_date DATE;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft';
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS offer_amount NUMERIC;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_status_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_status_check CHECK (status IN ('draft','sent','awaiting','won','lost','cancelled'));

CREATE TABLE IF NOT EXISTS proposal_files (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  file_name VARCHAR(300) NOT NULL, file_path VARCHAR(500) NOT NULL, file_size BIGINT,
  uploaded_by INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proposal_files ON proposal_files(proposal_id);
-- فایل تکی قدیمی هر پروپوزال به فهرست پیوست‌ها می‌رود (یک‌بار)
INSERT INTO proposal_files (proposal_id, file_name, file_path, uploaded_by, created_at)
  SELECT p.id, p.file_name, p.file_path, p.created_by, p.created_at FROM proposals p
  WHERE p.file_path IS NOT NULL AND NOT EXISTS (SELECT 1 FROM proposal_files f WHERE f.proposal_id = p.id AND f.file_path = p.file_path);

-- ── آرشیو مدارک: مدارک فنی، مدارک کیفی، فرم‌های ایزو ──
ALTER TABLE doc_folders DROP CONSTRAINT IF EXISTS doc_folders_area_check;
ALTER TABLE doc_folders ADD CONSTRAINT doc_folders_area_check CHECK (area IN ('quality','technical','proposal','iso'));
ALTER TABLE doc_files DROP CONSTRAINT IF EXISTS doc_files_area_check;
ALTER TABLE doc_files ADD CONSTRAINT doc_files_area_check CHECK (area IN ('quality','technical','proposal','iso'));
INSERT INTO doc_files (area, folder_id, file_name, file_path, file_size, uploaded_by, created_at)
  SELECT 'iso', NULL, d.title || ' — ' || d.file_name, d.file_path, d.file_size, d.uploaded_by, d.created_at FROM documents d
  WHERE d.category = 'iso' AND NOT EXISTS (SELECT 1 FROM doc_files x WHERE x.area = 'iso' AND x.file_path = d.file_path);
