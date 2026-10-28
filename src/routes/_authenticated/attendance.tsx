import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useDeferredValue } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarCheck,
  Calendar,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Search,
  Send,
  Check,
  AlertTriangle,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
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

import {
  getAttendanceDashboardData,
  markAttendanceDraft,
  markBatchAttendanceDraft,
  submitAttendanceSession,
} from "@/lib/attendance.functions";
import {
  CANONICAL_DEPARTMENTS,
  type AttendanceStatus,
  calculateAttendanceSummary,
  isWeekend,
} from "@/lib/attendance";
import type { CanonicalDepartment } from "@/lib/departments";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Live Attendance Management — KRYPTEDU" },
      { name: "description", content: "Department-wise student attendance management system." },
      { property: "og:title", content: "Live Attendance Management — KRYPTEDU" },
      { property: "og:description", content: "Department-wise student attendance management system." },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const queryClient = useQueryClient();
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Filter & Selection State
  const [selectedDept, setSelectedDept] = useState<CanonicalDepartment>("Computer Engineering");
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [searchInput, setSearchInput] = useState<string>("");
  const deferredSearch = useDeferredValue(searchInput);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Local draft marks state (student_id -> status)
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // 1. Query Attendance Dashboard Data
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["attendance-dashboard", selectedDept, selectedDate],
    queryFn: () =>
      getAttendanceDashboardData({
        data: {
          department: selectedDept,
          date: selectedDate,
        },
      }),
    staleTime: 30_000,
  });

  const role = data?.role || "faculty";
  const isStudent = role === "student";
  const isWeekendSelected = isWeekend(selectedDate);
  const canEdit = !isWeekendSelected && (data?.canEdit ?? (!isStudent && role !== "placement"));
  const canSubmit = canEdit && (data?.canSubmit ?? true);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Synchronize query records into local marks on date/dept change
  useEffect(() => {
    if (data?.students) {
      const initial: Record<string, AttendanceStatus> = {};
      data.students.forEach((s: any) => {
        if (s.status) initial[s.student_id] = s.status;
      });
      setMarks(initial);
      setPage(1);
    }
  }, [data?.students, selectedDept, selectedDate]);

  // 2. Mutations
  const markSingleMutation = useMutation({
    mutationFn: (payload: { student_id: string; status: AttendanceStatus }) =>
      markAttendanceDraft({
        data: {
          department: selectedDept,
          date: selectedDate,
          student_id: payload.student_id,
          status: payload.status,
        },
      }),
    onMutate: () => {
      setSaveStatus("saving");
    },
    onSuccess: () => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
      if (data?.session?.status === "published") {
        queryClient.invalidateQueries({ queryKey: ["students"] });
        queryClient.invalidateQueries({ queryKey: ["interventions"] });
        queryClient.invalidateQueries({ queryKey: ["student-profile"] });
        queryClient.invalidateQueries({ queryKey: ["student-attendance-history"] });
        queryClient.invalidateQueries({ queryKey: ["student-attendance-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["reports"] });
      }
    },
    onError: (err: any) => {
      setSaveStatus("error");
      toast.error(err.message || "Failed to save draft mark.");
    },
  });

  const markBatchMutation = useMutation({
    mutationFn: (payload: { status: AttendanceStatus; student_ids: string[] }) =>
      markBatchAttendanceDraft({
        data: {
          department: selectedDept,
          date: selectedDate,
          status: payload.status,
          student_ids: payload.student_ids,
        },
      }),
    onMutate: () => {
      setSaveStatus("saving");
    },
    onSuccess: (res) => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
      toast.success(`Marked ${res.count} students as ${res.status}.`);
      queryClient.invalidateQueries({
        queryKey: ["attendance-dashboard", selectedDept, selectedDate],
      });
      if (data?.session?.status === "published") {
        queryClient.invalidateQueries({ queryKey: ["students"] });
        queryClient.invalidateQueries({ queryKey: ["interventions"] });
        queryClient.invalidateQueries({ queryKey: ["student-profile"] });
        queryClient.invalidateQueries({ queryKey: ["student-attendance-history"] });
        queryClient.invalidateQueries({ queryKey: ["student-attendance-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["reports"] });
      }
    },
    onError: (err: any) => {
      setSaveStatus("error");
      toast.error(err.message || "Batch update failed.");
    },
  });

  const submitSessionMutation = useMutation({
    mutationFn: () => {
      if (!data?.students) throw new Error("No students loaded");
      const recordPayload = data.students.map((s: any) => ({
        student_id: s.student_id,
        status: marks[s.student_id] || s.status,
      }));
      return submitAttendanceSession({
        data: {
          department: selectedDept,
          date: selectedDate,
          records: recordPayload,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(res.message);
      setIsSubmitModalOpen(false);
      queryClient.invalidateQueries({
        queryKey: ["attendance-dashboard", selectedDept, selectedDate],
      });
      // Invalidate all dependent module queries across KRYPTEDU
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["student-profile"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Submission failed.");
    },
  });

  // Handler for marking single student
  const handleMark = (studentId: string, status: AttendanceStatus) => {
    if (!canEdit) return;
    setMarks((prev) => ({ ...prev, [studentId]: status }));
    markSingleMutation.mutate({ student_id: studentId, status });
  };

  // Handler for "Mark All Unmarked as Present"
  const handleMarkAllUnmarkedPresent = () => {
    if (!data?.students || !canEdit) return;
    const unmarkedIds = data.students
      .filter((s: any) => !marks[s.student_id])
      .map((s: any) => s.student_id);

    if (unmarkedIds.length === 0) {
      toast.info("All students already have a marked status.");
      return;
    }

    const updated = { ...marks };
    unmarkedIds.forEach((id: string) => {
      updated[id] = "present";
    });
    setMarks(updated);

    markBatchMutation.mutate({
      status: "present",
      student_ids: unmarkedIds,
    });
  };

  // Live Summary calculation based on current marks
  const liveSummary = useMemo(() => {
    if (!data?.students) return null;
    const records = data.students.map((s: any) => ({
      status: marks[s.student_id] || s.status || null,
    }));
    return calculateAttendanceSummary(data.students.length, records, {
      isPublished: data.session?.status === "published",
      isSample: data.session?.is_sample || false,
      sessionDate: selectedDate,
      department: selectedDept,
    });
  }, [data?.students, marks, data?.session, selectedDate, selectedDept]);

  // Filtered Students Table for Faculty/Admin
  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];
    return data.students.filter((s: any) => {
      const q = deferredSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        s.student_name.toLowerCase().includes(q) ||
        s.student_roll_no.toLowerCase().includes(q);

      const curStatus = marks[s.student_id] || s.status;
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "PRESENT" && curStatus === "present") ||
        (statusFilter === "ABSENT" && curStatus === "absent") ||
        (statusFilter === "NOT_CONSIDERED" && curStatus === "not_considered") ||
        (statusFilter === "UNMARKED" && !curStatus);

      return matchSearch && matchStatus;
    });
  }, [data?.students, deferredSearch, statusFilter, marks]);

  const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, page]);

  // Count unmarked students for submission validation
  const unmarkedCount = useMemo(() => {
    if (!data?.students) return 0;
    return data.students.filter((s: any) => !marks[s.student_id] && !s.status).length;
  }, [data?.students, marks]);

  // --------------------------------------------------------------------------
  // SKELETON LOADER
  // --------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="space-y-6 pb-12 animate-pulse">
        <div className="h-10 w-64 rounded-2xl bg-secondary/70" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-card border shadow-xs" />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-card border shadow-xs" />
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: STUDENT VIEW
  // --------------------------------------------------------------------------
  if (isStudent) {
    return <StudentAttendanceView data={data} />;
  }

  // --------------------------------------------------------------------------
  // RENDER: FACULTY, ADMIN & PLACEMENT VIEW
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow={canEdit ? "Faculty Attendance Portal" : "Campus Attendance Review"}
          title="Department-Wise Attendance"
          description={
            canEdit
              ? "Mark live cohort attendance, record draft changes, and publish official records."
              : "Read-only institutional published attendance summaries and records."
          }
        />

        {/* Submit Attendance & Saving Status */}
        {canEdit && (
          <div className="flex items-center gap-3">
            {/* Live Database Saving State Indicator */}
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl font-medium shadow-xs">
                <Loader2 className="size-3.5 animate-spin text-amber-600" />
                Saving draft...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-medium shadow-xs">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                Draft saved to database
              </span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl font-medium shadow-xs">
                <AlertTriangle className="size-3.5 text-rose-600" />
                Error saving draft
              </span>
            )}

            <Button
              onClick={() => setIsSubmitModalOpen(true)}
              disabled={isWeekendSelected}
              className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 shadow-sm transition-transform active:scale-95"
            >
              <Send className="size-3.5" />
              Submit Attendance
            </Button>
          </div>
        )}
      </div>

      {/* Weekend Alert */}
      {isWeekendSelected && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-900 shadow-xs">
          <AlertTriangle className="size-5 shrink-0 text-amber-600" />
          <div>
            <strong>Institutional Holiday (Weekend):</strong> Saturdays and Sundays are non-instructional holidays. Attendance sessions are neither scheduled nor recorded for weekends. Please select an eligible weekday (Monday to Friday).
          </div>
        </div>
      )}

      {/* Selectors and Control Bar */}
      <div className="card-surface rounded-2xl border p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Department Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Building2 className="size-3.5 text-primary" />
              Department
            </label>
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value as CanonicalDepartment);
                setSearchInput("");
                setPage(1);
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {CANONICAL_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Calendar className="size-3.5 text-primary" />
              Attendance Date
            </label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPage(1);
              }}
              className="rounded-xl text-xs"
            />
          </div>

          {/* Session Status Indicator */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary" />
              Session Status
            </label>
            <div className="flex h-9 items-center px-3 rounded-xl border border-border bg-secondary/30">
              {data?.session?.status === "published" ? (
                <Badge className="bg-emerald-600/15 text-emerald-700 border-emerald-500/30 gap-1 font-semibold text-[11px]">
                  <CheckCircle2 className="size-3" /> Published
                </Badge>
              ) : (
                <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 gap-1 font-semibold text-[11px]">
                  <Clock className="size-3" /> Draft / Unsaved
                </Badge>
              )}
            </div>
          </div>

          {/* Quick Action Button for Faculty & Admin */}
          {canEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Quick Action
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllUnmarkedPresent}
                disabled={markBatchMutation.isPending || unmarkedCount === 0}
                className="w-full h-9 rounded-xl text-xs font-medium gap-1.5 text-slate-700"
              >
                <Check className="size-3 text-emerald-600" />
                {unmarkedCount > 0
                  ? `Mark ${unmarkedCount} Unmarked as Present`
                  : "All Marked"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:gap-4">
        <Card className="rounded-2xl p-4 border shadow-sm">
          <div className="flex items-center justify-between text-xs text-subtle">
            <span>Total Students</span>
            <Users className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {liveSummary?.totalStudents || 0}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{selectedDept}</div>
        </Card>

        <Card className="rounded-2xl p-4 border shadow-sm">
          <div className="flex items-center justify-between text-xs text-subtle">
            <span>Present</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">
            {liveSummary?.presentCount || 0}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {liveSummary && liveSummary.totalStudents > 0
              ? `${Math.round((liveSummary.presentCount / liveSummary.totalStudents) * 100)}% of cohort`
              : "0%"}
          </div>
        </Card>

        <Card className="rounded-2xl p-4 border shadow-sm">
          <div className="flex items-center justify-between text-xs text-subtle">
            <span>Absent</span>
            <XCircle className="size-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-rose-700">
            {liveSummary?.absentCount || 0}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {liveSummary && liveSummary.totalStudents > 0
              ? `${Math.round((liveSummary.absentCount / liveSummary.totalStudents) * 100)}% of cohort`
              : "0%"}
          </div>
        </Card>

        <Card className="rounded-2xl p-4 border shadow-sm">
          <div className="flex items-center justify-between text-xs text-subtle">
            <span>Not Considered</span>
            <MinusCircle className="size-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-700">
            {liveSummary?.notConsideredCount || 0}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Excluded from %</div>
        </Card>

        <Card className="rounded-2xl p-4 border shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-subtle">
            <span>Attendance Rate</span>
            <CalendarCheck className="size-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {liveSummary?.attendancePercentage !== null && liveSummary?.attendancePercentage !== undefined
              ? `${liveSummary.attendancePercentage}%`
              : "N/A"}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Present ÷ (P + A)
          </div>
        </Card>
      </div>

      {/* Student Attendance Table Section */}
      <div className="card-surface rounded-2xl border overflow-hidden shadow-sm space-y-3 p-4">
        {/* Table Filters & Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 size-4 text-subtle" />
            <Input
              placeholder="Search by student name or roll no..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              className="pl-9 rounded-xl text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs text-foreground shadow-sm focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present Only</option>
              <option value="ABSENT">Absent Only</option>
              <option value="NOT_CONSIDERED">Not Considered</option>
              <option value="UNMARKED">Unmarked Only</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-secondary/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Roll No</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3 text-center">Attendance Marking</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-subtle">
                    No students found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s: any) => {
                  const currentStatus = marks[s.student_id] || s.status;

                  return (
                    <tr key={s.student_id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-foreground">
                        {s.student_roll_no}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {s.student_name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.student_dept}
                      </td>

                      {/* Interactive Attendance Marking Buttons */}
                      <td className="px-4 py-2.5 text-center">
                        {canEdit ? (
                          <div className="inline-flex rounded-xl border border-border p-1 bg-secondary/30 gap-1.5 shadow-xs">
                            <button
                              type="button"
                              onClick={() => handleMark(s.student_id, "present")}
                              title="Mark Present"
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                currentStatus === "present"
                                  ? "bg-emerald-600 text-white shadow-sm font-semibold scale-105"
                                  : "text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700"
                              }`}
                            >
                              <CheckCircle2 className="size-3.5" /> Present
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMark(s.student_id, "absent")}
                              title="Mark Absent"
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                currentStatus === "absent"
                                  ? "bg-rose-600 text-white shadow-sm font-semibold scale-105"
                                  : "text-muted-foreground hover:bg-rose-50 hover:text-rose-700"
                              }`}
                            >
                              <XCircle className="size-3.5" /> Absent
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMark(s.student_id, "not_considered")}
                              title="Mark Not Considered"
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                currentStatus === "not_considered"
                                  ? "bg-slate-700 text-white shadow-sm font-semibold scale-105"
                                  : "text-muted-foreground hover:bg-slate-100 hover:text-slate-800"
                              }`}
                            >
                              <MinusCircle className="size-3.5" /> Not Considered
                            </button>
                          </div>
                        ) : (
                          // Read-only indicator for Student / Placement
                          <div className="text-xs text-muted-foreground">
                            {currentStatus === "present" && (
                              <Badge className="bg-emerald-600/15 text-emerald-700 border-emerald-500/30 gap-1 font-medium">
                                <CheckCircle2 className="size-3" /> Present
                              </Badge>
                            )}
                            {currentStatus === "absent" && (
                              <Badge className="bg-rose-600/15 text-rose-700 border-rose-500/30 gap-1 font-medium">
                                <XCircle className="size-3" /> Absent
                              </Badge>
                            )}
                            {currentStatus === "not_considered" && (
                              <Badge className="bg-slate-500/15 text-slate-700 border-slate-400/30 gap-1 font-medium">
                                <MinusCircle className="size-3" /> Not Considered
                              </Badge>
                            )}
                            {!currentStatus && (
                              <Badge variant="outline" className="text-subtle">
                                Unmarked
                              </Badge>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {currentStatus === "present" && (
                          <Badge className="bg-emerald-600/15 text-emerald-700 border-emerald-500/30 gap-1 font-medium text-[11px]">
                            <CheckCircle2 className="size-3" /> Present
                          </Badge>
                        )}
                        {currentStatus === "absent" && (
                          <Badge className="bg-rose-600/15 text-rose-700 border-rose-500/30 gap-1 font-medium text-[11px]">
                            <XCircle className="size-3" /> Absent
                          </Badge>
                        )}
                        {currentStatus === "not_considered" && (
                          <Badge className="bg-slate-500/15 text-slate-700 border-slate-400/30 gap-1 font-medium text-[11px]">
                            <MinusCircle className="size-3" /> Not Considered
                          </Badge>
                        )}
                        {!currentStatus && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1 text-[11px]">
                            <Clock className="size-3" /> Pending Mark
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span>
            Showing {filteredStudents.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0} to{" "}
            {Math.min(page * PAGE_SIZE, filteredStudents.length)} of {filteredStudents.length} students
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 rounded-lg text-xs gap-1"
            >
              <ChevronLeft className="size-3" /> Previous
            </Button>
            <span className="font-medium text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 rounded-lg text-xs gap-1"
            >
              Next <ChevronRight className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal (Faculty Only) */}
      <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <CalendarCheck className="size-5 text-emerald-600" />
              Confirm Attendance Submission
            </DialogTitle>
            <DialogDescription className="text-xs text-subtle">
              Review session summary prior to official publication. Published attendance will become immediately visible to authorized students, administrators, and placement officers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {unmarkedCount > 0 ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-rose-800 space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="size-4 text-rose-600" />
                  Incomplete Attendance ({unmarkedCount} Unmarked)
                </div>
                <p className="text-[11px] leading-relaxed">
                  All students in {selectedDept} must have a status. Please mark remaining students Present, Absent, or Not Considered before publishing.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-800 space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  All {data?.students?.length || 0} Students Marked
                </div>
                <p className="text-[11px] leading-relaxed">
                  Ready for publication. Atomically saves all records and publishes the session.
                </p>
              </div>
            )}

            <div className="rounded-xl bg-secondary/30 p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department:</span>
                <strong className="text-foreground">{selectedDept}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Attendance Date:</span>
                <strong className="text-foreground">{selectedDate}</strong>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Present Count:</span>
                <span className="font-bold text-emerald-700">{liveSummary?.presentCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Absent Count:</span>
                <span className="font-bold text-rose-700">{liveSummary?.absentCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Not Considered:</span>
                <span className="font-bold text-slate-700">{liveSummary?.notConsideredCount || 0}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold text-foreground">Attendance Percentage:</span>
                <strong className="text-sm font-black text-emerald-800">
                  {liveSummary?.attendancePercentage !== null ? `${liveSummary?.attendancePercentage}%` : "N/A"}
                </strong>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSubmitModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={unmarkedCount > 0 || submitSessionMutation.isPending}
              onClick={() => submitSessionMutation.mutate()}
              className="gap-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitSessionMutation.isPending ? "Publishing..." : "Confirm & Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --------------------------------------------------------------------------
// STUDENT-SPECIFIC ATTENDANCE DASHBOARD COMPONENT
// --------------------------------------------------------------------------
function StudentAttendanceView({ data }: { data: any }) {
  const [selectedMonth, setSelectedMonth] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const PAGE_SIZE = 15;

  if (!data?.isLinked || !data?.student) {
    return (
      <div className="space-y-6 pb-12">
        <PageHeader
          eyebrow="Student Portal"
          title="My Attendance Record"
          description="Official published attendance records and institutional compliance."
        />
        <Card className="rounded-2xl border-amber-500/20 bg-amber-500/5 p-8 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
            <AlertTriangle className="size-7" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Student Profile Not Linked</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
            {data?.error ||
              "Your authenticated student account is not yet linked to an institutional student profile. Please contact an authorised campus administrator to link your profile."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild variant="secondary" className="rounded-xl border">
              <Link to="/student-dashboard">Return to Student Dashboard</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const student = data.student;
  const overall = data.overall;
  const rawRecords = data.records || [];
  const monthlyStats = data.monthly || [];

  // Filter records based on month, status, and date range
  const filteredRecords = useMemo(() => {
    return rawRecords.filter((r: any) => {
      // Month filter (YYYY-MM)
      if (selectedMonth !== "ALL") {
        if (!r.attendance_date.startsWith(selectedMonth)) return false;
      }
      // Status filter
      if (selectedStatus !== "ALL") {
        if (r.status !== selectedStatus) return false;
      }
      // Date range filter
      if (startDate && r.attendance_date < startDate) return false;
      if (endDate && r.attendance_date > endDate) return false;

      return true;
    });
  }, [rawRecords, selectedMonth, selectedStatus, startDate, endDate]);

  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, page]);

  const hasActiveFilters =
    selectedMonth !== "ALL" || selectedStatus !== "ALL" || startDate !== "" || endDate !== "";

  const handleClearFilters = () => {
    setSelectedMonth("ALL");
    setSelectedStatus("ALL");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const isSatisfactory =
    overall?.overallAttendancePercentage !== null &&
    overall?.overallAttendancePercentage !== undefined &&
    overall.overallAttendancePercentage >= 75;

  return (
    <div className="space-y-6 pb-12">
      {/* Student Identity Card */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary-deep">
                Official Student Attendance Profile
              </span>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-[10px] font-semibold"
              >
                Semester 1 · Active
              </Badge>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {student.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">PRN / Roll No: {student.roll_no}</span>
              <span>•</span>
              <span>{student.department}</span>
              <span>•</span>
              <span className="text-primary font-medium">{student.course}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm" className="rounded-xl border text-xs">
              <Link to="/student-dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Primary Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        {/* Overall Percentage */}
        <Card className="rounded-2xl p-4 border shadow-sm">
          <div className="flex items-center justify-between text-xs text-subtle">
            <span className="font-medium">Overall Attendance</span>
            <CalendarCheck className={`size-4 ${isSatisfactory ? "text-emerald-600" : "text-amber-600"}`} />
          </div>
          <div className={`mt-2 text-2xl font-bold tracking-tight ${isSatisfactory ? "text-emerald-700" : "text-amber-700"}`}>
            {overall?.overallAttendancePercentage !== null && overall?.overallAttendancePercentage !== undefined
              ? `${overall.overallAttendancePercentage}%`
              : "N/A"}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Formula: Present ÷ (Present + Absent) × 100</span>
          </div>
        </Card>

        {/* Total Eligible Sessions */}
        <Card className="rounded-2xl p-4 border shadow-sm">
          <div className="flex items-center justify-between text-xs text-subtle">
            <span className="font-medium">Eligible Sessions</span>
            <Calendar className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {overall?.totalEligibleSessions || 0}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {overall?.totalPublishedSessions || 0} total published sessions
          </div>
        </Card>

        {/* Present Sessions */}
        <Card className="rounded-2xl p-4 border shadow-sm">
          <div className="flex items-center justify-between text-xs text-subtle">
            <span className="font-medium">Sessions Present</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">
            {overall?.presentCount || 0}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Attended lectures & practicals
          </div>
        </Card>

        {/* Absent Sessions */}
        <Card className="rounded-2xl p-4 border shadow-sm">
          <div className="flex items-center justify-between text-xs text-subtle">
            <span className="font-medium">Sessions Absent</span>
            <XCircle className="size-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-rose-700">
            {overall?.absentCount || 0}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {overall?.notConsideredCount || 0} Not Considered (excluded)
          </div>
        </Card>
      </div>

      {/* Monthly Attendance Timeline Cards */}
      {monthlyStats.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Monthly Attendance Breakdown</h3>
            <span className="text-xs text-muted-foreground">Threshold: 75% minimum</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {monthlyStats.map((m: any) => {
              const meetsThreshold = m.percentage !== null && m.percentage >= 75;
              return (
                <Card key={m.monthKey} className="rounded-2xl border p-4 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">{m.month}</span>
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold ${
                        meetsThreshold
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-700"
                      }`}
                    >
                      {m.percentage !== null ? `${m.percentage}%` : "N/A"}
                    </Badge>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        meetsThreshold ? "bg-emerald-600" : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.min(100, m.percentage || 0)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>
                      <strong className="text-emerald-700 font-medium">{m.presentCount}</strong> Present
                    </span>
                    <span>
                      <strong className="text-rose-700 font-medium">{m.absentCount}</strong> Absent
                    </span>
                    <span>
                      <strong className="text-muted-foreground font-medium">{m.notConsideredCount}</strong> N/C
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Attendance History Table Card with Filters */}
      <div className="card-surface rounded-2xl border overflow-hidden shadow-sm">
        {/* Table Header & Controls */}
        <div className="border-b px-5 py-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Attendance History Records</h3>
              <p className="text-xs text-subtle">
                Showing official published records for {student.name}. Sorted newest first.
              </p>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-xs text-muted-foreground hover:text-foreground h-8"
              >
                Clear all filters
              </Button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {/* Quick Month Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-muted-foreground font-medium mr-1 text-[11px]">Month:</span>
              <button
                type="button"
                onClick={() => { setSelectedMonth("ALL"); setPage(1); }}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedMonth === "ALL"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              {monthlyStats.map((m: any) => (
                <button
                  key={m.monthKey}
                  type="button"
                  onClick={() => { setSelectedMonth(m.monthKey); setPage(1); }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedMonth === m.monthKey
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m.month}
                </button>
              ))}
            </div>

            {/* Quick Status Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-muted-foreground font-medium mr-1 text-[11px]">Status:</span>
              {[
                { id: "ALL", label: "All" },
                { id: "present", label: "Present" },
                { id: "absent", label: "Absent" },
                { id: "not_considered", label: "Not Considered" },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSelectedStatus(s.id); setPage(1); }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedStatus === s.id
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-2 text-xs ml-auto">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-[11px]">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="h-8 rounded-lg border border-border bg-card px-2 text-xs"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-[11px]">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="h-8 rounded-lg border border-border bg-card px-2 text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-secondary/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Department</th>
                <th className="px-6 py-3.5">Session / Subject</th>
                <th className="px-6 py-3.5 text-right">Attendance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-xs text-subtle">
                    {hasActiveFilters
                      ? "No attendance records match the selected filters."
                      : "No published attendance sessions found."}
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r: any) => {
                  const dateObj = new Date(r.attendance_date + "T00:00:00");
                  const formattedDate = dateObj.toLocaleDateString("en-US", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });

                  return (
                    <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                        {formattedDate}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {r.student_dept}
                      </td>
                      <td className="px-6 py-4 text-foreground">
                        <span className="font-medium text-xs">Lecture & Practical Session</span>
                        <span className="block text-[11px] text-muted-foreground mt-0.5">{student.course}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {r.status === "present" && (
                          <Badge className="bg-emerald-600/15 text-emerald-700 border-emerald-500/30 gap-1 font-medium text-xs">
                            <CheckCircle2 className="size-3" /> Present
                          </Badge>
                        )}
                        {r.status === "absent" && (
                          <Badge className="bg-rose-600/15 text-rose-700 border-rose-500/30 gap-1 font-medium text-xs">
                            <XCircle className="size-3" /> Absent
                          </Badge>
                        )}
                        {r.status === "not_considered" && (
                          <Badge className="bg-slate-500/15 text-slate-700 border-slate-400/30 gap-1 font-medium text-xs">
                            <MinusCircle className="size-3" /> Not Considered
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredRecords.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t px-5 py-3.5 text-xs text-muted-foreground sm:flex-row">
            <div>
              Showing <span className="font-semibold text-foreground">{(page - 1) * PAGE_SIZE + 1}</span> to{" "}
              <span className="font-semibold text-foreground">
                {Math.min(page * PAGE_SIZE, filteredRecords.length)}
              </span>{" "}
              of <span className="font-semibold text-foreground">{filteredRecords.length}</span> published records
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 gap-1 rounded-lg text-xs"
              >
                <ChevronLeft className="size-3.5" /> Previous
              </Button>
              <span className="text-xs font-medium px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 gap-1 rounded-lg text-xs"
              >
                Next <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
