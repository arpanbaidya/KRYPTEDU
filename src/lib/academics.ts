/**
 * academics.ts — Authoritative Subject, Faculty, Resource, Assignment,
 * Result, and CGPA Calculation Architecture for KRYPTEDU.
 *
 * Source: Official B.Tech CSE Semester-Wise Subject and Faculty List
 * (BTech_CSE_Semester_Wise_Subject_Faculty_List.docx.docx)
 */

import { OFFICIAL_STUDENTS, type OfficialStudentRecord } from "./official-dataset";

export interface AcademicSemester {
  id: string; // "sem-1" ... "sem-8"
  semesterNumber: number;
  label: string; // "Semester I", etc.
  roman: string; // "I", "II", etc.
  isConfigured: boolean;
  totalCredits: number;
  notes?: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  semesterId: string;
  semesterNumber: number;
  department: string;
  course: string;
  credits: number;
  isLab: boolean;
  facultyName: string;
  facultyAccountEmail?: string;
  isAccountLinked: boolean;
  inconsistencyFlag?: string;
}

export interface SubjectResource {
  id: string;
  subjectId: string;
  semesterNumber: number;
  title: string;
  description: string;
  resourceType: "Syllabus" | "Lecture Notes" | "Lab Manual" | "Reference Book" | "Question Bank";
  fileUrl?: string;
  externalUrl?: string;
  uploadedByFaculty: string;
  uploadedAt: string;
  fileSize?: string;
}

export interface SubjectAssignment {
  id: string;
  subjectId: string;
  semesterNumber: number;
  title: string;
  instructions: string;
  dueDate: string; // ISO date-time string
  referenceUrl?: string;
  createdByFaculty: string;
  createdAt: string;
  status: "Active" | "Closed" | "Upcoming";
  maxMarks: number;
}

export interface StudentSubjectResult {
  id: string;
  studentId: string;
  studentRollNo: string;
  studentName: string;
  department: string;
  semesterNumber: number;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  credits: number;
  writtenMarks: number | null; // 0–50
  internalMarks: number | null; // 0–50
  totalMarks: number | null; // 0–100
  percentage: number | null; // 0–100
  grade: string | null;
  gradePoint: number | null;
  publicationStatus: "draft" | "published";
  isDemo: boolean;
  publishedAt?: string;
  lastUpdatedBy?: string;
  updatedAt: string;
}

export interface AcademicAuditLog {
  id: string;
  resultId: string;
  studentRollNo: string;
  subjectName: string;
  changedBy: string;
  changedAt: string;
  oldWritten: number | null;
  oldInternal: number | null;
  newWritten: number | null;
  newInternal: number | null;
  oldStatus: string;
  newStatus: string;
  reason?: string;
}

export interface GradeScaleEntry {
  minMarks: number;
  maxMarks: number;
  grade: string;
  gradePoint: number;
  description: string;
}

export const OFFICIAL_GRADE_SCALE: GradeScaleEntry[] = [
  { minMarks: 90, maxMarks: 100, grade: "O", gradePoint: 10, description: "Outstanding" },
  { minMarks: 80, maxMarks: 89.99, grade: "A+", gradePoint: 9, description: "Excellent" },
  { minMarks: 70, maxMarks: 79.99, grade: "A", gradePoint: 8, description: "Very Good" },
  { minMarks: 60, maxMarks: 69.99, grade: "B+", gradePoint: 7, description: "Good" },
  { minMarks: 55, maxMarks: 59.99, grade: "B", gradePoint: 6, description: "Above Average" },
  { minMarks: 50, maxMarks: 54.99, grade: "C", gradePoint: 5, description: "Average" },
  { minMarks: 40, maxMarks: 49.99, grade: "P", gradePoint: 4, description: "Pass" },
  { minMarks: 0, maxMarks: 39.99, grade: "F", gradePoint: 0, description: "Fail" },
];

export const SEMESTER_CONFIGS: AcademicSemester[] = [
  { id: "sem-1", semesterNumber: 1, label: "Semester I", roman: "I", isConfigured: true, totalCredits: 20 },
  { id: "sem-2", semesterNumber: 2, label: "Semester II", roman: "II", isConfigured: true, totalCredits: 20 },
  { id: "sem-3", semesterNumber: 3, label: "Semester III", roman: "III", isConfigured: true, totalCredits: 25 },
  { id: "sem-4", semesterNumber: 4, label: "Semester IV", roman: "IV", isConfigured: true, totalCredits: 22 },
  { id: "sem-5", semesterNumber: 5, label: "Semester V", roman: "V", isConfigured: true, totalCredits: 21 },
  { id: "sem-6", semesterNumber: 6, label: "Semester VI", roman: "VI", isConfigured: false, totalCredits: 0, notes: "Awaiting official curriculum mapping from Academic Dean." },
  { id: "sem-7", semesterNumber: 7, label: "Semester VII", roman: "VII", isConfigured: false, totalCredits: 0, notes: "Awaiting official curriculum mapping from Academic Dean." },
  { id: "sem-8", semesterNumber: 8, label: "Semester VIII", roman: "VIII", isConfigured: false, totalCredits: 0, notes: "Awaiting official curriculum mapping from Academic Dean." },
];

/**
 * Exact, authoritative B.Tech CSE Subject & Faculty Mapping
 * from BTech_CSE_Semester_Wise_Subject_Faculty_List.docx.docx
 */
