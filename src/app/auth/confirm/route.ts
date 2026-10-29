import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  try {
    const supabase = await createClient();
    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : tokenHash && (type === "signup" || type === "email" || type === "recovery")
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        : null;

    if (!result) return confirmationFailed(request);
    const { data, error } = result;
    if (error || !data.user) {
      if (error) console.error("Supabase email confirmation failed.", error);
      return confirmationFailed(request);
    }

    const requestedNext = request.nextUrl.searchParams.get("next");
    const destinationPath = requestedNext === "/auth/reset-password"
      ? requestedNext
      : data.user.app_metadata.role === "admin" ? "/admin" : "/member";
    const destination = new URL(destinationPath, request.url);
    return NextResponse.redirect(destination);
  } catch (error) {
    console.error("Could not complete the Supabase email confirmation callback.", error);
    return confirmationFailed(request);
  }
}

function confirmationFailed(request: NextRequest) {
  const destination = new URL("/", request.url);
  destination.searchParams.set("auth", "confirmation-failed");
  return NextResponse.redirect(destination);
}
