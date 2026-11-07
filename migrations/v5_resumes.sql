-- رزومه‌ساز (نسخه ۴): رزومهٔ هر فرد با دو زبان فارسی/انگلیسی، قالب و تم رنگی (قابل تکرار)
CREATE TABLE IF NOT EXISTS resumes (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  lang VARCHAR(2) NOT NULL DEFAULT 'fa' CHECK (lang IN ('fa','en')),
  template VARCHAR(20) NOT NULL DEFAULT 'classic',
  theme JSONB NOT NULL DEFAULT '{}',
  data JSONB NOT NULL DEFAULT '{}',
  attach_name VARCHAR(300), attach_path VARCHAR(500),
  legacy_personnel_id INTEGER,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_resumes_legacy ON resumes(legacy_personnel_id) WHERE legacy_personnel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resumes_owner ON resumes(owner_id);

-- فهرست پرسنل قدیمی (در صورت وجود) یک‌بار به رزومه تبدیل می‌شود؛ فایل CV قبلی به‌عنوان پیوست می‌ماند
DO $$
BEGIN
  IF to_regclass('public.personnel') IS NOT NULL THEN
    INSERT INTO resumes (title, lang, data, attach_name, attach_path, legacy_personnel_id, created_at)
    SELECT p.full_name, 'fa',
      jsonb_build_object(
        'fa', jsonb_build_object('name', p.full_name, 'title', COALESCE(p.position, ''), 'summary', '',
          'email', COALESCE(p.email, ''), 'phone', COALESCE(p.phone, ''), 'address', '', 'website', '',
          'skills', CASE WHEN p.expertise IS NULL OR p.expertise = '' THEN '[]'::jsonb ELSE jsonb_build_array(p.expertise) END,
          'education', CASE WHEN p.education IS NULL OR p.education = '' THEN '[]'::jsonb
                            ELSE jsonb_build_array(jsonb_build_object('degree', p.education, 'school', '', 'from', '', 'to', '', 'note', '')) END,
          'experience', '[]'::jsonb, 'languages', '[]'::jsonb, 'certificates', '[]'::jsonb, 'projects', '[]'::jsonb,
          'years', p.experience_years),
        'en', jsonb_build_object('name', COALESCE(p.full_name_en, ''), 'title', '', 'summary', '', 'email', COALESCE(p.email, ''), 'phone', COALESCE(p.phone, ''),
          'address', '', 'website', '', 'skills', '[]'::jsonb, 'education', '[]'::jsonb, 'experience', '[]'::jsonb, 'languages', '[]'::jsonb,
          'certificates', '[]'::jsonb, 'projects', '[]'::jsonb)),
      p.cv_name, p.cv_path, p.id, p.created_at
    FROM personnel p
    WHERE NOT EXISTS (SELECT 1 FROM resumes r WHERE r.legacy_personnel_id = p.id);
  END IF;
END $$;
