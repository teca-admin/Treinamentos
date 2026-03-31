import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/config/supabase');
    const data = await res.json();
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}
test();
