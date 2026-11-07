-- اسکیمای کامل سامانه مناقصات (اجرا با: npm run setup-db)
DROP TABLE IF EXISTS tender_history, proposals, personnel, documents, tenders, user_sectors, sectors, users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(200), phone VARCHAR(50),
  password_hash VARCHAR(100) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('super_admin','ceo','technical_manager','technical_expert','financial','procurement')),
  access_level VARCHAR(10) NOT NULL DEFAULT 'sector' CHECK (access_level IN ('all','sector')),
  position VARCHAR(200), department VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMP, password_changed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE sectors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL, name_en VARCHAR(200), code VARCHAR(50) UNIQUE
);

CREATE TABLE user_sectors (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector_id INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, sector_id)
);

CREATE TABLE tenders (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL, title_en VARCHAR(500),
  client_name VARCHAR(300),
  sector_id INTEGER NOT NULL REFERENCES sectors(id),
  budget NUMERIC, our_offer NUMERIC, deadline DATE, description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'announced'
    CHECK (status IN ('announced','technical_review','financial_offer','ceo_approval','submitted','won','lost','cancelled')),
  result VARCHAR(20),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tenders_sector ON tenders(sector_id);
CREATE INDEX idx_tenders_status ON tenders(status);

CREATE TABLE tender_history (
  id SERIAL PRIMARY KEY,
  tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  from_status VARCHAR(30), to_status VARCHAR(30) NOT NULL,
  user_id INTEGER REFERENCES users(id), note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- آرشیو مشترک: اسناد کیفی (quality) و فرم‌های ایزو (iso)
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  category VARCHAR(20) NOT NULL CHECK (category IN ('quality','iso')),
  title VARCHAR(300) NOT NULL, title_en VARCHAR(300), description TEXT,
  file_name VARCHAR(300) NOT NULL, file_path VARCHAR(500) NOT NULL, file_size BIGINT,
  uploaded_by INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- آرشیو بخش‌ها: کارکنان کلیدی و پروپوزال‌ها
CREATE TABLE personnel (
  id SERIAL PRIMARY KEY,
  sector_id INTEGER NOT NULL REFERENCES sectors(id),
  full_name VARCHAR(200) NOT NULL, full_name_en VARCHAR(200),
  position VARCHAR(200), expertise VARCHAR(300), education VARCHAR(300),
  experience_years INTEGER, email VARCHAR(200), phone VARCHAR(50),
  cv_name VARCHAR(300), cv_path VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE proposals (
  id SERIAL PRIMARY KEY,
  sector_id INTEGER NOT NULL REFERENCES sectors(id),
  tender_id INTEGER REFERENCES tenders(id) ON DELETE SET NULL,
  title VARCHAR(300) NOT NULL, title_en VARCHAR(300), description TEXT,
  file_name VARCHAR(300), file_path VARCHAR(500),
  created_by INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
