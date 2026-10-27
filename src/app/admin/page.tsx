import { Workspace } from "@/components/workspace";
import { requireUser } from "@/lib/supabase/require-user";
import { connection } from "next/server";

export const instant = false;

export default async function AdminPage() {
  await connection();
  const user = await requireUser("admin");
  return <Workspace role="admin" user={user} />;
}
