import * as fs from "fs";
import * as path from "path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from "docx";

const ARTIFACT_DIR = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\d7729b10-0129-4293-a736-2bb6ace3e068";
const OUTPUT_DOCX = path.join(ARTIFACT_DIR, "KRYPTEDU_Complete_Project_Report.docx");
const LOCAL_OUTPUT_DOCX = path.join(process.cwd(), "KRYPTEDU_Complete_Project_Report.docx");

function createTitle(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 300, before: 200 },
    run: { font: "Times New Roman", size: 36, bold: true, color: "111827" },
  });
}

function createH1(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    spacing: { before: 400, after: 200 },
    run: { font: "Times New Roman", size: 32, bold: true, color: "0F172A" },
  });
}

function createH2(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    run: { font: "Times New Roman", size: 28, bold: true, color: "1E293B" },
  });
}

function createH3(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    run: { font: "Times New Roman", size: 24, bold: true, color: "334155" },
  });
}

function createP(text, options = {}) {
  return new Paragraph({
    alignment: options.align || AlignmentType.JUSTIFIED,
    spacing: { line: 360, after: 140 }, // 1.5 line spacing (360/240 = 1.5)
    children: [
      new TextRun({
        text: text,
        font: "Times New Roman",
        size: 24, // 12pt
        bold: !!options.bold,
        italics: !!options.italics,
        color: options.color || "1F2937",
      }),
    ],
  });
}

function createBullet(text, boldPrefix = "") {
  const children = [];
  if (boldPrefix) {
    children.push(
      new TextRun({
        text: boldPrefix + " ",
        font: "Times New Roman",
        size: 24,
        bold: true,
        color: "0F172A",
      })
    );
  }
  children.push(
    new TextRun({
      text: text,
      font: "Times New Roman",
      size: 24,
      color: "1F2937",
    })
  );
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { line: 360, after: 100 },
    children,
  });
}

function createSimpleTable(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h) =>
        new TableCell({
          width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
          shading: { fill: "F1F5F9" },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 100 },
              children: [
                new TextRun({
                  text: h,
                  font: "Times New Roman",
                  size: 22,
                  bold: true,
                  color: "0F172A",
                }),
              ],
            }),
          ],
        })
    ),
  });

  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (c) =>
            new TableCell({
              width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { before: 80, after: 80 },
                  children: [
                    new TextRun({
                      text: c,
                      font: "Times New Roman",
                      size: 20,
                      color: "334155",
                    }),
                  ],
                }),
              ],
            })
        ),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

