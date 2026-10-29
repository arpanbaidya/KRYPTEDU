-- Persist the curriculum credit weight on each result row. The authoritative CGPA
-- view and sync function use this column to apply the existing weighted formula.
ALTER TABLE public.student_subject_results
  ADD COLUMN IF NOT EXISTS credits numeric(4, 2) NOT NULL DEFAULT 3.0;

UPDATE public.student_subject_results r
SET credits = s.credits
FROM public.subjects s
WHERE s.id = r.subject_id;