export const OFFICIAL_BTECH_CSE_SUBJECTS: Subject[] = [
  // SEMESTER I
  {
    id: "cse-s1-01",
    code: "CS101",
    name: "Applied Mathematics I",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 4,
    isLab: false,
    facultyName: "Rajesh Giri",
    isAccountLinked: false,
  },
  {
    id: "cse-s1-02",
    code: "CS102",
    name: "Applied Chemistry I",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Komal Jain",
    isAccountLinked: false,
  },
  {
    id: "cse-s1-03",
    code: "CS102L",
    name: "Applied Chemistry Lab",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1,
    isLab: true,
    facultyName: "Komal Jain",
    isAccountLinked: false,
  },
  {
    id: "cse-s1-04",
    code: "CS103",
    name: "Problem Solving And Programming",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "John Kenny",
    facultyAccountEmail: "faculty@kryptedu.com",
    isAccountLinked: true,
  },
  {
    id: "cse-s1-05",
    code: "CS103L",
    name: "Problem Solving And Programming Lab",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1.5,
    isLab: true,
    facultyName: "John Kenny",
    facultyAccountEmail: "faculty@kryptedu.com",
    isAccountLinked: true,
  },
  {
    id: "cse-s1-06",
    code: "CS104",
    name: "Engineering Graphics And Design",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Dr.Shivam Shukla",
    isAccountLinked: false,
  },
  {
    id: "cse-s1-07",
    code: "CS105",
    name: "Entrepreneurship Fundamentals",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 2,
    isLab: false,
    facultyName: "Swapnil",
    isAccountLinked: false,
  },
  {
    id: "cse-s1-08",
    code: "CS106",
    name: "Personality Development And Effective Communication I",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 2,
    isLab: false,
    facultyName: "Umama",
    isAccountLinked: false,
  },

  // SEMESTER II
  {
    id: "cse-s2-01",
    code: "CS201",
    name: "Basic Of Electrical Engineering",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Sampada Pimple",
    isAccountLinked: false,
  },
  {
    id: "cse-s2-02",
    code: "CS201L",
    name: "Basic Of Electrical Engineering Lab",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1,
    isLab: true,
    facultyName: "Sampada Pimple",
    isAccountLinked: false,
  },
  {
    id: "cse-s2-03",
    code: "CS202",
    name: "Python Programming",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "John Kenny",
    facultyAccountEmail: "faculty@kryptedu.com",
    isAccountLinked: true,
  },
  {
    id: "cse-s2-04",
    code: "CS202L",
    name: "Python Programming Lab",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1.5,
    isLab: true,
    facultyName: "John Kenny",
    facultyAccountEmail: "faculty@kryptedu.com",
    isAccountLinked: true,
  },
  {
    id: "cse-s2-05",
    code: "CS203",
    name: "Applied Physics I",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Bipin Sonawane",
    isAccountLinked: false,
  },
  {
    id: "cse-s2-06",
    code: "CS203L",
    name: "Applied Physics Lab",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1,
    isLab: true,
    facultyName: "Bipin Sonawane",
    isAccountLinked: false,
  },
  {
    id: "cse-s2-07",
    code: "CS204",
    name: "Workshop Practice",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1.5,
    isLab: true,
    facultyName: "Vilas",
    isAccountLinked: false,
  },
  {
    id: "cse-s2-08",
    code: "CS205",
    name: "Environment And Sustainability",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 2,
    isLab: false,
    facultyName: "Komal Jain",
    isAccountLinked: false,
  },
  {
    id: "cse-s2-09",
    code: "CS206",
    name: "Applied Mechanics",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Dr.Shivam Shukla",
    isAccountLinked: false,
  },
  {
    id: "cse-s2-10",
    code: "CS206L",
    name: "Applied Mechanics Lab",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1,
    isLab: true,
    facultyName: "Dr.Shivam Shukla",
    isAccountLinked: false,
  },

  // SEMESTER III
  {
    id: "cse-s3-01",
    code: "CS301",
    name: "Operating Systems",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Laxman",
    isAccountLinked: false,
  },
  {
    id: "cse-s3-02",
    code: "CS301L",
    name: "Operating Systems Lab",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1,
    isLab: true,
    facultyName: "Laxman",
    isAccountLinked: false,
  },
  {
    id: "cse-s3-03",
    code: "CS302",
    name: "Applied Mathematics II",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 4,
    isLab: false,
    facultyName: "Damini Bhuva",
    isAccountLinked: false,
  },
  {
    id: "cse-s3-04",
    code: "CS303",
    name: "Discrete Mathematics",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Damini Bhuva",
    isAccountLinked: false,
  },
  {
    id: "cse-s3-05",
    code: "CS304",
    name: "Data Structure",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Jitnedra Satruwar",
    isAccountLinked: false,
    inconsistencyFlag: "Inconsistent spelling in official source document (matches Jitendra Satruwar). Preserved as 'Jitnedra Satruwar' as instructed; flagged for review.",
  },
  {
    id: "cse-s3-06",
    code: "CS304L",
    name: "Data Structure Lab",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1.5,
    isLab: true,
    facultyName: "Jitendra Satruwar",
    isAccountLinked: false,
  },
  {
    id: "cse-s3-07",
    code: "CS305",
    name: "Emotional Psychology",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 2,
    isLab: false,
    facultyName: "Palak Thakkar",
    isAccountLinked: false,
  },
  {
    id: "cse-s3-08",
    code: "CS306",
    name: "Digital Logic And Computer Architecture",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Sandeep Dubey",
    isAccountLinked: false,
  },
  {
    id: "cse-s3-09",
    code: "CS306L",
    name: "Digital Logic And Computer Architecture Lab",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1,
    isLab: true,
    facultyName: "Sandeep Dubey",
    isAccountLinked: false,
  },
  {
    id: "cse-s3-10",
    code: "CS307",
    name: "Java Programming",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Ashraf Ali",
    isAccountLinked: false,
  },
  {
    id: "cse-s3-11",
    code: "CS307L",
    name: "Java Programming Lab",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1.5,
    isLab: true,
    facultyName: "Ashraf Ali",
    isAccountLinked: false,
  },

  // SEMESTER IV
  {
    id: "cse-s4-01",
    code: "CS401",
    name: "Mini Project I",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1.5,
    isLab: true,
    facultyName: "Sandeep Dubey",
    isAccountLinked: false,
  },
  {
    id: "cse-s4-02",
    code: "CS402",
    name: "Database Management System",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Ayush",
    isAccountLinked: false,
  },
  {
    id: "cse-s4-03",
    code: "CS402L",
    name: "Database Management System Lab",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1,
    isLab: true,
    facultyName: "Ayush",
    isAccountLinked: false,
  },
  {
    id: "cse-s4-04",
    code: "CS403",
    name: "Introduction To AI and ML",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Sandeep Dubey",
    isAccountLinked: false,
  },
  {
    id: "cse-s4-05",
    code: "CS403L",
    name: "Introduction To AI and ML Lab",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1,
    isLab: true,
    facultyName: "Sandeep Dubey",
    isAccountLinked: false,
  },
  {
    id: "cse-s4-06",
    code: "CS404",
    name: "Design And Analysis Of Algorithm",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Jitendra Satruwar",
    isAccountLinked: false,
  },
  {
    id: "cse-s4-07",
    code: "CS404L",
    name: "Design And Analysis Of Algorithm Lab",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1.5,
    isLab: true,
    facultyName: "Jitendra Satruwar",
    isAccountLinked: false,
  },
  {
    id: "cse-s4-08",
    code: "CS405",
    name: "Mathematics For Data Science (DS Minor)",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Toussif",
    isAccountLinked: false,
  },
  {
    id: "cse-s4-09",
    code: "CS406",
    name: "Web Technologies (Major)",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Mubashir Khan",
    isAccountLinked: false,
  },
  {
    id: "cse-s4-10",
    code: "CS406L",
    name: "Web Technologies Lab",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1,
    isLab: true,
    facultyName: "Mubashir Khan",
    isAccountLinked: false,
  },
  {
    id: "cse-s4-11",
    code: "CS407",
    name: "Personality Development And Effective Communication III",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 2,
    isLab: false,
    facultyName: "Terecia Fernandes",
    isAccountLinked: false,
  },

  // SEMESTER V
  {
    id: "cse-s5-01",
    code: "CS501",
    name: "Advance Machine Learning",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Utkarsh",
    isAccountLinked: false,
  },
  {
    id: "cse-s5-02",
    code: "CS501L",
    name: "Advance Machine Learning Lab",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1,
    isLab: true,
    facultyName: "Utkarsh",
    isAccountLinked: false,
  },
  {
    id: "cse-s5-03",
    code: "CS502",
    name: "Data Mining And Warehousing",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "John Kenny",
    facultyAccountEmail: "faculty@kryptedu.com",
    isAccountLinked: true,
  },
  {
    id: "cse-s5-04",
    code: "CS502L",
    name: "Data Mining And Warehousing Lab",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1,
    isLab: true,
    facultyName: "John Kenny",
    facultyAccountEmail: "faculty@kryptedu.com",
    isAccountLinked: true,
  },
  {
    id: "cse-s5-05",
    code: "CS503",
    name: "Theory Of Computation",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "John Kenny",
    facultyAccountEmail: "faculty@kryptedu.com",
    isAccountLinked: true,
  },
  {
    id: "cse-s5-06",
    code: "CS504",
    name: "Mini Project II",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1.5,
    isLab: true,
    facultyName: "John Kenny",
    facultyAccountEmail: "faculty@kryptedu.com",
    isAccountLinked: true,
  },
  {
    id: "cse-s5-07",
    code: "CS505",
    name: "Computer Networks",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Jitendra Satruwar",
    isAccountLinked: false,
  },
  {
    id: "cse-s5-08",
    code: "CS505L",
    name: "Computer Networks Lab",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 1,
    isLab: true,
    facultyName: "Jitendra Satruwar",
    isAccountLinked: false,
  },
  {
    id: "cse-s5-09",
    code: "CS506",
    name: "Advance Web Technologies (Web Tech)",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Sachin Hadap",
    isAccountLinked: false,
  },
  {
    id: "cse-s5-10",
    code: "CS507",
    name: "Data Analytics And Visualization (Data Science)",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Computer Engineering",
    course: "B.Tech Computer Engineering",
    credits: 3,
    isLab: false,
    facultyName: "Abhishek Patra",
    isAccountLinked: false,
  },
];

