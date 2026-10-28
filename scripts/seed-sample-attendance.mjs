import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env
const envPath = path.resolve("c:/Users/Admin/Desktop/Project/grade-galaxy-sync-main/.env");
const envText = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let v = m[2] || "";
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[m[1]] = v;
  }
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

console.log("=== KRYPTEDU REPEATABLE SAMPLE ATTENDANCE SEEDER ===");
console.log("Supabase URL:", env.VITE_SUPABASE_URL);

// Canonical departments & proportions
const CANONICAL_DEPTS = [
  "Computer Engineering",
  "Artificial Intelligence and Machine Learning",
  "Cyber security & Forensics",
];

async function seed() {
  // Check if tables are available in Supabase
  const { error: checkErr } = await supabase.from("attendance_sessions").select("id").limit(1);
  if (checkErr) {
    console.log("Note: Supabase table 'attendance_sessions' is pending schema execution in SQL Editor.");
    console.log("Code is: " + checkErr.code + " — " + checkErr.message);
    console.log("The SQL migration '0013_attendance_management_system.sql' contains the full seed data.");
    return;
  }

  // 1. Fetch official students from database
  const { data: students, error: stuErr } = await supabase
    .from("students")
    .select("id, roll_no, name, department");

  if (stuErr || !students || students.length === 0) {
    console.log("No students retrieved from public.students. Aborting DB seed.");
    return;
  }

  console.log(`Found ${students.length} students in public.students.`);

  // 2. Generate 7 past days of sample attendance
  const today = new Date();
  let sessionsCreated = 0;
  let recordsCreated = 0;

  for (let offset = 1; offset <= 7; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    // Skip weekends (Sunday=0, Saturday=6)
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const dateStr = d.toISOString().split("T")[0];

    for (const dept of CANONICAL_DEPTS) {
      const deptStudents = students.filter((s) => s.department === dept);
      if (deptStudents.length === 0) continue;

      // Check existing session
      const { data: existingSess } = await supabase
        .from("attendance_sessions")
        .select("id, is_sample")
        .eq("department", dept)
        .eq("attendance_date", dateStr)
        .maybeSingle();

      let sessionId = existingSess?.id;

      if (!existingSess) {
        // Create new sample session
        const { data: newSess, error: sErr } = await supabase
          .from("attendance_sessions")
          .insert({
            department: dept,
            attendance_date: dateStr,
            status: "published",
            is_sample: true,
            notes: "Sample Data — Universal College of Engineering Historical Session",
            submitted_at: d.toISOString(),
          })
          .select("id")
          .single();

        if (sErr) {
          console.warn(`Could not create session for ${dept} on ${dateStr}:`, sErr.message);
          continue;
        }
        sessionId = newSess.id;
        sessionsCreated++;
      } else if (!existingSess.is_sample) {
        // Do NOT overwrite genuine attendance
        console.log(`Preserving genuine attendance for ${dept} on ${dateStr}.`);
        continue;
      }

      // Populate student records
      const recordsToInsert = [];
      deptStudents.forEach((stu, idx) => {
        // Realistic distribution: ~82% Present, ~12% Absent, ~6% Not Considered
        let status = "present";
        if ((idx + offset) % 17 === 0) status = "not_considered";
        else if ((idx + offset) % 8 === 0) status = "absent";

        recordsToInsert.push({
          session_id: sessionId,
          student_id: stu.id,
          status,
          is_sample: true,
        });
      });

      const { data: inserted, error: rErr } = await supabase
        .from("attendance_records")
        .upsert(recordsToInsert, { onConflict: "session_id,student_id" })
        .select("id");

      if (!rErr) {
        recordsCreated += recordsToInsert.length;
      }
    }
  }

  console.log(`Seeding complete: ${sessionsCreated} sessions, ${recordsCreated} records created/updated.`);
}

seed().catch(console.error);