async function buildDocx() {
  console.log("Generating formal academic Word document...");

  const doc = new Document({
    creator: "KRYPTEDU Architecture Team",
    title: "KRYPTEDU — Smart Campus Analytics Complete Project Report",
    description: "Bachelor of Technology Final Year Project Report in Computer Science and Engineering",
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 24, color: "1F2937" },
          paragraph: { spacing: { line: 360, after: 140 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 1-inch margins
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "KRYPTEDU — Smart Campus Analytics | B.Tech CSE Final Year Report",
                    font: "Times New Roman",
                    size: 18,
                    italics: true,
                    color: "64748B",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Page ",
                    font: "Times New Roman",
                    size: 18,
                    color: "64748B",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: "Times New Roman",
                    size: 18,
                    color: "64748B",
                  }),
                  new TextRun({
                    text: " of ",
                    font: "Times New Roman",
                    size: 18,
                    color: "64748B",
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: "Times New Roman",
                    size: 18,
                    color: "64748B",
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // PRELIMINARY PAGES
          createTitle("KRYPTEDU — SMART CAMPUS ANALYTICS"),
          createP(
            "A Project Report Submitted in Partial Fulfillment of the Requirements for the Award of the Degree of",
            { align: AlignmentType.CENTER, italics: true }
          ),
          createP("BACHELOR OF TECHNOLOGY IN COMPUTER SCIENCE AND ENGINEERING", {
            align: AlignmentType.CENTER,
            bold: true,
          }),
          createP("ACADEMIC YEAR: 2025 – 2026", { align: AlignmentType.CENTER }),
          createP("Submitted by:", { align: AlignmentType.CENTER, bold: true }),
          createP("[STUDENT NAME 1] ([ROLL NO 1]) | [STUDENT NAME 2] ([ROLL NO 2])", {
            align: AlignmentType.CENTER,
          }),
          createP("[STUDENT NAME 3] ([ROLL NO 3]) | [STUDENT NAME 4] ([ROLL NO 4])", {
            align: AlignmentType.CENTER,
          }),
          createP("Under the Guidance of:", { align: AlignmentType.CENTER, bold: true }),
          createP("[NAME OF INTERNAL GUIDE], Assistant Professor, Department of CSE", {
            align: AlignmentType.CENTER,
          }),
          createP("DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING", {
            align: AlignmentType.CENTER,
            bold: true,
          }),
          createP("[YOUR INSTITUTION / COLLEGE NAME], Affiliated to [AFFILIATED UNIVERSITY NAME]", {
            align: AlignmentType.CENTER,
          }),

          // CERTIFICATE
          createH1("CERTIFICATE"),
          createP(
            "This is to certify that the project report entitled 'KRYPTEDU — SMART CAMPUS ANALYTICS' submitted by [STUDENT NAME 1] ([ROLL NO 1]), [STUDENT NAME 2] ([ROLL NO 2]), [STUDENT NAME 3] ([ROLL NO 3]), and [STUDENT NAME 4] ([ROLL NO 4]) in partial fulfillment of the requirements for the award of the degree of Bachelor of Technology in Computer Science and Engineering from [AFFILIATED UNIVERSITY NAME] is a bonafide record of the work carried out by them under my supervision and guidance during the academic year 2025–2026."
          ),
          createP(
            "The results embodied in this report have not been submitted to any other university or institute for the award of any degree or diploma."
          ),
          createP("\n\n______________________________\n[NAME OF INTERNAL GUIDE]\nProject Guide", {
            align: AlignmentType.LEFT,
          }),
          createP("\n______________________________\n[NAME OF HEAD OF DEPARTMENT]\nProfessor & Head of Department", {
            align: AlignmentType.LEFT,
          }),

          // DECLARATION
          createH1("DECLARATION"),
          createP(
            "We hereby declare that the project entitled 'KRYPTEDU — SMART CAMPUS ANALYTICS' is an authentic record of our own research and development work carried out under the supervision of [NAME OF INTERNAL GUIDE], Department of Computer Science and Engineering, [YOUR INSTITUTION / COLLEGE NAME]."
          ),
          createP(
            "We further declare that the content of this project report has not been submitted previously to any other university or institution for the award of any degree, diploma, or certificate."
          ),
          createP("1. [STUDENT NAME 1] ([ROLL NO 1])"),
          createP("2. [STUDENT NAME 2] ([ROLL NO 2])"),
          createP("3. [STUDENT NAME 3] ([ROLL NO 3])"),
          createP("4. [STUDENT NAME 4] ([ROLL NO 4])"),

          // ABSTRACT
          createH1("ABSTRACT"),
          createP(
            "Modern higher education institutions handle voluminous academic, attendance, financial, and placement data. However, traditional campus management systems typically operate in disconnected departmental silos, relying on batch data exports, disparate spreadsheet calculators, and fragmented communication tools. These structural limitations impede early risk detection, cause discrepancies between attendance percentages and official CGPA, and leave academic administrators and placement coordinators without timely, predictive intelligence to intervene before students experience academic probation or placement disqualification."
          ),
          createP(
            "To resolve these institutional bottlenecks, this project presents KRYPTEDU — Smart Campus Analytics, an enterprise-grade, integrated educational analytics and intervention management platform. Built upon a unified full-stack architecture combining React 19, TanStack Start (full-stack SSR), Nitro, and Supabase PostgreSQL with Row-Level Security, KRYPTEDU establishes a single source of truth across academic curricula, daily attendance registers, student risk profiling, fee management, and placement readiness."
          ),
          createP(
            "The platform implements an authoritative Academic CGPA engine supporting multi-department curricula across eight semesters, enforcing institutionally validated Written (0–50) and Internal (0–50) marking scales. A bidirectional data-synchronization pipeline guarantees that when faculty publish daily attendance sessions or examination scores, dependent metrics—including Attendance Percentage, Semester SGPA, Cumulative CGPA, Academic Risk, and Placement Readiness—recalculate immediately across all administrative dashboards, student profile drawers, and intervention queues. In addition, KRYPTEDU introduces an authoritative, multi-dimensional 5-Indicator Placement Readiness Model (R = 0.25G + 0.25T + 0.20I + 0.20P + 0.10C) and an AI-powered Mock Interview Studio with automated speech-to-text, dynamic follow-up questioning, and multi-criteria rubric scoring powered by Google Gemini API (gemini-3.8-flash). The platform has been comprehensively validated through 167 automated unit, integration, and security test suites, delivering an enterprise-grade smart campus ecosystem."
          ),

          // CHAPTER 1
          createH1("CHAPTER 1: INTRODUCTION"),
          createH2("1.1 Introduction to Smart Campus Analytics"),
          createP(
            "The global tertiary education landscape is experiencing unprecedented digital transformation. Contemporary universities and engineering colleges generate substantial operational data daily, encompassing classroom biometric attendance, continuous internal assessments, laboratory evaluations, semester examinations, tuition fee transactions, and placement interviews. When aggregated and processed systematically, these disparate data streams yield invaluable learning analytics—the measurement, collection, analysis, and reporting of data about learners and their contexts for purposes of understanding and optimizing learning environments."
          ),
          createH2("1.2 Background of Educational Data Analytics"),
          createP(
            "Historically, academic recordkeeping transitioned from paper-based registries in the mid-twentieth century to standalone relational database management systems in the late 1990s. Studies consistently demonstrate that student attrition and placement failures rarely occur without precursor signals. Significant dips in classroom attendance almost invariably precede drops in internal test scores, which subsequently depress semester grade point averages and ultimately disqualify candidates from campus recruitment criteria."
          ),
          createH2("1.3 Problem Statement"),
          createP(
            "To design, develop, and validate an integrated, secure Smart Campus Analytics platform that unifies student academic records, continuous attendance registers, and placement readiness indicators into a single source of truth; automates institutional CGPA calculations across multi-department curricula; synchronizes dependent analytics bidirectionally; provides proactive student intervention management; and embeds voice-enabled AI mock interview intelligence with verifiable audit logging."
          ),
          createH2("1.4 Project Objectives"),
          createBullet("Formulate and implement official semester curricula for B.Tech CSE, AIML, and CSF departments.", "1. Authoritative Academic Engine:"),
          createBullet("Engineer a unified database transaction pipeline ensuring that faculty updates in attendance or examination records instantaneously recalculate student percentages, SGPA, CGPA, and dependent risk scores application-wide.", "2. Bidirectional Data Synchronization:"),
          createBullet("Design and deploy a validated multi-indicator formula (R = 0.25G + 0.25T + 0.20I + 0.20P + 0.10C) balancing academics, technical skills, mock interviews, placement prep, and attendance.", "3. Placement Readiness Model:"),
          createBullet("Integrate Google Gemini API to generate dynamic follow-up questions and 10-part debrief reports with offline deterministic fallbacks.", "4. Voice-Enabled AI Mock Interview:"),
          createBullet("Construct an administrative fee ledger with Razorpay checkout and immutable audit trail logging ('Save & Audit').", "5. Financial Integrity & Auditing:"),
          createBullet("Validate the complete platform against 167 automated unit, integration, and security test cases.", "6. Comprehensive Quality Assurance:"),

          // CHAPTER 2
          createH1("CHAPTER 2: LITERATURE REVIEW AND EXISTING SYSTEM"),
          createH2("2.1 Existing System Limitations"),
          createP(
            "Traditional Student Information Systems (SIS) and Learning Management Systems (LMS) manage student data in isolated silos. Departmental attendance coordinators, examination cells, accounts sections, and placement cells maintain disparate spreadsheets and software packages, leading to data divergence, delayed interventions, and unverified CGPA calculations."
          ),
          createSimpleTable(
            ["Feature Dimension", "Traditional SIS", "Standard LMS", "KRYPTEDU Platform"],
            [
              ["Data Scope", "Administrative only", "Course assignments only", "Unified Academic, Attendance, Fees & Placement"],
              ["CGPA Calculation", "Batch / Periodic", "Not supported", "Authoritative, real-time, credit-weighted"],
              ["Attendance Tracking", "Standalone module", "Course-specific logins", "Daily registers with instant 2-way sync"],
              ["Placement Modeling", "Basic CGPA threshold", "None", "5-indicator multi-dimensional score (R)"],
              ["Mock Interviews", "Manual / human-dependent", "None", "Voice/STT, dynamic questions, 10-part report"],
              ["Fee Ledger & Audit", "Separate accounts silo", "None", "Razorpay gateway + mandatory Save & Audit"],
              ["Testing Rigor", "Varies / manual QA", "Plugin tests", "167 automated test cases passing (Vitest)"],
            ]
          ),

          // CHAPTER 3
          createH1("CHAPTER 3: REQUIREMENT ANALYSIS"),
          createH2("3.1 Role-Based Permission Matrix"),
          createP(
            "KRYPTEDU enforces strict Role-Based Access Control (RBAC) across four primary institutional user types: Student, Faculty, Placement Officer, and System Administrator."
          ),
          createSimpleTable(
            ["Role", "Academic Profile & CGPA", "Attendance Registers", "Marks Entry & Publishing", "AI Mock Interview", "Fee Ledger & Save & Audit"],
            [
              ["Student", "Read-only (Own)", "Read-only (Own)", "No Access", "Full Access", "Online Payment via Razorpay"],
              ["Faculty", "Read-only (Dept/All)", "Create, Mark & Publish", "Enter Marks & Publish", "Full Access", "No Access"],
              ["Placement Officer", "Read-only (All)", "Read-only (All)", "No Access", "Full Access & Analytics", "No Access"],
              ["Administrator", "Full Management", "Full Management", "Full Management", "Full Management", "Full Management ('Save & Audit')"],
            ]
          ),

          // CHAPTER 4 & 5
          createH1("CHAPTER 4 & 5: SYSTEM DESIGN, ARCHITECTURE & TECHNOLOGY STACK"),
          createH2("4.1 Architecture Overview"),
          createP(
            "The platform leverages a three-tier cloud-native architecture combining React 19 on the client, TanStack Start full-stack server functions on Nitro, and Supabase PostgreSQL with Row-Level Security."
          ),
          createSimpleTable(
            ["Layer", "Technology", "Version", "Key Architectural Rationale"],
            [
              ["Frontend UI", "React & TanStack Router", "v19.2 / v1.164", "Concurrent rendering, 100% type-safe file-based routing"],
              ["Server Engine", "Nitro & TanStack Start", "v8.1.5", "Serverless edge functions, server-side data loaders, zero secret leaks"],
              ["Database & Auth", "Supabase PostgreSQL & GoTrue", "v2.99", "ACID transactions, foreign key integrity, RSA-signed JWT tokens"],
              ["AI Service", "Google GenAI SDK (@google/genai)", "v2.28", "Official unified SDK, gemini-3.8-flash model, structured JSON schema"],
              ["Testing", "Vitest", "v4.1.11", "167 unit, integration, and security tests executing in 8.30 seconds"],
            ]
          ),

          // CHAPTER 6 & 7
          createH1("CHAPTER 6 & 7: MODULE IMPLEMENTATION & DATABASE DESIGN"),
          createH2("6.1 Core Subsystems"),
          createBullet("Authoritative registry with search, department filtering, and 360-degree profile drawer.", "Student Management:"),
          createBullet("Session creation, daily student roster marking, draft/publish workflow, and instant percentage calculation.", "Attendance Management:"),
          createBullet("Curricula for CSE, AIML, and CSF across semesters 1–8; 50 Written + 50 Internal marks scale; authoritative CGPA ledger.", "Academic Management:"),
          createBullet("R = 0.25G + 0.25T + 0.20I + 0.20P + 0.10C balancing academics, coding, interview, and attendance discipline.", "Placement Readiness Model:"),
          createBullet("Voice-enabled speech-to-text, dynamic follow-up questioning, rubric scoring, and 10-part debrief report.", "AI Mock Interview Studio:"),
          createBullet("Razorpay checkout, student tuition ledger, and mandatory reason audit logging ('Save & Audit').", "Course Fee Ledger:"),

          // CHAPTER 8
          createH1("CHAPTER 8: ALGORITHMS AND ANALYTICAL METHODS"),
          createH2("8.1 Credit-Weighted CGPA Calculation"),
          createP(
            "CGPA = [ SUM(Credits_i * GradePoint_i) ] / [ SUM(Credits_i) ] across all completed courses, where Grade Points map from 10-point scales: O (>=90: 10), A+ (80-89: 9), A (70-79: 8), B+ (60-69: 7), B (50-59: 6), C (40-49: 5), F (<40: 0)."
          ),
          createH2("8.2 5-Indicator Placement Readiness Scoring"),
          createP(
            "R = 0.25G + 0.25T + 0.20I + 0.20P + 0.10C, where G is normalized CGPA (10 * CGPA), T is technical assessment score, I is AI mock interview score, P is placement prep/resume score, and C is attendance discipline score."
          ),
          createP("Risk Classification Thresholds: Low Risk (75-100), Moderate Risk (50-74), High Risk (0-49)."),

          // CHAPTER 10
          createH1("CHAPTER 10: TESTING AND EMPIRICAL VALIDATION"),
          createH2("10.1 Automated Test Execution Summary"),
          createP(
            "Testing was conducted using Vitest v4.1.11 across 13 test suites. A 100% pass rate was achieved across all 167 automated test cases:"
          ),
          createSimpleTable(
            ["Test Suite", "Tests", "Scope / Invariants Verified", "Status"],
            [
              ["two-way-sync.test.ts", "11", "Attendance & marks modifications synchronize CGPA, attendance %, and risk scores", "PASSED"],
              ["payments.test.ts", "19", "Course fees, Razorpay orders, and Save & Audit mandatory reason logging", "PASSED"],
              ["attendance.test.ts", "21", "Session publish workflow, attendance % formula, excused exclusions", "PASSED"],
              ["academics.test.ts", "13", "Multi-department curriculum resolution (CSE, AIML, CSF), 50/50 marks validation", "PASSED"],
              ["scoring.test.ts", "26", "5-indicator Placement Readiness formula (R), boundary conditions, risk classifications", "PASSED"],
              ["auth.test.ts", "11", "RBAC permissions, student isolation, faculty departmental access, admin authorization", "PASSED"],
              ["csv.test.ts", "16", "Institutional CSV dataset ingestion, column mapping, header validation", "PASSED"],
              ["interview.test.ts", "12", "Dynamic follow-up generation, 10-part debrief report rubric, fallback scoring", "PASSED"],
              ["ai-insights.test.ts", "15", "AI provider key resolution, model configuration (gemini-3.8-flash), deterministic fallback", "PASSED"],
              ["support-groups.test.ts", "8", "Cohort support group creation, risk thresholds, student assignment", "PASSED"],
              ["interventions.test.ts", "9", "Academic and placement intervention lifecycles, status transitions", "PASSED"],
              ["security.test.ts", "5", "API key isolation, client bundle sanitization, RLS enforcement", "PASSED"],
              ["app-routing.test.tsx", "1", "Client route navigation, authenticated layout guard, 404 handler", "PASSED"],
            ]
          ),
          createP("Total Tests Passed: 167 of 167 (100% Pass Rate). Total Execution Duration: 8.30 seconds.", {
            bold: true,
          }),

          // CHAPTER 15 & REFERENCES
          createH1("CHAPTER 15: CONCLUSION & REFERENCES"),
          createH2("15.1 Conclusion"),
          createP(
            "The KRYPTEDU — Smart Campus Analytics platform successfully demonstrates the practical viability of integrating academic management, real-time attendance registers, predictive placement readiness modeling, and conversational AI into a unified web platform. By establishing the database as the sole authority and enforcing bidirectional data synchronization, the system eliminates administrative discrepancies, prevents student failure through early intervention, and prepares candidates for competitive recruitment."
          ),
          createH2("References"),
          createBullet("C. Romero and S. Ventura, 'Educational data mining and learning analytics: An updated survey,' WIREs Data Mining and Knowledge Discovery, vol. 10, no. 3, p. e1355, 2020.", "[1]"),
          createBullet("G. Siemens and P. Long, 'Penetrating the fog: Analytics in learning and education,' EDUCAUSE Review, vol. 46, no. 5, pp. 30–32, 2011.", "[2]"),
          createBullet("S. B. Kotsiantis, 'Use of machine learning techniques for educational proposes: a decision support system for forecasting students' grades,' Artificial Intelligence Review, vol. 37, no. 4, pp. 331–344, 2012.", "[3]"),
          createBullet("TanStack Team, 'TanStack Start: Full-Stack React Framework Documentation,' 2026. [Online]. Available: https://tanstack.com/start", "[4]"),
          createBullet("Supabase Inc., 'Supabase: The Open Source Firebase Alternative Architecture Guide,' 2026. [Online]. Available: https://supabase.com/docs", "[5]"),
          createBullet("Google Cloud & DeepMind, 'Google Gen AI SDK for TypeScript Documentation,' 2026. [Online]. Available: https://ai.google.dev/gemini-api/docs", "[6]"),
          createBullet("Razorpay Software Pvt. Ltd., 'Razorpay Standard Checkout & Payment Verification Guide,' 2026. [Online]. Available: https://razorpay.com/docs/payments", "[7]"),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT_DOCX, buffer);
  fs.writeFileSync(LOCAL_OUTPUT_DOCX, buffer);
  console.log(`Document successfully generated at:\n  - ${OUTPUT_DOCX}\n  - ${LOCAL_OUTPUT_DOCX}`);
}

buildDocx().catch((e) => console.error("Error generating docx:", e));