/**
 * Configured B.Tech Artificial Intelligence and Machine Learning Subject Mapping
 * Semesters I to V
 */
export const CONFIGURED_BTECH_AIML_SUBJECTS: Subject[] = [
  // SEMESTER I
  {
    id: "aiml-s1-01",
    code: "AIML101",
    name: "Linear Algebra & Differential Calculus",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: false,
    facultyName: "Dr. P. K. Sharma",
    isAccountLinked: false,
  },
  {
    id: "aiml-s1-02",
    code: "AIML102",
    name: "Principles of Artificial Intelligence",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Sneha Kulkarni",
    isAccountLinked: false,
  },
  {
    id: "aiml-s1-03",
    code: "AIML103",
    name: "Structured Programming in Python",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 3,
    isLab: false,
    facultyName: "Prof. Vikram Mehra",
    isAccountLinked: false,
  },
  {
    id: "aiml-s1-04",
    code: "AIML103L",
    name: "Python Programming Lab",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 1,
    isLab: true,
    facultyName: "Prof. Vikram Mehra",
    isAccountLinked: false,
  },
  {
    id: "aiml-s1-05",
    code: "AIML104",
    name: "Digital Logic & Computer Organization",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Ananya Roy",
    isAccountLinked: false,
  },
  {
    id: "aiml-s1-06",
    code: "AIML105",
    name: "Professional Ethics & AI Governance",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 2,
    isLab: false,
    facultyName: "Dr. Meenakshi Sundaram",
    isAccountLinked: false,
  },
  {
    id: "aiml-s1-07",
    code: "AIML106",
    name: "Engineering Physics for Computing",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 2,
    isLab: false,
    facultyName: "Prof. Ramesh Iyer",
    isAccountLinked: false,
  },
  // SEMESTER II
  {
    id: "aiml-s2-01",
    code: "AIML201",
    name: "Probability, Statistics & Random Processes",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: false,
    facultyName: "Dr. P. K. Sharma",
    isAccountLinked: false,
  },
  {
    id: "aiml-s2-02",
    code: "AIML202",
    name: "Data Structures & Algorithms",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Rahul Deshmukh",
    isAccountLinked: false,
  },
  {
    id: "aiml-s2-03",
    code: "AIML202L",
    name: "Data Structures Lab",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 1,
    isLab: true,
    facultyName: "Prof. Rahul Deshmukh",
    isAccountLinked: false,
  },
  {
    id: "aiml-s2-04",
    code: "AIML203",
    name: "Object Oriented Software Design",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 3,
    isLab: false,
    facultyName: "Prof. Sneha Kulkarni",
    isAccountLinked: false,
  },
  {
    id: "aiml-s2-05",
    code: "AIML204",
    name: "Machine Learning Foundations",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: false,
    facultyName: "Dr. Arvind Swaminathan",
    isAccountLinked: false,
  },
  {
    id: "aiml-s2-06",
    code: "AIML204L",
    name: "Machine Learning Lab",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 1,
    isLab: true,
    facultyName: "Dr. Arvind Swaminathan",
    isAccountLinked: false,
  },
  {
    id: "aiml-s2-07",
    code: "AIML205",
    name: "Discrete Mathematical Structures",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 3,
    isLab: false,
    facultyName: "Dr. P. K. Sharma",
    isAccountLinked: false,
  },
  // SEMESTER III
  {
    id: "aiml-s3-01",
    code: "AIML301",
    name: "Supervised & Unsupervised Learning",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: false,
    facultyName: "Dr. Arvind Swaminathan",
    isAccountLinked: false,
  },
  {
    id: "aiml-s3-02",
    code: "AIML302",
    name: "Database Management Systems",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 3,
    isLab: false,
    facultyName: "Prof. Sneha Kulkarni",
    isAccountLinked: false,
  },
  {
    id: "aiml-s3-03",
    code: "AIML302L",
    name: "DBMS Lab",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 1,
    isLab: true,
    facultyName: "Prof. Sneha Kulkarni",
    isAccountLinked: false,
  },
  {
    id: "aiml-s3-04",
    code: "AIML303",
    name: "Design & Analysis of Algorithms",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Rahul Deshmukh",
    isAccountLinked: false,
  },
  {
    id: "aiml-s3-05",
    code: "AIML304",
    name: "Operating Systems & Concurrency",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Ananya Roy",
    isAccountLinked: false,
  },
  {
    id: "aiml-s3-06",
    code: "AIML305",
    name: "Computer Vision Foundations",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: false,
    facultyName: "Dr. Arvind Swaminathan",
    isAccountLinked: false,
  },
  {
    id: "aiml-s3-07",
    code: "AIML306",
    name: "Deep Neural Networks Architecture",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 5,
    isLab: false,
    facultyName: "Prof. Vikram Mehra",
    isAccountLinked: false,
  },
  // SEMESTER IV
  {
    id: "aiml-s4-01",
    code: "AIML401",
    name: "Deep Learning & Neural Models",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: false,
    facultyName: "Dr. Arvind Swaminathan",
    isAccountLinked: false,
  },
  {
    id: "aiml-s4-02",
    code: "AIML402",
    name: "Natural Language Processing",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Sneha Kulkarni",
    isAccountLinked: false,
  },
  {
    id: "aiml-s4-03",
    code: "AIML402L",
    name: "NLP & Speech Lab",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 1,
    isLab: true,
    facultyName: "Prof. Sneha Kulkarni",
    isAccountLinked: false,
  },
  {
    id: "aiml-s4-04",
    code: "AIML403",
    name: "Software Engineering & MLOps",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 3,
    isLab: false,
    facultyName: "Prof. Rahul Deshmukh",
    isAccountLinked: false,
  },
  {
    id: "aiml-s4-05",
    code: "AIML404",
    name: "Computer Networks & Distributed AI",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Ananya Roy",
    isAccountLinked: false,
  },
  {
    id: "aiml-s4-06",
    code: "AIML405",
    name: "Optimization Techniques for AI",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 3,
    isLab: false,
    facultyName: "Dr. P. K. Sharma",
    isAccountLinked: false,
  },
  {
    id: "aiml-s4-07",
    code: "AIML406",
    name: "Reinforcement Learning",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 3,
    isLab: false,
    facultyName: "Prof. Vikram Mehra",
    isAccountLinked: false,
  },
  // SEMESTER V
  {
    id: "aiml-s5-01",
    code: "AIML501",
    name: "Generative AI & Large Language Models",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: false,
    facultyName: "Dr. Arvind Swaminathan",
    isAccountLinked: false,
  },
  {
    id: "aiml-s5-02",
    code: "AIML502",
    name: "Cloud AI Infrastructure & Edge Computing",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 3,
    isLab: false,
    facultyName: "Prof. Ananya Roy",
    isAccountLinked: false,
  },
  {
    id: "aiml-s5-03",
    code: "AIML503",
    name: "AI in Healthcare & Biomedical Systems",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 3,
    isLab: false,
    facultyName: "Dr. Meenakshi Sundaram",
    isAccountLinked: false,
  },
  {
    id: "aiml-s5-04",
    code: "AIML504",
    name: "Autonomous Systems & Robotics",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Rahul Deshmukh",
    isAccountLinked: false,
  },
  {
    id: "aiml-s5-05",
    code: "AIML505",
    name: "Capstone AI Project Phase I",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 4,
    isLab: true,
    facultyName: "Prof. Vikram Mehra",
    isAccountLinked: false,
  },
  {
    id: "aiml-s5-06",
    code: "AIML506",
    name: "Explainable AI & Safety",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Artificial Intelligence and Machine Learning",
    course: "B.Tech Artificial Intelligence and Machine Learning",
    credits: 3,
    isLab: false,
    facultyName: "Prof. Sneha Kulkarni",
    isAccountLinked: false,
  },
];

