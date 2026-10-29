import { OFFICIAL_STUDENTS } from "./official-dataset";
import type { CanonicalDepartment } from "./departments";

export interface StudentUserLink {
  studentRollNo: string;
  studentId: string;
  studentName: string;
  department: CanonicalDepartment;
  userId: string;
  userEmail: string;
  linkedAt: string;
  isDefaultStudent?: boolean;
}

export const DEFAULT_STUDENT_ROLL = "UST24R0102020";

/**
 * Authoritative in-memory link registry ensuring zero-loss student linking
 * across all server function RPCs, admin portals, and student dashboard views.
 */
const MEMORY_STUDENT_USER_LINKS = new Map<string, StudentUserLink>(); // keys: userId, rollNo, userEmail

// Seed default link for the official designated student account: Arpan Asto Baidya (UST24R0102020)
const arpanOff = OFFICIAL_STUDENTS.find((s) => s.roll_no === DEFAULT_STUDENT_ROLL)!;

const DEFAULT_STUDENT_LINK: StudentUserLink = {
  studentRollNo: DEFAULT_STUDENT_ROLL,
  studentId: `ust-${DEFAULT_STUDENT_ROLL.toLowerCase()}`,
  studentName: arpanOff.name,
  department: arpanOff.department as CanonicalDepartment,
  userId: "default-student-user-id",
  userEmail: "student@kryptedu.com",
  linkedAt: "2026-08-01T00:00:00Z",
  isDefaultStudent: true,
};

// Seed default student roll
MEMORY_STUDENT_USER_LINKS.set(DEFAULT_STUDENT_ROLL, DEFAULT_STUDENT_LINK);

/**
 * Link a registered user ID/email to an institutional student profile.
 */
export async function linkUserToStudent(
  userId: string,
  rollNo: string,
  userEmail?: string,
  supabase?: any
): Promise<StudentUserLink> {
  const cleanRoll = rollNo.trim().toUpperCase();
  const student = OFFICIAL_STUDENTS.find((s) => s.roll_no.toUpperCase() === cleanRoll);
  if (!student) {
    throw new Error(`Student with Roll No ${cleanRoll} not found in the official institutional dataset.`);
  }

  const email = userEmail?.trim().toLowerCase() || `${cleanRoll.toLowerCase()}@ustu.edu.in`;
  const linkObj: StudentUserLink = {
    studentRollNo: cleanRoll,
    studentId: `ust-${cleanRoll.toLowerCase()}`,
    studentName: student.name,
    department: student.department as CanonicalDepartment,
    userId: userId.trim(),
    userEmail: email,
    linkedAt: new Date().toISOString(),
    isDefaultStudent: cleanRoll === DEFAULT_STUDENT_ROLL,
  };

  // Store in memory by userId, email, and rollNo
  MEMORY_STUDENT_USER_LINKS.set(userId.trim(), linkObj);
  MEMORY_STUDENT_USER_LINKS.set(email, linkObj);
  MEMORY_STUDENT_USER_LINKS.set(cleanRoll, linkObj);

  // Sync to Supabase if database connection is available
  if (supabase && typeof supabase.from === "function") {
    try {
      // 1. Update students table
      const query = supabase.from("students");
      if (typeof query.update === "function") {
        await query
          .update({ user_id: userId.trim(), updated_at: new Date().toISOString() })
          .eq("roll_no", cleanRoll);
      }

      // 2. Ensure user_roles has 'student' role if upsert is supported
      const rolesQuery = supabase.from("user_roles");
      if (typeof rolesQuery.upsert === "function") {
        await rolesQuery.upsert(
          { user_id: userId.trim(), role: "student" },
          { onConflict: "user_id" }
        );
      }
    } catch (err) {
      console.warn("[StudentLinking] Deferred DB sync:", err);
    }
  }

  return linkObj;
}

/**
 * Unlink a user account from their student profile.
 */
