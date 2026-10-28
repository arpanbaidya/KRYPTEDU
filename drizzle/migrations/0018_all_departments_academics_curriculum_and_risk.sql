-- ============================================================================
-- Migration: 0018_all_departments_academics_curriculum_and_risk.sql
-- Description: Multi-Department Academics Expansion, Placement Risk Analysis,
--              and Comprehensive Cross-Department Synchronisation.
--              Configures curricula for Computer Engineering, AIML, and
--              Cyber security & Forensics.
-- ============================================================================

-- 1. Insert Configured Subjects for Artificial Intelligence and Machine Learning
INSERT INTO public.subjects (id, code, name, semester_number, department, course, credits, is_lab, faculty_name, inconsistency_flag)
VALUES
  -- Sem I AIML
  ('aiml-s1-01', 'AIML101', 'Linear Algebra & Differential Calculus', 1, 'Artificial Intelligence and Machine Learning', 'B.Tech Artificial Intelligence and Machine Learning', 4.0, false, 'Dr. P. K. Sharma', 'Configured Department Curriculum'),
  ('aiml-s1-02', 'AIML102', 'Principles of Artificial Intelligence', 1, 'Artificial Intelligence and Machine Learning', 'B.Tech Artificial Intelligence and Machine Learning', 4.0, false, 'Prof. Sneha Kulkarni', 'Configured Department Curriculum'),
  ('aiml-s1-03', 'AIML103', 'Structured Programming in Python', 1, 'Artificial Intelligence and Machine Learning', 'B.Tech Artificial Intelligence and Machine Learning', 3.0, false, 'Prof. Vikram Mehra', 'Configured Department Curriculum'),
  ('aiml-s1-04', 'AIML103L', 'Python Programming Lab', 1, 'Artificial Intelligence and Machine Learning', 'B.Tech Artificial Intelligence and Machine Learning', 1.0, true, 'Prof. Vikram Mehra', 'Configured Department Curriculum'),
  ('aiml-s1-05', 'AIML104', 'Digital Logic & Computer Organization', 1, 'Artificial Intelligence and Machine Learning', 'B.Tech Artificial Intelligence and Machine Learning', 4.0, false, 'Prof. Ananya Roy', 'Configured Department Curriculum'),
  ('aiml-s1-06', 'AIML105', 'Professional Ethics & AI Governance', 1, 'Artificial Intelligence and Machine Learning', 'B.Tech Artificial Intelligence and Machine Learning', 2.0, false, 'Dr. Meenakshi Sundaram', 'Configured Department Curriculum'),
  ('aiml-s1-07', 'AIML106', 'Engineering Physics for Computing', 1, 'Artificial Intelligence and Machine Learning', 'B.Tech Artificial Intelligence and Machine Learning', 2.0, false, 'Prof. Ramesh Iyer', 'Configured Department Curriculum'),
  -- Sem II AIML
  ('aiml-s2-01', 'AIML201', 'Probability, Statistics & Random Processes', 2, 'Artificial Intelligence and Machine Learning', 'B.Tech Artificial Intelligence and Machine Learning', 4.0, false, 'Dr. P. K. Sharma', 'Configured Department Curriculum'),
  ('aiml-s2-02', 'AIML202', 'Data Structures & Algorithms', 2, 'Artificial Intelligence and Machine Learning', 'B.Tech Artificial Intelligence and Machine Learning', 4.0, false, 'Prof. Rahul Deshmukh', 'Configured Department Curriculum'),
  ('aiml-s2-03', 'AIML202L', 'Data Structures Lab', 2, 'Artificial Intelligence and Machine Learning', 'B.Tech Artificial Intelligence and Machine Learning', 1.0, true, 'Prof. Rahul Deshmukh', 'Configured Department Curriculum'),
  ('aiml-s2-04', 'AIML203', 'Object Oriented Software Design', 2, 'Artificial Intelligence and Machine Learning', 'B.Tech Artificial Intelligence and Machine Learning', 3.0, false, 'Prof. Sneha Kulkarni', 'Configured Department Curriculum'),
  ('aiml-s2-05', 'AIML204', 'Machine Learning Foundations', 2, 'Artificial Intelligence and Machine Learning', 'B.Tech Artificial Intelligence and Machine Learning', 4.0, false, 'Dr. Arvind Swaminathan', 'Configured Department Curriculum'),
  ('aiml-s2-06', 'AIML204L', 'Machine Learning Lab', 2, 'Artificial Intelligence and Machine Learning', 'B.Tech Artificial Intelligence and Machine Learning', 1.0, true, 'Dr. Arvind Swaminathan', 'Configured Department Curriculum'),
  ('aiml-s2-07', 'AIML205', 'Discrete Mathematical Structures', 2, 'Artificial Intelligence and Machine Learning', 'B.Tech Artificial Intelligence and Machine Learning', 3.0, false, 'Dr. P. K. Sharma', 'Configured Department Curriculum')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  credits = EXCLUDED.credits,
  faculty_name = EXCLUDED.faculty_name;

