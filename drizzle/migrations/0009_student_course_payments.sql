-- ============================================================================
-- Migration: 0009_student_course_payments.sql
-- Description: Student Course Fees and Razorpay Payment Transactions Module
-- ============================================================================

-- 1. Student Course Fees Table
CREATE TABLE IF NOT EXISTS public.student_course_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_name text NOT NULL DEFAULT 'B.Tech Engineering & Technology',
  total_fee numeric(10, 2) NOT NULL DEFAULT 175000.00 CHECK (total_fee >= 0),
  currency text NOT NULL DEFAULT 'INR',
  due_date date DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_course_unique UNIQUE (student_id, course_name)
);

CREATE INDEX IF NOT EXISTS idx_student_course_fees_student ON public.student_course_fees(student_id);

-- 2. Payment Transactions Table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_id uuid NOT NULL REFERENCES public.student_course_fees(id) ON DELETE CASCADE,
  razorpay_order_id text NOT NULL,
  razorpay_payment_id text UNIQUE,
  razorpay_signature text,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  payment_method text DEFAULT 'online',
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'captured', 'failed', 'refunded', 'refund_pending')),
  payment_option text NOT NULL DEFAULT 'custom' CHECK (payment_option IN ('half', 'full', 'custom')),
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

-- 3. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_course_fees TO authenticated;
GRANT ALL ON public.student_course_fees TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.student_course_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: student_course_fees
-- Staff (admin, faculty, placement) can read all course fee records
CREATE POLICY "staff read student_course_fees" ON public.student_course_fees
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Staff can insert course fees
CREATE POLICY "staff insert student_course_fees" ON public.student_course_fees
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- Staff can update course fees
CREATE POLICY "staff update student_course_fees" ON public.student_course_fees
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()));

-- Admin can delete course fees
CREATE POLICY "admin delete student_course_fees" ON public.student_course_fees
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Students can read only their own course fee record
CREATE POLICY "students read own course_fees" ON public.student_course_fees
  FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    )
  );

-- 6. RLS Policies: payment_transactions
-- Staff can read all payment transactions
CREATE POLICY "staff read payment_transactions" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Staff can insert payment transactions
CREATE POLICY "staff insert payment_transactions" ON public.payment_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- Staff can update payment transactions
CREATE POLICY "staff update payment_transactions" ON public.payment_transactions
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()));

-- Students can read only their own payment transactions
CREATE POLICY "students read own payment_transactions" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    )
  );

-- Students can create payment transactions for themselves
CREATE POLICY "students insert own payment_transactions" ON public.payment_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    )
  );

-- 7. Seed Initial Course Fee Records for All Current Students
INSERT INTO public.student_course_fees (student_id, course_name, total_fee, due_date)
SELECT 
  s.id,
  CASE 
    WHEN s.department = 'Computer Science' THEN 'B.Tech Computer Science & Engineering'
    WHEN s.department = 'Information Tech' THEN 'B.Tech Information Technology'
    WHEN s.department = 'Electronics' THEN 'B.Tech Electronics & Comm Engineering'
    WHEN s.department = 'Mechanical' THEN 'B.Tech Mechanical Engineering'
    WHEN s.department = 'Civil' THEN 'B.Tech Civil Engineering'
    ELSE 'B.Tech Engineering & Technology'
  END AS course_name,
  175000.00 AS total_fee,
  (CURRENT_DATE + INTERVAL '25 days')::date
FROM public.students s
ON CONFLICT (student_id, course_name) DO NOTHING;
