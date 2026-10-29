# KRYPTEDU — Project Diagrams & Architectural Models

This document compiles the formal architectural diagrams, structural blueprints, and behavioral workflows for **KRYPTEDU — Smart Campus Analytics**, modeled directly on the verified implementation.

---

## 1. System Architecture Diagram

```mermaid
flowchart TD
    subgraph Client_Tier["Client Tier (Presentation Layer)"]
        UI_Student["Student Portal<br/>(Profile, Attendance, Grades, Fees)"]
        UI_Faculty["Faculty Portal<br/>(Attendance Register, Marks Entry)"]
        UI_Admin["Admin Console<br/>(Fee Ledger, Save & Audit, Users)"]
        UI_Placement["Placement Dashboard<br/>(Placement Readiness, Risk Triage)"]
        UI_Interview["AI Mock Interview Studio<br/>(Speech-to-Text, Voice Rubric)"]
        UI_Insights["AI Insights Copilot<br/>(Multi-turn Query Engine)"]
    end

    subgraph Application_Tier["Application Tier (Nitro / TanStack Start Server)"]
        Router["TanStack Router & SSR Engine"]
        AuthMiddleware["RBAC Auth Middleware<br/>(requireSupabaseAuth)"]
        
        subgraph Server_Functions["Server Functions (createServerFn)"]
            Fn_Attendance["Attendance Service<br/>(Session & Record Management)"]
            Fn_Academics["Academics Service<br/>(Curriculum, Marks & CGPA)"]
            Fn_Scoring["Scoring Engine<br/>(5-Indicator Placement Risk)"]
            Fn_Payments["Payments & Audit Service<br/>(Razorpay & Audit Logs)"]
            Fn_Interview["Interview Engine<br/>(Dynamic Questions & Rubric)"]
            Fn_AI["Unified AI Service<br/>(ai.service.ts)"]
        end
    end

    subgraph External_Services["External Services & Cloud Infrastructure"]
        Gemini_API["Google Gemini API<br/>(@google/genai / gemini-3.8-flash)"]
        Razorpay_Gateway["Razorpay Payment Gateway<br/>(Orders & Signature Verification)"]
    end

    subgraph Data_Tier["Database Tier (Supabase PostgreSQL)"]
        DB_Auth["auth.users & profiles"]
        DB_Students["students table"]
        DB_Attendance["attendance_sessions & records"]
        DB_Academics["marks_records & curriculum"]
        DB_Fees["student_course_fees & fee_audit_logs"]
        DB_Interviews["mock_interviews & interventions"]
    end

    UI_Student & UI_Faculty & UI_Admin & UI_Placement & UI_Interview & UI_Insights --> Router
    Router --> AuthMiddleware
    AuthMiddleware --> Server_Functions

    Fn_Attendance --> DB_Attendance & DB_Students
    Fn_Academics --> DB_Academics & DB_Students
    Fn_Scoring --> DB_Academics & DB_Attendance & DB_Students
    Fn_Payments --> DB_Fees & Razorpay_Gateway
    Fn_Interview --> Gemini_API & DB_Interviews
    Fn_AI --> Gemini_API & DB_Students
    
    AuthMiddleware -.-> DB_Auth
```

---

## 2. Use Case Diagram

```mermaid
flowchart LR
    Student((Student))
    Faculty((Faculty))
    Admin((Administrator))
    Placement((Placement Officer))

    subgraph KRYPTEDU_Platform["KRYPTEDU Smart Campus Analytics"]
        UC1["View 360° Academic Profile & CGPA"]
        UC2["Check Published Attendance Register"]
        UC3["Take AI Mock Technical/HR Interview"]
        UC4["Pay Course Tuition via Razorpay"]
        UC5["Create Attendance Session & Mark Daily Records"]
        UC6["Enter Written (50) & Internal (50) Marks"]
        UC7["Publish Authoritative Semester Results"]
        UC8["Manage Student Fee Ledger with 'Save & Audit'"]
        UC9["Inspect Immutable Fee Audit Trail Logs"]
        UC10["Analyze Department Academic & Attendance Risk"]
        UC11["Evaluate 5-Indicator Placement Readiness"]
        UC12["Trigger & Manage Student Support Interventions"]
        UC13["Query AI Insights Conversational Copilot"]
        UC14["Import & Synchronize Official Campus CSV Dataset"]
    end

    Student --> UC1
    Student --> UC2
    Student --> UC3
    Student --> UC4

    Faculty --> UC5
    Faculty --> UC6
    Faculty --> UC7
    Faculty --> UC10
    Faculty --> UC12

    Admin --> UC8
    Admin --> UC9
    Admin --> UC10
    Admin --> UC14
    Admin --> UC13

    Placement --> UC11
    Placement --> UC12
    Placement --> UC13
    Placement --> UC3
```

