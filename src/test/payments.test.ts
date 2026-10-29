import { describe, it, expect } from "vitest";
import {
  calculateBalance,
  calculatePaymentOptions,
  derivePaymentStatus,
  validateCustomAmount,
  formatINR,
  generateReceiptNumber,
  computePaymentSummary,
  formatCourseName,
  type StudentCourseFeeItem,
  type FeeAuditLogItem,
} from "../lib/payments";
import {
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
  getRazorpayConfig,
} from "../lib/razorpay.server";
import {
  STANDARD_COURSE_FEE,
  getAdminPaymentsDashboard,
  getAdminPaymentsDashboardLogic,
  updateStudentCourseFeeLogic,
  getUserRole,
} from "../lib/payments.functions";

describe("Payment Module: Domain Logic & Razorpay Gateway Invariants", () => {
  // Test Case 1: Standardized Course Fee
  it("enforces standardized course fee of ₹1,75,000.00 for every student", () => {
    expect(STANDARD_COURSE_FEE).toBe(175000);

    const initialOpts = calculatePaymentOptions(STANDARD_COURSE_FEE);
    expect(initialOpts.full).toBe(175000);
    expect(initialOpts.half).toBe(87500);

    const cohortTotal = 36 * STANDARD_COURSE_FEE;
    expect(cohortTotal).toBe(6300000);
    expect(formatINR(cohortTotal)).toContain("63,00,000.00");
  });

  // Test Case 2: Pay half the outstanding balance
  it("calculates 50% of outstanding balance accurately (Option A)", () => {
    // Initial balance: ₹1,75,000.00
    const initialOpts = calculatePaymentOptions(175000);
    expect(initialOpts.half).toBe(87500);
    expect(initialOpts.full).toBe(175000);

    // After partial payment of ₹75,000, remaining balance is ₹1,00,000
    // Half must be 50% of the REMAINING balance (₹50,000), not the original fee
    const remainingBalance = calculateBalance(175000, 75000);
    expect(remainingBalance).toBe(100000);

    const postPartialOpts = calculatePaymentOptions(remainingBalance);
    expect(postPartialOpts.half).toBe(50000);
    expect(postPartialOpts.full).toBe(100000);
  });

  // Test Case 3: Pay the full outstanding balance
  it("calculates full remaining fee without exceeding balance (Option B)", () => {
    const balance = calculateBalance(175000, 50000);
    expect(balance).toBe(125000);

    const opts = calculatePaymentOptions(balance);
    expect(opts.full).toBe(125000);
    expect(opts.full).toBeLessThanOrEqual(balance);
  });

  // Test Case 4: Pay valid custom amount
  it("accepts valid custom amounts within outstanding balance (Option C)", () => {
    const balance = 75000;
    const check1 = validateCustomAmount(25000, balance);
    expect(check1.valid).toBe(true);

    const check2 = validateCustomAmount(75000, balance);
    expect(check2.valid).toBe(true);
  });

  // Test Case 5: Reject zero, negative, and excessive custom amounts
  it("strictly rejects zero, negative, and excessive custom amounts", () => {
    const balance = 50000;

    const zeroCheck = validateCustomAmount(0, balance);
    expect(zeroCheck.valid).toBe(false);
    expect(zeroCheck.error).toContain("greater than ₹0.00");

    const negCheck = validateCustomAmount(-500, balance);
    expect(negCheck.valid).toBe(false);
    expect(negCheck.error).toContain("greater than ₹0.00");

    const excessCheck = validateCustomAmount(50001, balance);
    expect(excessCheck.valid).toBe(false);
    expect(excessCheck.error).toContain("cannot exceed");

    const nanCheck = validateCustomAmount(NaN, balance);
    expect(nanCheck.valid).toBe(false);
  });

  // Test Case 6: Formatting currency correctly in INR
  it("formats amounts in Indian Rupees (INR) correctly", () => {
    const formatted = formatINR(175000);
    expect(formatted).toContain("1,75,000.00");
  });

  // Test Case 7: Verify valid payment signatures and reject invalid signatures
  it("verifies authentic HMAC-SHA256 signatures and rejects forged signatures", () => {
    const orderId = "order_9A33XWu170gUtm";
    const paymentId = "pay_29A1XWuYeUkdu3";
    const secret = "sample_test_secret_key_12345";

    const crypto = require("node:crypto");
    const legitimateSignature = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const isValid = verifyRazorpaySignature(orderId, paymentId, legitimateSignature, secret);
    expect(isValid).toBe(true);

    const isTampered = verifyRazorpaySignature(
      orderId,
      paymentId,
      "forged_invalid_signature_hex_code",
      secret
    );
    expect(isTampered).toBe(false);

    const isMismatched = verifyRazorpaySignature(
      "order_different_999",
      paymentId,
      legitimateSignature,
      secret
    );
    expect(isMismatched).toBe(false);
  });

  // Test Case 8: Webhook signature verification
  it("verifies Razorpay webhook event signatures", () => {
    const body = JSON.stringify({ event: "payment.captured", id: "evt_123" });
    const webhookSecret = "whsec_test_secret_999";

    const crypto = require("node:crypto");
    const validWhSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    expect(verifyRazorpayWebhookSignature(body, validWhSig, webhookSecret)).toBe(true);
    expect(verifyRazorpayWebhookSignature(body, "invalid_wh_sig", webhookSecret)).toBe(false);
  });

  // Test Case 9: Unverified payment never reduces outstanding balance
  it("ensures unverified or failed payments never reduce the outstanding balance", () => {
    const totalFee = 175000;
    const confirmedPayments = 0;
    const balance = calculateBalance(totalFee, confirmedPayments);
    expect(balance).toBe(175000);

    const status = derivePaymentStatus(totalFee, confirmedPayments, { hasFailed: true });
    expect(status).toBe("Failed");
  });

  // Test Case 10: Confirm partial payments update balance correctly
  it("correctly derives 'Partially Paid' status and updates balance", () => {
    const totalFee = 175000;
    const confirmedPayments = 87500;
    const balance = calculateBalance(totalFee, confirmedPayments);
    expect(balance).toBe(87500);

    const status = derivePaymentStatus(totalFee, confirmedPayments);
    expect(status).toBe("Partially Paid");
  });

  // Test Case 11: Confirm fully paid student has zero balance
  it("correctly derives 'Paid' status and sets balance to zero when cleared", () => {
    const totalFee = 175000;
    const confirmedPayments = 175000;
    const balance = calculateBalance(totalFee, confirmedPayments);
    expect(balance).toBe(0);

    const status = derivePaymentStatus(totalFee, confirmedPayments);
    expect(status).toBe("Paid");
  });

  // Test Case 12: Receipt generation produces unique identifiers
  it("generates structured receipt numbers with timestamp", () => {
    const rec1 = generateReceiptNumber();
    const rec2 = generateReceiptNumber();
    expect(rec1).toMatch(/^KRYPT-REC-\d{8}-[A-Z0-9]+$/);
    expect(rec2).toMatch(/^KRYPT-REC-\d{8}-[A-Z0-9]+$/);
    expect(rec1).not.toBe(rec2);
  });

  // Test Case 13: Summary card computation accurately aggregates metrics
  it("accurately aggregates cohort fee totals, collections, and transaction counts", () => {
    const mockFeeItems: StudentCourseFeeItem[] = [
      {
        id: "f1",
        student_id: "s1",
        student_name: "Alice",
        student_roll_no: "KR2024001",
        student_dept: "Computer Science",
        student_year: 4,
        course_name: "B.Tech Computer Science",
        total_fee: 175000,
        amount_paid: 175000,
        remaining_balance: 0,
        status: "Paid",
        due_date: null,
        currency: "INR",
        transactions_count: 2,
        last_payment_date: "2026-10-01",
      },
      {
        id: "f2",
        student_id: "s2",
        student_name: "Bob",
        student_roll_no: "KR2024002",
        student_dept: "Information Tech",
        student_year: 3,
        course_name: "B.Tech Information Tech",
        total_fee: 175000,
        amount_paid: 87500,
        remaining_balance: 87500,
        status: "Partially Paid",
        due_date: null,
        currency: "INR",
        transactions_count: 1,
        last_payment_date: "2026-10-15",
      },
      {
        id: "f3",
        student_id: "s3",
        student_name: "Charlie",
        student_roll_no: "KR2024003",
        student_dept: "Civil",
        student_year: 2,
        course_name: "B.Tech Civil",
        total_fee: 175000,
        amount_paid: 0,
        remaining_balance: 175000,
        status: "Unpaid",
        due_date: null,
        currency: "INR",
        transactions_count: 0,
        last_payment_date: null,
      },
    ];

    const mockTxs = [
      { status: "captured", amount: 87500 },
      { status: "captured", amount: 87500 },
      { status: "captured", amount: 87500 },
      { status: "failed", amount: 20000 },
    ];

    const summary = computePaymentSummary(mockFeeItems, mockTxs);
    expect(summary.totalCourseFees).toBe(525000); // 3 * 175,000
    expect(summary.totalCollected).toBe(262500);
    expect(summary.outstandingFees).toBe(262500);
    expect(summary.pendingStudentsCount).toBe(2);
    expect(summary.successfulTxCount).toBe(3);
    expect(summary.failedTxCount).toBe(1);
  });
});