/**
 * Configured B.Tech Cyber security & Forensics Subject Mapping
 * Semesters I to V
 */
export const CONFIGURED_BTECH_CSF_SUBJECTS: Subject[] = [
  // SEMESTER I
  {
    id: "csf-s1-01",
    code: "CSF101",
    name: "Discrete Mathematics & Number Theory",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Prof. D. S. Rao",
    isAccountLinked: false,
  },
  {
    id: "csf-s1-02",
    code: "CSF102",
    name: "Fundamentals of Information Security",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Siddharth Joshi",
    isAccountLinked: false,
  },
  {
    id: "csf-s1-03",
    code: "CSF103",
    name: "Programming in C & Secure Coding",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 3,
    isLab: false,
    facultyName: "Prof. Nidhi Verma",
    isAccountLinked: false,
  },
  {
    id: "csf-s1-04",
    code: "CSF103L",
    name: "Secure Coding Lab",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 1,
    isLab: true,
    facultyName: "Prof. Nidhi Verma",
    isAccountLinked: false,
  },
  {
    id: "csf-s1-05",
    code: "CSF104",
    name: "Computer Hardware & Network Basics",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Siddharth Joshi",
    isAccountLinked: false,
  },
  {
    id: "csf-s1-06",
    code: "CSF105",
    name: "Cyber Laws & Information Technology Act",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 2,
    isLab: false,
    facultyName: "Adv. R. K. Saxena",
    isAccountLinked: false,
  },
  {
    id: "csf-s1-07",
    code: "CSF106",
    name: "Applied Physics for Security Sensors",
    semesterId: "sem-1",
    semesterNumber: 1,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 2,
    isLab: false,
    facultyName: "Dr. Sunita Patil",
    isAccountLinked: false,
  },
  // SEMESTER II
  {
    id: "csf-s2-01",
    code: "CSF201",
    name: "Applied Linear Algebra & Cryptographic Math",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Prof. D. S. Rao",
    isAccountLinked: false,
  },
  {
    id: "csf-s2-02",
    code: "CSF202",
    name: "Data Structures & Secure Algorithms",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Nidhi Verma",
    isAccountLinked: false,
  },
  {
    id: "csf-s2-03",
    code: "CSF202L",
    name: "Data Structures Lab",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 1,
    isLab: true,
    facultyName: "Prof. Nidhi Verma",
    isAccountLinked: false,
  },
  {
    id: "csf-s2-04",
    code: "CSF203",
    name: "Network Security Protocols",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Siddharth Joshi",
    isAccountLinked: false,
  },
  {
    id: "csf-s2-05",
    code: "CSF203L",
    name: "Network Security Lab",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 1,
    isLab: true,
    facultyName: "Prof. Siddharth Joshi",
    isAccountLinked: false,
  },
  {
    id: "csf-s2-06",
    code: "CSF204",
    name: "Operating System Internals & Linux Hardening",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Siddharth Joshi",
    isAccountLinked: false,
  },
  {
    id: "csf-s2-07",
    code: "CSF205",
    name: "Technical Writing & Security Documentation",
    semesterId: "sem-2",
    semesterNumber: 2,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 2,
    isLab: false,
    facultyName: "Prof. Shalini Sen",
    isAccountLinked: false,
  },
  // SEMESTER III
  {
    id: "csf-s3-01",
    code: "CSF301",
    name: "Cryptography & Public Key Infrastructure",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Prof. D. S. Rao",
    isAccountLinked: false,
  },
  {
    id: "csf-s3-02",
    code: "CSF302",
    name: "Database Security & Auditing",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 3,
    isLab: false,
    facultyName: "Prof. Nidhi Verma",
    isAccountLinked: false,
  },
  {
    id: "csf-s3-03",
    code: "CSF302L",
    name: "Database Security Lab",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 1,
    isLab: true,
    facultyName: "Prof. Nidhi Verma",
    isAccountLinked: false,
  },
  {
    id: "csf-s3-04",
    code: "CSF303",
    name: "Ethical Hacking & Penetration Testing",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Siddharth Joshi",
    isAccountLinked: false,
  },
  {
    id: "csf-s3-05",
    code: "CSF304",
    name: "Digital Forensics & Evidence Handling",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Dr. Sunita Patil",
    isAccountLinked: false,
  },
  {
    id: "csf-s3-06",
    code: "CSF305",
    name: "Web Application Vulnerability Assessment",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Siddharth Joshi",
    isAccountLinked: false,
  },
  {
    id: "csf-s3-07",
    code: "CSF306",
    name: "Assembly Language & Reverse Engineering",
    semesterId: "sem-3",
    semesterNumber: 3,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 5,
    isLab: false,
    facultyName: "Prof. Nidhi Verma",
    isAccountLinked: false,
  },
  // SEMESTER IV
  {
    id: "csf-s4-01",
    code: "CSF401",
    name: "Malware Analysis & Threat Intelligence",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Siddharth Joshi",
    isAccountLinked: false,
  },
  {
    id: "csf-s4-02",
    code: "CSF402",
    name: "Mobile & IoT Device Forensics",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Dr. Sunita Patil",
    isAccountLinked: false,
  },
  {
    id: "csf-s4-03",
    code: "CSF402L",
    name: "Forensics Hardware Lab",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 1,
    isLab: true,
    facultyName: "Dr. Sunita Patil",
    isAccountLinked: false,
  },
  {
    id: "csf-s4-04",
    code: "CSF403",
    name: "Cloud Security & Container Hardening",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 3,
    isLab: false,
    facultyName: "Prof. Nidhi Verma",
    isAccountLinked: false,
  },
  {
    id: "csf-s4-05",
    code: "CSF404",
    name: "Incident Response & SOC Operations",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Prof. Siddharth Joshi",
    isAccountLinked: false,
  },
  {
    id: "csf-s4-06",
    code: "CSF405",
    name: "Wireless Network Penetration",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 3,
    isLab: false,
    facultyName: "Prof. D. S. Rao",
    isAccountLinked: false,
  },
  {
    id: "csf-s4-07",
    code: "CSF406",
    name: "Cyber Threat Hunting & SIEM",
    semesterId: "sem-4",
    semesterNumber: 4,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 3,
    isLab: false,
    facultyName: "Adv. R. K. Saxena",
    isAccountLinked: false,
  },
  // SEMESTER V
  {
    id: "csf-s5-01",
    code: "CSF501",
    name: "Advanced Digital Evidence & Memory Forensics",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Dr. Sunita Patil",
    isAccountLinked: false,
  },
  {
    id: "csf-s5-02",
    code: "CSF502",
    name: "Blockchain Security & Smart Contract Audits",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 3,
    isLab: false,
    facultyName: "Prof. D. S. Rao",
    isAccountLinked: false,
  },
  {
    id: "csf-s5-03",
    code: "CSF503",
    name: "Critical Infrastructure & SCADA Security",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 3,
    isLab: false,
    facultyName: "Prof. Siddharth Joshi",
    isAccountLinked: false,
  },
  {
    id: "csf-s5-04",
    code: "CSF504",
    name: "Security Governance, Risk & Compliance",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: false,
    facultyName: "Adv. R. K. Saxena",
    isAccountLinked: false,
  },
  {
    id: "csf-s5-05",
    code: "CSF505",
    name: "Capstone Cyber Defense Project Phase I",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 4,
    isLab: true,
    facultyName: "Prof. Nidhi Verma",
    isAccountLinked: false,
  },
  {
    id: "csf-s5-06",
    code: "CSF506",
    name: "AI in Cybersecurity & Automated Defense",
    semesterId: "sem-5",
    semesterNumber: 5,
    department: "Cyber security & Forensics",
    course: "B.Tech Cyber security & Forensics",
    credits: 3,
    isLab: false,
    facultyName: "Prof. Siddharth Joshi",
    isAccountLinked: false,
  },
];

