-- نسخه ۵: گردش‌کار کامل، کامنت و تاریخچه، اعلان تغییرات، استعلام قیمت، انصراف، آرشیو سال‌های قبل، گردش‌کار مناقصات عمومی (قابل تکرار)

-- ── مناقصات معدنی ──
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS received_date DATE;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS year_j INTEGER;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS is_archive BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS risk_text TEXT;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS opportunity_text TEXT;
UPDATE tenders SET received_date = created_at::date WHERE received_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenders_year ON tenders(year_j);

ALTER TABLE tender_files ADD COLUMN IF NOT EXISTS change_id INTEGER;
ALTER TABLE tender_files DROP CONSTRAINT IF EXISTS tender_files_kind_check;
ALTER TABLE tender_files ADD CONSTRAINT tender_files_kind_check CHECK (kind IN ('tender','feasibility','guarantee','work','change','archive'));

CREATE TABLE IF NOT EXISTS tender_comments (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tcomments ON tender_comments(tender_id);

-- اعلان تغییرات (مثلاً تغییر مبلغ ضمانت‌نامه یا مهلت در میانهٔ مناقصه)
CREATE TABLE IF NOT EXISTS tender_changes (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  body TEXT,
  field VARCHAR(30), old_value VARCHAR(300), new_value VARCHAR(300),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tchanges ON tender_changes(tender_id);

-- ── استعلام قیمت: پوشه‌های دلخواه + ردیف استعلام + پیوست ──
CREATE TABLE IF NOT EXISTS inquiry_folders (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES inquiry_folders(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  created_by INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS inquiries (
  id SERIAL PRIMARY KEY,
  folder_id INTEGER REFERENCES inquiry_folders(id) ON DELETE SET NULL,
  title VARCHAR(400) NOT NULL,
  party VARCHAR(300),
  inquiry_date DATE, year_j INTEGER,
  amount NUMERIC,
  status VARCHAR(12) NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','selected','closed')),
  description TEXT,
  created_by INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inq_folder ON inquiries(folder_id);
CREATE TABLE IF NOT EXISTS inquiry_files (
  id SERIAL PRIMARY KEY,
  inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  file_name VARCHAR(300) NOT NULL, file_path VARCHAR(500) NOT NULL, file_size BIGINT,
  uploaded_by INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inq_files ON inquiry_files(inquiry_id);

-- ── انصراف از مناقصه ──
CREATE TABLE IF NOT EXISTS tender_withdrawals (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER REFERENCES tenders(id) ON DELETE SET NULL,
  title VARCHAR(400) NOT NULL,
  client_name VARCHAR(300),
  withdraw_date DATE, year_j INTEGER,
  reason TEXT,
  created_by INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS withdrawal_files (
  id SERIAL PRIMARY KEY,
  withdrawal_id INTEGER NOT NULL REFERENCES tender_withdrawals(id) ON DELETE CASCADE,
  file_name VARCHAR(300) NOT NULL, file_path VARCHAR(500) NOT NULL, file_size BIGINT,
  uploaded_by INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wd_files ON withdrawal_files(withdrawal_id);

-- ── مناقصات عمومی (نفت و گاز): گردش‌کار با دروازه‌های تصمیم ──
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS received_date DATE;
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS base_amount NUMERIC;
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS our_offer NUMERIC;
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS guarantee_amount NUMERIC;
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS tech_done BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS tech_at TIMESTAMP;
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS schedule TEXT;
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS ceo_decision VARCHAR(5);
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS ceo_decided_at TIMESTAMP;
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS ceo_note TEXT;
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS needs_guarantee BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS guarantee_status VARCHAR(10);
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS guarantee_note TEXT;
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS guarantee_at TIMESTAMP;
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS closed_ack BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '{}';
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS risk_text TEXT;
ALTER TABLE gen_tenders ADD COLUMN IF NOT EXISTS opportunity_text TEXT;
UPDATE gen_tenders SET received_date = created_at::date WHERE received_date IS NULL;
UPDATE gen_tenders SET ceo_decision = 'yes' WHERE ceo_decision IS NULL AND bid_decision = 'bid';
UPDATE gen_tenders SET ceo_decision = 'no', closed_ack = TRUE WHERE ceo_decision IS NULL AND bid_decision = 'no_bid';

ALTER TABLE gen_files ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'tender';
ALTER TABLE gen_files ADD COLUMN IF NOT EXISTS assignment_id INTEGER;
ALTER TABLE gen_files ADD COLUMN IF NOT EXISTS change_id INTEGER;

CREATE TABLE IF NOT EXISTS gen_history (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER NOT NULL REFERENCES gen_tenders(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS gen_comments (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER NOT NULL REFERENCES gen_tenders(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS gen_changes (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER NOT NULL REFERENCES gen_tenders(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL, body TEXT,
  field VARCHAR(30), old_value VARCHAR(300), new_value VARCHAR(300),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS gen_assignments (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER NOT NULL REFERENCES gen_tenders(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assignee_name VARCHAR(200) NOT NULL,
  doc_key VARCHAR(30), task TEXT, due_date DATE,
  status VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  created_by INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW(), done_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gen_hist ON gen_history(tender_id);
CREATE INDEX IF NOT EXISTS idx_gen_comm ON gen_comments(tender_id);
CREATE INDEX IF NOT EXISTS idx_gen_asg ON gen_assignments(tender_id);
