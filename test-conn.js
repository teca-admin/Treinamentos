import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('https://teca-admin-supabase.ly7t0m.easypanel.host/');
    console.log('Status:', res.status);
  } catch (e) {
    console.error('Fetch failed:', e.message);
  }
}
test();