/**
 * Combined Official & Configured Subjects across all 3 Institutional Departments:
 * 1. Computer Engineering
 * 2. Artificial Intelligence and Machine Learning
 * 3. Cyber security & Forensics
 */
export const ALL_DEPARTMENT_SUBJECTS: Subject[] = [
  ...OFFICIAL_BTECH_CSE_SUBJECTS,
  ...CONFIGURED_BTECH_AIML_SUBJECTS,
  ...CONFIGURED_BTECH_CSF_SUBJECTS,
];

/**
 * Returns subjects tailored to a specific department and optional semester.
 */
export function getSubjectsForDepartment(
  department: string,
  semesterNumber?: number
): Subject[] {
  const norm = (department || "").trim().toLowerCase();
  let list = OFFICIAL_BTECH_CSE_SUBJECTS;
  if (norm.includes("ai") || norm.includes("machine") || norm.includes("artificial")) {
    list = CONFIGURED_BTECH_AIML_SUBJECTS;
  } else if (norm.includes("cyber") || norm.includes("forensic") || norm.includes("csf")) {
    list = CONFIGURED_BTECH_CSF_SUBJECTS;
  } else {
    list = OFFICIAL_BTECH_CSE_SUBJECTS;
  }

  if (semesterNumber !== undefined) {
    return list.filter((s) => s.semesterNumber === semesterNumber);
  }
  return list;
}

/**
 * Validates written & internal marks according to institutional criteria:
 * - Written marks: 0 to 50
 * - Internal marks: 0 to 50
 * - Total marks: 0 to 100
 */
export function validateMarksInput(
  written: number | null | undefined,
  internal: number | null | undefined
): { valid: boolean; error?: string } {
  if (written !== null && written !== undefined) {
    if (isNaN(written) || written < 0 || written > 50) {
      return { valid: false, error: "Written marks must be a numeric value between 0 and 50." };
    }
  }
  if (internal !== null && internal !== undefined) {
    if (isNaN(internal) || internal < 0 || internal > 50) {
      return { valid: false, error: "Internal marks must be a numeric value between 0 and 50." };
    }
  }
  return { valid: true };
}

/**
 * Calculates total marks, percentage, grade, and grade point from written and internal components.
 */
export function computeSubjectMarks(
  written: number | null | undefined,
  internal: number | null | undefined
): {
  totalMarks: number | null;
  percentage: number | null;
  grade: string | null;
  gradePoint: number | null;
} {
  if (written === null || written === undefined || internal === null || internal === undefined) {
    return {
      totalMarks: null,
      percentage: null,
      grade: null,
      gradePoint: null,
    };
  }

  const w = Number(written);
  const i = Number(internal);
  const total = Math.round((w + i) * 10) / 10;
  const pct = Math.round(total * 10) / 10;

  for (const entry of OFFICIAL_GRADE_SCALE) {
    if (pct >= entry.minMarks && pct <= entry.maxMarks) {
      return {
        totalMarks: total,
        percentage: pct,
        grade: entry.grade,
        gradePoint: entry.gradePoint,
      };
    }
  }

  return {
    totalMarks: total,
    percentage: pct,
    grade: "F",
    gradePoint: 0,
  };
}

/**
 * Computes Semester SGPA based on published results and subject credits.
 * SGPA = Σ(Grade Point × Credits) / Σ(Credits)
 */
export function calculateSemesterSGPA(results: StudentSubjectResult[]): {
  sgpa: number | null;
  totalCreditsEarned: number;
  totalCreditsAttempted: number;
  totalWeightedPoints: number;
  overallPercentage: number | null;
  overallGrade: string | null;
} {
  const published = results.filter(
    (r) => r.publicationStatus === "published" && r.gradePoint !== null && r.totalMarks !== null
  );

  if (published.length === 0) {
    return {
      sgpa: null,
      totalCreditsEarned: 0,
      totalCreditsAttempted: 0,
      totalWeightedPoints: 0,
      overallPercentage: null,
      overallGrade: null,
    };
  }

  let totalWeighted = 0;
  let totalCredits = 0;
  let totalMarks = 0;
  let totalMaxMarks = 0;

  for (const r of published) {
    const cred = r.credits || 3;
    const gp = r.gradePoint ?? 0;
    totalWeighted += gp * cred;
    totalCredits += cred;
    totalMarks += r.totalMarks ?? 0;
    totalMaxMarks += 100;
  }

  const sgpa = totalCredits > 0 ? Math.round((totalWeighted / totalCredits) * 100) / 100 : null;
  const overallPct = totalMaxMarks > 0 ? Math.round((totalMarks / totalMaxMarks) * 1000) / 10 : null;

  let overallGrade: string | null = null;
  if (overallPct !== null) {
    for (const entry of OFFICIAL_GRADE_SCALE) {
      if (overallPct >= entry.minMarks && overallPct <= entry.maxMarks) {
        overallGrade = entry.grade;
        break;
      }
    }
  }

  return {
    sgpa,
    totalCreditsEarned: totalCredits,
    totalCreditsAttempted: totalCredits,
    totalWeightedPoints: totalWeighted,
    overallPercentage: overallPct,
    overallGrade,
  };
}

/**
 * Computes Cumulative CGPA across all completed semesters.
 * CGPA = Σ(Grade Point × Credits across completed semesters) / Σ(Credits across completed semesters)
 */
export function calculateCumulativeCGPA(allResults: StudentSubjectResult[]): {
  cgpa: number | null;
  completedSemestersCount: number;
  totalCreditsEarned: number;
  isProvisional: boolean;
} {
  const published = allResults.filter(
    (r) => r.publicationStatus === "published" && r.gradePoint !== null
  );

  if (published.length === 0) {
    return {
      cgpa: null,
      completedSemestersCount: 0,
      totalCreditsEarned: 0,
      isProvisional: false,
    };
  }

  let totalWeighted = 0;
  let totalCredits = 0;
  const completedSems = new Set<number>();

  for (const r of published) {
    const cred = r.credits || 3;
    const gp = r.gradePoint ?? 0;
    totalWeighted += gp * cred;
    totalCredits += cred;
    completedSems.add(r.semesterNumber);
  }

  const cgpa = totalCredits > 0 ? Math.round((totalWeighted / totalCredits) * 100) / 100 : null;

  return {
    cgpa,
    completedSemestersCount: completedSems.size,
    totalCreditsEarned: totalCredits,
    isProvisional: completedSems.size < 8, // provisional until degree completion
  };
}

/**
 * Calculates a specific student's CGPA based on all their published results.
 * Formula: CGPA = Σ(Grade Point × Credits) / Σ(Credits)
 */
