-- ============================================================================
-- Migration: 0016_academics_module.sql
-- Description: Academics Module Tables, Official B.Tech CSE Subject & Faculty
--              Mappings, Semester Configuration (Sem I-VIII), Resources,
--              Assignments, Results (Written & Internal 0-50), CGPA conversions,
--              and Strict Role-Based Security.
-- ============================================================================

-- 1. Create Academic Semesters Table
CREATE TABLE IF NOT EXISTS public.academic_semesters (
  id text PRIMARY KEY,
  semester_number integer NOT NULL UNIQUE,
  label text NOT NULL,
  roman text NOT NULL,
  is_configured boolean NOT NULL DEFAULT false,
  total_credits integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create Subjects Table
CREATE TABLE IF NOT EXISTS public.subjects (
  id text PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  semester_number integer NOT NULL,
  department text NOT NULL,
  course text NOT NULL,
  credits numeric(4, 2) NOT NULL DEFAULT 3.0,
  is_lab boolean NOT NULL DEFAULT false,
  faculty_name text NOT NULL,
  inconsistency_flag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subjects_code_sem_unique UNIQUE (code, semester_number)
);

CREATE INDEX IF NOT EXISTS idx_subjects_sem ON public.subjects(semester_number);
CREATE INDEX IF NOT EXISTS idx_subjects_dept ON public.subjects(department);

-- 3. Create Subject Resources Table
CREATE TABLE IF NOT EXISTS public.subject_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id text NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  semester_number integer NOT NULL,
  title text NOT NULL,
  description text,
  resource_type text NOT NULL,
  file_url text,
  external_url text,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resources_subject ON public.subject_resources(subject_id);

-- 4. Create Subject Assignments Table
CREATE TABLE IF NOT EXISTS public.subject_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id text NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  semester_number integer NOT NULL,
  title text NOT NULL,
  instructions text,
  due_date timestamptz NOT NULL,
  reference_url text,
  created_by uuid REFERENCES auth.users(id),
  created_by_name text NOT NULL,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Closed', 'Upcoming')),
  max_marks numeric(4, 2) NOT NULL DEFAULT 25.0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_subject ON public.subject_assignments(subject_id);

-- 5. Create Student Subject Results Table
CREATE TABLE IF NOT EXISTS public.student_subject_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  student_roll_no text NOT NULL,
  subject_id text NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  semester_number integer NOT NULL,
  written_marks numeric(5, 2) CHECK (written_marks IS NULL OR (written_marks >= 0 AND written_marks <= 50)),
  internal_marks numeric(5, 2) CHECK (internal_marks IS NULL OR (internal_marks >= 0 AND internal_marks <= 50)),
  total_marks numeric(5, 2) CHECK (total_marks IS NULL OR (total_marks >= 0 AND total_marks <= 100)),
  percentage numeric(5, 2),
  grade text,
  grade_point numeric(4, 2),
  publication_status text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published')),
  is_demo boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  last_updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT results_student_subject_unique UNIQUE (student_roll_no, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_results_student ON public.student_subject_results(student_roll_no);
CREATE INDEX IF NOT EXISTS idx_results_subject ON public.student_subject_results(subject_id);
CREATE INDEX IF NOT EXISTS idx_results_sem ON public.student_subject_results(semester_number);
CREATE INDEX IF NOT EXISTS idx_results_status ON public.student_subject_results(publication_status);

-- 6. Create Academic Audit Logs Table
CREATE TABLE IF NOT EXISTS public.academic_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid REFERENCES public.student_subject_results(id) ON DELETE SET NULL,
  student_roll_no text NOT NULL,
  subject_name text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_by_name text,
  old_written numeric(5, 2),
  old_internal numeric(5, 2),
  new_written numeric(5, 2),
  new_internal numeric(5, 2),
  old_status text,
  new_status text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Grant Permissions
GRANT ALL ON public.academic_semesters TO service_role;
GRANT SELECT ON public.academic_semesters TO authenticated, anon;

GRANT ALL ON public.subjects TO service_role;
GRANT SELECT ON public.subjects TO authenticated, anon;

GRANT ALL ON public.subject_resources TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_resources TO authenticated;
GRANT SELECT ON public.subject_resources TO anon;

GRANT ALL ON public.subject_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_assignments TO authenticated;
GRANT SELECT ON public.subject_assignments TO anon;

GRANT ALL ON public.student_subject_results TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_subject_results TO authenticated;
GRANT SELECT ON public.student_subject_results TO anon;

GRANT ALL ON public.academic_audit_logs TO service_role;
GRANT SELECT, INSERT ON public.academic_audit_logs TO authenticated;
GRANT SELECT ON public.academic_audit_logs TO anon;

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.academic_semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subject_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_audit_logs ENABLE ROW LEVEL SECURITY;

-- Semesters & Subjects: Everyone authenticated or anon can read configurations
CREATE POLICY "anyone read academic_semesters" ON public.academic_semesters FOR SELECT USING (true);
CREATE POLICY "anyone read subjects" ON public.subjects FOR SELECT USING (true);

-- Resources: Everyone can read; only faculty & admin can modify
CREATE POLICY "read subject_resources" ON public.subject_resources FOR SELECT USING (true);
CREATE POLICY "staff modify subject_resources" ON public.subject_resources
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('faculty', 'admin'))
  );

