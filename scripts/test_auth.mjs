import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);

async function testAuth() {
  const testEmail = `staff.sync.${Date.now()}@ustu.edu.in`;
  const testPassword = 'Password123!Secure';
  
  console.log('Attempting signUp with:', testEmail);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (signUpError) {
    console.error('SignUp Error:', signUpError);
    return;
  }

  console.log('SignUp Success! User:', signUpData.user?.id, 'Session:', !!signUpData.session);

  let client = supabase;
  if (!signUpData.session) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (signInError) {
      console.error('SignIn Error:', signInError);
      return;
    }
    console.log('SignIn Success!');
  }

  // Now test querying students!
  const { data: students, error: sErr, count } = await supabase
    .from('students')
    .select('id, roll_no, name, department', { count: 'exact' });

  if (sErr) {
    console.error('Query students error:', sErr);
  } else {
    console.log('Successfully queried students! Count:', count, 'Length:', students?.length);
    console.log('First 5 students:', students?.slice(0, 5));
  }
}

testAuth().catch(console.error);
