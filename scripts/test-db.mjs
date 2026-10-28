import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

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

const url = env.VITE_SUPABASE_URL || "https://ruphrlqojhmaemgoilrc.supabase.co";
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log("Supabase URL:", url);
console.log("Supabase Key:", key ? key.substring(0, 15) + "..." : "none");

const supabase = createClient(url, key);

async function check() {
  const tables = ["students", "student_course_fees", "payment_transactions", "payment_audit_log"];
  for (const t of tables) {
    const { data, error, status } = await supabase.from(t).select("*").limit(1);
    console.log(`Table '${t}': status=${status}, error=${error ? JSON.stringify(error) : "none"}, count=${data?.length}`);
  }
}

check();
