import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useDeferredValue } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  GraduationCap,
  BookOpen,
  Award,
  Calendar,
  User,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Download,
  Filter,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Send,
  HelpCircle,
  BarChart3,
  Layers,
  History,
  Building2,
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
  getAcademicsData,
  saveMarksDraft,
  publishSubjectResults,
  manageSubjectResource,
  manageSubjectAssignment,
} from "@/lib/academics.functions";
import {
  SEMESTER_CONFIGS,
  OFFICIAL_GRADE_SCALE,
  validateMarksInput,
  computeSubjectMarks,
  calculateStudentCGPA,
  getSubjectsForDepartment,
  generateDemoResultsForOfficialStudents,
  type AcademicSemester,
  type Subject,
  type SubjectResource,
  type SubjectAssignment,
  type StudentSubjectResult,
} from "@/lib/academics";

export const Route = createFileRoute("/_authenticated/academics")({
  head: () => ({
    meta: [
      { title: "Academics & Semester Curriculum — KRYPTEDU" },
      { name: "description", content: "Official B.Tech CSE semester subjects, faculty mappings, resources, assignments, and results." },
      { property: "og:title", content: "Academics & Semester Curriculum — KRYPTEDU" },
      { property: "og:description", content: "Official B.Tech CSE semester subjects, faculty mappings, resources, assignments, and results." },
    ],
  }),
  component: AcademicsPage,
});