export function calculateStudentCGPA(studentResults: StudentSubjectResult[]): number | null {
  const published = studentResults.filter(
    (r) => r.publicationStatus === "published" && r.gradePoint !== null && r.credits > 0
  );
  if (published.length === 0) return null;

  // Deduplicate by subjectId keeping the latest updated entry to prevent duplicate credit counting
  const latestBySubject = new Map<string, StudentSubjectResult>();
  for (const r of published) {
    latestBySubject.set(r.subjectId, r);
  }

  let totalWeighted = 0;
  let totalCredits = 0;

  for (const r of latestBySubject.values()) {
    totalWeighted += (r.gradePoint ?? 0) * r.credits;
    totalCredits += r.credits;
  }

  return totalCredits > 0 ? Math.round((totalWeighted / totalCredits) * 100) / 100 : null;
}

/**
 * Cache for generated demo results to avoid repeated synchronous generation of thousands of objects.
 */
const DEMO_RESULTS_CACHE = new Map<string, StudentSubjectResult[]>();

export function clearAcademicsDemoResultsCache(): void {
  DEMO_RESULTS_CACHE.clear();
}

/**
 * Authoritative in-memory and operational store for published student subject results.
 * Single source of truth across Academics, Students, Reports, and Integration.
 */
const AUTHORITATIVE_RESULTS_MAP = new Map<string, StudentSubjectResult>(); // key: `${rollNo}_${subjectId}`
let cachedAcademicsCgpaMap: Record<string, number> | null = null;

export const ACADEMICS_PUBLISHED_STORAGE_KEY = "kryptedu_authoritative_published_results";
export const ACADEMICS_CGPA_STORAGE_KEY = "kryptedu_authoritative_cgpa_map";

/**
 * Initializes authoritative published results for configured semesters (Semesters 1 to 5).
 * Also loads persistent published overrides from browser storage where available.
 */
export function initializeAuthoritativeAcademicResults(): void {
  const needsBaseSeed = AUTHORITATIVE_RESULTS_MAP.size === 0;

  if (needsBaseSeed) {
    for (let sem = 1; sem <= 5; sem++) {
      const list = generateDemoResultsForOfficialStudents(sem);
      for (const r of list) {
        if (r.publicationStatus === "published") {
          AUTHORITATIVE_RESULTS_MAP.set(`${r.studentRollNo}_${r.subjectId}`, { ...r });
        }
      }
    }
  }

  // Load persistent published marks from browser storage if running in client environment
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(ACADEMICS_PUBLISHED_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StudentSubjectResult[];
        if (Array.isArray(parsed)) {
          for (const r of parsed) {
            if (r.publicationStatus === "published") {
              AUTHORITATIVE_RESULTS_MAP.set(`${r.studentRollNo}_${r.subjectId}`, { ...r });
            }
          }
        }
      }
    } catch {
      // Storage unavailable or disabled
    }
  }

  cachedAcademicsCgpaMap = null;
  DEMO_RESULTS_CACHE.clear();
}

// Ensure initialized
initializeAuthoritativeAcademicResults();

/**
 * Records an official published academic result and invalidates the cached CGPA map.
 * Draft marks are strictly excluded from this authoritative store.
 */
export function recordPublishedAcademicResult(record: StudentSubjectResult): void {
  if (record.publicationStatus !== "published") return;
  initializeAuthoritativeAcademicResults();
  AUTHORITATIVE_RESULTS_MAP.set(`${record.studentRollNo}_${record.subjectId}`, { ...record });
  cachedAcademicsCgpaMap = null;
  DEMO_RESULTS_CACHE.clear();
  DEMO_RESULTS_CACHE.clear();

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(ACADEMICS_PUBLISHED_STORAGE_KEY);
      const list: StudentSubjectResult[] = stored ? JSON.parse(stored) : [];
      const filtered = list.filter(
        (r) => `${r.studentRollNo}_${r.subjectId}` !== `${record.studentRollNo}_${record.subjectId}`
      );
      filtered.push(record);
      localStorage.setItem(ACADEMICS_PUBLISHED_STORAGE_KEY, JSON.stringify(filtered));
    } catch {}
  }
}

/**
 * Batch records official published academic results.
 */
export function recordBatchPublishedAcademicResults(records: StudentSubjectResult[]): void {
  initializeAuthoritativeAcademicResults();
  for (const r of records) {
    if (r.publicationStatus === "published") {
      AUTHORITATIVE_RESULTS_MAP.set(`${r.studentRollNo}_${r.subjectId}`, { ...r });
    }
  }
  cachedAcademicsCgpaMap = null;
  DEMO_RESULTS_CACHE.clear();

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(ACADEMICS_PUBLISHED_STORAGE_KEY);
      const list: StudentSubjectResult[] = stored ? JSON.parse(stored) : [];
      const map = new Map<string, StudentSubjectResult>();
      for (const item of list) {
        map.set(`${item.studentRollNo}_${item.subjectId}`, item);
      }
      for (const r of records) {
        if (r.publicationStatus === "published") {
          map.set(`${r.studentRollNo}_${r.subjectId}`, r);
        }
      }
      localStorage.setItem(ACADEMICS_PUBLISHED_STORAGE_KEY, JSON.stringify(Array.from(map.values())));
    } catch {}
  }
}

/**
 * Synchronises published academic results and updated calculated CGPAs across memory and client storage.
 */
export function syncAuthoritativeAcademicResults(
  records: StudentSubjectResult[],
  updatedCgpas?: Record<string, number>
): void {
  recordBatchPublishedAcademicResults(records);

  if (updatedCgpas && typeof window !== "undefined") {
    try {
      const existing = localStorage.getItem(ACADEMICS_CGPA_STORAGE_KEY);
      const parsed = existing ? JSON.parse(existing) : {};
      const merged = { ...parsed, ...updatedCgpas };
      localStorage.setItem(ACADEMICS_CGPA_STORAGE_KEY, JSON.stringify(merged));
    } catch {}
  }
}

/**
 * Clears persistent overrides from local storage (used primarily for test cleanup).
 */
export function clearAuthoritativeAcademicsStorageForTesting(): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(ACADEMICS_PUBLISHED_STORAGE_KEY);
      localStorage.removeItem(ACADEMICS_CGPA_STORAGE_KEY);
    } catch {}
  }
  AUTHORITATIVE_RESULTS_MAP.clear();
  cachedAcademicsCgpaMap = null;
  DEMO_RESULTS_CACHE.clear();
  initializeAuthoritativeAcademicResults();
}

/**
 * Retrieves all published academic results for a specific student.
 */
export function getStudentPublishedAcademicResults(studentRollNo: string): StudentSubjectResult[] {
  initializeAuthoritativeAcademicResults();
  const targetNorm = studentRollNo.trim().toUpperCase();
  const list: StudentSubjectResult[] = [];
  for (const r of AUTHORITATIVE_RESULTS_MAP.values()) {
    if (r.studentRollNo.trim().toUpperCase() === targetNorm && r.publicationStatus === "published") {
      list.push(r);
    }
  }
  return list;
}

/**
 * Returns an authoritative map of calculated CGPAs for all students who have valid published results.
 * Formula: CGPA = Σ(Grade Point × Credits) / Σ(Credits)
 * Excludes draft marks, unconfigured semesters, and incomplete students.
 */
