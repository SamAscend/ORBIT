import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  const requestedRole = request.nextUrl.pathname.startsWith("/admin") ? "admin" : "member";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    const destination = new URL("/", request.url);
    destination.searchParams.set("setup", "required");
    destination.searchParams.set("mode", requestedRole);
    return NextResponse.redirect(destination);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const destination = new URL("/", request.url);
    destination.searchParams.set("mode", requestedRole);
    const redirectResponse = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  const actualRole = user.app_metadata.role === "admin" ? "admin" : "member";
  if (actualRole !== requestedRole) {
    const redirectResponse = NextResponse.redirect(new URL(`/${actualRole}`, request.url));
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/member/:path*"],
};