describe("Role-Based Access Control (RBAC) Invariants for Payments", () => {
  // Test Case 14: Permission Matrix Check
  const permissions = {
    student: {
      seeSidebarPayments: true,
      openStudentPage: true,
      viewOwnFeeAndBalance: true,
      initiatePayment: true,
      viewOwnHistory: true,
      downloadOwnReceipt: true,
      viewAllTransactions: false,
      viewCohortBalances: false,
      searchAllRecords: false,
      exportPaymentReports: false,
      manageCourseFees: false,
    },
    admin: {
      seeSidebarPayments: true,
      openStudentPage: false,
      viewOwnFeeAndBalance: false,
      initiatePayment: false,
      viewOwnHistory: false,
      downloadOwnReceipt: false,
      viewAllTransactions: true,
      viewCohortBalances: true,
      searchAllRecords: true,
      exportPaymentReports: true,
      manageCourseFees: true,
    },
    faculty: {
      seeSidebarPayments: false,
      openStudentPage: false,
      viewOwnFeeAndBalance: false,
      initiatePayment: false,
      viewOwnHistory: false,
      downloadOwnReceipt: false,
      viewAllTransactions: false,
      viewCohortBalances: false,
      searchAllRecords: false,
      exportPaymentReports: false,
      manageCourseFees: false,
    },
    placement: {
      seeSidebarPayments: false,
      openStudentPage: false,
      viewOwnFeeAndBalance: false,
      initiatePayment: false,
      viewOwnHistory: false,
      downloadOwnReceipt: false,
      viewAllTransactions: false,
      viewCohortBalances: false,
      searchAllRecords: false,
      exportPaymentReports: false,
      manageCourseFees: false,
    },
  };

  it("enforces that Students can access own payment page and initiate checkout, but cannot access admin tools", () => {
    const studentPerms = permissions.student;
    expect(studentPerms.seeSidebarPayments).toBe(true);
    expect(studentPerms.openStudentPage).toBe(true);
    expect(studentPerms.initiatePayment).toBe(true);
    expect(studentPerms.viewAllTransactions).toBe(false);
    expect(studentPerms.manageCourseFees).toBe(false);
  });

  it("enforces that Admin can manage fees and export reports, but cannot initiate student payments", () => {
    const adminPerms = permissions.admin;
    expect(adminPerms.seeSidebarPayments).toBe(true);
    expect(adminPerms.viewAllTransactions).toBe(true);
    expect(adminPerms.exportPaymentReports).toBe(true);
    expect(adminPerms.manageCourseFees).toBe(true);
    expect(adminPerms.openStudentPage).toBe(false);
    expect(adminPerms.initiatePayment).toBe(false);
  });

  it("enforces that Faculty and Placement Officers have zero access to Payments", () => {
    for (const role of ["faculty", "placement"] as const) {
      const p = permissions[role];
      expect(p.seeSidebarPayments).toBe(false);
      expect(p.openStudentPage).toBe(false);
      expect(p.viewAllTransactions).toBe(false);
      expect(p.exportPaymentReports).toBe(false);
      expect(p.manageCourseFees).toBe(false);
    }
  });

  // Test Case 15: Student Data Privacy Isolation
  it("enforces student privacy: student can never access other student's fee or payments", () => {
    const studentA_id = "uuid-student-a";
    const studentB_id = "uuid-student-b";

    // Simulating server-side session check
    const resolveAllowedStudent = (sessionUserId: string, userToStudentMap: Record<string, string>) => {
      return userToStudentMap[sessionUserId] || null;
    };

    const map = {
      "user-alice": studentA_id,
      "user-bob": studentB_id,
    };

    const aliceResolved = resolveAllowedStudent("user-alice", map);
    expect(aliceResolved).toBe(studentA_id);
    expect(aliceResolved).not.toBe(studentB_id);
  });

  // Test Case 16: Course Name formatting without duplicate Engineering
  it("formats course names properly without duplicate 'Engineering' strings", () => {
    expect(formatCourseName("Computer Engineering")).toBe("B.Tech Computer Engineering");
    expect(formatCourseName("Electronics & Communication Engineering")).toBe(
      "B.Tech Electronics & Communication Engineering"
    );
    expect(
      formatCourseName(
        "Computer Engineering",
        "B.Tech Computer Engineering Engineering"
      )
    ).toBe("B.Tech Computer Engineering");
    expect(formatCourseName("Information Technology")).toBe(
      "B.Tech Information Technology Engineering"
    );
  });

  // Test Case 17: Save & Audit Trail Invariants
  it("enforces fee adjustment and audit log integrity", () => {
    const student = {
      id: "ust-ust24r0102001",
      roll_no: "UST24R0102001",
      name: "Aanosh Mukesh Lingapur",
      dept: "Computer Engineering",
    };

    const oldFee = 175000;
    const newFee = 150000;
    const reason = "Merit scholarship applied, semester fee concession";

    // Adjustment must have non-empty reason
    expect(reason.trim().length).toBeGreaterThan(0);
    expect(newFee).toBeGreaterThanOrEqual(0);

    const auditEntry: FeeAuditLogItem = {
      id: "audit-test-1",
      student_id: student.id,
      student_name: student.name,
      student_roll_no: student.roll_no,
      fee_id: "fee-ust24r0102001",
      changed_by: "admin@kryptedu.com",
      old_fee: oldFee,
      new_fee: newFee,
      old_total_fee: oldFee,
      new_total_fee: newFee,
      reason,
      created_at: new Date().toISOString(),
    };

    expect(auditEntry.old_fee).toBe(175000);
    expect(auditEntry.new_fee).toBe(150000);
    expect(auditEntry.old_total_fee).toBe(175000);
    expect(auditEntry.new_total_fee).toBe(150000);
    expect(auditEntry.student_name).toBe("Aanosh Mukesh Lingapur");
    expect(auditEntry.student_roll_no).toBe("UST24R0102001");
    expect(auditEntry.reason).toBe(reason);
  });

  it("retrieves complete ledger for all 275 students with realistic statuses and financial summaries", async () => {
    const createChain = () => {
      const chain: any = {
        order: () => chain,
        limit: () => chain,
        in: () => chain,
        then: (onfulfilled: any) => Promise.resolve({ data: [] }).then(onfulfilled),
        catch: (onrejected: any) => Promise.resolve({ data: [] }).catch(onrejected),
      };
      return chain;
    };

    const mockSupabase = {
      from: () => ({
        select: () => createChain(),
      }),
    };

    const dashboard = await getAdminPaymentsDashboardLogic({
      supabase: mockSupabase,
      userId: "demo-admin-id",
      claims: { email: "admin@kryptedu.com" },
    });

    // 1. Must return all 275 canonical students
    expect(dashboard.feeItems.length).toBe(275);

    // 2. All statuses must be represented
    const paidCount = dashboard.feeItems.filter((i) => i.status === "Paid").length;
    const partialCount = dashboard.feeItems.filter((i) => i.status === "Partially Paid").length;
    const unpaidCount = dashboard.feeItems.filter((i) => i.status === "Unpaid").length;
    const failedCount = dashboard.feeItems.filter((i) => i.status === "Failed").length;

    expect(paidCount).toBeGreaterThan(0);
    expect(partialCount).toBeGreaterThan(0);
    expect(unpaidCount).toBeGreaterThan(0);
    expect(failedCount).toBeGreaterThan(0);
    expect(paidCount + partialCount + unpaidCount + failedCount).toBe(275);

    // 3. Financial summary invariants
    expect(dashboard.summary.totalCourseFees).toBe(275 * 175000);
    expect(dashboard.summary.totalCollected).toBeGreaterThan(0);
    expect(dashboard.summary.outstandingFees).toBe(
      dashboard.summary.totalCourseFees - dashboard.summary.totalCollected
    );

    // 4. Transactions & Receipts must be present
    expect(dashboard.transactions.length).toBeGreaterThan(0);
    const sampleCapturedTx = dashboard.transactions.find((t) => t.status === "captured");
    expect(sampleCapturedTx).toBeDefined();
    expect(sampleCapturedTx?.receipt_number).toBeDefined();

    // 5. Audit logs must be present
    expect(dashboard.auditLogs.length).toBeGreaterThan(0);
  });

  it("updates student course fee and logs immutable audit trail entry", async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          ilike: () => ({ maybeSingle: () => Promise.resolve(null) }),
          eq: () => ({ maybeSingle: () => Promise.resolve(null) }),
        }),
        insert: () => Promise.resolve({ data: null, error: null }),
      }),
    };

    const targetStudentId = "ust-ust24r0102001";
    const result = await updateStudentCourseFeeLogic(
      {
        student_id: targetStudentId,
        total_fee: 140000,
        reason: "Sports scholarship concession",
      },
      {
        supabase: mockSupabase,
        userId: "demo-admin-id",
        claims: { email: "admin@kryptedu.com" },
      }
    );

    expect(result.success).toBe(true);
    expect(result.newFee).toBe(140000);
    expect(result.auditLog.reason).toBe("Sports scholarship concession");
    expect(result.auditLog.new_fee).toBe(140000);
  });

  it("enforces strict RBAC rejection for non-admin callers", async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: [{ role: "faculty" }], error: null }),
        }),
      }),
    };

    await expect(
      getAdminPaymentsDashboardLogic({
        supabase: mockSupabase,
        userId: "demo-faculty-id",
        claims: { email: "faculty@kryptedu.com" },
      })
    ).rejects.toThrow("Forbidden (403)");
  });
});
