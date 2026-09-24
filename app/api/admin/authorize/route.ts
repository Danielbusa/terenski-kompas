import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!token || !url || !anonKey) {
    return Response.json({ allowed: false }, { status: 401 });
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return Response.json({ allowed: false }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role,approval_status")
    .eq("id", authData.user.id)
    .single();

  if (error || profile?.role !== "admin" || profile.approval_status !== "approved") {
    return Response.json({ allowed: false }, { status: 403 });
  }

  return Response.json({ allowed: true, userId: authData.user.id });
}
