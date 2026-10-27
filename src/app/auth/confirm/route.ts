import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return confirmationFailed(request);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return confirmationFailed(request);

  const destination = new URL(data.user.app_metadata.role === "admin" ? "/admin" : "/member", request.url);
  return NextResponse.redirect(destination);
}

function confirmationFailed(request: NextRequest) {
  const destination = new URL("/", request.url);
  destination.searchParams.set("auth", "confirmation-failed");
  return NextResponse.redirect(destination);
}
