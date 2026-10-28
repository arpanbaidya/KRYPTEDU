-- ============================================================================
-- Migration: 0014_attendance_three_month_demo_dataset.sql
-- Description: Complete 3-Month Demo Dataset (1 August 2026 to 31 October 2026)
--              - Monday through Friday (65 weekdays)
--              - Saturdays (14) and Sundays (13) strictly excluded as holidays
--              - 3 Canonical departments (Computer Engineering, AIML, Cyber Sec)
--              - 275 Official Students (17,875 records across 195 sessions)
--              - Realistic distribution (~85.4% Present, ~11% Absent, ~3.6% Not Considered)
--              - Synchronizes calculated attendance % to public.students table
--              - Idempotent and tagged with is_demo = true and is_sample = true
-- ============================================================================

-- 1. Ensure table columns and demo metadata flags exist
ALTER TABLE public.attendance_sessions 
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.attendance_records 
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_is_demo ON public.attendance_sessions (is_demo);
CREATE INDEX IF NOT EXISTS idx_attendance_records_is_demo ON public.attendance_records (is_demo);

-- 2. Populate 3-Month Weekday Demo Dataset (Aug 1 - Oct 31, 2026)
DO $$
DECLARE
  v_date date;
  v_dept text;
  v_session_id uuid;
  v_student record;
  v_num_part int;
  v_bias float;
  v_rand float;
  v_status text;
  v_idx int;
  v_seed int;
  v_depts text[] := ARRAY[
    'Computer Engineering',
    'Artificial Intelligence and Machine Learning',
    'Cyber security & Forensics'
  ];
BEGIN
  -- Loop across all days between 2026-08-01 and 2026-10-31
  FOR v_date IN 
    SELECT d::date 
    FROM generate_series('2026-08-01'::date, '2026-10-31'::date, '1 day'::interval) d
  LOOP
    -- Strictly exclude Saturdays (DOW = 6) and Sundays (DOW = 0)
    IF EXTRACT(DOW FROM v_date) NOT IN (0, 6) THEN
      
      FOREACH v_dept IN ARRAY v_depts LOOP
        -- Upsert Demo Session (idempotent)
        INSERT INTO public.attendance_sessions (
          department,
          attendance_date,
          status,
          is_sample,
          is_demo,
          notes,
          submitted_at
        ) VALUES (
          v_dept,
          v_date,
          'published',
          true,
          true,
          'DEMO DATA — 1 Aug to 31 Oct 2026 Weekday Session',
          (v_date || ' 12:00:00+00')::timestamptz
        )
        ON CONFLICT (department, attendance_date) 
        DO UPDATE SET 
          status = 'published',
          is_demo = true,
          is_sample = true,
          updated_at = now()
        RETURNING id INTO v_session_id;

        -- Populate student records for this department
        v_idx := 0;
        FOR v_student IN 
          SELECT id, roll_no 
          FROM public.students 
          WHERE department = v_dept
          ORDER BY roll_no
        LOOP
          v_idx := v_idx + 1;
          
          -- Extract numeric part of roll number for deterministic bias
          v_num_part := COALESCE(NULLIF(regexp_replace(v_student.roll_no, '\D', '', 'g'), '')::int, v_idx);
          v_bias := 0.88;
          
          -- Tail distributions for realistic risk evaluation
          IF v_num_part % 25 = 0 THEN
            v_bias := 0.52; -- Chronic absentee (<60% attendance)
          ELSIF v_num_part % 11 = 0 THEN
            v_bias := 0.72; -- Moderate absentee (60–75% attendance)
          END IF;

          -- Deterministic pseudo-random number based on roll_no and date
          v_seed := abs(hashtext(v_student.roll_no || '_' || v_date::text || '_demo_2026'));
          v_rand := (v_seed % 10000)::float / 10000.0;

          IF v_rand < v_bias THEN
            v_status := 'present';
          ELSIF v_rand < (v_bias + (1.0 - v_bias) * 0.75) THEN
            v_status := 'absent';
          ELSE
            v_status := 'not_considered';
          END IF;

          -- Upsert Attendance Record
          INSERT INTO public.attendance_records (
            session_id,
            student_id,
            status,
            is_sample,
            is_demo
          ) VALUES (
            v_session_id,
            v_student.id,
            v_status,
            true,
            true
          )
          ON CONFLICT (session_id, student_id)
          DO UPDATE SET 
            status = EXCLUDED.status,
            is_demo = true,
            is_sample = true,
            updated_at = now();
        END LOOP;
      END LOOP;
      
    END IF;
  END LOOP;

  -- 3. Synchronize calculated attendance percentage into public.students
  -- Formula: Present / (Present + Absent) * 100
  -- Excludes Not Considered, draft sessions, and weekends
  UPDATE public.students s
  SET attendance = agg.attendance_pct
  FROM (
    SELECT 
      r.student_id,
      ROUND(
        (COUNT(*) FILTER (WHERE r.status = 'present')::numeric / 
         NULLIF(COUNT(*) FILTER (WHERE r.status IN ('present', 'absent')), 0)::numeric) * 100, 
        1
      ) AS attendance_pct
    FROM public.attendance_records r
    JOIN public.attendance_sessions sess ON sess.id = r.session_id
    WHERE sess.status = 'published'
    GROUP BY r.student_id
  ) agg
  WHERE s.id = agg.student_id;

END $$;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
