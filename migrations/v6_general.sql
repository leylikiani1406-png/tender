-- مناقصات عمومی (نفت و گاز): خط لولهٔ فرصت‌ها، تصمیم شرکت/عدم شرکت، استانداردها، ریسک‌ها و رقبا (قابل تکرار)
CREATE TABLE IF NOT EXISTS gen_standards (
  id SERIAL PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,
  title VARCHAR(300) NOT NULL,
  body VARCHAR(40) NOT NULL,
  topic VARCHAR(40) NOT NULL,
  note VARCHAR(500)
);
CREATE TABLE IF NOT EXISTS gen_tenders (
  id SERIAL PRIMARY KEY,
  title VARCHAR(300) NOT NULL,
  tender_number VARCHAR(100),
  client_name VARCHAR(300),
  category VARCHAR(20) NOT NULL DEFAULT 'other' CHECK (category IN ('upstream','downstream','drilling','pipeline','epc','supply','services','hse','other')),
  location VARCHAR(200),
  est_value NUMERIC,
  currency VARCHAR(5) NOT NULL DEFAULT 'IRR',
  publish_date DATE,
  deadline DATE,
  stage VARCHAR(20) NOT NULL DEFAULT 'identified' CHECK (stage IN ('identified','qualifying','preparing','submitted','won','lost','no_bid')),
  bid_decision VARCHAR(10) CHECK (bid_decision IS NULL OR bid_decision IN ('bid','no_bid')),
  bid_score JSONB NOT NULL DEFAULT '{}',
  probability INTEGER CHECK (probability IS NULL OR (probability BETWEEN 0 AND 100)),
  standards JSONB NOT NULL DEFAULT '{}',
  risks JSONB NOT NULL DEFAULT '[]',
  competitors JSONB NOT NULL DEFAULT '[]',
  tasks JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gen_stage ON gen_tenders(stage);
CREATE INDEX IF NOT EXISTS idx_gen_deadline ON gen_tenders(deadline);
CREATE TABLE IF NOT EXISTS gen_files (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER NOT NULL REFERENCES gen_tenders(id) ON DELETE CASCADE,
  file_name VARCHAR(300) NOT NULL, file_path VARCHAR(500) NOT NULL, file_size BIGINT,
  uploaded_by INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gen_files ON gen_files(tender_id);

-- فهرست اولیهٔ استانداردهای رایج صنعت نفت و گاز (قابل ویرایش؛ ویرایش جاری هر استاندارد را از منبع رسمی بررسی کنید)
INSERT INTO gen_standards (code, title, body, topic) VALUES
 ('API 5L','Specification for Line Pipe','API','pipeline'),
 ('API 5CT','Casing and Tubing','API','drilling'),
 ('API 6A','Wellhead and Tree Equipment','API','drilling'),
 ('API 6D','Pipeline and Piping Valves','API','pipeline'),
 ('API 16A','Drill-through Equipment','API','drilling'),
 ('API 610','Centrifugal Pumps for Petroleum, Petrochemical and Natural Gas Industries','API','equipment'),
 ('API 650','Welded Tanks for Oil Storage','API','storage'),
 ('API 653','Tank Inspection, Repair, Alteration, and Reconstruction','API','inspection'),
 ('API 510','Pressure Vessel Inspection Code','API','inspection'),
 ('API 570','Piping Inspection Code','API','inspection'),
 ('API 520','Sizing, Selection, and Installation of Pressure-relieving Devices','API','safety'),
 ('API 521','Pressure-relieving and Depressuring Systems','API','safety'),
 ('API RP 14C','Safety Systems for Offshore Production Platforms','API','safety'),
 ('API RP 1111','Offshore Hydrocarbon Pipelines','API','pipeline'),
 ('API 1104','Welding of Pipelines and Related Facilities','API','pipeline'),
 ('API Spec Q1','Quality Management System Requirements for Manufacturing Organizations','API','quality'),
 ('API Spec Q2','Quality Management System for Service Supply Organizations','API','quality'),
 ('ASME B31.3','Process Piping','ASME','piping'),
 ('ASME B31.4','Pipeline Transportation Systems for Liquids and Slurries','ASME','pipeline'),
 ('ASME B31.8','Gas Transmission and Distribution Piping Systems','ASME','pipeline'),
 ('ASME BPVC VIII','Boiler and Pressure Vessel Code, Section VIII (Pressure Vessels)','ASME','equipment'),
 ('ASME BPVC IX','Boiler and Pressure Vessel Code, Section IX (Welding, Brazing and Fusing Qualifications)','ASME','welding'),
 ('ISO 9001','Quality Management Systems','ISO','quality'),
 ('ISO 14001','Environmental Management Systems','ISO','hse'),
 ('ISO 45001','Occupational Health and Safety Management Systems','ISO','hse'),
 ('ISO 29001','Quality Management Systems for Petroleum, Petrochemical and Natural Gas Industries','ISO','quality'),
 ('ISO 31000','Risk Management Guidelines','ISO','risk'),
 ('ISO 55001','Asset Management Systems','ISO','management'),
 ('ISO 15156','Materials for Use in H2S-containing Environments (NACE MR0175)','ISO','materials'),
 ('ISO 13628','Design and Operation of Subsea Production Systems','ISO','subsea'),
 ('NORSOK M-001','Materials Selection','NORSOK','materials'),
 ('NORSOK S-001','Technical Safety','NORSOK','safety'),
 ('NORSOK Z-013','Risk and Emergency Preparedness Assessment','NORSOK','risk'),
 ('NORSOK D-010','Well Integrity in Drilling and Well Operations','NORSOK','drilling'),
 ('IEC 61511','Functional Safety — Safety Instrumented Systems for the Process Industry','IEC','safety'),
 ('IEC 61508','Functional Safety of Electrical/Electronic/Programmable Electronic Safety-related Systems','IEC','safety'),
 ('IEC 60079','Explosive Atmospheres','IEC','safety'),
 ('NACE SP0169','Control of External Corrosion on Underground or Submerged Metallic Piping Systems','NACE','corrosion'),
 ('DNV-ST-F101','Submarine Pipeline Systems','DNV','pipeline'),
 ('IPS','استانداردهای نفت ایران (Iranian Petroleum Standards) — شمارهٔ مرتبط با موضوع مناقصه را اضافه کنید','IPS','local')
ON CONFLICT (code) DO NOTHING;
