-- ============================================================================
-- Migration: 0010_standardize_fees_and_audit_log.sql
-- Description: Standardize course fee to 175,000 for all students,
--              create administrative fee audit logging,
--              and enforce strict RBAC on payment tables.
-- ============================================================================

-- 1. Standardize default course fee to 175,000.00
ALTER TABLE public.student_course_fees 
  ALTER COLUMN total_fee SET DEFAULT 175000.00;

UPDATE public.student_course_fees 
  SET total_fee = 175000.00, updated_at = now();

-- 2. Create Fee Audit Logs Table
CREATE TABLE IF NOT EXISTS public.fee_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_id uuid NOT NULL REFERENCES public.student_course_fees(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id),
  old_fee numeric(10, 2) NOT NULL,
  new_fee numeric(10, 2) NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_audit_logs_student ON public.fee_audit_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_audit_logs_fee ON public.fee_audit_logs(fee_id);

GRANT SELECT, INSERT ON public.fee_audit_logs TO authenticated;
GRANT ALL ON public.fee_audit_logs TO service_role;

ALTER TABLE public.fee_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only Admins can view fee audit logs
CREATE POLICY "admin view fee_audit_logs" ON public.fee_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only Admins can insert fee audit logs
CREATE POLICY "admin insert fee_audit_logs" ON public.fee_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Enforce Strict RBAC on student_course_fees
-- Drop broad staff policies from 0009
DROP POLICY IF EXISTS "staff read student_course_fees" ON public.student_course_fees;
DROP POLICY IF EXISTS "staff insert student_course_fees" ON public.student_course_fees;
DROP POLICY IF EXISTS "staff update student_course_fees" ON public.student_course_fees;

-- New strict policies: Only Admin and Students (own record)
CREATE POLICY "admin read student_course_fees" ON public.student_course_fees
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin insert student_course_fees" ON public.student_course_fees
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin update student_course_fees" ON public.student_course_fees
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Enforce Strict RBAC on payment_transactions
-- Drop broad staff policies from 0009
DROP POLICY IF EXISTS "staff read payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "staff insert payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "staff update payment_transactions" ON public.payment_transactions;

-- New strict policies: Only Admin and Students (own transactions)
CREATE POLICY "admin read payment_transactions" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin insert payment_transactions" ON public.payment_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
