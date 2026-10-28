import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);

const passwords = ['password', 'Password123', 'Password123!', 'Admin123!', 'admin123', 'kryptedu', 'kryptedu123'];

async function tryLogin() {
  for (const p of passwords) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'demo.admin@kryptedu-demo.example',
      password: p
    });
    if (data?.session) {
      console.log('Success with password:', p);
      return data.session;
    }
  }
  console.log('Passwords did not match demo.admin');
}

tryLogin().catch(console.error);
