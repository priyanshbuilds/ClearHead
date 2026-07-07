import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error || !users || users.users.length === 0) {
    console.error("No users found", error);
    return;
  }
  const user = users.users.find(u => u.email);
  if (!user) {
    console.error("No user with email found");
    return;
  }
  const userId = user.id;
  console.log("Testing morning-card with User:", user.email, "ID:", userId);

  // Poll server
  let serverUp = false;
  for(let i=0; i<15; i++) {
    try {
      const ping = await fetch('http://localhost:3001');
      if (ping.ok || ping.status === 404) {
        serverUp = true;
        break;
      }
    } catch(e) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!serverUp) {
    console.error("Server not up");
    return;
  }
  console.log("Server is up, making request to morning-card...");
  
  const res = await fetch('http://localhost:3001/api/morning-card', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CRON_SECRET}`
    },
    body: JSON.stringify({ userId })
  });

  console.log("Status:", res.status);
  console.log(await res.json());
}
run();
