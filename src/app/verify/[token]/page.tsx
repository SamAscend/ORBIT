import { OrbitLogo } from "@/components/orbit-logo";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";

export const instant = false;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function VerifyMembershipPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  let member: { member_name: string; crew_number: number } | null = null;
  let verificationError = "";

  if (uuidPattern.test(token)) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("verify_orbit_membership", { p_token: token });
      if (error) throw error;
      member = data[0] ?? null;
    } catch (error) {
      console.error("Could not verify an ORBIT membership.", error);
      verificationError = "Live verification is temporarily unavailable. Please try again.";
    }
  }

  return <main className="verification-page">
    <section className="verification-panel">
      <div className="verification-brand"><OrbitLogo className="verification-logo" /></div>
      {verificationError
        ? <><span className="eyebrow">ORBIT MEMBERSHIP CHECK</span><h1>Could not verify right now</h1><p>{verificationError}</p></>
        : member
          ? <><span className="verification-status valid">CURRENT MEMBER</span><h1>Membership verified</h1><p>This membership is currently active in ORBIT.</p><dl><div><dt>Member</dt><dd>{member.member_name}</dd></div><div><dt>Crew ID</dt><dd>MZ-{String(member.crew_number).padStart(4, "0")}</dd></div></dl></>
          : <><span className="verification-status invalid">NOT ACTIVE</span><h1>Membership not active</h1><p>This card does not match a current active ORBIT membership. Ask the member to contact an administrator if this seems incorrect.</p></>}
      <small>ORBIT · Community, in motion.</small>
    </section>
  </main>;
}
