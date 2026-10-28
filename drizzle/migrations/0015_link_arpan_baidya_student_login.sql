-- Migration 0015: Link Arpan Baidya's Student Login to Official Student Record UST24R0102020
-- Fixes "Welcome, Aarav Patel" by disassociating legacy dummy student KR2024001
-- and linking Arpan Asto Baidya (UST24R0102020) from the official dataset.

-- 1. Ensure user_roles has 'student' role for Arpan Baidya / student login emails
UPDATE public.user_roles 
SET role = 'student'::public.app_role 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE lower(email) IN ('student@kryptedu.com', 'arpan@kryptedu.com', 'arpan.baidya@ustu.edu.in')
     OR lower(coalesce(raw_user_meta_data->>'email', '')) IN ('student@kryptedu.com', 'arpan@kryptedu.com', 'arpan.baidya@ustu.edu.in')
     OR lower(email) LIKE '%arpan%baidya%'
);

-- 2. Disassociate any legacy dummy records (e.g. KR2024001 Aarav Patel, KR1) from the student user_id
-- This prevents unique constraint violation on students_user_id_key and stops Aarav Patel from showing up
UPDATE public.students 
SET user_id = NULL 
WHERE roll_no LIKE 'KR%' OR name ILIKE '%aarav patel%';

-- 3. Link Arpan Baidya's official student record (Roll No: UST24R0102020) to auth.users
UPDATE public.students 
SET user_id = (
  SELECT id FROM auth.users 
  WHERE lower(email) IN ('student@kryptedu.com', 'arpan@kryptedu.com', 'arpan.baidya@ustu.edu.in')
     OR lower(coalesce(raw_user_meta_data->>'email', '')) IN ('student@kryptedu.com', 'arpan@kryptedu.com', 'arpan.baidya@ustu.edu.in')
     OR lower(email) LIKE '%arpan%baidya%'
  ORDER BY 
    CASE 
      WHEN lower(email) = 'arpan.baidya@ustu.edu.in' THEN 1
      WHEN lower(email) = 'arpan@kryptedu.com' THEN 2
      WHEN lower(email) = 'student@kryptedu.com' THEN 3
      ELSE 4
    END
  LIMIT 1
)
WHERE roll_no = 'UST24R0102020';

-- 4. Update setup_demo_accounts() RPC so it links Arpan Baidya instead of legacy KR1
CREATE OR REPLACE FUNCTION public.setup_demo_accounts()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Admin, Faculty, Placement demo mappings
  UPDATE public.user_roles SET role = 'admin' WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'admin@kryptedu.com');
  UPDATE public.user_roles SET role = 'faculty' WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'faculty@kryptedu.com');
  UPDATE public.user_roles SET role = 'placement' WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'placement@kryptedu.com');
  
  -- Disassociate legacy dummy records
  UPDATE public.students SET user_id = NULL WHERE roll_no LIKE 'KR%' OR name ILIKE '%aarav patel%';

  -- For student demo: map student login to Arpan Asto Baidya (UST24R0102020)
  UPDATE public.user_roles SET role = 'student' WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE lower(email) IN ('student@kryptedu.com', 'arpan@kryptedu.com', 'arpan.baidya@ustu.edu.in')
  );
  
  UPDATE public.students 
  SET user_id = (
    SELECT id FROM auth.users 
    WHERE lower(email) IN ('student@kryptedu.com', 'arpan@kryptedu.com', 'arpan.baidya@ustu.edu.in')
    ORDER BY CASE WHEN lower(email) = 'arpan.baidya@ustu.edu.in' THEN 1 ELSE 2 END
    LIMIT 1
  )
  WHERE roll_no = 'UST24R0102020';
END;
$$;
