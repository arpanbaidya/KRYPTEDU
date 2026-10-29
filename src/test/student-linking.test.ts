import { describe, it, expect } from "vitest";
import {
  getLinkedStudentForUser,
  linkUserToStudent,
  unlinkUserFromStudent,
  getAllRegisteredStudentLinks,
  getStudentUserLinkStatus,
  DEFAULT_STUDENT_ROLL,
} from "../lib/student-linking";
import { OFFICIAL_STUDENTS } from "../lib/official-dataset";

describe("Authoritative Student Account Linking Engine", () => {
  it("resolves default student profile for Arpan Asto Baidya (UST24R0102020)", async () => {
    const student = await getLinkedStudentForUser("default-student-user-id", "student@kryptedu.com", "student");
    expect(student).not.toBeNull();
    expect(student?.roll_no).toBe(DEFAULT_STUDENT_ROLL);
    expect(student?.name).toBe("Arpan Asto Baidya");
    expect(student?.department).toBe("Computer Engineering");
    expect(student?.isLinked).toBe(true);
  });

  it("resolves Arpan Baidya for aliases arpan.baidya@ustu.edu.in and arpan@kryptedu.com", async () => {
    const s1 = await getLinkedStudentForUser("user-alias-1", "arpan.baidya@ustu.edu.in", "student");
    expect(s1?.roll_no).toBe(DEFAULT_STUDENT_ROLL);
    expect(s1?.isLinked).toBe(true);

    const s2 = await getLinkedStudentForUser("user-alias-2", "arpan@kryptedu.com", "student");
    expect(s2?.roll_no).toBe(DEFAULT_STUDENT_ROLL);
    expect(s2?.isLinked).toBe(true);
  });

  it("links any official student to a user account and dual-indexes in memory", async () => {
    const targetStudent = OFFICIAL_STUDENTS[5]; // Official student
    const testUserId = "test-user-aiml-101";
    const testEmail = "test.aiml@campus.edu";

    const link = await linkUserToStudent(testUserId, targetStudent.roll_no, testEmail);
    expect(link.studentRollNo).toBe(targetStudent.roll_no);
    expect(link.studentName).toBe(targetStudent.name);
    expect(link.userId).toBe(testUserId);
    expect(link.userEmail).toBe(testEmail);

    // Verify retrieval by userId
    const resolvedByUserId = await getLinkedStudentForUser(testUserId);
    expect(resolvedByUserId?.roll_no).toBe(targetStudent.roll_no);
    expect(resolvedByUserId?.name).toBe(targetStudent.name);
    expect(resolvedByUserId?.isLinked).toBe(true);

    // Verify retrieval by email
    const resolvedByEmail = await getLinkedStudentForUser("other-id", testEmail);
    expect(resolvedByEmail?.roll_no).toBe(targetStudent.roll_no);
    expect(resolvedByEmail?.isLinked).toBe(true);

    // Verify link status check
    const status = getStudentUserLinkStatus(targetStudent.roll_no);
    expect(status).not.toBeNull();
    expect(status?.userId).toBe(testUserId);
  });

  it("allows unlinking a student and verifies removal", async () => {
    const testStudent = OFFICIAL_STUDENTS[10];
    const testUserId = "test-user-cyber-202";

    await linkUserToStudent(testUserId, testStudent.roll_no, "cyber.student@ustu.edu.in");
    expect(getStudentUserLinkStatus(testStudent.roll_no)).not.toBeNull();

    const unlinked = await unlinkUserFromStudent(testStudent.roll_no);
    expect(unlinked).toBe(true);
    expect(getStudentUserLinkStatus(testStudent.roll_no)).toBeNull();
  });

  it("guarantees an authenticated student user is never left unlinked", async () => {
    // Random student user without prior mapping
    const newStudentUserId = "random-student-uuid-9999";
    const newStudentEmail = "brandnewstudent@university.ac.in";

    const resolved = await getLinkedStudentForUser(newStudentUserId, newStudentEmail, "student");
    expect(resolved).not.toBeNull();
    expect(resolved?.isLinked).toBe(true);
    expect(resolved?.roll_no).toBe(DEFAULT_STUDENT_ROLL);
    expect(resolved?.name).toBe("Arpan Asto Baidya");
  });

  it("protects staff roles (admin, faculty, placement) from accidental student auto-linking", async () => {
    const adminUser = await getLinkedStudentForUser("admin-uuid-1", "admin@kryptedu.com", "admin");
    expect(adminUser).toBeNull();

    const facultyUser = await getLinkedStudentForUser("faculty-uuid-1", "faculty@kryptedu.com", "faculty");
    expect(facultyUser).toBeNull();

    const placementUser = await getLinkedStudentForUser("placement-uuid-1", "placement@kryptedu.com", "placement");
    expect(placementUser).toBeNull();
  });

  it("returns all registered links for administrative inspection", () => {
    const allLinks = getAllRegisteredStudentLinks();
    expect(allLinks[DEFAULT_STUDENT_ROLL]).toBeDefined();
    expect(allLinks[DEFAULT_STUDENT_ROLL].studentRollNo).toBe(DEFAULT_STUDENT_ROLL);
  });
});
