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

async function run() {
  const { data: roles, error: rErr } = await supabase.from('user_roles').select('*');
  console.log('user_roles count:', roles?.length, 'error:', rErr);
  if (roles && roles.length > 0) {
    console.log('Sample roles:', roles.slice(0, 5));
  }
}

run();
