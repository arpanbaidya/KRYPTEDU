import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve('c:/Users/Admin/Desktop/Project/grade-galaxy-sync-main/.env');
const envText = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let v = m[2] || '';
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[m[1]] = v;
  }
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function check() {
  const { data: sess, error: sErr } = await supabase.from('attendance_sessions').select('*').limit(1);
  console.log('attendance_sessions:', sess, sErr);

  const { data: recs, error: rErr } = await supabase.from('attendance_records').select('*').limit(1);
  console.log('attendance_records:', recs, rErr);
}

check();
