import { withSupabase } from 'npm:@supabase/server@^1';

type Profile = {
  user_id: string;
  username: string;
  role: string;
};

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, ctx) => {
    const callerId = ctx.userClaims?.id;
    if (!callerId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: caller, error: callerError } = await ctx.supabase
      .from('users')
      .select('role')
      .eq('user_id', callerId)
      .single();

    if (callerError || caller?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (request.method === 'GET') {
      const users = [];

      for (let page = 1; ; page += 1) {
        const { data, error } = await ctx.supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
        if (error) return Response.json({ error: 'Could not load users' }, { status: 500 });

        const ids = data.users.map((user) => user.id);
        if (ids.length === 0) break;

        const { data: profiles, error: profilesError } = await ctx.supabaseAdmin
          .from('users')
          .select('user_id, username, role')
          .in('user_id', ids);

        if (profilesError) return Response.json({ error: 'Could not load users' }, { status: 500 });

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
      return Response.json({ users });
    }

    if (request.method === 'DELETE') {
      let body: { userId?: unknown };
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'Invalid request' }, { status: 400 });
      }

      const targetId = body.userId;
      if (typeof targetId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
        return Response.json({ error: 'Invalid user ID' }, { status: 400 });
      }
      if (targetId.toLowerCase() === callerId.toLowerCase()) {
        return Response.json({ error: 'You cannot delete your own account here' }, { status: 400 });
      }

      const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(targetId);
      if (error) return Response.json({ error: 'Could not delete user' }, { status: 500 });

      return Response.json({ deleted: true });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }),
};
