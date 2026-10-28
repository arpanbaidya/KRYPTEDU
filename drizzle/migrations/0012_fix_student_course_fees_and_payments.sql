-- ============================================================================
-- Migration: 0012_fix_student_course_fees_and_payments.sql
-- Description: Self-contained, robust setup for Student Course Fees,
--              Razorpay Payment Transactions, Fee Audit Trail, and RLS.
--              Includes schema cache refresh.
-- ============================================================================

-- 1. Ensure 'student' is an allowed enum value in app_role if app_role exists
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'student';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 2. Create Student Course Fees Table
CREATE TABLE IF NOT EXISTS public.student_course_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_name text NOT NULL DEFAULT 'B.Tech Engineering & Technology',
  total_fee numeric(10, 2) NOT NULL DEFAULT 175000.00 CHECK (total_fee >= 0),
  currency text NOT NULL DEFAULT 'INR',
  due_date date DEFAULT (CURRENT_DATE + INTERVAL '30 days')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_course_unique UNIQUE (student_id, course_name)
);

CREATE INDEX IF NOT EXISTS idx_student_course_fees_student ON public.student_course_fees(student_id);

-- 3. Create Payment Transactions Table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_id uuid REFERENCES public.student_course_fees(id) ON DELETE CASCADE,
  razorpay_order_id text NOT NULL,
  razorpay_payment_id text UNIQUE,
  razorpay_signature text,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  payment_method text DEFAULT 'Razorpay',
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'captured', 'failed', 'refunded', 'refund_pending')),
  payment_option text NOT NULL DEFAULT 'half' CHECK (payment_option IN ('half', 'full', 'custom')),
  receipt_number text UNIQUE,
  notes text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_student ON public.payment_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_fee ON public.payment_transactions(fee_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_tx_order ON public.payment_transactions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_payment ON public.payment_transactions(razorpay_payment_id);

-- 4. Create Fee Audit Logs Table
CREATE TABLE IF NOT EXISTS public.fee_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_id uuid REFERENCES public.student_course_fees(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id),
  old_fee numeric(10, 2) NOT NULL,
  new_fee numeric(10, 2) NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_audit_logs_student ON public.fee_audit_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_audit_logs_fee ON public.fee_audit_logs(fee_id);

-- 5. Grant Permissions to authenticated and service_role
GRANT ALL ON public.student_course_fees TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_course_fees TO authenticated;
GRANT SELECT ON public.student_course_fees TO anon;

GRANT ALL ON public.payment_transactions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.payment_transactions TO authenticated;
GRANT SELECT ON public.payment_transactions TO anon;

GRANT ALL ON public.fee_audit_logs TO service_role;
GRANT SELECT, INSERT ON public.fee_audit_logs TO authenticated;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.student_course_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. Drop older conflicting policies if any exist
DROP POLICY IF EXISTS "staff read student_course_fees" ON public.student_course_fees;
DROP POLICY IF EXISTS "staff insert student_course_fees" ON public.student_course_fees;
DROP POLICY IF EXISTS "staff update student_course_fees" ON public.student_course_fees;
DROP POLICY IF EXISTS "admin read student_course_fees" ON public.student_course_fees;
DROP POLICY IF EXISTS "admin insert student_course_fees" ON public.student_course_fees;
DROP POLICY IF EXISTS "admin update student_course_fees" ON public.student_course_fees;
DROP POLICY IF EXISTS "admin delete student_course_fees" ON public.student_course_fees;
DROP POLICY IF EXISTS "students read own course_fees" ON public.student_course_fees;
DROP POLICY IF EXISTS "students insert own course_fees" ON public.student_course_fees;
DROP POLICY IF EXISTS "admin all student_course_fees" ON public.student_course_fees;
DROP POLICY IF EXISTS "student read own student_course_fees" ON public.student_course_fees;
DROP POLICY IF EXISTS "student insert own student_course_fees" ON public.student_course_fees;

DROP POLICY IF EXISTS "staff read payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "staff insert payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "staff update payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "admin read payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "admin insert payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "admin all payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "students read own payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "students insert own payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "students update own payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "student read own payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "student insert own payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "student update own payment_transactions" ON public.payment_transactions;

DROP POLICY IF EXISTS "admin view fee_audit_logs" ON public.fee_audit_logs;
DROP POLICY IF EXISTS "admin insert fee_audit_logs" ON public.fee_audit_logs;

-- 8. Create Secure, Resilient RLS Policies

-- A. Policies for student_course_fees:
-- Admin full access
CREATE POLICY "admin all student_course_fees" ON public.student_course_fees
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  );

-- Enrolled students can read only their own course fee record
CREATE POLICY "student read own student_course_fees" ON public.student_course_fees
  FOR SELECT TO authenticated
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

-- Enrolled students can initialize their own standard course fee if missing
CREATE POLICY "student insert own student_course_fees" ON public.student_course_fees
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

-- B. Policies for payment_transactions:
-- Admin full access
CREATE POLICY "admin all payment_transactions" ON public.payment_transactions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  );

-- Students can read only their own transactions
CREATE POLICY "student read own payment_transactions" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

-- Students can create transactions for their own fee payments
CREATE POLICY "student insert own payment_transactions" ON public.payment_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

-- Students can update transactions for their own payments (e.g. razorpay signature/payment_id)
CREATE POLICY "student update own payment_transactions" ON public.payment_transactions
  FOR UPDATE TO authenticated
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

-- C. Policies for fee_audit_logs:
CREATE POLICY "admin all fee_audit_logs" ON public.fee_audit_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  );

-- 9. Seed Standardized Course Fees (₹1,75,000.00) for all existing students
INSERT INTO public.student_course_fees (student_id, course_name, total_fee, due_date)
SELECT 
  s.id,
  'B.Tech ' || COALESCE(s.department, 'Engineering'),
  175000.00,
  (CURRENT_DATE + INTERVAL '30 days')::date
FROM public.students s
ON CONFLICT (student_id, course_name) DO UPDATE 
  SET total_fee = 175000.00, updated_at = now();

-- 10. Force PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';
