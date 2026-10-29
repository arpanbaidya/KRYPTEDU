/**
 * KRYPTEDU Course Fee & Payment Domain Logic
 * Handles balance math, payment option calculation, status derivation,
 * validation, and currency formatting.
 */
import { OFFICIAL_STUDENTS } from "./official-dataset";
import { normalizeDepartment } from "./departments";

export type PaymentStatus =
  | "Unpaid"
  | "Partially Paid"
  | "Paid"
  | "Failed"
  | "Refund Pending";

export type PaymentOptionType = "half" | "full" | "custom";

export interface StudentCourseFeeItem {
  id: string;
  student_id: string;
  student_name: string;
  student_roll_no: string;
  student_dept: string;
  student_year: number;
  course_name: string;
  total_fee: number;
  amount_paid: number;
  remaining_balance: number;
  status: PaymentStatus;
  due_date: string | null;
  currency: string;
  transactions_count: number;
  last_payment_date: string | null;
  is_linked?: boolean;
  linked_user_id?: string | null;
  linked_user_email?: string | null;
}

export interface PaymentSummary {
  totalCourseFees: number;
  totalCollected: number;
  outstandingFees: number;
  pendingStudentsCount: number;
  successfulTxCount: number;
  failedTxCount: number;
}

export interface PaymentTransactionItem {
  id: string;
  student_id: string;
  fee_id: string;
  student_name?: string;
  student_roll_no?: string;
  course_name?: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amount: number;
  currency: string;
  payment_method: string | null;
  status: "created" | "captured" | "failed" | "refunded" | "refund_pending";
  payment_option: PaymentOptionType;
  receipt_number: string | null;
  notes: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface PaymentReceipt {
  receiptNumber: string;
  studentName: string;
  studentRollNo: string;
  studentDept: string;
  courseName: string;
  amountPaid: number;
  currency: string;
  remainingBalance: number;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  paymentDate: string;
  paymentMethod: string;
  paymentOption: PaymentOptionType;
}

export interface FeeAuditLogItem {
  id: string;
  student_id: string;
  student_name?: string;
  student_roll_no?: string;
  fee_id: string;
  changed_by: string | null;
  old_fee: number;
  new_fee: number;
  old_total_fee?: number;
  new_total_fee?: number;
  reason: string | null;
  created_at: string;
}

/**
 * Format official B.Tech course name based on department, avoiding duplication
 */
export function formatCourseName(dept?: string, existing?: string): string {
  if (existing) {
    const cleaned = existing
      .replace(/\bEngineering\s+Engineering\b/gi, "Engineering")
      .trim();
    if (cleaned && cleaned.toLowerCase() !== "b.tech engineering & technology") {
      return cleaned;
    }
  }
  const cleanDept = (dept || "Computer Engineering").trim();
  if (/engineering$/i.test(cleanDept)) {
    return `B.Tech ${cleanDept}`;
  }
  return `B.Tech ${cleanDept} Engineering`;
}

/**
 * Calculates remaining balance:
 * Remaining Balance = Total Course Fee - Confirmed Payments
 * Returns 0 if payments exceed or match total fee.
 */
export function calculateBalance(totalFee: number, confirmedPayments: number): number {
  const fee = Math.max(0, Number(totalFee) || 0);
  const paid = Math.max(0, Number(confirmedPayments) || 0);
  const balance = Math.max(0, fee - paid);
  return Math.round(balance * 100) / 100;
}

/**
 * Derives payment status based on fee, confirmed payments, and transaction history.
 */
export function derivePaymentStatus(
  totalFee: number,
  confirmedPayments: number,
  options?: { hasFailed?: boolean; hasRefundPending?: boolean }
): PaymentStatus {
  if (options?.hasRefundPending) {
    return "Refund Pending";
  }

  const fee = Math.max(0, Number(totalFee) || 0);
  const paid = Math.max(0, Number(confirmedPayments) || 0);

  if (fee > 0 && paid >= fee) {
    return "Paid";
  }
  if (paid > 0 && paid < fee) {
    return "Partially Paid";
  }
  if (options?.hasFailed && paid === 0) {
    return "Failed";
  }
  return "Unpaid";
}

/**
 * Calculates the amounts for the three required payment options:
 * - Option A (Half): 50% of the current remaining balance.
 * - Option B (Full): 100% of the current remaining balance.
 */
export function calculatePaymentOptions(remainingBalance: number) {
  const balance = Math.max(0, Number(remainingBalance) || 0);
  const halfAmount = Math.max(0, Math.round((balance / 2) * 100) / 100);
  const fullAmount = balance;

  return {
    half: halfAmount,
    full: fullAmount,
    balance,
  };
}

/**
 * Validates custom payment amount:
 * - Must be a finite number
 * - Must be greater than 0
 * - Must not exceed remaining balance
 */
export function validateCustomAmount(
  amount: number,
  remainingBalance: number
): { valid: boolean; error?: string } {
  if (typeof amount !== "number" || isNaN(amount) || !isFinite(amount)) {
    return { valid: false, error: "Please enter a valid numeric payment amount." };
  }
  if (amount <= 0) {
    return { valid: false, error: "Payment amount must be greater than ₹0.00." };
  }
  if (amount > remainingBalance) {
    return {
      valid: false,
      error: `Payment amount cannot exceed the current outstanding balance of ${formatINR(remainingBalance)}.`,
    };
  }
  return { valid: true };
}

/**
 * Formats monetary amounts in Indian Rupees (INR) e.g. ₹25,000.00
 */
export function formatINR(amount: number): string {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Generates an institutional receipt number
 */
export function generateReceiptNumber(prefix: string = "KRYPT-REC"): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${datePart}-${randomPart}`;
}

/**
 * Aggregates summary cards from a list of student course fee items and transactions
 */
export function computePaymentSummary(
  feeItems: StudentCourseFeeItem[],
  transactions: { status: string; amount: number }[]
): PaymentSummary {
  let totalCourseFees = 0;
  let totalCollected = 0;
  let outstandingFees = 0;
  let pendingStudentsCount = 0;

  for (const item of feeItems) {
    totalCourseFees += item.total_fee;
    totalCollected += item.amount_paid;
    outstandingFees += item.remaining_balance;
    if (item.status === "Unpaid" || item.status === "Partially Paid" || item.status === "Failed") {
      pendingStudentsCount++;
    }
  }

  let successfulTxCount = 0;
  let failedTxCount = 0;

  for (const tx of transactions) {
    if (tx.status === "captured") {
      successfulTxCount++;
    } else if (tx.status === "failed") {
      failedTxCount++;
    }
  }

  return {
    totalCourseFees: Math.round(totalCourseFees * 100) / 100,
    totalCollected: Math.round(totalCollected * 100) / 100,
    outstandingFees: Math.round(outstandingFees * 100) / 100,
    pendingStudentsCount,
    successfulTxCount,
    failedTxCount,
  };
}

/**
 * Generates an authoritative baseline course fee and payment dataset
 * for all 275 canonical students with realistic distributions.
 */
export function generateBaselinePaymentDataset(): {
  feeItems: StudentCourseFeeItem[];
  transactions: PaymentTransactionItem[];
  summary: PaymentSummary;
} {
  const feeItems: StudentCourseFeeItem[] = [];
  const transactions: PaymentTransactionItem[] = [];

  OFFICIAL_STUDENTS.forEach((student, idx) => {
    const studentId = `ust-${student.roll_no.toLowerCase()}`;
    const dept = normalizeDepartment(student.department) || "Computer Engineering";
    const courseName = formatCourseName(dept);
    const cleanRoll = student.roll_no.toUpperCase();
    const totalFee = 175000;

    let amountPaid = 0;
    let status: PaymentStatus = "Unpaid";
    let txCount = 0;
    let lastDate: string | null = null;

    if (idx % 20 === 19) {
      // Failed payment attempt (~5%, 14 students)
      status = "Failed";
      amountPaid = 0;
      txCount = 1;
      lastDate = new Date(Date.now() - (idx * 3600000 * 2)).toISOString();
      transactions.push({
        id: `tx-failed-${cleanRoll}`,
        student_id: studentId,
        fee_id: `fee-${studentId}`,
        student_name: student.name,
        student_roll_no: student.roll_no,
        course_name: courseName,
        razorpay_order_id: `order_failed_${cleanRoll.toLowerCase()}`,
        razorpay_payment_id: `pay_failed_${cleanRoll.toLowerCase()}`,
        amount: 87500,
        currency: "INR",
        payment_method: "UPI",
        status: "failed",
        payment_option: "custom",
        receipt_number: undefined,
        notes: "Bank gateway authentication failed.",
        verified_at: undefined,
        created_at: lastDate,
      });
    } else if (idx % 5 === 0 || idx % 5 === 1) {
      // Full payment (Paid, ~40%, 110 students)
      status = "Paid";
      amountPaid = 175000;
      txCount = 1;
      lastDate = new Date(Date.now() - (idx * 3600000 * 3)).toISOString();
      transactions.push({
        id: `tx-paid-${cleanRoll}`,
        student_id: studentId,
        fee_id: `fee-${studentId}`,
        student_name: student.name,
        student_roll_no: student.roll_no,
        course_name: courseName,
        razorpay_order_id: `order_official_${cleanRoll.toLowerCase()}`,
        razorpay_payment_id: `pay_official_${cleanRoll.toLowerCase()}`,
        amount: 175000,
        currency: "INR",
        payment_method: idx % 3 === 0 ? "UPI" : idx % 3 === 1 ? "Net Banking" : "Card",
        status: "captured",
        payment_option: "full",
        receipt_number: `RCP-2025-${cleanRoll}`,
        notes: "Official Institutional Course Fee receipt issued.",
        verified_at: lastDate,
        created_at: lastDate,
      });
    } else if (idx % 5 === 2 || idx % 5 === 3) {
      // Partial payment (Partially Paid, ~40%, 110 students)
      status = "Partially Paid";
      amountPaid = 87500;
      txCount = 1;
      lastDate = new Date(Date.now() - (idx * 3600000 * 4)).toISOString();
      transactions.push({
        id: `tx-partial-${cleanRoll}`,
        student_id: studentId,
        fee_id: `fee-${studentId}`,
        student_name: student.name,
        student_roll_no: student.roll_no,
        course_name: courseName,
        razorpay_order_id: `order_partial_${cleanRoll.toLowerCase()}`,
        razorpay_payment_id: `pay_partial_${cleanRoll.toLowerCase()}`,
        amount: 87500,
        currency: "INR",
        payment_method: idx % 2 === 0 ? "UPI" : "Net Banking",
        status: "captured",
        payment_option: "custom",
        receipt_number: `RCP-2025-${cleanRoll}-P1`,
        notes: "First installment course fee verified.",
        verified_at: lastDate,
        created_at: lastDate,
      });
    } else {
      // Unpaid (~15%, 41 students)
      status = "Unpaid";
      amountPaid = 0;
      txCount = 0;
    }

    const remainingBalance = totalFee - amountPaid;

    feeItems.push({
      id: `fee-${studentId}`,
      student_id: studentId,
      student_name: student.name,
      student_roll_no: student.roll_no,
      student_dept: dept,
      student_year: student.year,
      course_name: courseName,
      total_fee: totalFee,
      amount_paid: amountPaid,
      remaining_balance: remainingBalance,
      status,
      due_date: null,
      currency: "INR",
      transactions_count: txCount,
      last_payment_date: lastDate,
    });
  });

  const summary = computePaymentSummary(feeItems, transactions);

  return { feeItems, transactions, summary };
}
