import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Building2,
  RefreshCw,
  Edit2,
  FileText,
  Printer,
  History,
  Users,
  Shield,
  GraduationCap,
} from "lucide-react";

import { PageHeader, Card } from "@/components/kr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { supabase } from "@/integrations/supabase/client";
import {
  getAdminPaymentsDashboard,
  updateStudentCourseFee,
} from "@/lib/payments.functions";
import {
  formatINR,
  formatCourseName,
  type StudentCourseFeeItem,
  type PaymentStatus,
  type PaymentTransactionItem,
} from "@/lib/payments";
import { CANONICAL_DEPARTMENTS } from "@/lib/departments";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({
    meta: [
      { title: "Admin Payment Management — KRYPTEDU" },
      { name: "description", content: "Institutional student course fees, payment statuses, and verified receipts." },
      { property: "og:title", content: "Admin Payment Management — KRYPTEDU" },
      { property: "og:description", content: "Institutional student course fees, payment statuses, and verified receipts." },
    ],
  }),
  beforeLoad: ({ context }) => {
    const role = (context as any)?.role;
    if (role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminPaymentManagementPage,
});

function AdminPaymentManagementPage() {
  const queryClient = useQueryClient();

  // Top Tabs: Student Fees & Receipts vs User Roles
  const [activeTab, setActiveTab] = useState<"fees" | "users">("fees");

  // Query: Student Payments Data
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-payments-dashboard"],
    queryFn: () => getAdminPaymentsDashboard(),
  });

  // Query: User Roles (for the User Management tab)
  const { data: users, isLoading: isUsersLoading } = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_all_users");
      if (error) throw error;
      return data;
    },
    enabled: activeTab === "users",
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase.rpc("set_user_role", {
        target_user_id: userId,
        new_role: newRole as "admin" | "faculty" | "placement" | "pending" | "student",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User role updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update role.");
    },
  });

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");

  // Fee Adjustment Modal State
  const [editFeeStudent, setEditFeeStudent] = useState<StudentCourseFeeItem | null>(null);
  const [editFeeAmount, setEditFeeAmount] = useState<string>("");
  const [editCourseName, setEditCourseName] = useState<string>("");
  const [editDueDate, setEditDueDate] = useState<string>("");
  const [editReason, setEditReason] = useState<string>("");
  const [isEditFeeModalOpen, setIsEditFeeModalOpen] = useState(false);

  // Receipt Modal State
  const [selectedStudentForReceipt, setSelectedStudentForReceipt] = useState<StudentCourseFeeItem | null>(null);
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<PaymentTransactionItem | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    if (!data?.feeItems) return [];
    return data.feeItems.filter((item) => {
      const matchSearch =
        item.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.student_roll_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.student_dept.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "PAID" && item.status === "Paid") ||
        (statusFilter === "PARTIAL" && item.status === "Partially Paid") ||
        (statusFilter === "UNPAID" && item.status === "Unpaid") ||
        (statusFilter === "FAILED" && item.status === "Failed");

      const matchDept = deptFilter === "ALL" || item.student_dept === deptFilter;

      return matchSearch && matchStatus && matchDept;
    });
  }, [data?.feeItems, searchTerm, statusFilter, deptFilter]);

  // Pagination State for 275+ students performance
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, page]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setPage(1);
  };
  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };
  const handleDeptChange = (val: string) => {
    setDeptFilter(val);
    setPage(1);
  };

  // Fee Update Mutation
  const updateFeeMutation = useMutation({
    mutationFn: (payload: {
      student_id: string;
      total_fee?: number;
      course_name?: string;
      due_date?: string;
      reason?: string;
    }) => updateStudentCourseFee({ data: payload }),
    onSuccess: () => {
      toast.success("Course fee record updated and audit log recorded.");
      setIsEditFeeModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-payments-dashboard"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update course fee.");
    },
  });

  const handleOpenEditFee = (item: StudentCourseFeeItem) => {
    setEditFeeStudent(item);
    setEditFeeAmount(item.total_fee.toString());
    setEditCourseName(formatCourseName(item.student_dept, item.course_name));
    setEditDueDate(item.due_date || "");
    setEditReason("");
    setIsEditFeeModalOpen(true);
  };

  // Open Receipt Modal
  const handleOpenReceipt = (student: StudentCourseFeeItem) => {
    const txs = data?.transactions?.filter(
      (t) => t.student_id === student.student_id && t.status === "captured"
    ) || [];
    if (txs.length === 0) {
      toast.info(`No confirmed payments found for ${student.student_name}.`);
      return;
    }
    setSelectedStudentForReceipt(student);
    setSelectedTxForReceipt(txs[0]);
    setIsReceiptModalOpen(true);
  };

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "Paid":
        return (
          <Badge className="bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/25 border-emerald-500/30 gap-1 font-semibold text-xs py-0.5">
            <CheckCircle2 className="size-3 text-emerald-600" /> Paid
          </Badge>
        );
      case "Partially Paid":
        return (
          <Badge className="bg-amber-600/15 text-amber-700 hover:bg-amber-600/25 border-amber-500/30 gap-1 font-semibold text-xs py-0.5">
            <Clock className="size-3 text-amber-600" /> Partially Paid
          </Badge>
        );
      case "Failed":
        return (
          <Badge className="bg-red-600/15 text-red-700 hover:bg-red-600/25 border-red-500/30 gap-1 font-semibold text-xs py-0.5">
            <AlertCircle className="size-3 text-red-600" /> Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground gap-1 font-medium text-xs py-0.5">
            <AlertCircle className="size-3" /> Unpaid
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * { visibility: hidden; }
              #kryptedu-admin-receipt, #kryptedu-admin-receipt * { visibility: visible; }
              #kryptedu-admin-receipt {
                position: fixed;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 24px;
                background: white;
                box-shadow: none;
              }
            }
          `,
        }}
      />

      {/* Header & Tab Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="Administrator Control Hub"
          title="Student Course Fees & Payments"
          className="mb-0"
        />

        <div className="flex items-center gap-2">
          {/* Tab Switcher */}
          <div className="flex rounded-xl bg-secondary/60 p-1 border border-border">
            <button
              onClick={() => setActiveTab("fees")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "fees"
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GraduationCap className="size-3.5" />
              Student Fees & Receipts
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "users"
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="size-3.5" />
              User Roles
            </button>
          </div>

          {activeTab === "fees" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5 rounded-xl text-xs"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {activeTab === "users" ? (
        /* USER ROLES TAB (Clean KRYPTEDU Card Format) */
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Shield className="size-5 text-primary" />
                System User Management
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assign and manage institutional security roles for student, faculty, and administrative accounts.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {users?.length ?? 0} registered accounts
            </Badge>
          </div>

          {isUsersLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              <RefreshCw className="mx-auto size-6 animate-spin text-primary" />
              <p className="mt-2 text-xs">Loading registered users...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-secondary/30 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Email Address</th>
                    <th className="px-4 py-3">Current Role</th>
                    <th className="px-4 py-3 text-right">Assign Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users?.map((u: any) => (
                    <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-foreground">{u.email}</td>
                      <td className="px-4 py-3.5">
                        <Badge
                          variant={u.role === "admin" ? "default" : "outline"}
                          className="capitalize text-xs"
                        >
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            updateRoleMutation.mutate({ userId: u.user_id, newRole: e.target.value })
                          }
                          className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm outline-none focus:ring-1 focus:ring-primary"
                          disabled={updateRoleMutation.isPending}
                        >
                          <option value="admin">Admin</option>
                          <option value="faculty">Faculty</option>
                          <option value="placement">Placement Officer</option>
                          <option value="student">Student</option>
                          <option value="pending">Pending Approval</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {users?.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-xs text-muted-foreground">
                        No user accounts registered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        /* STUDENT FEES & RECEIPTS TAB */
        <>
          {/* Search & Filters */}
          <Card className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search student name, roll number, or department..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 rounded-xl text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
                  <Filter className="size-3.5" /> Status:
                </div>
                {(["ALL", "PAID", "PARTIAL", "UNPAID", "FAILED"] as const).map((st) => (
                  <Button
                    key={st}
                    size="sm"
                    variant={statusFilter === st ? "default" : "outline"}
                    onClick={() => handleStatusChange(st)}
                    className="h-8 rounded-full text-xs font-medium px-3"
                  >
                    {st === "ALL" ? "All Status" : st === "PARTIAL" ? "Partially Paid" : st}
                  </Button>
                ))}

                <select
                  value={deptFilter}
                  onChange={(e) => handleDeptChange(e.target.value)}
                  className="h-8 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground outline-none"
                >
                  <option value="ALL">All Departments</option>
                  {CANONICAL_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Student Fee Ledger Table with requested columns */}
          <Card className="overflow-hidden p-0 shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-secondary/40 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3.5">Student Details</th>
                    <th className="px-4 py-3.5">Department</th>
                    <th className="px-4 py-3.5 text-right">Total Fees</th>
                    <th className="px-4 py-3.5 text-right">Amount Paid</th>
                    <th className="px-4 py-3.5 text-right">Remaining Balance</th>
                    <th className="px-4 py-3.5 text-center">Paid / Not Mark</th>
                    <th className="px-4 py-3.5 text-center">Receipt Section</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        <RefreshCw className="mx-auto size-6 animate-spin text-primary" />
                        <p className="mt-2 text-xs">Loading student course fees ledger...</p>
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        <CreditCard className="mx-auto size-8 text-subtle" />
                        <p className="mt-2 font-medium">No matching student payment records</p>
                        <p className="text-xs text-subtle">Try adjusting your search query or department filter.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((item) => {
                      const studentTxs =
                        data?.transactions?.filter(
                          (t) => t.student_id === item.student_id && t.status === "captured"
                        ) || [];
                      const hasReceipt = studentTxs.length > 0;

                      return (
                        <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                          {/* 1. Student Name & Roll No */}
                          <td className="px-5 py-4">
                            <div className="font-bold text-foreground">{item.student_name}</div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="font-mono font-medium text-primary">{item.student_roll_no}</span>
                              <span>·</span>
                              <span>Year {item.student_year}</span>
                            </div>
                          </td>

                          {/* 2. Department */}
                          <td className="px-4 py-4">
                            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground bg-secondary/50 px-2.5 py-1 rounded-lg border border-border">
                              <Building2 className="size-3 text-primary shrink-0" />
                              {item.student_dept}
                            </div>
                          </td>

                          {/* 3. Total Fees */}
                          <td className="px-4 py-4 text-right font-semibold text-foreground">
                            {formatINR(item.total_fee)}
                          </td>

                          {/* 4. Total Amount Paid (How much paid) */}
                          <td className="px-4 py-4 text-right font-bold text-emerald-700">
                            {formatINR(item.amount_paid)}
                          </td>

                          {/* 5. Remaining Balance */}
                          <td className="px-4 py-4 text-right font-semibold">
                            <span
                              className={item.remaining_balance > 0 ? "text-amber-700" : "text-muted-foreground"}
                            >
                              {formatINR(item.remaining_balance)}
                            </span>
                          </td>

                          {/* 6. Paid or Not Mark */}
                          <td className="px-4 py-4 text-center">
                            {getStatusBadge(item.status)}
                          </td>

                          {/* 7. Receipt Section */}
                          <td className="px-4 py-4 text-center">
                            {hasReceipt ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenReceipt(item)}
                                className="h-8 gap-1.5 rounded-xl text-xs font-semibold border-emerald-500/30 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100"
                              >
                                <Printer className="size-3.5 text-emerald-700" />
                                View Receipt {studentTxs.length > 1 ? `(${studentTxs.length})` : ""}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                No receipt (Unpaid)
                              </span>
                            )}
                          </td>

                          {/* 8. Admin Actions */}
                          <td className="px-5 py-4 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEditFee(item)}
                              className="h-8 gap-1 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Edit2 className="size-3.5" />
                              Adjust Fee
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between border-t bg-secondary/20 px-5 py-3 text-xs gap-2">
                <span className="text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredStudents.length)} of{" "}
                  {filteredStudents.length} students
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-7 px-2.5 rounded-lg text-xs"
                  >
                    Previous
                  </Button>
                  <span className="font-semibold text-foreground px-1">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-7 px-2.5 rounded-lg text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Fee Audit Trail */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="size-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Recent Fee Adjustments & Audit Trail</h3>
              </div>
              <span className="text-xs text-muted-foreground">Immutable administrative change logs</span>
            </div>

            {data?.auditLogs && data.auditLogs.length > 0 ? (
              <div className="divide-y border rounded-xl overflow-hidden text-xs">
                {data.auditLogs.slice(0, 10).map((log) => {
                  const oldFeeDisplay = log.old_fee ?? (log as any).old_total_fee;
                  const newFeeDisplay = log.new_fee ?? (log as any).new_total_fee;
                  const adminLabel = log.changed_by
                    ? log.changed_by.includes("@")
                      ? log.changed_by
                      : `${log.changed_by.slice(0, 8)}...`
                    : "Administrator";

                  return (
                    <div
                      key={log.id}
                      className="p-3 flex items-center justify-between bg-secondary/10 hover:bg-secondary/20 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>{log.student_name || "Student"}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            ({log.student_roll_no || log.student_id})
                          </span>
                        </div>
                        <div className="text-muted-foreground">
                          Fee adjusted from {formatINR(oldFeeDisplay ?? 175000)} →{" "}
                          <span className="font-semibold text-primary">{formatINR(newFeeDisplay ?? 175000)}</span>
                        </div>
                        {log.reason && (
                          <div className="text-subtle italic mt-0.5 text-[11px]">Reason: "{log.reason}"</div>
                        )}
                      </div>
                      <div className="text-right text-[11px] text-subtle space-y-0.5">
                        <div className="font-medium text-foreground">Admin: {adminLabel}</div>
                        <div>{new Date(log.created_at).toLocaleString("en-IN")}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No fee adjustments recorded yet.
              </div>
            )}
          </Card>
        </>
      )}

      {/* Official Printable Receipt Dialog for Admin */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="sm:max-w-xl rounded-2xl p-0 overflow-hidden">
          <div id="kryptedu-admin-receipt" className="p-6 bg-white text-slate-900 space-y-4">
            <div className="border-b pb-4 text-center">
              <div className="text-2xl font-black tracking-wider text-emerald-700">KRYPTEDU</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                Smart Campus Analytics · Institutional Fee Receipt
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="size-4 text-emerald-600" />
                OFFICIAL PAYMENT RECEIPT
              </div>
            </div>

            {selectedStudentForReceipt && selectedTxForReceipt && (
              <div className="space-y-4 text-xs">
                {/* Transaction Selector if student made multiple payments */}
                {(() => {
                  const studentTxs =
                    data?.transactions?.filter(
                      (t) => t.student_id === selectedStudentForReceipt.student_id && t.status === "captured"
                    ) || [];
                  if (studentTxs.length <= 1) return null;

                  return (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                      <span className="font-semibold text-slate-700">Select Payment Transaction:</span>
                      <select
                        value={selectedTxForReceipt.id}
                        onChange={(e) => {
                          const tx = studentTxs.find((t) => t.id === e.target.value);
                          if (tx) setSelectedTxForReceipt(tx);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none"
                      >
                        {studentTxs.map((tx, idx) => (
                          <option key={tx.id} value={tx.id}>
                            Payment #{studentTxs.length - idx}: {formatINR(tx.amount)} (
                            {new Date(tx.created_at).toLocaleDateString("en-IN")})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Receipt Number:</span>
                    <strong className="font-mono text-slate-800 text-xs">
                      {selectedTxForReceipt.receipt_number || "KRYPT-REC-OFFICIAL"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Payment Date & Time:</span>
                    <strong className="text-slate-800">
                      {new Date(selectedTxForReceipt.created_at).toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Razorpay Payment ID:</span>
                    <strong className="font-mono text-slate-800 text-[11px] truncate block">
                      {selectedTxForReceipt.razorpay_payment_id || "N/A"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Razorpay Order ID:</span>
                    <strong className="font-mono text-slate-800 text-[11px] truncate block">
                      {selectedTxForReceipt.razorpay_order_id}
                    </strong>
                  </div>
                </div>

                {/* Student Details */}
                <div className="border rounded-xl p-3.5 space-y-1.5 bg-slate-50/50">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Student Name:</span>
                    <strong className="text-slate-900">{selectedStudentForReceipt.student_name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Student Roll No:</span>
                    <strong className="font-mono text-slate-900">{selectedStudentForReceipt.student_roll_no}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Department:</span>
                    <strong className="text-slate-800">{selectedStudentForReceipt.student_dept}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Academic Year:</span>
                    <span className="text-slate-800">Year {selectedStudentForReceipt.student_year}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Course Enrolled:</span>
                    <span className="text-slate-800">{selectedStudentForReceipt.course_name}</span>
                  </div>
                </div>

                {/* Amount Paid Breakdown */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-slate-700">Amount Paid This Transaction:</span>
                    <strong className="text-2xl font-black text-emerald-800">
                      {formatINR(selectedTxForReceipt.amount)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center border-t border-emerald-200 pt-2 text-xs">
                    <span className="text-slate-600">Total Course Fee:</span>
                    <strong className="font-bold text-slate-800">
                      {formatINR(selectedStudentForReceipt.total_fee)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600">Total Cumulative Paid:</span>
                    <strong className="font-bold text-emerald-700">
                      {formatINR(selectedStudentForReceipt.amount_paid)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center border-t border-emerald-200 pt-2 text-xs">
                    <span className="text-slate-600">Remaining Balance:</span>
                    <strong
                      className={`font-bold ${
                        selectedStudentForReceipt.remaining_balance > 0 ? "text-amber-800" : "text-slate-800"
                      }`}
                    >
                      {formatINR(selectedStudentForReceipt.remaining_balance)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600">Current Payment Status:</span>
                    <strong className="font-bold text-emerald-700">{selectedStudentForReceipt.status}</strong>
                  </div>
                </div>

                <div className="text-[10px] text-center text-slate-400 pt-2 border-t">
                  Institutional Electronic Receipt verified through Razorpay & Supabase RLS. No physical signature required.
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t bg-slate-50 p-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReceiptModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="gap-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Printer className="size-3.5" />
              Print Receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fee Adjustment Modal */}
      <Dialog open={isEditFeeModalOpen} onOpenChange={setIsEditFeeModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="size-5 text-primary" />
              Adjust Student Course Fee
            </DialogTitle>
            <DialogDescription>
              Modify fee record for {editFeeStudent?.student_name} ({editFeeStudent?.student_roll_no}). All modifications are recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>

          {editFeeStudent && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-secondary/30 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Department:</span>
                  <span className="font-semibold text-foreground">{editFeeStudent.student_dept}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Total Fee:</span>
                  <span className="font-semibold text-foreground">
                    {formatINR(editFeeStudent.total_fee)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Already Paid:</span>
                  <span className="font-semibold text-emerald-700">
                    {formatINR(editFeeStudent.amount_paid)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Course Name</label>
                <Input
                  value={editCourseName}
                  onChange={(e) => setEditCourseName(e.target.value)}
                  className="rounded-xl text-xs"
                  placeholder="Course name"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Total Fee (₹ INR)</label>
                <Input
                  type="number"
                  value={editFeeAmount}
                  onChange={(e) => setEditFeeAmount(e.target.value)}
                  className="rounded-xl text-xs"
                  placeholder="175000"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Due Date</label>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Reason for Adjustment <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g., Merit scholarship applied, semester fee concession..."
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsEditFeeModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editFeeStudent) return;
                const feeNum = parseFloat(editFeeAmount);
                if (isNaN(feeNum) || feeNum < 0) {
                  toast.error("Please enter a valid non-negative fee amount.");
                  return;
                }
                if (!editReason.trim()) {
                  toast.error("Please provide a reason for the fee adjustment audit log.");
                  return;
                }
                updateFeeMutation.mutate({
                  student_id: editFeeStudent.student_id,
                  total_fee: feeNum,
                  course_name: editCourseName,
                  due_date: editDueDate || undefined,
                  reason: editReason,
                });
              }}
              disabled={updateFeeMutation.isPending}
              className="rounded-xl text-xs font-semibold"
            >
              {updateFeeMutation.isPending ? "Recording Audit..." : "Save & Audit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
