-- Resolve canonical student rows and publish a marks batch atomically.
-- The function runs as the caller: table grants and RLS policies remain active.
CREATE OR REPLACE FUNCTION public.publish_academic_marks(p_results jsonb)
RETURNS TABLE (student_roll_no text, calculated_cgpa numeric)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_missing text[];
  v_ambiguous text[];
  v_duplicate_count integer;
  v_result_count integer;
  v_saved_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'faculty'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden (403): Only authorised faculty or administrators can publish official marks.'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_results) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Marks must be provided as a list.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_results) = 0 THEN
    RAISE EXCEPTION 'No marks were provided for publication.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_result_count FROM jsonb_array_elements(p_results);
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_results) AS item
    WHERE nullif(btrim(item->>'student_roll_no'), '') IS NULL
       OR nullif(btrim(item->>'subject_id'), '') IS NULL
       OR (item->>'semester_number') IS NULL
       OR (item->>'written_marks') IS NULL
       OR (item->>'internal_marks') IS NULL
       OR (item->>'written_marks')::numeric NOT BETWEEN 0 AND 50
       OR (item->>'internal_marks')::numeric NOT BETWEEN 0 AND 50
  ) THEN
    RAISE EXCEPTION 'Invalid marks or missing student, subject, or semester identifier.'
      USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(roll_label ORDER BY roll_label) INTO v_missing
  FROM (
    SELECT min(btrim(item->>'student_roll_no')) AS roll_label,
           upper(btrim(item->>'student_roll_no')) AS roll_key
    FROM jsonb_array_elements(p_results) AS item
    GROUP BY upper(btrim(item->>'student_roll_no'))
  ) requested
  WHERE NOT EXISTS (
    SELECT 1 FROM public.students s
    WHERE upper(btrim(s.roll_no)) = requested.roll_key
  );
  IF coalesce(cardinality(v_missing), 0) > 0 THEN
    RAISE EXCEPTION 'Student record not found: % missing; %', cardinality(v_missing),
      array_to_string(v_missing[1:10], ', ')
      USING ERRCODE = 'P0001', DETAIL = 'Only the first 10 missing roll numbers are listed.';
  END IF;

  SELECT array_agg(roll_key ORDER BY roll_key) INTO v_ambiguous
  FROM (
    SELECT upper(btrim(item->>'student_roll_no')) AS roll_key
    FROM jsonb_array_elements(p_results) AS item
    GROUP BY upper(btrim(item->>'student_roll_no'))
  ) requested
  JOIN public.students s ON upper(btrim(s.roll_no)) = requested.roll_key
  GROUP BY requested.roll_key
  HAVING count(*) > 1;
  IF coalesce(cardinality(v_ambiguous), 0) > 0 THEN
    RAISE EXCEPTION 'Ambiguous student records for normalized roll number(s): %',
      array_to_string(v_ambiguous[1:10], ', ')
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_duplicate_count
  FROM (
    SELECT upper(btrim(item->>'student_roll_no')), item->>'subject_id'
    FROM jsonb_array_elements(p_results) AS item
    GROUP BY upper(btrim(item->>'student_roll_no')), item->>'subject_id'
    HAVING count(*) > 1
  ) duplicates;
  IF v_duplicate_count > 0 THEN
    RAISE EXCEPTION 'Duplicate student and subject entries in publication batch.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.student_subject_results (
    student_id, student_roll_no, subject_id, semester_number,
    written_marks, internal_marks, total_marks, percentage,
    grade, grade_point, credits, publication_status, is_demo,
    published_at, last_updated_by, updated_at
  )
  SELECT s.id, s.roll_no, subject.id, (item->>'semester_number')::integer,
         (item->>'written_marks')::numeric, (item->>'internal_marks')::numeric,
         (item->>'total_marks')::numeric, (item->>'percentage')::numeric,
         item->>'grade', (item->>'grade_point')::numeric, subject.credits,
         'published', false, (item->>'published_at')::timestamptz,
         auth.uid(), (item->>'updated_at')::timestamptz
  FROM jsonb_array_elements(p_results) AS item
  JOIN public.students s
    ON upper(btrim(s.roll_no)) = upper(btrim(item->>'student_roll_no'))
  JOIN public.subjects subject
    ON subject.id = item->>'subject_id'
   AND subject.semester_number = (item->>'semester_number')::integer
  ON CONFLICT (student_roll_no, subject_id) DO UPDATE SET
    student_id = EXCLUDED.student_id,
    semester_number = EXCLUDED.semester_number,
    written_marks = EXCLUDED.written_marks,
    internal_marks = EXCLUDED.internal_marks,
    total_marks = EXCLUDED.total_marks,
    percentage = EXCLUDED.percentage,
    grade = EXCLUDED.grade,
    grade_point = EXCLUDED.grade_point,
    credits = EXCLUDED.credits,
    publication_status = 'published',
    is_demo = false,
    published_at = EXCLUDED.published_at,
    last_updated_by = EXCLUDED.last_updated_by,
    updated_at = EXCLUDED.updated_at;

  GET DIAGNOSTICS v_saved_count = ROW_COUNT;
  IF v_saved_count <> v_result_count THEN
    RAISE EXCEPTION 'Publication batch did not resolve to the expected student, subject, and semester records.'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1 FROM public.sync_authoritative_academics_cgpa();

  RETURN QUERY
  SELECT v.student_roll_no, v.calculated_cgpa
  FROM public.view_student_authoritative_cgpa v
  WHERE upper(btrim(v.student_roll_no)) IN (
    SELECT DISTINCT upper(btrim(item->>'student_roll_no'))
    FROM jsonb_array_elements(p_results) AS item
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_academic_marks(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_academic_marks(jsonb) TO authenticated;