function AcademicsPage() {
  const queryClient = useQueryClient();

  // Selection state
  const [selectedDept, setSelectedDept] = useState<string>("Computer Engineering");
  const [selectedSemNumber, setSelectedSemNumber] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"subjects" | "results">("subjects");
  const [searchInput, setSearchInput] = useState<string>("");
  const deferredSearch = useDeferredValue(searchInput);

  // Per-student subject dropdown selector & pagination state
  const [selectedSubjectByStudent, setSelectedSubjectByStudent] = useState<Record<string, string>>({});
  const [globalSubjectSelector, setGlobalSubjectSelector] = useState<string>("ALL");
  const [resultsPage, setResultsPage] = useState<number>(1);
  const RESULTS_PAGE_SIZE = 25;

  // Subject details modal state
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Faculty marks entry modal state
  const [markingSubject, setMarkingSubject] = useState<Subject | null>(null);
  const [isMarkingModalOpen, setIsMarkingModalOpen] = useState<boolean>(false);
  const [draftMarksState, setDraftMarksState] = useState<
    Record<string, { written: string; internal: string }>
  >({});

  // Faculty Resource upload modal state
  const [isResourceModalOpen, setIsResourceModalOpen] = useState<boolean>(false);
  const [resourceForm, setResourceForm] = useState({
    title: "",
    description: "",
    resourceType: "Lecture Notes" as "Syllabus" | "Lecture Notes" | "Lab Manual" | "Reference Book" | "Question Bank",
    fileUrl: "",
    externalUrl: "",
  });

  // Faculty Assignment modal state
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState<boolean>(false);
  const [assignmentForm, setAssignmentForm] = useState({
    title: "",
    instructions: "",
    dueDate: "",
    referenceUrl: "",
    maxMarks: 25,
  });

  // 1. Fetch Academics Data (Demo data is always included)
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["academics-data", selectedDept, selectedSemNumber],
    queryFn: () =>
      getAcademicsData({
        data: {
          department: selectedDept,
          semesterNumber: selectedSemNumber,
          includeDemo: true,
        },
      }),
    staleTime: 30_000,
  });

  const role = data?.role || "faculty";
  const isStudent = role === "student";
  const canFacultyManage = role === "faculty" || role === "admin";
  const isConfigured = data?.isConfigured ?? (selectedSemNumber <= 5);
  const subjects = useMemo(() => {
    if (data?.subjects && data.subjects.length > 0) return data.subjects;
    return getSubjectsForDepartment(selectedDept, selectedSemNumber);
  }, [data?.subjects, selectedDept, selectedSemNumber]);

  const results = useMemo(() => {
    if (data?.results && data.results.length > 0) return data.results;
    return generateDemoResultsForOfficialStudents(selectedSemNumber, selectedDept);
  }, [data?.results, selectedSemNumber, selectedDept]);

  const resources = data?.resources || [];
  const assignments = data?.assignments || [];
  const summary = data?.summary;
  const cumulativeSummary = data?.cumulativeSummary;

  // Filtered subjects
  const filteredSubjects = useMemo(() => {
    if (!deferredSearch.trim()) return subjects;
    const q = deferredSearch.toLowerCase();
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.facultyName.toLowerCase().includes(q)
    );
  }, [subjects, deferredSearch]);

  // Group results by student with calculated CGPA and per-subject result lookup
  const studentGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        studentRollNo: string;
        studentName: string;
        department: string;
        resultsBySubject: Map<string, StudentSubjectResult>;
        allResults: StudentSubjectResult[];
      }
    >();

    for (const r of results) {
      if (!map.has(r.studentRollNo)) {
        map.set(r.studentRollNo, {
          studentRollNo: r.studentRollNo,
          studentName: r.studentName,
          department: r.department,
          resultsBySubject: new Map(),
          allResults: [],
        });
      }
      const entry = map.get(r.studentRollNo)!;
      entry.resultsBySubject.set(r.subjectId, r);
      entry.allResults.push(r);
    }

    const list = Array.from(map.values()).map((g) => ({
      ...g,
      cgpa: calculateStudentCGPA(g.allResults),
    }));

    if (!deferredSearch.trim()) return list;
    const q = deferredSearch.toLowerCase();
    return list.filter(
      (g) =>
        g.studentName.toLowerCase().includes(q) ||
        g.studentRollNo.toLowerCase().includes(q)
    );
  }, [results, deferredSearch]);

  const handleSetAllSubjects = (subId: string) => {
    setGlobalSubjectSelector(subId);
    if (subId !== "ALL") {
      const updated: Record<string, string> = {};
      for (const g of studentGroups) {
        updated[g.studentRollNo] = subId;
      }
      setSelectedSubjectByStudent(updated);
    }
  };

  const totalPages = Math.max(1, Math.ceil(studentGroups.length / RESULTS_PAGE_SIZE));
  const currentPage = Math.min(resultsPage, totalPages);
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * RESULTS_PAGE_SIZE;
    return studentGroups.slice(start, start + RESULTS_PAGE_SIZE);
  }, [studentGroups, currentPage, RESULTS_PAGE_SIZE]);

  // Mutations
  const saveDraftMutation = useMutation({
    mutationFn: (payload: any) => saveMarksDraft({ data: payload }),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["academics-data"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save draft marks.");
    },
  });

  const publishMutation = useMutation({
    mutationFn: (payload: any) => publishSubjectResults({ data: payload }),
    onSuccess: (res) => {
      toast.success(res.message);
      setIsMarkingModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["academics-data"] });
      queryClient.invalidateQueries({ queryKey: ["student-profile"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["student-dashboard"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to publish results.");
    },
  });

  const resourceMutation = useMutation({
    mutationFn: (payload: any) => manageSubjectResource({ data: payload }),
    onSuccess: (res) => {
      toast.success(res.message);
      setIsResourceModalOpen(false);
      setResourceForm({
        title: "",
        description: "",
        resourceType: "Lecture Notes",
        fileUrl: "",
        externalUrl: "",
      });
      queryClient.invalidateQueries({ queryKey: ["academics-data"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to upload resource.");
    },
  });

  const assignmentMutation = useMutation({
    mutationFn: (payload: any) => manageSubjectAssignment({ data: payload }),
    onSuccess: (res) => {
      toast.success(res.message);
      setIsAssignmentModalOpen(false);
      setAssignmentForm({
        title: "",
        instructions: "",
        dueDate: "",
        referenceUrl: "",
        maxMarks: 25,
      });
      queryClient.invalidateQueries({ queryKey: ["academics-data"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create assignment.");
    },
  });

  // Handler to open marking modal
  const handleOpenMarking = (subject: Subject) => {
    setMarkingSubject(subject);
    // Initialize draft marks state with existing values
    const initialMarks: Record<string, { written: string; internal: string }> = {};
    const relevantResults = results.filter((r) => r.subjectId === subject.id);

    relevantResults.forEach((r) => {
      initialMarks[r.studentRollNo] = {
        written: r.writtenMarks !== null ? String(r.writtenMarks) : "",
        internal: r.internalMarks !== null ? String(r.internalMarks) : "",
      };
    });
    setDraftMarksState(initialMarks);
    setIsMarkingModalOpen(true);
  };

  // Handler to open subject details modal
  const handleOpenDetails = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow={isStudent ? "Student Academic Portal" : "Campus Academics & Examination Cell"}
          title="Academics"
          description="Curriculum subjects, official faculty mappings, lecture resources, assignments, and semester grade records."
        />
      </div>

      {/* Top Semester & Navigation Bar */}
      <div className="card-surface rounded-2xl border p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Department & Semester Selectors */}
        <div className="flex flex-wrap items-center gap-4">
          {!isStudent && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
                <Building2 className="size-4 text-primary" />
                Department:
              </label>
              <select
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setSearchInput("");
                  setResultsPage(1);
                  setSelectedSubjectByStudent({});
                  setGlobalSubjectSelector("ALL");
                }}
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 max-w-[240px]"
              >
                <option value="Computer Engineering">Computer Engineering</option>
                <option value="Artificial Intelligence and Machine Learning">Artificial Intelligence and Machine Learning</option>
                <option value="Cyber security & Forensics">Cyber security & Forensics</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
              <Layers className="size-4 text-primary" />
              Semester:
            </label>
            <select
              value={selectedSemNumber}
              onChange={(e) => {
                setSelectedSemNumber(Number(e.target.value));
                setSearchInput("");
                setResultsPage(1);
                setSelectedSubjectByStudent({});
                setGlobalSubjectSelector("ALL");
              }}
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {SEMESTER_CONFIGS.map((sem) => (
                <option key={sem.id} value={sem.semesterNumber}>
                  {sem.label} ({sem.isConfigured ? `${sem.totalCredits} Credits` : "Unconfigured"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Tabs (Subjects vs Results) */}
        <div className="flex items-center rounded-xl bg-secondary/40 p-1 border border-border/50 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("subjects")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all ${
              activeTab === "subjects"
                ? "bg-primary text-primary-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="size-3.5" />
            Subjects ({subjects.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("results")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all ${
              activeTab === "results"
                ? "bg-primary text-primary-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Award className="size-3.5" />
            Results & Grades
          </button>
        </div>
      </div>

      {/* UNCONFIGURED SEMESTER STATE (Semesters VI - VIII) */}
      {!isConfigured ? (
        <Card className="rounded-2xl border-amber-500/20 bg-amber-500/5 p-8 text-center shadow-sm space-y-4">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Semester {selectedSemNumber} Curriculum Not Yet Configured
            </h3>
            <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground leading-relaxed">
              The authoritative B.Tech CSE document provides verified subject and faculty mappings for Semesters I through V.
              Semesters VI, VII, and VIII will be populated once the official syllabi are verified by the Academic Dean's office.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedSemNumber(1)}
            className="rounded-xl text-xs gap-1.5"
          >
            Switch to Semester I (Configured)
          </Button>
        </Card>
      ) : (
        <>
          {/* SEARCH BAR */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={
                activeTab === "subjects"
                  ? "Search subjects by name, code, or faculty member..."
                  : "Search results by student name, roll number, or subject..."
              }
              className="rounded-xl pl-9 text-xs"
            />
          </div>

          {/* TAB 1: SUBJECTS VIEW */}
          {activeTab === "subjects" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing {filteredSubjects.length} of {subjects.length} official subjects in Semester {selectedSemNumber}
                </span>
                <span className="font-mono text-[11px] font-semibold text-primary">{data?.department || selectedDept}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSubjects.map((sub) => {
                  const subRes = resources.filter((r) => r.subjectId === sub.id);
                  const subAssign = assignments.filter((a) => a.subjectId === sub.id);

                  return (
                    <Card key={sub.id} className="rounded-2xl border p-4 shadow-sm hover:shadow-md transition-shadow space-y-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                              {sub.code}
                            </span>
                            <span className="ml-2 text-[10px] text-muted-foreground font-semibold">
                              {sub.credits} Credits {sub.isLab ? "· Lab" : "· Theory"}
                            </span>
                          </div>
                          {sub.inconsistencyFlag && (
                            <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-700 text-[9px] py-0 font-semibold" title={sub.inconsistencyFlag}>
                              Flagged Spelling
                            </Badge>
                          )}
                        </div>

                        <h3 className="font-bold text-sm text-foreground line-clamp-2">
                          {sub.name}
                        </h3>

                        {/* Faculty details */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border/40">
                          <User className="size-3.5 text-primary shrink-0" />
                          <span className="font-medium text-foreground">{sub.facultyName}</span>
                          {sub.isAccountLinked && (
                            <Badge variant="outline" className="text-[9px] py-0 text-emerald-700 border-emerald-300 bg-emerald-50 font-bold ml-auto">
                              Linked
                            </Badge>
                          )}
                        </div>

                        {/* Counts badge */}
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                          <span className="flex items-center gap-1">
                            <FileText className="size-3" />
                            {subRes.length} Resources
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {subAssign.length} Assignments
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center gap-2 border-t border-border/40">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDetails(sub)}
                          className="flex-1 rounded-xl text-xs h-8 gap-1.5"
                        >
                          <BookOpen className="size-3 text-primary" />
                          Resources & Details
                        </Button>

                        {canFacultyManage && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenMarking(sub)}
                            className="rounded-xl text-xs h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          >
                            <Pencil className="size-3" />
                            Mark
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: RESULTS VIEW */}
          {activeTab === "results" && (
            <div className="space-y-6">
              {/* STUDENT SPECIFIC SUMMARY CARDS */}
              {isStudent && summary && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
                  <Card className="rounded-2xl p-4 border shadow-sm">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Semester SGPA</span>
                    <p className="mt-1 text-3xl font-black tracking-tight text-emerald-700">
                      {summary.sgpa !== null ? summary.sgpa.toFixed(2) : "N/A"}
                    </p>
                    <span className="text-[10px] text-muted-foreground">Out of 10.0 scale</span>
                  </Card>

                  <Card className="rounded-2xl p-4 border shadow-sm">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Cumulative CGPA</span>
                    <p className="mt-1 text-3xl font-black tracking-tight text-foreground">
                      {cumulativeSummary?.cgpa !== null && cumulativeSummary?.cgpa !== undefined ? cumulativeSummary.cgpa.toFixed(2) : "N/A"}
                    </p>
                    <span className="text-[10px] text-muted-foreground">Across completed semesters</span>
                  </Card>

                  <Card className="rounded-2xl p-4 border shadow-sm">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Credits Earned</span>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                      {summary.totalCreditsEarned}
                    </p>
                    <span className="text-[10px] text-muted-foreground">Official Credit Weight</span>
                  </Card>

                  <Card className="rounded-2xl p-4 border shadow-sm">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Overall Percentage</span>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-primary">
                      {summary.overallPercentage !== null ? `${summary.overallPercentage}%` : "N/A"}
                    </p>
                    <span className="text-[10px] text-muted-foreground">Grade: {summary.overallGrade || "N/A"}</span>
                  </Card>
                </div>
              )}

              {/* RESULTS TABLE */}
              <div className="card-surface rounded-2xl border overflow-hidden shadow-sm">
                <div className="border-b px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {isStudent ? "My Semester Grade Register" : `Semester ${selectedSemNumber} Examination Results`}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Written Marks (0–50), Internal Marks (0–50), Total (100). Select a subject per student to view individual scores.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {subjects.length > 0 && !isStudent && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">Switch all to:</span>
                        <select
                          value={globalSubjectSelector}
                          onChange={(e) => handleSetAllSubjects(e.target.value)}
                          className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="ALL">Individual Subjects</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {canFacultyManage && (
                      <Button
                        size="sm"
                        onClick={() => {
                          if (subjects.length > 0) handleOpenMarking(subjects[0]);
                        }}
                        className="rounded-xl text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      >
                        <Pencil className="size-3.5" />
                        Enter / Publish Marks
                      </Button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-secondary/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3">Student</th>
                        <th className="px-5 py-3">Subject</th>
                        <th className="px-4 py-3 text-center">Credits</th>
                        <th className="px-4 py-3 text-center">Written (50)</th>
                        <th className="px-4 py-3 text-center">Internal (50)</th>
                        <th className="px-4 py-3 text-center">Total (100)</th>
                        <th className="px-4 py-3 text-center">Percentage</th>
                        <th className="px-4 py-3 text-center">CGPA</th>
                        <th className="px-5 py-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedStudents.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-xs text-subtle">
                            No examination results published for the selected semester.
                          </td>
                        </tr>
                      ) : (
                        paginatedStudents.map((student) => {
                          const currentSubjectId =
                            selectedSubjectByStudent[student.studentRollNo] ||
                            (globalSubjectSelector !== "ALL" ? globalSubjectSelector : subjects[0]?.id || "");
                          const currentSubject = subjects.find((s) => s.id === currentSubjectId);
                          const currentResult = student.resultsBySubject.get(currentSubjectId);

                          return (
                            <tr key={student.studentRollNo} className="hover:bg-secondary/20 transition-colors">
                              <td className="px-5 py-3.5">
                                <span className="font-semibold text-foreground block">{student.studentName}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">{student.studentRollNo}</span>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex flex-col gap-1">
                                  <select
                                    value={currentSubjectId}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setSelectedSubjectByStudent((prev) => ({
                                        ...prev,
                                        [student.studentRollNo]: val,
                                      }));
                                    }}
                                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/20 max-w-[260px] cursor-pointer"
                                  >
                                    {subjects.map((sub) => (
                                      <option key={sub.id} value={sub.id}>
                                        {sub.name} ({sub.code})
                                      </option>
                                    ))}
                                  </select>
                                  {currentSubject && (
                                    <span className="font-mono text-[10px] text-primary">
                                      {currentSubject.code} · {currentSubject.credits} Credits
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-center font-mono font-semibold">
                                {currentResult ? currentResult.credits : currentSubject ? currentSubject.credits : "—"}
                              </td>
                              <td className="px-4 py-3.5 text-center font-mono font-bold text-foreground">
                                {currentResult && currentResult.writtenMarks !== null ? currentResult.writtenMarks : "—"}
                              </td>
                              <td className="px-4 py-3.5 text-center font-mono font-bold text-foreground">
                                {currentResult && currentResult.internalMarks !== null ? currentResult.internalMarks : "—"}
                              </td>
                              <td className="px-4 py-3.5 text-center font-mono font-black text-emerald-700 text-sm">
                                {currentResult && currentResult.totalMarks !== null ? currentResult.totalMarks : "—"}
                              </td>
                              <td className="px-4 py-3.5 text-center font-mono font-semibold">
                                {currentResult && currentResult.percentage !== null ? `${currentResult.percentage}%` : "—"}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                {student.cgpa !== null ? (
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-xs font-bold px-2.5 py-0.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                                  >
                                    {student.cgpa.toFixed(2)}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground font-mono">—</span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end">
                                  {currentResult?.publicationStatus === "published" ? (
                                    <Badge className="bg-emerald-600/15 text-emerald-700 border-emerald-500/30 text-[10px] font-semibold gap-1">
                                      <CheckCircle2 className="size-3" /> Published
                                    </Badge>
                                  ) : currentResult?.publicationStatus === "draft" ? (
                                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] font-semibold gap-1">
                                      <Clock className="size-3" /> Draft
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground border-border text-[10px] font-medium gap-1">
                                      <Clock className="size-3" /> Not Entered
                                    </Badge>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {studentGroups.length > RESULTS_PAGE_SIZE && (
                  <div className="border-t px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground bg-muted/10">
                    <div>
                      Showing <span className="font-semibold text-foreground">{(currentPage - 1) * RESULTS_PAGE_SIZE + 1}</span> to{" "}
                      <span className="font-semibold text-foreground">
                        {Math.min(currentPage * RESULTS_PAGE_SIZE, studentGroups.length)}
                      </span>{" "}
                      of <span className="font-semibold text-foreground">{studentGroups.length}</span> students
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setResultsPage((p) => Math.max(1, p - 1))}
                        className="h-8 rounded-lg text-xs gap-1"
                      >
                        <ChevronLeft className="size-3.5" />
                        Previous
                      </Button>
                      <span className="px-2 font-medium text-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setResultsPage((p) => Math.min(totalPages, p + 1))}
                        className="h-8 rounded-lg text-xs gap-1"
                      >
                        Next
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: SUBJECT DETAILS (RESOURCES & ASSIGNMENTS) */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl rounded-2xl max-h-[85vh] overflow-y-auto">
          {selectedSubject && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-primary font-bold">
                    {selectedSubject.code} · {selectedSubject.credits} Credits
                  </Badge>
                  <span className="text-xs text-muted-foreground">Semester {selectedSubject.semesterNumber}</span>
                </div>
                <DialogTitle className="text-lg font-bold text-foreground mt-1">
                  {selectedSubject.name}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Faculty: <strong className="text-foreground">{selectedSubject.facultyName}</strong> · Department of {selectedSubject.department}
                </DialogDescription>
              </DialogHeader>

              {/* Sub-sections: Resources and Assignments */}
              <div className="space-y-6 pt-2">
                {/* 1. Resources Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <FileText className="size-4 text-primary" />
                      Course Resources & Notes
                    </h4>
                    {canFacultyManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsResourceModalOpen(true)}
                        className="rounded-xl text-[11px] h-7 gap-1"
                      >
                        <Plus className="size-3" /> Upload Resource
                      </Button>
                    )}
                  </div>

                  {resources.filter((r) => r.subjectId === selectedSubject.id).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-3 text-center">
                      No resources uploaded yet for this subject.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {resources
                        .filter((r) => r.subjectId === selectedSubject.id)
                        .map((res) => (
                          <div
                            key={res.id}
                            className="p-3 rounded-xl border border-border bg-card flex items-start justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground">{res.title}</span>
                                <Badge variant="outline" className="text-[10px] py-0 text-primary border-primary/30">
                                  {res.resourceType}
                                </Badge>
                              </div>
                              <p className="text-muted-foreground text-[11px] mt-0.5">{res.description}</p>
                              <span className="text-[10px] text-muted-foreground block mt-1">
                                Uploaded by {res.uploadedByFaculty} ({res.fileSize || "PDF Document"})
                              </span>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              asChild
                              className="rounded-lg text-[11px] h-7 gap-1 shrink-0"
                            >
                              <a href={res.fileUrl || res.externalUrl || "#"} target="_blank" rel="noreferrer">
                                <Download className="size-3" /> View PDF
                              </a>
                            </Button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* 2. Assignments Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Clock className="size-4 text-emerald-600" />
                      Coursework Assignments & Deadlines
                    </h4>
                    {canFacultyManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsAssignmentModalOpen(true)}
                        className="rounded-xl text-[11px] h-7 gap-1"
                      >
                        <Plus className="size-3" /> Create Assignment
                      </Button>
                    )}
                  </div>

                  {assignments.filter((a) => a.subjectId === selectedSubject.id).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-3 text-center">
                      No assignments currently posted for this subject.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {assignments
                        .filter((a) => a.subjectId === selectedSubject.id)
                        .map((assign) => (
                          <div
                            key={assign.id}
                            className="p-3 rounded-xl border border-border bg-card space-y-1.5 text-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-bold text-foreground block">{assign.title}</span>
                                <span className="text-[11px] text-muted-foreground">{assign.instructions}</span>
                              </div>
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-semibold shrink-0"
                              >
                                Max: {assign.maxMarks} Marks
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                              <span>Due: {new Date(assign.dueDate).toLocaleDateString()}</span>
                              <span className="text-primary font-medium">Status: {assign.status}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: FACULTY MARKS ENTRY & PUBLISHING */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={isMarkingModalOpen} onOpenChange={setIsMarkingModalOpen}>
        <DialogContent className="max-w-3xl rounded-2xl max-h-[85vh] overflow-y-auto">
          {markingSubject && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-bold">
                  <Pencil className="size-4 text-emerald-600" />
                  Grade Register: {markingSubject.name} ({markingSubject.code})
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Enter student written marks (0–50) and internal marks (0–50). Save drafts or publish directly to student portals.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="rounded-xl border overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/40 border-b text-[11px] font-semibold uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5">Roll Number</th>
                        <th className="px-4 py-2.5">Student Name</th>
                        <th className="px-4 py-2.5 text-center">Written (0–50)</th>
                        <th className="px-4 py-2.5 text-center">Internal (0–50)</th>
                        <th className="px-4 py-2.5 text-center">Total (100)</th>
                        <th className="px-4 py-2.5 text-center">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {results
                        .filter((r) => r.subjectId === markingSubject.id)
                        .map((r) => {
                          const currentMarks = draftMarksState[r.studentRollNo] || {
                            written: r.writtenMarks !== null ? String(r.writtenMarks) : "",
                            internal: r.internalMarks !== null ? String(r.internalMarks) : "",
                          };

                          const wNum = currentMarks.written !== "" ? Number(currentMarks.written) : null;
                          const iNum = currentMarks.internal !== "" ? Number(currentMarks.internal) : null;
                          const calc = computeSubjectMarks(wNum, iNum);

                          return (
                            <tr key={r.id} className="hover:bg-muted/10">
                              <td className="px-4 py-2 font-mono font-semibold">{r.studentRollNo}</td>
                              <td className="px-4 py-2 font-medium">{r.studentName}</td>
                              <td className="px-4 py-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={50}
                                  value={currentMarks.written}
                                  onChange={(e) => {
                                    setDraftMarksState((prev) => ({
                                      ...prev,
                                      [r.studentRollNo]: {
                                        ...prev[r.studentRollNo],
                                        written: e.target.value,
                                      },
                                    }));
                                  }}
                                  placeholder="0–50"
                                  className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center font-mono text-xs focus:ring-1 focus:ring-primary"
                                />
                              </td>
                              <td className="px-4 py-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={50}
                                  value={currentMarks.internal}
                                  onChange={(e) => {
                                    setDraftMarksState((prev) => ({
                                      ...prev,
                                      [r.studentRollNo]: {
                                        ...prev[r.studentRollNo],
                                        internal: e.target.value,
                                      },
                                    }));
                                  }}
                                  placeholder="0–50"
                                  className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center font-mono text-xs focus:ring-1 focus:ring-primary"
                                />
                              </td>
                              <td className="px-4 py-2 text-center font-mono font-bold text-emerald-700">
                                {calc.totalMarks !== null ? calc.totalMarks : "—"}
                              </td>
                              <td className="px-4 py-2 text-center font-bold">
                                {calc.grade || "—"}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMarkingModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={saveDraftMutation.isPending}
                  onClick={() => {
                    const payloadRecords = Object.entries(draftMarksState).map(([rollNo, marks]) => ({
                      studentRollNo: rollNo,
                      writtenMarks: marks.written !== "" ? Number(marks.written) : null,
                      internalMarks: marks.internal !== "" ? Number(marks.internal) : null,
                    }));
                    saveDraftMutation.mutate({
                      subjectId: markingSubject.id,
                      semesterNumber: markingSubject.semesterNumber,
                      records: payloadRecords,
                    });
                  }}
                  className="rounded-xl text-xs font-semibold"
                >
                  {saveDraftMutation.isPending ? "Saving..." : "Save Draft"}
                </Button>
                <Button
                  size="sm"
                  disabled={publishMutation.isPending}
                  onClick={() => {
                    const payloadRecords = Object.entries(draftMarksState)
                      .filter(([_, m]) => m.written !== "" && m.internal !== "")
                      .map(([rollNo, marks]) => ({
                        studentRollNo: rollNo,
                        writtenMarks: Number(marks.written),
                        internalMarks: Number(marks.internal),
                      }));

                    if (payloadRecords.length === 0) {
                      toast.error("Please enter written and internal marks before publishing.");
                      return;
                    }

                    publishMutation.mutate({
                      subjectId: markingSubject.id,
                      semesterNumber: markingSubject.semesterNumber,
                      records: payloadRecords,
                    });
                  }}
                  className="gap-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Send className="size-3" />
                  {publishMutation.isPending ? "Publishing..." : "Confirm & Publish"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: UPLOAD RESOURCE MODAL */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={isResourceModalOpen} onOpenChange={setIsResourceModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Upload Course Resource</DialogTitle>
            <DialogDescription className="text-xs">
              Add study material, lab manuals, or lecture slides for {selectedSubject?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Resource Title</label>
              <Input
                value={resourceForm.title}
                onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                placeholder="e.g. Chapter 4 Lecture Notes — Graph Theory"
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Resource Type</label>
              <select
                value={resourceForm.resourceType}
                onChange={(e) => setResourceForm({ ...resourceForm, resourceType: e.target.value as any })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium"
              >
                {["Syllabus", "Lecture Notes", "Lab Manual", "Reference Book", "Question Bank"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Description</label>
              <Input
                value={resourceForm.description}
                onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
                placeholder="Brief summary of file contents..."
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsResourceModalOpen(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!resourceForm.title || resourceMutation.isPending}
              onClick={() => {
                if (!selectedSubject) return;
                resourceMutation.mutate({
                  action: "create",
                  subjectId: selectedSubject.id,
                  semesterNumber: selectedSubject.semesterNumber,
                  ...resourceForm,
                });
              }}
              className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: CREATE ASSIGNMENT MODAL */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={isAssignmentModalOpen} onOpenChange={setIsAssignmentModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Create Coursework Assignment</DialogTitle>
            <DialogDescription className="text-xs">
              Post instructions and deadline for {selectedSubject?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Assignment Title</label>
              <Input
                value={assignmentForm.title}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                placeholder="e.g. Lab Exercise 4: Tree Traversal in C++"
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Instructions</label>
              <Input
                value={assignmentForm.instructions}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, instructions: e.target.value })}
                placeholder="Instructions, expected output format..."
                className="rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Due Date</label>
                <Input
                  type="date"
                  value={assignmentForm.dueDate}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                  className="rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Max Marks</label>
                <Input
                  type="number"
                  value={assignmentForm.maxMarks}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, maxMarks: Number(e.target.value) })}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAssignmentModalOpen(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!assignmentForm.title || !assignmentForm.dueDate || assignmentMutation.isPending}
              onClick={() => {
                if (!selectedSubject) return;
                assignmentMutation.mutate({
                  action: "create",
                  subjectId: selectedSubject.id,
                  semesterNumber: selectedSubject.semesterNumber,
                  ...assignmentForm,
                });
              }}
              className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Post Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
