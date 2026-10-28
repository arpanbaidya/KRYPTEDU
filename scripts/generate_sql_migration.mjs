import fs from 'node:fs';
import Papa from 'papaparse';

const csv = fs.readFileSync('official_dataset.csv', 'utf8');
const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });

const departmentsMap = {
  'B.Tech Computer Engineering': 'Computer Engineering',
  'B.Tech Artificial Intelligence and Machine Learning': 'Artificial Intelligence and Machine Learning',
  'B.Tech Cyber security & Forensics': 'Cyber security & Forensics'
};

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

let sql = `-- ============================================================================
-- Migration: 0011_replace_dummy_data_with_official_dataset.sql
-- Description: Replace 36 mock dummy students with official 275 student records
--              from the authoritative UCoE institutional dataset.
--              Enforces canonical departments and performance indexes.
-- ============================================================================

-- 1. Relax NOT NULL constraints for metrics not in the source dataset
-- (Prevents fabricating fake metrics while preserving real student identities)
ALTER TABLE public.students 
  ALTER COLUMN cgpa DROP NOT NULL,
  ALTER COLUMN cgpa DROP DEFAULT,
  ALTER COLUMN cgpa SET DEFAULT NULL,
  ALTER COLUMN attendance DROP NOT NULL,
  ALTER COLUMN attendance DROP DEFAULT,
  ALTER COLUMN attendance SET DEFAULT NULL,
  ALTER COLUMN lms_activity DROP NOT NULL,
  ALTER COLUMN lms_activity DROP DEFAULT,
  ALTER COLUMN lms_activity SET DEFAULT NULL,
  ALTER COLUMN engagement DROP NOT NULL,
  ALTER COLUMN engagement DROP DEFAULT,
  ALTER COLUMN engagement SET DEFAULT NULL,
  ALTER COLUMN placement_readiness DROP NOT NULL,
  ALTER COLUMN placement_readiness DROP DEFAULT,
  ALTER COLUMN placement_readiness SET DEFAULT NULL,
  ALTER COLUMN skills_score DROP NOT NULL,
  ALTER COLUMN skills_score DROP DEFAULT,
  ALTER COLUMN skills_score SET DEFAULT NULL,
  ALTER COLUMN feedback_score DROP NOT NULL,
  ALTER COLUMN feedback_score DROP DEFAULT,
  ALTER COLUMN feedback_score SET DEFAULT NULL,
  ALTER COLUMN backlogs DROP NOT NULL,
  ALTER COLUMN backlogs DROP DEFAULT,
  ALTER COLUMN backlogs SET DEFAULT NULL;

-- 2. Add department canonical check constraint
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS check_canonical_departments;
ALTER TABLE public.students ADD CONSTRAINT check_canonical_departments 
  CHECK (department IN (
    'Computer Engineering',
    'Artificial Intelligence and Machine Learning',
    'Cyber security & Forensics'
  ));

-- 3. Delete old dummy records ('KR2024001' to 'KR2024036')
-- Cascade handles dummy interventions and fees
DELETE FROM public.students 
  WHERE roll_no LIKE 'KR2024%';

-- 4. Insert 275 Official Students
INSERT INTO public.students (roll_no, name, department, year, cgpa, attendance, lms_activity, engagement, placement_readiness, skills_score, feedback_score, backlogs)
VALUES
`;

const rowSqls = data.map((row) => {
  const roll_no = escapeSql((row['Registration Id'] || '').trim());
  const name = escapeSql((row['Name'] || '').trim());
  const programme = (row['Programme'] || '').trim();
  const department = escapeSql(departmentsMap[programme] || programme);
  return `  ('${roll_no}', '${name}', '${department}', 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`;
});

sql += rowSqls.join(',\n');
sql += `\nON CONFLICT (roll_no) DO UPDATE SET 
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  year = EXCLUDED.year,
  updated_at = now();\n\n`;

sql += `-- 5. Seed standard course fee (₹1,75,000.00) for all official students
INSERT INTO public.student_course_fees (student_id, course_name, total_fee, due_date)
SELECT 
  s.id,
  'B.Tech ' || s.department AS course_name,
  175000.00 AS total_fee,
  (CURRENT_DATE + INTERVAL '30 days')::date
FROM public.students s
ON CONFLICT (student_id, course_name) DO NOTHING;

-- 6. High-Performance Database Indexes
CREATE INDEX IF NOT EXISTS idx_students_roll_no ON public.students(roll_no);
CREATE INDEX IF NOT EXISTS idx_students_department ON public.students(department);
CREATE INDEX IF NOT EXISTS idx_students_year ON public.students(year);
CREATE INDEX IF NOT EXISTS idx_students_name ON public.students(name);
CREATE INDEX IF NOT EXISTS idx_students_dept_year ON public.students(department, year);
`;

fs.writeFileSync('drizzle/migrations/0011_replace_dummy_data_with_official_dataset.sql', sql, 'utf8');
console.log('Saved drizzle/migrations/0011_replace_dummy_data_with_official_dataset.sql');
