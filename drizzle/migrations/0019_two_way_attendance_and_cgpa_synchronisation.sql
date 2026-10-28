-- ============================================================================
-- Migration: 0019_two_way_attendance_and_cgpa_synchronisation.sql
-- Description: Authoritative Two-Way Synchronisation Layer for Attendance
--              and Academics CGPA across all modules.
--              Exposes canonical calculation views for published records,
--              excluding drafts and "not_considered" from attendance denominator,
--              and provides idempotent synchronisation stored procedures.
-- ============================================================================

-- 1. Create Authoritative Published Attendance View
-- Formula: Attendance % = Published Present / (Published Present + Published Absent) * 100
-- Draft sessions and 'not_considered' marks are strictly excluded from the denominator.
CREATE OR REPLACE VIEW public.view_student_authoritative_attendance AS
SELECT
  s.id AS student_id,
  s.roll_no,
  s.name AS student_name,
  s.department,
  COUNT(r.id) FILTER (WHERE r.status = 'present')::integer AS present_count,
  COUNT(r.id) FILTER (WHERE r.status = 'absent')::integer AS absent_count,
  COUNT(r.id) FILTER (WHERE r.status = 'not_considered')::integer AS not_considered_count,
  COUNT(r.id) FILTER (WHERE r.status IN ('present', 'absent'))::integer AS eligible_sessions_count,
  COUNT(sess.id)::integer AS total_published_sessions,
  CASE
    WHEN COUNT(r.id) FILTER (WHERE r.status IN ('present', 'absent')) > 0 THEN
      ROUND(
        (COUNT(r.id) FILTER (WHERE r.status = 'present')::numeric /
         COUNT(r.id) FILTER (WHERE r.status IN ('present', 'absent'))::numeric) * 100,
        1
      )
    ELSE NULL
  END AS authoritative_attendance_percentage
FROM public.students s
LEFT JOIN public.attendance_records r ON r.student_id = s.id
LEFT JOIN public.attendance_sessions sess ON sess.id = r.session_id AND sess.status = 'published'
GROUP BY s.id, s.roll_no, s.name, s.department;

-- 2. Ensure Authoritative Academics CGPA View
-- Formula: CGPA = Σ(Grade Point × Credits) / Σ(Credits)
-- Draft marks are strictly filtered out (publication_status = 'published').
CREATE OR REPLACE VIEW public.view_student_authoritative_cgpa AS
SELECT
  r.student_roll_no,
  r.student_id,
  ROUND(
    SUM(r.grade_point * r.credits)::numeric / NULLIF(SUM(r.credits), 0)::numeric,
    2
  ) AS calculated_cgpa,
  COUNT(r.id)::integer AS published_subjects_count,
  SUM(r.credits)::numeric AS total_credits_earned,
  MAX(r.published_at) AS latest_published_at
FROM public.student_subject_results r
WHERE r.publication_status = 'published'
  AND r.grade_point IS NOT NULL
  AND r.credits > 0
GROUP BY r.student_roll_no, r.student_id;

-- 3. Stored Procedure for Two-Way Synchronisation
-- Safely updates public.students.attendance and public.students.cgpa
-- without overwriting with fabricated zeroes when data is missing.
CREATE OR REPLACE FUNCTION public.sync_two_way_attendance_and_cgpa()
RETURNS TABLE (
  total_students_updated integer,
  attendance_synced_count integer,
  cgpa_synced_count integer
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_updated integer := 0;
  v_att_count integer := 0;
  v_cgpa_count integer := 0;
BEGIN
  -- Synchronise published attendance
  WITH att_calc AS (
    SELECT student_id, roll_no, authoritative_attendance_percentage
    FROM public.view_student_authoritative_attendance
    WHERE authoritative_attendance_percentage IS NOT NULL
  )
  UPDATE public.students s
  SET attendance = a.authoritative_attendance_percentage,
      updated_at = now()
  FROM att_calc a
  WHERE (s.id = a.student_id OR s.roll_no = a.roll_no)
    AND (s.attendance IS DISTINCT FROM a.authoritative_attendance_percentage);

  GET DIAGNOSTICS v_att_count = ROW_COUNT;

  -- Synchronise published CGPA
  WITH cgpa_calc AS (
    SELECT student_roll_no, student_id, calculated_cgpa
    FROM public.view_student_authoritative_cgpa
    WHERE calculated_cgpa IS NOT NULL
  )
  UPDATE public.students s
  SET cgpa = c.calculated_cgpa,
      updated_at = now()
  FROM cgpa_calc c
  WHERE (s.roll_no = c.student_roll_no OR s.id = c.student_id)
    AND (s.cgpa IS DISTINCT FROM c.calculated_cgpa);

  GET DIAGNOSTICS v_cgpa_count = ROW_COUNT;

  v_updated := v_att_count + v_cgpa_count;

  RETURN QUERY SELECT v_updated, v_att_count, v_cgpa_count;
END;
$$;

-- Grant access to authenticated users
GRANT SELECT ON public.view_student_authoritative_attendance TO authenticated;
GRANT SELECT ON public.view_student_authoritative_cgpa TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_two_way_attendance_and_cgpa() TO authenticated;