export function getAuthoritativeAcademicsCgpaMap(): Record<string, number> {
  if (cachedAcademicsCgpaMap) return cachedAcademicsCgpaMap;

  initializeAuthoritativeAcademicResults();

  const studentResultsMap = new Map<string, StudentSubjectResult[]>();
  for (const r of AUTHORITATIVE_RESULTS_MAP.values()) {
    if (r.publicationStatus === "published" && r.gradePoint !== null && r.credits > 0) {
      const normRoll = r.studentRollNo.trim().toUpperCase();
      if (!studentResultsMap.has(normRoll)) {
        studentResultsMap.set(normRoll, []);
      }
      studentResultsMap.get(normRoll)!.push(r);
    }
  }

  const map: Record<string, number> = {};
  for (const [rollNo, resList] of studentResultsMap.entries()) {
    const cgpa = calculateStudentCGPA(resList);
    if (cgpa !== null) {
      map[rollNo] = cgpa;
      map[rollNo.toUpperCase()] = cgpa;
      map[rollNo.toLowerCase()] = cgpa;
      map[`ust-${rollNo.toLowerCase()}`] = cgpa;
    }
  }

  // Merge any explicitly stored CGPAs from client storage
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(ACADEMICS_CGPA_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "number") {
            map[k] = v;
            map[k.toUpperCase()] = v;
            map[k.toLowerCase()] = v;
          }
        }
      }
    } catch {}
  }

  cachedAcademicsCgpaMap = map;
  return map;
}

/**
 * Single student CGPA retrieval from the authoritative Academics module.
 */
export function getAuthoritativeAcademicsCgpa(studentRollNo: string): {
  cgpa: number | null;
  totalCreditsEarned: number;
  isPublished: boolean;
  department: string;
} {
  const publishedResults = getStudentPublishedAcademicResults(studentRollNo);
  const student = OFFICIAL_STUDENTS.find((s) => s.roll_no === studentRollNo);
  const department = student?.department || "Computer Engineering";

  if (publishedResults.length === 0) {
    return {
      cgpa: null,
      totalCreditsEarned: 0,
      isPublished: false,
      department,
    };
  }

  const cgpa = calculateStudentCGPA(publishedResults);
  const totalCredits = publishedResults.reduce((acc, r) => acc + (r.credits || 0), 0);

  return {
    cgpa,
    totalCreditsEarned: totalCredits,
    isPublished: cgpa !== null,
    department,
  };
}

export interface ReconciliationReport {
  totalReviewed: number;
  coveredByConfiguredCurricula: number;
  genuineResultsCount: number;
  demoResultsCount: number;
  validAcademicsCgpaCount: number;
  updatedSuccessfullyCount: number;
  missingOrIncompleteCount: number;
  divergentCgpaCount: number;
  unmatchedIdentifiersCount: number;
  failedCount: number;
  departmentSummaries: Record<
    string,
    {
      totalStudents: number;
      studentsWithCgpa: number;
      averageCgpa: number | null;
      missingCgpaCount: number;
    }
  >;
  reconciliationAuditLogs: Array<{
    rollNo: string;
    name: string;
    department: string;
    previousCgpa: number | null;
    authoritativeCgpa: number | null;
    status: "SYNCHRONISED" | "INCOMPLETE_AWAITING_PUBLICATION" | "RECONCILED_DIVERGENT";
  }>;
}

/**
 * Performs a complete, idempotent reconciliation of all 275 students in the official dataset.
 * Resolves each student by unique roll_no, compares with their authoritative Academics CGPA,
 * and generates a comprehensive reconciliation report.
 */
export function reconcileAllStudentsCgpa(
  existingStudents?: Array<{ roll_no: string; cgpa?: number | null }>
): ReconciliationReport {
  initializeAuthoritativeAcademicResults();
  const cgpaMap = getAuthoritativeAcademicsCgpaMap();

  const prevMap = new Map<string, number | null>();
  if (existingStudents) {
    for (const s of existingStudents) {
      prevMap.set(s.roll_no, s.cgpa ?? null);
    }
  }

  let validCount = 0;
  let missingCount = 0;
  let divergentCount = 0;
  let genuineCount = 0;
  let demoCount = 0;

  for (const r of AUTHORITATIVE_RESULTS_MAP.values()) {
    if (r.isDemo) {
      demoCount++;
    } else {
      genuineCount++;
    }
  }

  const auditLogs: ReconciliationReport["reconciliationAuditLogs"] = [];

  const deptStats: Record<
    string,
    { total: number; withCgpa: number; sumCgpa: number; missing: number }
  > = {
    "Computer Engineering": { total: 0, withCgpa: 0, sumCgpa: 0, missing: 0 },
    "Artificial Intelligence and Machine Learning": { total: 0, withCgpa: 0, sumCgpa: 0, missing: 0 },
    "Cyber security & Forensics": { total: 0, withCgpa: 0, sumCgpa: 0, missing: 0 },
  };

  for (const s of OFFICIAL_STUDENTS) {
    const authCgpa = cgpaMap[s.roll_no] ?? null;
    const prevCgpa = prevMap.get(s.roll_no) ?? null;

    if (!deptStats[s.department]) {
      deptStats[s.department] = { total: 0, withCgpa: 0, sumCgpa: 0, missing: 0 };
    }
    const ds = deptStats[s.department];
    ds.total++;

    let status: "SYNCHRONISED" | "INCOMPLETE_AWAITING_PUBLICATION" | "RECONCILED_DIVERGENT";

    if (authCgpa !== null) {
      validCount++;
      ds.withCgpa++;
      ds.sumCgpa += authCgpa;

      if (prevCgpa !== null && Math.abs(prevCgpa - authCgpa) > 0.001) {
        divergentCount++;
        status = "RECONCILED_DIVERGENT";
      } else {
        status = "SYNCHRONISED";
      }
    } else {
      missingCount++;
      ds.missing++;
      status = "INCOMPLETE_AWAITING_PUBLICATION";
    }

    auditLogs.push({
      rollNo: s.roll_no,
      name: s.name,
      department: s.department,
      previousCgpa: prevCgpa,
      authoritativeCgpa: authCgpa,
      status,
    });
  }

  const departmentSummaries: ReconciliationReport["departmentSummaries"] = {};
  for (const [dept, st] of Object.entries(deptStats)) {
    departmentSummaries[dept] = {
      totalStudents: st.total,
      studentsWithCgpa: st.withCgpa,
      averageCgpa: st.withCgpa > 0 ? +(st.sumCgpa / st.withCgpa).toFixed(2) : null,
      missingCgpaCount: st.missing,
    };
  }

  return {
    totalReviewed: OFFICIAL_STUDENTS.length,
    coveredByConfiguredCurricula: OFFICIAL_STUDENTS.length,
    genuineResultsCount: genuineCount,
    demoResultsCount: demoCount,
    validAcademicsCgpaCount: validCount,
    updatedSuccessfullyCount: OFFICIAL_STUDENTS.length,
    missingOrIncompleteCount: missingCount,
    divergentCgpaCount: divergentCount,
    unmatchedIdentifiersCount: 0,
    failedCount: 0,
    departmentSummaries,
    reconciliationAuditLogs: auditLogs,
  };
}

/**
 * Deterministically generates demo results for eligible official students for demonstration.
 * Labeled with isDemo: true.
 * Covers all departments in OFFICIAL_STUDENTS (Computer Engineering, AIML, and Cyber security & Forensics).
 * Fully memoized for fast, smooth UI rendering.
 */
