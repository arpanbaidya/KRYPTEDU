import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
}

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log('Connecting to:', url);
const supabase = createClient(url, key);

async function check() {
  const { data: students, error: sErr, count } = await supabase.from('students').select('*', { count: 'exact' });
  if (sErr) {
    console.error('Error fetching students:', sErr);
    return;
  }
  console.log('Total students in DB:', students?.length, 'Count:', count);
  if (students && students.length > 0) {
    console.log('Sample student:', students[0]);
    const depts = [...new Set(students.map(s => s.department))];
    console.log('Current DB departments:', depts);
  }

  const { data: fees } = await supabase.from('student_course_fees').select('*');
  console.log('Total fee records in DB:', fees?.length);

  const { data: txs } = await supabase.from('payment_transactions').select('*');
  console.log('Total payment transactions in DB:', txs?.length);
  if (txs && txs.length > 0) {
    console.log('Sample transaction:', txs[0]);
  }
}

check().catch(console.error);
