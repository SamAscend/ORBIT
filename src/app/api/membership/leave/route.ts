import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

type LeaveRequest = {
  confirmation?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "This account-closure request must come from ORBIT." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "The leave request must use JSON." }, { status: 415 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "The leave request was not valid." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "The leave request was not valid." }, { status: 400 });
  }
  const body = payload as LeaveRequest;
  if (body.confirmation !== "LEAVE ORBIT" || typeof body.password !== "string" || !body.password || body.password.length > 1024) {
    return NextResponse.json({ error: "Confirm the request and enter your current password." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Sign in again before closing your account." }, { status: 401 });
  }
  if (user.app_metadata.role === "admin") {
    return NextResponse.json({ error: "Administrator accounts cannot use member account closure." }, { status: 403 });
  }
  if (!user.email) {
    return NextResponse.json({ error: "This account has no email address for password verification." }, { status: 400 });
  }

  const config = getSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !serviceRoleKey) {
    return NextResponse.json({ error: "Account closure is not configured. Contact an ORBIT administrator." }, { status: 503 });
  }

  const passwordClient = createSupabaseClient(config.url, config.key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error: passwordError } = await passwordClient.auth.signInWithPassword({
    email: user.email,
    password: body.password,
  });
  if (passwordError) {
    return NextResponse.json({ error: "The current password could not be verified." }, { status: 401 });
  }

  const adminClient = createSupabaseClient(config.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error: photoError } = await adminClient.storage
    .from("profile-photos")
    .remove([`${user.id}/avatar`]);
  if (photoError) {
    console.error("Could not remove the member's profile photo during account closure.", photoError);
    return NextResponse.json({ error: "The profile photo could not be removed, so the account was not closed. Please try again or contact an administrator." }, { status: 502 });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("Could not delete the member account.", deleteError);
    return NextResponse.json({ error: "The account could not be closed. Your membership data is still in place; please try again or contact an administrator." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
