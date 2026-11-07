-- مهاجرت نسخه ۳ (بدون حذف داده): نوع مناقصه، گردش‌کار جدید، فرم‌ها، پوشه‌ها و آمار اکسل
-- اجرا: npm run migrate   (چندبار اجرا شود مشکلی ندارد)

ALTER TABLE tenders ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'exploration';
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS ceo_decision VARCHAR(5);
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS ceo_decided_at TIMESTAMP;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS ceo_note TEXT;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS needs_guarantee BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS guarantee_status VARCHAR(10);
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS guarantee_note TEXT;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS guarantee_at TIMESTAMP;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS tech_done BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS tech_at TIMESTAMP;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS referral_to VARCHAR(200);
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS schedule TEXT;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS closed_ack BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS feasibility JSONB NOT NULL DEFAULT '{}';
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '{}';
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS result_form JSONB NOT NULL DEFAULT '{}';

ALTER TABLE tenders DROP CONSTRAINT IF EXISTS tenders_kind_check;
ALTER TABLE tenders ADD CONSTRAINT tenders_kind_check CHECK (kind IN ('exploration','supervision'));

-- وضعیت‌های جدید: review (در انتظار تصمیم)، active (شرکت می‌کنیم)، closed (بسته شد)، finished (اتمام یافته)
-- تبدیل وضعیت‌های قدیمی فقط یک‌بار (قبل از نسخه ۴) انجام می‌شود تا با اجرای دوباره، وضعیت‌های جدید خراب نشوند
ALTER TABLE tenders DROP CONSTRAINT IF EXISTS tenders_status_check;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenders' AND column_name = 'submit_status') THEN
    UPDATE tenders SET status = 'review' WHERE status IN ('announced','technical_review','financial_offer','ceo_approval');
    UPDATE tenders SET status = 'active', ceo_decision = 'yes' WHERE status = 'submitted';
    UPDATE tenders SET ceo_decision = 'yes', result = COALESCE(result, status), status = 'finished' WHERE status IN ('won','lost');
    UPDATE tenders SET ceo_decision = 'no', closed_ack = TRUE, status = 'closed' WHERE status = 'cancelled';
  END IF;
END $$;
ALTER TABLE tenders ADD CONSTRAINT tenders_status_check CHECK (status IN ('review','active','closed','cancelled','finished'));
ALTER TABLE tenders ALTER COLUMN status SET DEFAULT 'review';
CREATE INDEX IF NOT EXISTS idx_tenders_kind ON tenders(kind);

-- فایل‌های هر مناقصه: اسناد مناقصه، پیوست امکان‌سنجی، ضمانت‌نامه
CREATE TABLE IF NOT EXISTS tender_files (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('tender','feasibility','guarantee')),
  file_name VARCHAR(300) NOT NULL, file_path VARCHAR(500) NOT NULL, file_size BIGINT,
  uploaded_by INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tender_files_tender ON tender_files(tender_id);

-- پوشه‌ها و مدارک: مدارک کیفی، مدارک فنی، پروپوزال
CREATE TABLE IF NOT EXISTS doc_folders (
  id SERIAL PRIMARY KEY,
  area VARCHAR(20) NOT NULL CHECK (area IN ('quality','technical','proposal')),
  parent_id INTEGER REFERENCES doc_folders(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  created_by INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS doc_files (
  id SERIAL PRIMARY KEY,
  area VARCHAR(20) NOT NULL CHECK (area IN ('quality','technical','proposal')),
  folder_id INTEGER REFERENCES doc_folders(id) ON DELETE CASCADE,
  file_name VARCHAR(300) NOT NULL, file_path VARCHAR(500) NOT NULL, file_size BIGINT,
  uploaded_by INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_folders_area ON doc_folders(area, parent_id);
CREATE INDEX IF NOT EXISTS idx_doc_files_area ON doc_files(area, folder_id);

-- آمار داشبورد از فایل اکسل (یک ردیف)
CREATE TABLE IF NOT EXISTS result_stats (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  rows JSONB NOT NULL DEFAULT '[]', file_name VARCHAR(300),
  uploaded_by INTEGER REFERENCES users(id), uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);