---

## 3. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    STUDENTS ||--o{ ATTENDANCE_RECORDS : "has"
    STUDENTS ||--o{ MARKS_RECORDS : "achieves"
    STUDENTS ||--o{ STUDENT_COURSE_FEES : "incurs"
    STUDENTS ||--o{ FEE_AUDIT_LOGS : "audited under"
    STUDENTS ||--o{ MOCK_INTERVIEWS : "completes"
    STUDENTS ||--o{ INTERVENTIONS : "receives"
    
    ATTENDANCE_SESSIONS ||--|{ ATTENDANCE_RECORDS : "contains"
    
    STUDENTS {
        uuid id PK
        string roll_no UK
        string name
        string email UK
        string department
        int year_of_study
        int current_semester
        string phone
        uuid user_id FK
    }

    ATTENDANCE_SESSIONS {
        uuid id PK
        string subject_code
        string department
        int semester
        date session_date
        string status
        uuid marked_by FK
        timestamp created_at
    }

    ATTENDANCE_RECORDS {
        uuid id PK
        uuid session_id FK
        uuid student_id FK
        string status
        timestamp marked_at
    }

    MARKS_RECORDS {
        uuid id PK
        uuid student_id FK
        string subject_code
        int semester
        float written_marks
        float internal_marks
        float total_marks
        float grade_point
        string publication_status
        timestamp updated_at
    }

    STUDENT_COURSE_FEES {
        uuid id PK
        uuid student_id FK
        float total_fee
        string course_name
        date due_date
        string status
        timestamp updated_at
    }

    FEE_AUDIT_LOGS {
        uuid id PK
        uuid student_id FK
        uuid fee_id FK
        string changed_by
        float old_fee
        float new_fee
        string reason
        timestamp created_at
    }

    MOCK_INTERVIEWS {
        uuid id PK
        uuid student_id FK
        string role
        string track
        string level
        float score
        json transcript
        json evaluation_rubric
        timestamp created_at
    }

    INTERVENTIONS {
        uuid id PK
        uuid student_id FK
        string type
        string risk_level
        string assigned_to
        string status
        string notes
        timestamp created_at
    }
```

---

## 4. Data Flow Diagram Level 0 (Context Diagram)

```mermaid
flowchart TD
    User["Institutional Users<br/>(Student, Faculty, Admin, Placement)"]
    External_AI["Google Gemini AI Service"]
    External_Payment["Razorpay Payment Gateway"]
    
    Kryptedu_System(("KRYPTEDU — Smart Campus Analytics System"))

    User -- "1. Login Credentials, Attendance Marks, Exam Scores, Fee Adjustments" --> Kryptedu_System
    Kryptedu_System -- "2. Personalized Dashboard, Official CGPA, Risk Triage, Receipts" --> User

    Kryptedu_System -- "3. Anonymized Academic Prompts & Interview Transcripts" --> External_AI
    External_AI -- "4. Analytical Explanations, Follow-up Questions & Rubric Scores" --> Kryptedu_System

    Kryptedu_System -- "5. Payment Order Requests (Amount, Currency, Receipt ID)" --> External_Payment
    External_Payment -- "6. Verified Payment Signatures & Transaction IDs" --> Kryptedu_System
```

---

## 5. Data Flow Diagram Level 1 (Subsystems Flow)

```mermaid
flowchart TD
    User["Authenticated User"]
    
    subgraph DFD_Level_1["KRYPTEDU Core Processes"]
        P1["1.0 Authentication & Role Authorization"]
        P2["2.0 Student Academic & CGPA Processing"]
        P3["3.0 Attendance Recording & Aggregation"]
        P4["4.0 Placement Readiness & Risk Analytics"]
        P5["5.0 AI Insights & Mock Interview Engine"]
        P6["6.0 Fee Ledger & Audit Trail Processing"]
    end

    D1[("D1: Users & Profiles")]
    D2[("D2: Student Master Registry")]
    D3[("D3: Attendance Ledger")]
    D4[("D4: Academic Marks Ledger")]
    D5[("D5: Fee Ledger & Audit Trail")]
    D6[("D6: Interview & Intervention Logs")]

    User -->|Credentials| P1
    P1 <-->|Verify Claims & Roles| D1
    P1 -->|Authorized Context| P2 & P3 & P4 & P5 & P6

    P3 -->|New Session & Daily Marks| D3
    D3 -->|Published Attendance %| P4

    P2 -->|Written & Internal Marks| D4
    D4 -->|Credit Weighted CGPA| P4 & D2

    P4 -->|Combined Risk & Readiness Metrics| D6
    P4 -->|Cohort Risk Alerts| User

    P5 <-->|Question Context & Rubrics| D6
    P5 -->|Live Insights & Feedback| User

    P6 -->|Fee Adjustments + Mandatory Reason| D5
    D5 -->|Immutable Audit History| User
```

---

## 6. Authentication & RBAC Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Browser)
    participant Client as TanStack Start Client
    participant ServerFn as Server Function (createServerFn)
    participant AuthMW as requireSupabaseAuth Middleware
    participant SupabaseAuth as Supabase Auth (GoTrue)
    participant DB as PostgreSQL (profiles table)

    User->>Client: Enters Email & Password / Google OAuth
    Client->>SupabaseAuth: signInWithPassword({ email, password })
    SupabaseAuth-->>Client: Returns JWT Session (access_token, user_id)
    Client->>Client: Stores token securely & updates AuthContext

    User->>Client: Triggers Action (e.g. Publish Marks / Save Fee Audit)
    Client->>ServerFn: Invokes server function with request payload + Auth Headers
    ServerFn->>AuthMW: Executes middleware pipeline
    AuthMW->>SupabaseAuth: Validates JWT signature & expiry
    SupabaseAuth-->>AuthMW: Confirms valid token & userId
    AuthMW->>DB: Queries user role from profiles where id = userId
    DB-->>AuthMW: Returns role ("admin" | "faculty" | "student" | "placement_officer")
    
    alt Role Authorized
        AuthMW-->>ServerFn: Attaches verified { userId, role, claims } to context
        ServerFn->>ServerFn: Executes business logic & database mutation
        ServerFn-->>Client: Returns success response
        Client-->>User: Renders updated UI state & toast notification
    else Role Unauthorized (403 Forbidden)
        AuthMW-->>Client: Throws 403 Forbidden error
        Client-->>User: Displays unauthorized alert toast
    end
```

---

## 7. AI Insights & Placement Readiness Workflow Diagram

```mermaid
flowchart TD
    Start([User Initiates Query or Interview]) --> ContextBuild[Retrieve Student Context:<br/>Authoritative CGPA, Attendance %, Year, Dept]
    ContextBuild --> ModelFormula[Compute 5-Indicator Readiness:<br/>R = 0.25G + 0.25T + 0.20I + 0.20P + 0.10C]
    
    ModelFormula --> ClassifyRisk{Check Readiness Score R}
    ClassifyRisk -- "R >= 75" --> LowRisk[Classify as Low Risk / Placement Ready]
    ClassifyRisk -- "50 <= R < 75" --> ModRisk[Classify as Moderate Risk / Upskilling Needed]
    ClassifyRisk -- "R < 50" --> HighRisk[Classify as High Risk / Urgent Intervention]

    LowRisk & ModRisk & HighRisk --> PromptAssembly[Assemble Structured Prompt with Institutional Context]
    PromptAssembly --> CheckAIConfig{Is AI Provider Configured?}

    CheckAIConfig -- Yes --> CallGemini[Call Google Gemini API via @google/genai<br/>model: gemini-3.8-flash]
    CallGemini --> CheckResponse{API Call Successful?}
    
    CheckResponse -- Yes --> CacheStore[Store in 60s Idempotent Cache]
    CacheStore --> RenderAI[Render AI-Generated Insights / Interview Rubric]
    
    CheckResponse -- "Rate Limit (429) / Busy (503)" --> BackoffRetry[Exponential Backoff with Jitter]
    BackoffRetry --> CheckRetry{Retry Limit <= 2?}
    CheckRetry -- Yes --> CallGemini
    CheckRetry -- No --> LocalFallback
    
    CheckAIConfig -- No --> LocalFallback[Activate Local Deterministic Analytical Copilot<br/>and Static Rubric Question Bank]
    LocalFallback --> RenderDeterministic[Render Verified Offline Recommendations & Roadmap]
    
    RenderAI & RenderDeterministic --> End([Display in Chat / Interview Report])
```

---

## 8. Attendance and Academics Two-Way Sync Workflow

```mermaid
flowchart LR
    subgraph Trigger_Events["Trigger Events"]
        E1["Faculty Marks / Modifies Attendance"]
        E2["Faculty Enters / Modifies Marks"]
    end

    subgraph Supabase_DB["Supabase Authoritative Database"]
        T_Attendance[("attendance_records")]
        T_Marks[("marks_records")]
    end

    subgraph Synchronous_Recalculation["Shared Calculation Pipeline"]
        Calc_Att["Attendance Formula:<br/>Present / (Present + Absent) * 100"]
        Calc_CGPA["Academics CGPA Formula:<br/>SUM(Credits * GradePoint) / SUM(Credits)"]
        Calc_Risk["Authoritative Risk Recalculation:<br/>Academic Risk + 5-Indicator Placement Risk"]
    end

    subgraph Instantaneous_UI_Refresh["Synchronized UI Views"]
        V_Students["Students Registry & Profile Drawer"]
        V_Dashboard["Institutional Executive Dashboard"]
        V_Interventions["Intervention Triage Queue"]
        V_StudentPortal["Student Personal Portal"]
    end

    E1 -->|Update Status| T_Attendance
    E2 -->|Update Marks| T_Marks

    T_Attendance --> Calc_Att
    T_Marks --> Calc_CGPA

    Calc_Att & Calc_CGPA --> Calc_Risk
    Calc_Risk --> V_Students & V_Dashboard & V_Interventions & V_StudentPortal
```

---

## 9. Production Deployment Architecture Diagram

```mermaid
flowchart TD
    subgraph Global_Edge["Global Edge Network"]
        DNS["Institutional Domain DNS"]
        CDN["Cloudflare / Edge CDN (Static Assets & Caching)"]
    end

    subgraph Application_Host["Serverless Runtime Environment"]
        NitroSSR["Nitro SSR Worker (TanStack Start Node Server)"]
        EnvConfig["Server Environment (.env Server Secrets)"]
    end

    subgraph Managed_Cloud_Backend["Managed Cloud Backend"]
        Supabase["Supabase Cloud Infrastructure"]
        Postgres[(PostgreSQL 15+ Database)]
        GoTrue["Supabase GoTrue (Auth & JWT)"]
        Storage["Supabase Storage (PDF Receipts & Docs)"]
    end

    subgraph Enterprise_External_APIs["Enterprise External APIs"]
        GeminiCloud["Google Cloud Vertex / AI Studio (Gemini API)"]
        RazorpayCloud["Razorpay Payment Gateway Servers"]
    end

    ClientDevice["Client Browsers (Desktop & Mobile)"] --> DNS
    DNS --> CDN
    CDN --> NitroSSR
    NitroSSR --- EnvConfig
    
    NitroSSR -->|Encrypted HTTPS / REST| Supabase
    Supabase --> Postgres & GoTrue & Storage

    NitroSSR -->|TLS 1.3 Server-Side API| GeminiCloud
    NitroSSR -->|TLS 1.3 Server-Side API| RazorpayCloud
```