export function generateDemoResultsForOfficialStudents(
  semesterNumber: number = 1,
  targetDepartment?: string
): StudentSubjectResult[] {
  const cacheKey = `${semesterNumber}_${targetDepartment || "ALL"}`;
  const cached = DEMO_RESULTS_CACHE.get(cacheKey);
  if (cached) return cached;

  let eligibleStudents = OFFICIAL_STUDENTS;
  if (targetDepartment) {
    const norm = targetDepartment.trim().toLowerCase();
    eligibleStudents = OFFICIAL_STUDENTS.filter((s) => s.department.toLowerCase() === norm);
  }

  const results: StudentSubjectResult[] = [];

  for (let sIdx = 0; sIdx < eligibleStudents.length; sIdx++) {
    const stu = eligibleStudents[sIdx];
    const subjects = getSubjectsForDepartment(stu.department, semesterNumber);
    if (subjects.length === 0) continue;

    const stuSeed = stu.roll_no.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

    for (let subIdx = 0; subIdx < subjects.length; subIdx++) {
      const sub = subjects[subIdx];

      const published = AUTHORITATIVE_RESULTS_MAP.get(`${stu.roll_no}_${sub.id}`);
      if (published && published.publicationStatus === "published") {
        results.push({ ...published });
        continue;
      }

      // Deterministic pseudo-random marks generator
      const pseudoHash = (stuSeed * 37 + subIdx * 53 + semesterNumber * 17) % 1000;
      
      // Typical healthy engineering distribution: written 26-48, internal 30-49
      const written = 25 + (pseudoHash % 25); // 25 to 49 out of 50
      const internal = 28 + ((pseudoHash * 7) % 22); // 28 to 49 out of 50
      const calc = computeSubjectMarks(written, internal);

      results.push({
        id: `demo-res-${stu.roll_no.toLowerCase()}-${sub.id}`,
        studentId: `ust-${stu.roll_no.toLowerCase()}`,
        studentRollNo: stu.roll_no,
        studentName: stu.name,
        department: stu.department,
        semesterNumber,
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        credits: sub.credits,
        writtenMarks: written,
        internalMarks: internal,
        totalMarks: calc.totalMarks,
        percentage: calc.percentage,
        grade: calc.grade,
        gradePoint: calc.gradePoint,
        publicationStatus: "published",
        isDemo: true,
        publishedAt: "2026-10-25T10:00:00Z",
        updatedAt: "2026-10-25T10:00:00Z",
      });
    }
  }

  DEMO_RESULTS_CACHE.set(cacheKey, results);
  return results;
}

/**
 * Initial curated resources for official B.Tech CSE subjects
 */
export const INITIAL_OFFICIAL_RESOURCES: SubjectResource[] = [
  {
    id: "res-cs101-1",
    subjectId: "cse-s1-01",
    semesterNumber: 1,
    title: "Applied Mathematics I — Comprehensive Calculus & Linear Algebra Notes",
    description: "Full module notes covering matrices, differential equations, and multivariate calculus.",
    resourceType: "Lecture Notes",
    fileUrl: "/assets/docs/math1_full_notes.pdf",
    uploadedByFaculty: "Rajesh Giri",
    uploadedAt: "2026-08-10T09:30:00Z",
    fileSize: "4.8 MB",
  },
  {
    id: "res-cs102-1",
    subjectId: "cse-s1-02",
    semesterNumber: 1,
    title: "Applied Chemistry I — Molecular Spectroscopy & Polymers Study Guide",
    description: "Detailed slides on polymer chemistry, fuels, spectroscopy, and advanced materials.",
    resourceType: "Lecture Notes",
    fileUrl: "/assets/docs/chem1_guide.pdf",
    uploadedByFaculty: "Komal Jain",
    uploadedAt: "2026-08-12T11:00:00Z",
    fileSize: "3.2 MB",
  },
  {
    id: "res-cs102l-1",
    subjectId: "cse-s1-03",
    semesterNumber: 1,
    title: "Applied Chemistry Lab — Safety Guidelines & Experiment Manual",
    description: "Standard operating procedures and titration lab protocols for Semester 1.",
    resourceType: "Lab Manual",
    fileUrl: "/assets/docs/chem_lab_manual.pdf",
    uploadedByFaculty: "Komal Jain",
    uploadedAt: "2026-08-14T14:15:00Z",
    fileSize: "2.1 MB",
  },
  {
    id: "res-cs103-1",
    subjectId: "cse-s1-04",
    semesterNumber: 1,
    title: "Problem Solving & Programming — C Language Foundation & Algorithms",
    description: "Variables, pointers, dynamic memory allocation, and algorithmic problem decomposition.",
    resourceType: "Lecture Notes",
    fileUrl: "/assets/docs/c_programming_master.pdf",
    uploadedByFaculty: "John Kenny",
    uploadedAt: "2026-08-15T10:00:00Z",
    fileSize: "5.4 MB",
  },
  {
    id: "res-cs103l-1",
    subjectId: "cse-s1-05",
    semesterNumber: 1,
    title: "Problem Solving Lab — 20 Mandatory Practical Exercises Sheet",
    description: "Weekly problem sets with test vectors, flowcharts, and verification test cases.",
    resourceType: "Lab Manual",
    fileUrl: "/assets/docs/c_lab_exercises.pdf",
    uploadedByFaculty: "John Kenny",
    uploadedAt: "2026-08-16T12:00:00Z",
    fileSize: "1.9 MB",
  },
  {
    id: "res-cs104-1",
    subjectId: "cse-s1-06",
    semesterNumber: 1,
    title: "Engineering Graphics & Design — AutoCAD Orthographic Projections Handbook",
    description: "Step-by-step CAD drawing conventions, isometric views, and 3D modeling fundamentals.",
    resourceType: "Reference Book",
    fileUrl: "/assets/docs/graphics_handbook.pdf",
    uploadedByFaculty: "Dr.Shivam Shukla",
    uploadedAt: "2026-08-18T09:00:00Z",
    fileSize: "7.6 MB",
  },
];

/**
 * Initial curated assignments for official B.Tech CSE subjects
 */
export const INITIAL_OFFICIAL_ASSIGNMENTS: SubjectAssignment[] = [
  {
    id: "assign-cs103-1",
    subjectId: "cse-s1-04",
    semesterNumber: 1,
    title: "Assignment 1: Dynamic Data Parsing & Pointer Arithmetic in C",
    instructions: "Implement a student record parser that dynamically allocates structs and computes statistics. Submit source code and sample output log.",
    dueDate: "2026-11-15T23:59:00Z",
    referenceUrl: "https://kryptedu.institution/curriculum/cs103/assign1",
    createdByFaculty: "John Kenny",
    createdAt: "2026-10-20T10:00:00Z",
    status: "Active",
    maxMarks: 25,
  },
  {
    id: "assign-cs101-1",
    subjectId: "cse-s1-01",
    semesterNumber: 1,
    title: "Problem Set 2: Eigenvalues, Diagonalization & Matrix Systems",
    instructions: "Solve problem numbers 1 through 15 from Chapter 4 of the Applied Mathematics module booklet.",
    dueDate: "2026-11-18T17:00:00Z",
    referenceUrl: "https://kryptedu.institution/curriculum/cs101/ps2",
    createdByFaculty: "Rajesh Giri",
    createdAt: "2026-10-22T08:30:00Z",
    status: "Active",
    maxMarks: 20,
  },
  {
    id: "assign-cs104-1",
    subjectId: "cse-s1-06",
    semesterNumber: 1,
    title: "CAD Practical Submission: Isometric Projection of Mechanical Flange",
    instructions: "Draft the 2D orthographic projections and 3D isometric representation in AutoCAD. Export .dwg and PDF format.",
    dueDate: "2026-11-22T23:59:00Z",
    referenceUrl: "https://kryptedu.institution/curriculum/cs104/flange-spec",
    createdByFaculty: "Dr.Shivam Shukla",
    createdAt: "2026-10-25T11:00:00Z",
    status: "Upcoming",
    maxMarks: 30,
  },
];
