-- ============================================================================
-- Migration: 0017_synchronise_authoritative_academics_cgpa.sql
-- Description: Authoritative Academics CGPA Synchronisation Layer.
--              Exposes calculated CGPA view based strictly on published
--              semester subject results using weighted formula:
--              CGPA = Σ(Grade Point × Credits) / Σ(Credits).
--              Provides idempotent reconciliation function and audit logging.
-- ============================================================================

-- 1. Create Authoritative Academics CGPA View
-- Joins published subject results with subject credit weightings.
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

-- 2. Audit Table for CGPA Synchronisation and Reconciliations
CREATE TABLE IF NOT EXISTS public.academics_cgpa_reconciliation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_type text NOT NULL DEFAULT 'SYSTEM_WIDE_RECONCILIATION',
  total_students_reviewed integer NOT NULL,
  students_with_valid_cgpa integer NOT NULL,
  students_updated_successfully integer NOT NULL,
  students_missing_academics integer NOT NULL,
  students_divergent integer NOT NULL DEFAULT 0,
  unmatched_identifiers integer NOT NULL DEFAULT 0,
  failed_updates integer NOT NULL DEFAULT 0,
  details jsonb,
  executed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Stored Procedure for Safe Idempotent CGPA Synchronisation
-- Updates public.students.cgpa from the authoritative Academics view.
-- Does not overwrite with zero when no academic results exist (leaves as NULL).
CREATE OR REPLACE FUNCTION public.sync_authoritative_academics_cgpa(target_roll_no text DEFAULT NULL)
RETURNS TABLE (
  total_reviewed integer,
  valid_cgpa_count integer,
  updated_count integer,
  missing_count integer
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reviewed integer := 0;
  v_valid integer := 0;
  v_updated integer := 0;
  v_missing integer := 0;
BEGIN
  -- 1. Synchronise public.students.cgpa from the authoritative calculation
  WITH calculated AS (
    SELECT
      v.student_roll_no,
      v.calculated_cgpa
    FROM public.view_student_authoritative_cgpa v
    WHERE (target_roll_no IS NULL OR v.student_roll_no = target_roll_no)
  )
  UPDATE public.students s
  SET cgpa = c.calculated_cgpa,
      updated_at = now()
  FROM calculated c
  WHERE s.roll_no = c.student_roll_no
    AND (s.cgpa IS DISTINCT FROM c.calculated_cgpa);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- 2. Compute summary counts
  SELECT COUNT(*) INTO v_reviewed
  FROM public.students
  WHERE (target_roll_no IS NULL OR roll_no = target_roll_no);

  SELECT COUNT(*) INTO v_valid
  FROM public.students
  WHERE cgpa IS NOT NULL
    AND (target_roll_no IS NULL OR roll_no = target_roll_no);

  v_missing := v_reviewed - v_valid;

  RETURN QUERY SELECT v_reviewed, v_valid, v_updated, v_missing;
END;
$$;

-- 4. Grant Permissions
GRANT SELECT ON public.view_student_authoritative_cgpa TO authenticated, service_role;
GRANT SELECT ON public.academics_cgpa_reconciliation_audit TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_authoritative_academics_cgpa(text) TO authenticated, service_role;
