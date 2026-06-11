import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const email = 'andreas@bodyfuel.test';
const password = 'Andreas2026!';

// Create user
const { data: userData, error: createErr } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { display_name: 'Andreas', role: 'client' },
});

if (createErr) {
  console.error('Create error:', createErr);
  process.exit(1);
}

console.log('Created user:', userData.user.id);

// Ensure profile + role exist (trigger should handle it, but double-check)
const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
const { data: roles } = await supabase.from('user_roles').select('*').eq('user_id', userData.user.id);

console.log('Profile:', profile);
console.log('Roles:', roles);
console.log('---');
console.log('Email:', email);
console.log('Password:', password);