-- Assignments: Everyone can read; only faculty & admin can modify
CREATE POLICY "read subject_assignments" ON public.subject_assignments FOR SELECT USING (true);
CREATE POLICY "staff modify subject_assignments" ON public.subject_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('faculty', 'admin'))
  );

-- Student Subject Results:
-- 1. Faculty can read and manage drafts and published results
CREATE POLICY "faculty manage results" ON public.student_subject_results
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('faculty', 'admin'))
  );

-- 2. Students can ONLY read their own PUBLISHED results
CREATE POLICY "student read own published results" ON public.student_subject_results
  FOR SELECT TO authenticated
  USING (
    publication_status = 'published' AND
    (
      student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()) OR
      student_roll_no IN (SELECT roll_no FROM public.students WHERE user_id = auth.uid())
    )
  );

-- 3. Placement Officer can read PUBLISHED results
CREATE POLICY "placement read published results" ON public.student_subject_results
  FOR SELECT TO authenticated
  USING (
    publication_status = 'published' AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'placement')
  );

-- 9. Insert Semesters I - VIII Configurations
INSERT INTO public.academic_semesters (id, semester_number, label, roman, is_configured, total_credits, notes)
VALUES
  ('sem-1', 1, 'Semester I', 'I', true, 20, 'Configured via official B.Tech CSE mapping.'),
  ('sem-2', 2, 'Semester II', 'II', true, 20, 'Configured via official B.Tech CSE mapping.'),
  ('sem-3', 3, 'Semester III', 'III', true, 25, 'Configured via official B.Tech CSE mapping.'),
  ('sem-4', 4, 'Semester IV', 'IV', true, 22, 'Configured via official B.Tech CSE mapping.'),
  ('sem-5', 5, 'Semester V', 'V', true, 21, 'Configured via official B.Tech CSE mapping.'),
  ('sem-6', 6, 'Semester VI', 'VI', false, 0, 'Awaiting official curriculum mapping from Academic Dean.'),
  ('sem-7', 7, 'Semester VII', 'VII', false, 0, 'Awaiting official curriculum mapping from Academic Dean.'),
  ('sem-8', 8, 'Semester VIII', 'VIII', false, 0, 'Awaiting official curriculum mapping from Academic Dean.')
ON CONFLICT (id) DO UPDATE SET
  is_configured = EXCLUDED.is_configured,
  total_credits = EXCLUDED.total_credits,
  notes = EXCLUDED.notes;