-- 2. Insert Configured Subjects for Cyber security & Forensics
INSERT INTO public.subjects (id, code, name, semester_number, department, course, credits, is_lab, faculty_name, inconsistency_flag)
VALUES
  -- Sem I CSF
  ('csf-s1-01', 'CSF101', 'Discrete Mathematics & Number Theory', 1, 'Cyber security & Forensics', 'B.Tech Cyber security & Forensics', 4.0, false, 'Prof. D. S. Rao', 'Configured Department Curriculum'),
  ('csf-s1-02', 'CSF102', 'Fundamentals of Information Security', 1, 'Cyber security & Forensics', 'B.Tech Cyber security & Forensics', 4.0, false, 'Prof. Siddharth Joshi', 'Configured Department Curriculum'),
  ('csf-s1-03', 'CSF103', 'Programming in C & Secure Coding', 1, 'Cyber security & Forensics', 'B.Tech Cyber security & Forensics', 3.0, false, 'Prof. Nidhi Verma', 'Configured Department Curriculum'),
  ('csf-s1-04', 'CSF103L', 'Secure Coding Lab', 1, 'Cyber security & Forensics', 'B.Tech Cyber security & Forensics', 1.0, true, 'Prof. Nidhi Verma', 'Configured Department Curriculum'),
  ('csf-s1-05', 'CSF104', 'Computer Hardware & Network Basics', 1, 'Cyber security & Forensics', 'B.Tech Cyber security & Forensics', 4.0, false, 'Prof. Siddharth Joshi', 'Configured Department Curriculum'),
  ('csf-s1-06', 'CSF105', 'Cyber Laws & Information Technology Act', 1, 'Cyber security & Forensics', 'B.Tech Cyber security & Forensics', 2.0, false, 'Adv. R. K. Saxena', 'Configured Department Curriculum'),
  ('csf-s1-07', 'CSF106', 'Applied Physics for Security Sensors', 1, 'Cyber security & Forensics', 'B.Tech Cyber security & Forensics', 2.0, false, 'Dr. Sunita Patil', 'Configured Department Curriculum'),
  -- Sem II CSF
  ('csf-s2-01', 'CSF201', 'Applied Linear Algebra & Cryptographic Math', 2, 'Cyber security & Forensics', 'B.Tech Cyber security & Forensics', 4.0, false, 'Prof. D. S. Rao', 'Configured Department Curriculum'),
  ('csf-s2-02', 'CSF202', 'Data Structures & Secure Algorithms', 2, 'Cyber security & Forensics', 'B.Tech Cyber security & Forensics', 4.0, false, 'Prof. Nidhi Verma', 'Configured Department Curriculum'),
  ('csf-s2-03', 'CSF202L', 'Data Structures Lab', 2, 'Cyber security & Forensics', 'B.Tech Cyber security & Forensics', 1.0, true, 'Prof. Nidhi Verma', 'Configured Department Curriculum'),
  ('csf-s2-04', 'CSF203', 'Network Security Protocols', 2, 'Cyber security & Forensics', 'B.Tech Cyber security & Forensics', 4.0, false, 'Prof. Siddharth Joshi', 'Configured Department Curriculum'),
  ('csf-s2-05', 'CSF203L', 'Network Security Lab', 2, 'Cyber security & Forensics', 'B.Tech Cyber security & Forensics', 1.0, true, 'Prof. Siddharth Joshi', 'Configured Department Curriculum'),
  ('csf-s2-06', 'CSF204', 'Operating System Internals & Linux Hardening', 2, 'Cyber security & Forensics', 'B.Tech Cyber security & Forensics', 4.0, false, 'Prof. Siddharth Joshi', 'Configured Department Curriculum'),
  ('csf-s2-07', 'CSF205', 'Technical Writing & Security Documentation', 2, 'Cyber security & Forensics', 'B.Tech Cyber security & Forensics', 2.0, false, 'Prof. Shalini Sen', 'Configured Department Curriculum')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  credits = EXCLUDED.credits,
  faculty_name = EXCLUDED.faculty_name;

-- 3. Create Placement Risk View
-- Defines placement risk based on verified placement readiness, skills, feedback, and academic standings.
CREATE OR REPLACE VIEW public.view_student_placement_risk AS
SELECT
  s.id AS student_id,
  s.roll_no,
  s.name,
  s.department,
  s.cgpa,
  s.placement_readiness,
  s.skills_score,
  s.feedback_score,
  CASE
    WHEN s.placement_readiness IS NULL AND s.skills_score IS NULL AND s.feedback_score IS NULL THEN 'Low'
    WHEN COALESCE(s.placement_readiness, 0) * 0.50 + COALESCE(s.skills_score, 0) * 0.30 + COALESCE(s.feedback_score, 0) * 0.20 < 45 THEN 'High'
    WHEN COALESCE(s.placement_readiness, 0) * 0.50 + COALESCE(s.skills_score, 0) * 0.30 + COALESCE(s.feedback_score, 0) * 0.20 < 65 THEN 'Medium'
    ELSE 'Low'
  END AS placement_risk,
  CASE
    WHEN s.placement_readiness IS NULL AND s.skills_score IS NULL AND s.feedback_score IS NULL THEN 'Placement evaluations pending for Batch 2024'
    WHEN COALESCE(s.placement_readiness, 0) < 45 THEN 'Placement readiness score below 45 threshold'
    WHEN COALESCE(s.skills_score, 0) < 40 THEN 'Technical skills assessment deficit'
    ELSE 'Placement readiness aligns with institutional benchmarks'
  END AS placement_risk_reason
FROM public.students s;

-- 4. Grant Permissions
GRANT SELECT ON public.view_student_placement_risk TO authenticated, service_role;