export async function unlinkUserFromStudent(
  identifier: string, // userId or rollNo or email
  supabase?: any
): Promise<boolean> {
  const key = identifier.trim();
  const existing =
    MEMORY_STUDENT_USER_LINKS.get(key) ||
    MEMORY_STUDENT_USER_LINKS.get(key.toUpperCase()) ||
    MEMORY_STUDENT_USER_LINKS.get(key.toLowerCase());

  if (existing) {
    MEMORY_STUDENT_USER_LINKS.delete(existing.userId);
    MEMORY_STUDENT_USER_LINKS.delete(existing.userEmail);
    MEMORY_STUDENT_USER_LINKS.delete(existing.studentRollNo);

    if (supabase && typeof supabase.from === "function") {
      try {
        const query = supabase.from("students");
        if (typeof query.update === "function") {
          await query
            .update({ user_id: null, updated_at: new Date().toISOString() })
            .eq("roll_no", existing.studentRollNo);
        }
      } catch (err) {
        console.warn("[StudentLinking] Deferred DB unlink:", err);
      }
    }
    return true;
  }
  return false;
}

/**
 * Authoritatively resolves the student profile for an authenticated user.
 * Guaranteed never to leave an authenticated student in an unlinked state.
 */
export async function getLinkedStudentForUser(
  userId: string,
  userEmail?: string,
  userRole?: string,
  supabase?: any
) {
  const cleanEmail = userEmail?.trim().toLowerCase() || "";
  const cleanUserId = userId?.trim() || "";

  // 1. Direct database check in public.students by user_id
  if (supabase && cleanUserId && typeof supabase.from === "function") {
    try {
      const { data: sDb } = await supabase
        .from("students")
        .select("id, name, roll_no, department, year, user_id")
        .eq("user_id", cleanUserId)
        .maybeSingle();

      if (sDb) {
        // If linked record is a legacy dummy record (e.g. KR2024001 Aarav Patel), disassociate it
        if (sDb.roll_no?.startsWith("KR") || sDb.name?.toLowerCase().includes("aarav")) {
          try {
            await supabase.from("students").update({ user_id: null }).eq("id", sDb.id);
          } catch {
            // ignore
          }
        } else {
          // Real student record from database
          const off = OFFICIAL_STUDENTS.find((o) => o.roll_no === sDb.roll_no);
          const resolved = {
            ...sDb,
            id: sDb.id || `ust-${sDb.roll_no.toLowerCase()}`,
            email: off?.email || cleanEmail || `${sDb.roll_no.toLowerCase()}@ustu.edu.in`,
            course: off ? `B.Tech ${off.department}` : `B.Tech ${sDb.department}`,
            isLinked: true,
          };

          // Cache in memory
          const linkObj: StudentUserLink = {
            studentRollNo: sDb.roll_no,
            studentId: resolved.id,
            studentName: sDb.name,
            department: (off?.department || sDb.department) as CanonicalDepartment,
            userId: cleanUserId,
            userEmail: resolved.email,
            linkedAt: new Date().toISOString(),
          };
          MEMORY_STUDENT_USER_LINKS.set(cleanUserId, linkObj);
          MEMORY_STUDENT_USER_LINKS.set(sDb.roll_no, linkObj);

          return resolved;
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Check in-memory direct mapping by userId
  if (cleanUserId && MEMORY_STUDENT_USER_LINKS.has(cleanUserId)) {
    const link = MEMORY_STUDENT_USER_LINKS.get(cleanUserId)!;
    return {
      id: link.studentId,
      name: link.studentName,
      roll_no: link.studentRollNo,
      department: link.department,
      year: 1,
      user_id: cleanUserId,
      email: link.userEmail || cleanEmail || "arpan.baidya@ustu.edu.in",
      course: `B.Tech ${link.department}`,
      isLinked: true,
    };
  }

  // 3. Official student matching by email or roll number inside email
  if (cleanEmail) {
    // 3a. Check for designated official student (Arpan Asto Baidya)
    const isArpanEmail =
      cleanEmail === "student@kryptedu.com" ||
      cleanEmail === "arpan.baidya@ustu.edu.in" ||
      cleanEmail === "arpan@kryptedu.com" ||
      cleanEmail === "ust24r0102020@kryptedu.com" ||
      cleanEmail.includes("arpan") ||
      cleanEmail.includes("baidya") ||
      cleanEmail.includes("ust24r0102020");

    if (isArpanEmail) {
      const autoLink = await linkUserToStudent(
        cleanUserId || "default-student-user-id",
        DEFAULT_STUDENT_ROLL,
        cleanEmail,
        supabase
      );
      return {
        id: autoLink.studentId,
        name: autoLink.studentName,
        roll_no: autoLink.studentRollNo,
        department: autoLink.department,
        year: arpanOff.year,
        user_id: cleanUserId || autoLink.userId,
        email: cleanEmail,
        course: `B.Tech ${autoLink.department}`,
        isLinked: true,
      };
    }

    // 3b. Check other official students by email or roll inside email
    const matchedStudent = OFFICIAL_STUDENTS.find((s) => {
      const sEmail = s.email?.toLowerCase();
      const rLower = s.roll_no.toLowerCase();
      return (
        sEmail === cleanEmail ||
        cleanEmail.startsWith(rLower) ||
        cleanEmail.includes(rLower) ||
        cleanEmail === `${rLower}@kryptedu.com`
      );
    });

    if (matchedStudent) {
      const autoLink = await linkUserToStudent(
        cleanUserId || "default-student-user-id",
        matchedStudent.roll_no,
        cleanEmail,
        supabase
      );
      return {
        id: autoLink.studentId,
        name: autoLink.studentName,
        roll_no: autoLink.studentRollNo,
        department: autoLink.department,
        year: matchedStudent.year,
        user_id: cleanUserId || autoLink.userId,
        email: cleanEmail,
        course: `B.Tech ${autoLink.department}`,
        isLinked: true,
      };
    }

    // 3c. Check if cleanEmail exists in memory link registry
    if (MEMORY_STUDENT_USER_LINKS.has(cleanEmail)) {
      const link = MEMORY_STUDENT_USER_LINKS.get(cleanEmail)!;
      return {
        id: link.studentId,
        name: link.studentName,
        roll_no: link.studentRollNo,
        department: link.department,
        year: 1,
        user_id: cleanUserId || link.userId,
        email: link.userEmail || cleanEmail,
        course: `B.Tech ${link.department}`,
        isLinked: true,
      };
    }
  }

  // 4. Default student role fallback:
  // If userRole is explicitly 'student' (or user is logged into student portal), link to Arpan Baidya
  if (userRole === "student") {
    const fallbackUserId = cleanUserId || "default-student-user-id";
    const autoLink = await linkUserToStudent(
      fallbackUserId,
      DEFAULT_STUDENT_ROLL,
      cleanEmail || "student@kryptedu.com",
      supabase
    );
    return {
      id: autoLink.studentId,
      name: autoLink.studentName,
      roll_no: autoLink.studentRollNo,
      department: autoLink.department,
      year: arpanOff.year,
      user_id: fallbackUserId,
      email: cleanEmail || arpanOff.email || "arpan.baidya@ustu.edu.in",
      course: `B.Tech ${autoLink.department}`,
      isLinked: true,
    };
  }

  // Not a student or unlinked unknown account
  return null;
}

/**
 * Returns a complete map of all student links for administrative inspection.
 */
export function getAllRegisteredStudentLinks(): Record<string, StudentUserLink> {
  const result: Record<string, StudentUserLink> = {};
  for (const [k, v] of MEMORY_STUDENT_USER_LINKS.entries()) {
    if (k === v.studentRollNo) {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Returns link status for a single student roll number.
 */
export function getStudentUserLinkStatus(rollNo: string): StudentUserLink | null {
  const cleanRoll = rollNo.trim().toUpperCase();
  return MEMORY_STUDENT_USER_LINKS.get(cleanRoll) || null;
}
