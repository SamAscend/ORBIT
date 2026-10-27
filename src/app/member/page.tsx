import { Workspace } from "@/components/workspace";
import { requireUser } from "@/lib/supabase/require-user";
import { connection } from "next/server";

export const instant = false;

export default async function MemberPage() {
  await connection();
  const user = await requireUser("member");
  return <Workspace role="member" user={user} />;
}
