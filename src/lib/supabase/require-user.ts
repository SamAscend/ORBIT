import { redirect } from "next/navigation";
import { createClient } from "./server";

export async function requireUser(role: "admin" | "member") {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect(`/?mode=${role}`);

  const actualRole = user.app_metadata.role === "admin" ? "admin" : "member";
  if (actualRole !== role) redirect(`/${actualRole}`);

  if (role === "member") {
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) redirect("/?access=membership");
  }

  return user;
}
