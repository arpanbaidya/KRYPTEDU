-- ============================================================================
-- Migration: 0013_attendance_management_system.sql
-- Description: Department-Wise Live Attendance Management System,
--              Draft vs Published Workflow, Granular Role-Based Security,
--              and Historical Sample Data for Official Students Cohort.
-- ============================================================================

-- 1. Create Attendance Sessions Table
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  attendance_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_by uuid REFERENCES auth.users(id),
  submitted_by uuid REFERENCES auth.users(id),
  submitted_at timestamptz,
  is_sample boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_sessions_dept_date_unique UNIQUE (department, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_dept_date ON public.attendance_sessions(department, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_status ON public.attendance_sessions(status);

-- 2. Create Attendance Records Table
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'not_considered')),
  updated_by uuid REFERENCES auth.users(id),
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_records_session_student_unique UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON public.attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON public.attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON public.attendance_records(status);

-- 3. Grants
GRANT ALL ON public.attendance_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_sessions TO authenticated;
GRANT SELECT ON public.attendance_sessions TO anon;

GRANT ALL ON public.attendance_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT SELECT ON public.attendance_records TO anon;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- 5. Drop any prior policies
DROP POLICY IF EXISTS "faculty all attendance_sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "admin and placement read published attendance_sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "student read published attendance_sessions" ON public.attendance_sessions;

DROP POLICY IF EXISTS "faculty all attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "admin and placement read published attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "student read own published attendance_records" ON public.attendance_records;

-- 6. Create Strict Role-Based Policies

-- A. Policies for attendance_sessions:
-- Faculty has full access (create, read drafts & published, update, publish)
CREATE POLICY "faculty all attendance_sessions" ON public.attendance_sessions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'faculty')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'faculty')
  );

-- Admin and Placement can read ONLY published sessions
CREATE POLICY "admin and placement read published attendance_sessions" ON public.attendance_sessions
  FOR SELECT TO authenticated
  USING (
    status = 'published' AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin', 'placement'))
  );

-- Students can read ONLY published sessions
CREATE POLICY "student read published attendance_sessions" ON public.attendance_sessions
  FOR SELECT TO authenticated
  USING (
    status = 'published' AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'student')
  );

-- B. Policies for attendance_records:
-- Faculty has full control over records
CREATE POLICY "faculty all attendance_records" ON public.attendance_records
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'faculty')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'faculty')
  );

-- Admin and Placement can read records ONLY from published sessions
CREATE POLICY "admin and placement read published attendance_records" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin', 'placement')) AND
    session_id IN (SELECT id FROM public.attendance_sessions WHERE status = 'published')
  );

-- Students can read ONLY their own records from published sessions
CREATE POLICY "student read own published attendance_records" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()) AND
    session_id IN (SELECT id FROM public.attendance_sessions WHERE status = 'published')
  );

-- 7. Seed Sample Historical Attendance for Official Students
-- Generates published historical attendance for recent dates across the 3 canonical departments
DO $$
DECLARE
  dept_rec RECORD;
  sess_date date;
  cur_session_id uuid;
  stu_rec RECORD;
  stu_counter integer;
  assigned_status text;
  day_offset integer;
BEGIN
  -- Generate 5 past days of sample attendance
  FOR day_offset IN 1..5 LOOP
    sess_date := (CURRENT_DATE - (day_offset || ' days')::interval)::date;

    FOR dept_rec IN 
      SELECT unnest(ARRAY[
        'Computer Engineering',
        'Artificial Intelligence and Machine Learning',
        'Cyber security & Forensics'
      ]) AS dept_name
    LOOP
      -- Check if session already exists
      SELECT id INTO cur_session_id 
      FROM public.attendance_sessions 
      WHERE department = dept_rec.dept_name AND attendance_date = sess_date;

      IF cur_session_id IS NULL THEN
        INSERT INTO public.attendance_sessions (
          department,
          attendance_date,
          status,
          is_sample,
          notes,
          submitted_at
        ) VALUES (
          dept_rec.dept_name,
          sess_date,
          'published',
          true,
          'Sample Data — Universal College of Engineering Historical Session',
          now()
        ) RETURNING id INTO cur_session_id;

        -- Populate records for all students in this department
        stu_counter := 1;
        FOR stu_rec IN 
          SELECT id FROM public.students 
          WHERE department = dept_rec.dept_name 
          ORDER BY roll_no
        LOOP
          -- Realistic distribution: 85% Present, 10% Absent, 5% Not Considered
          IF (stu_counter + day_offset) % 19 = 0 THEN
            assigned_status := 'not_considered';
          ELSIF (stu_counter + day_offset) % 7 = 0 THEN
            assigned_status := 'absent';
          ELSE
            assigned_status := 'present';
          END IF;

          INSERT INTO public.attendance_records (
            session_id,
            student_id,
            status,
            is_sample
          ) VALUES (
            cur_session_id,
            stu_rec.id,
            assigned_status,
            true
          ) ON CONFLICT (session_id, student_id) DO NOTHING;

          stu_counter := stu_counter + 1;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 8. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
