import { createClient } from 'npm:@supabase/supabase-js@^2';

type Profile = {
  user_id: string;
  username: string;
  role: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Server configuration is incomplete' }, 500);
  }
  if (!authorization) return json({ error: 'Unauthorized' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  const callerId = authData.user?.id;
  if (authError || !callerId) return json({ error: 'Unauthorized' }, 401);

  const { data: caller, error: callerError } = await adminClient
    .from('users')
    .select('role')
    .eq('user_id', callerId)
    .single();

  if (callerError || caller?.role !== 'admin') {
    return json({ error: 'Forbidden' }, 403);
  }

  if (request.method === 'GET') {
    const users = [];

    for (let page = 1; ; page += 1) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
      if (error) return json({ error: 'Could not load users' }, 500);

      const ids = data.users.map((user) => user.id);
      if (ids.length === 0) break;

      const { data: profiles, error: profilesError } = await adminClient
        .from('users')
        .select('user_id, username, role')
        .in('user_id', ids);

      if (profilesError) return json({ error: 'Could not load users' }, 500);

      const profilesById = new Map(((profiles ?? []) as Profile[]).map((profile) => [profile.user_id, profile]));
      users.push(...data.users.map((user) => ({
        userId: user.id,
        username: profilesById.get(user.id)?.username ?? 'Unknown user',
        email: user.email ?? null,
        role: profilesById.get(user.id)?.role ?? 'user',
      })));

      if (data.users.length < 100) break;
    }

    users.sort((a, b) => a.username.localeCompare(b.username));
    return json({ users });
  }

  if (request.method === 'DELETE') {
    let body: { userId?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid request' }, 400);
    }

    const targetId = body.userId;
    if (typeof targetId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
      return json({ error: 'Invalid user ID' }, 400);
    }
    if (targetId.toLowerCase() === callerId.toLowerCase()) {
      return json({ error: 'You cannot delete your own account here' }, 400);
    }

    const { error } = await adminClient.auth.admin.deleteUser(targetId);
    if (error) return json({ error: 'Could not delete user' }, 500);

    return json({ deleted: true });
  }

  return json({ error: 'Method not allowed' }, 405);
});
