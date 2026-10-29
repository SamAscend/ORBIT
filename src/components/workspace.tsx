"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { User } from "@supabase/supabase-js";
import { OrbitLogo, OrbitSymbol } from "@/components/orbit-logo";

type WorkspaceRole = "admin" | "member";
type Counts = { members: number; events: number; quests: number; xp: number; crewNumber: number | null };
type ViewName = "Overview" | "Calendar" | "Events" | "Quests" | "Members" | "Membership" | "Profile";
type Participant = { userId: string; fullName: string; username: string };
type CommunityEvent = Pick<Database["public"]["Tables"]["events"]["Row"], "id" | "title" | "description" | "visibility" | "start_at" | "location" | "capacity" | "status"> & { registered?: boolean; participants?: Participant[] };
type CommunityQuest = Pick<Database["public"]["Tables"]["quests"]["Row"], "id" | "title" | "description" | "xp_reward" | "goal" | "deadline"> & { registered?: boolean; participants?: Participant[] };
type MembershipRecord = Pick<Database["public"]["Tables"]["memberships"]["Row"], "user_id" | "crew_number" | "status" | "created_at" | "sleep_until">;
type DirectoryMember = { userId: string; fullName: string; username: string; crewNumber: number; status: string; joinedAt: string; sleepUntil: string | null };
type ProfileData = { fullName: string; username: string; avatarUrl: string | null };
type WorkspaceData = { events: CommunityEvent[]; quests: CommunityQuest[]; members: DirectoryMember[] };
type EventDraft = { title: string; description: string; visibility: "public" | "private"; status: "open" | "cancelled" | "completed"; startAt: string; location: string; capacity: string };
type QuestDraft = { title: string; description: string; xpReward: string; goal: string; deadline: string };
type CommunityDetail = { kind: "event"; item: CommunityEvent } | { kind: "quest"; item: CommunityQuest };

function workspaceLoadErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return typeof error === "string" ? error : "Workspace data could not be loaded.";
  }

  const details = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const message = typeof details.message === "string" ? details.message : "Workspace data could not be loaded.";
  const code = typeof details.code === "string" ? details.code : "";
  const normalizedMessage = message.toLowerCase();

  if (
    code === "PGRST204"
    || code === "PGRST205"
    || code === "42703"
    || code === "42P01"
    || normalizedMessage.includes("schema cache")
    || normalizedMessage.includes("does not exist")
  ) {
    return "Database schema is missing the new ORBIT calendar/profile features. Run migration 202610270005_calendar_profiles_and_participation.sql in the Supabase SQL Editor, then reload this page.";
  }

  return message;
}

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Icon({ name }: { name: "grid" | "calendar" | "flag" | "users" | "card" | "settings" | "logout" | "eye" }) {
  const paths: Record<typeof name, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    flag: <><path d="M5 21V5" /><path d="M5 5c5-4 9 4 14 0v10c-5 4-9-4-14 0" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2-.7a6 6 0 0 0-.6-1.4l1-1.8-2.1-2.1-1.8 1a6 6 0 0 0-1.5-.6l-.6-2h-3l-.7 2a6 6 0 0 0-1.4.6l-1.8-1-2.1 2.1 1 1.8a6 6 0 0 0-.6 1.5l-2 .6v3l2 .7a6 6 0 0 0 .6 1.4l-1 1.8 2.1 2.1 1.8-1a6 6 0 0 0 1.5.6l.6 2h3l.7-2a6 6 0 0 0 1.4-.6l1.8 1 2.1-2.1-1-1.8a6 6 0 0 0 .6-1.5z" transform="translate(2 1) scale(.83)" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  };
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function Workspace({ role, user }: { role: WorkspaceRole; user: User }) {
  const router = useRouter();
  const [view, setView] = useState<ViewName>("Overview");
  const [greeting, setGreeting] = useState("Welcome");
  const [counts, setCounts] = useState<Counts>({ members: 0, events: 0, quests: 0, xp: 0, crewNumber: null });
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData>({ events: [], quests: [], members: [] });
  const [profileUsername, setProfileUsername] = useState("");
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [sleepUntil, setSleepUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<CommunityDetail | null>(null);

  const displayName = useMemo(() => {
    if (role === "admin") return "Admin";
    const name = profileData?.fullName ?? user.user_metadata.full_name;
    return typeof name === "string" && name.trim() ? name.trim().split(/\s+/)[0] : "Member";
  }, [profileData?.fullName, role, user.user_metadata.full_name]);

  useEffect(() => {
    const updateGreeting = () => setGreeting(greetingFor(new Date().getHours()));
    const timeout = window.setTimeout(updateGreeting, 0);
    const interval = window.setInterval(updateGreeting, 60_000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCounts() {
      setLoading(true);
      setError("");

      try {
        const supabase = createClient();
        const membershipQuery = role === "admin"
          ? supabase.from("memberships").select("user_id, crew_number, status, created_at, sleep_until").neq("status", "left").order("created_at", { ascending: false }).limit(1000)
          : supabase.from("memberships").select("user_id, crew_number, status, created_at, sleep_until", { count: "exact" }).eq("user_id", user.id).eq("status", "active").limit(1);
        const [membershipResult, eventResult, questResult] = await Promise.all([
          membershipQuery,
          supabase.from("events").select("id, title, description, visibility, start_at, location, capacity, status", { count: "exact" }).order("start_at", { ascending: true }).limit(1000),
          supabase.from("quests").select("id, title, description, xp_reward, goal, deadline", { count: "exact" }).order("created_at", { ascending: false }).limit(1000),
        ]);
        if (membershipResult.error) throw membershipResult.error;
        if (eventResult.error) throw eventResult.error;
        if (questResult.error) throw questResult.error;

        let xp = 0;
        const memberships = membershipResult.data as MembershipRecord[];
        let crewNumber: number | null = null;
        let directoryMembers: DirectoryMember[] = [];
        let profile: ProfileData | null = null;
        let memberEventRegistrations = new Set<string>();
        let memberQuestRegistrations = new Set<string>();
        const eventParticipants = new Map<string, Participant[]>();
        const questParticipants = new Map<string, Participant[]>();
        if (role === "admin") {
          const userIds = memberships.map((membership) => membership.user_id);
          const [profilesResult, eventRegistrationsResult, questRegistrationsResult] = await Promise.all([
            userIds.length
              ? supabase.from("profiles").select("id, full_name, username, is_admin").in("id", userIds)
              : Promise.resolve({ data: [], error: null }),
            supabase.from("event_registrations").select("event_id, user_id").eq("status", "registered"),
            supabase.from("quest_registrations").select("quest_id, user_id").eq("status", "registered"),
          ]);
          if (profilesResult.error) throw profilesResult.error;
          if (eventRegistrationsResult.error) throw eventRegistrationsResult.error;
          if (questRegistrationsResult.error) throw questRegistrationsResult.error;
          const profiles = new Map(profilesResult.data.map((memberProfile) => [memberProfile.id, { fullName: memberProfile.full_name, username: memberProfile.username, isAdmin: memberProfile.is_admin }]));
          directoryMembers = memberships.filter((membership) => !profiles.get(membership.user_id)?.isAdmin).map((membership) => ({
            userId: membership.user_id,
            fullName: profiles.get(membership.user_id)?.fullName ?? "Member",
            username: profiles.get(membership.user_id)?.username ?? "member",
            crewNumber: membership.crew_number,
            status: membership.status,
            joinedAt: membership.created_at,
            sleepUntil: membership.sleep_until,
          }));
          const attendeeIds = [...new Set([...eventRegistrationsResult.data, ...questRegistrationsResult.data].map((registration) => registration.user_id))];
          const attendeeProfilesResult = attendeeIds.length
            ? await supabase.from("profiles").select("id, full_name, username").in("id", attendeeIds)
            : { data: [], error: null };
          if (attendeeProfilesResult.error) throw attendeeProfilesResult.error;
          const attendeeProfiles = new Map(attendeeProfilesResult.data.map((attendee) => [attendee.id, { userId: attendee.id, fullName: attendee.full_name, username: attendee.username }]));
          for (const registration of eventRegistrationsResult.data) {
            const attendee = attendeeProfiles.get(registration.user_id);
            if (attendee) eventParticipants.set(registration.event_id, [...(eventParticipants.get(registration.event_id) ?? []), attendee]);
          }
          for (const registration of questRegistrationsResult.data) {
            const attendee = attendeeProfiles.get(registration.user_id);
            if (attendee) questParticipants.set(registration.quest_id, [...(questParticipants.get(registration.quest_id) ?? []), attendee]);
          }
        }
        if (role === "member") {
          crewNumber = memberships[0]?.crew_number ?? null;
          const [profileResult, xpResult, eventRegistrationsResult, questRegistrationsResult] = await Promise.all([
            supabase.from("profiles").select("full_name, username, avatar_url").eq("id", user.id).maybeSingle(),
            supabase.from("xp_ledger").select("points").eq("user_id", user.id),
            supabase.from("event_registrations").select("event_id").eq("user_id", user.id).eq("status", "registered"),
            supabase.from("quest_registrations").select("quest_id").eq("user_id", user.id).eq("status", "registered"),
          ]);
          if (profileResult.error) throw profileResult.error;
          if (xpResult.error) throw xpResult.error;
          if (eventRegistrationsResult.error) throw eventRegistrationsResult.error;
          if (questRegistrationsResult.error) throw questRegistrationsResult.error;
          memberEventRegistrations = new Set(eventRegistrationsResult.data.map((registration) => registration.event_id));
          memberQuestRegistrations = new Set(questRegistrationsResult.data.map((registration) => registration.quest_id));
          profile = profileResult.data ? { fullName: profileResult.data.full_name, username: profileResult.data.username, avatarUrl: profileResult.data.avatar_url } : null;
          setProfileUsername(profile?.username ?? "");
          setProfileData(profile);
          setSleepUntil(memberships[0]?.sleep_until ?? null);
          xp = xpResult.data.reduce((total, entry) => total + entry.points, 0);
        }

        if (active) {
          setCounts({
            members: directoryMembers.filter((member) => member.status === "active" && (!member.sleepUntil || new Date(member.sleepUntil) <= new Date())).length,
            events: eventResult.count ?? 0,
            quests: questResult.count ?? 0,
            xp,
            crewNumber,
          });
          setWorkspaceData({
            events: eventResult.data.map((communityEvent) => ({
              ...communityEvent,
              registered: memberEventRegistrations.has(communityEvent.id),
              participants: eventParticipants.get(communityEvent.id) ?? [],
            })),
            quests: questResult.data.map((communityQuest) => ({
              ...communityQuest,
              registered: memberQuestRegistrations.has(communityQuest.id),
              participants: questParticipants.get(communityQuest.id) ?? [],
            })),
            members: directoryMembers,
          });
        }
      } catch (loadError) {
        const message = workspaceLoadErrorMessage(loadError);
        console.warn("Could not load workspace data from Supabase.", {
          message,
          code: loadError && typeof loadError === "object" && "code" in loadError ? loadError.code : undefined,
          details: loadError && typeof loadError === "object" && "details" in loadError ? loadError.details : undefined,
          hint: loadError && typeof loadError === "object" && "hint" in loadError ? loadError.hint : undefined,
        });
        if (active) setError(message);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCounts();
    return () => { active = false; };
  }, [role, user.id, refreshKey]);

  async function toggleMemberAccess(member: DirectoryMember) {
    setError("");
    if (member.status === "active" && !window.confirm(`Suspend ${member.fullName}'s ORBIT access?`)) return;
    setMemberActionId(member.userId);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.from("memberships")
        .update({ status: member.status === "active" ? "suspended" : "active" })
        .eq("user_id", member.userId);
      if (updateError) throw updateError;
      setRefreshKey((key) => key + 1);
    } catch (actionError) {
      console.error("Could not update member access.", actionError);
      setError(actionError instanceof Error ? actionError.message : "Could not update member access.");
    } finally {
      setMemberActionId(null);
    }
  }

  async function toggleParticipation(detail: CommunityDetail) {
    if (role !== "member") return;
    setError("");
    try {
      const supabase = createClient();
      const isEvent = detail.kind === "event";
      const itemId = detail.item.id;
      const existing = isEvent
        ? await supabase.from("event_registrations").select("id, status").eq("event_id", itemId).eq("user_id", user.id).maybeSingle()
        : await supabase.from("quest_registrations").select("id, status").eq("quest_id", itemId).eq("user_id", user.id).maybeSingle();
      if (existing.error) throw existing.error;
      const nextStatus = detail.item.registered ? "cancelled" : "registered";
      const result = existing.data
        ? isEvent
          ? await supabase.from("event_registrations").update({ status: nextStatus }).eq("id", existing.data.id)
          : await supabase.from("quest_registrations").update({ status: nextStatus }).eq("id", existing.data.id)
        : isEvent
          ? await supabase.from("event_registrations").insert({ event_id: itemId, user_id: user.id })
          : await supabase.from("quest_registrations").insert({ quest_id: itemId, user_id: user.id });
      if (result.error) throw result.error;
      setSelectedDetail((current) => {
        if (!current || current.kind !== detail.kind || current.item.id !== itemId) return current;
        if (current.kind === "event") {
          return { kind: "event", item: { ...current.item, registered: nextStatus === "registered" } };
        }
        return { kind: "quest", item: { ...current.item, registered: nextStatus === "registered" } };
      });
      setRefreshKey((key) => key + 1);
    } catch (actionError) {
      console.error("Could not update event or quest participation.", actionError);
      setError(actionError instanceof Error ? actionError.message : "Could not update participation.");
    }
  }

  function updateProfile(profile: ProfileData) {
    setProfileData(profile);
    setProfileUsername(profile.username);
  }

  function updateSleepMode(until: string | null) {
    setSleepUntil(until);
    setRefreshKey((key) => key + 1);
  }

  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      window.location.replace("/");
    } catch (signOutError) {
      console.error("Could not sign out.", signOutError);
      setError(signOutError instanceof Error ? signOutError.message : "Could not sign out.");
      setSigningOut(false);
    }
  }

  const adminNavigation: { label: ViewName; icon: "grid" | "calendar" | "flag" | "users" }[] = [
    { label: "Overview", icon: "grid" },
    { label: "Calendar", icon: "calendar" },
    { label: "Events", icon: "calendar" },
    { label: "Quests", icon: "flag" },
    { label: "Members", icon: "users" },
  ];
  const memberNavigation: { label: ViewName; icon: "grid" | "calendar" | "flag" | "card" | "settings" }[] = [
    { label: "Overview", icon: "grid" },
    { label: "Calendar", icon: "calendar" },
    { label: "Events", icon: "calendar" },
    { label: "Quests", icon: "flag" },
    { label: "Membership", icon: "card" },
    { label: "Profile", icon: "settings" },
  ];
  const navigation = role === "admin" ? adminNavigation : memberNavigation;
  const activeView = view;

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link className="brand-lockup" href={role === "admin" ? "/admin" : "/member"}><OrbitLogo className="sidebar-orbit-logo" /></Link>
        <div className="community-switcher"><span className="community-avatar"><OrbitSymbol className="community-orbit-symbol" /></span><span className="community-switch-copy"><b>ORBIT</b><small>{role === "admin" ? "Admin workspace" : "Your community"}</small></span></div>
        <nav className="workspace-nav" aria-label={`${role} navigation`}>
          <span className="nav-group-label">{role === "admin" ? "ADMIN WORKSPACE" : "YOUR CREW"}</span>
          {navigation.map((item) => <button key={item.label} className={`nav-item ${activeView === item.label ? "active" : ""}`} onClick={() => setView(item.label)}><Icon name={item.icon} /><span>{item.label}</span></button>)}
        </nav>
        <div className="workspace-sidebar-bottom"><div className="sidebar-quote"><span>✳</span><p>{role === "admin" ? "A well-run community gives everyone room to grow." : "A crew is just people who keep showing up for each other."}</p><small>THE ORBIT WAY</small></div><div className="sidebar-footnote">MADE FOR THE MILES AHEAD <span>© 2026</span></div></div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar"><div className="workspace-header-left">{activeView !== "Overview" && <button className="workspace-back-button" onClick={() => setView("Overview")} aria-label="Back to overview"><span aria-hidden="true">←</span><span>Back</span></button>}<div className="breadcrumb"><span>ORBIT</span><span>›</span><b>{activeView}</b></div></div><div className="workspace-account"><span className={`role-chip ${role}`}>{role === "admin" ? "ADMIN" : "MEMBER"}</span><span className="avatar avatar-profile" aria-label="Profile photo" style={profileData?.avatarUrl ? { backgroundImage: `url("${profileData.avatarUrl}")`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>{profileData?.avatarUrl ? "" : role === "admin" ? "AD" : displayName.slice(0, 2).toUpperCase()}</span><div className="profile-copy"><b>{displayName}</b><small>{role === "admin" ? "Platform administrator" : profileUsername ? `@${profileUsername}` : "Crew member"}</small></div><button className="signout-button" onClick={signOut} disabled={signingOut} aria-label="Sign out"><Icon name="logout" /></button></div></header>
        <div className="workspace-content">
          <section className="welcome-row">
            <div><div className="eyebrow">{role === "admin" ? "PLATFORM ADMINISTRATION" : "YOUR ORBIT MEMBERSHIP"}</div><h1>{greeting}, {displayName} <span className="wave">✳</span></h1><p className="page-intro">{role === "admin" ? "Here’s a clear view of your ORBIT community." : "Your place in the crew, and everything happening around you."}</p></div>
            {role === "admin" && <span className="workspace-admin-badge"><Icon name="settings" /> Admin workspace</span>}
          </section>

          {error && <div className="workspace-error" role="alert"><b>Could not load your workspace.</b><span>{error}</span><button onClick={() => router.refresh()}>Try again</button></div>}

          {activeView === "Overview" && (role === "admin"
            ? <AdminOverview counts={counts} loading={loading} onNavigate={setView} />
            : <MemberOverview counts={counts} loading={loading} name={displayName} email={user.email ?? ""} events={workspaceData.events} quests={workspaceData.quests} onNavigate={setView} onViewDetail={setSelectedDetail} />)}
          {activeView === "Calendar" && <CalendarView events={workspaceData.events} quests={workspaceData.quests} onViewDetail={setSelectedDetail} />}
          {activeView === "Events" && (role === "admin"
            ? <EventManager events={workspaceData.events} adminId={user.id} onChanged={() => setRefreshKey((key) => key + 1)} onViewDetail={(item) => setSelectedDetail({ kind: "event", item })} />
            : <EmptyWorkspaceSection role={role} kind="events" count={counts.events} loading={loading} events={workspaceData.events} onViewDetail={setSelectedDetail} />)}
          {activeView === "Quests" && (role === "admin"
            ? <QuestManager quests={workspaceData.quests} adminId={user.id} onChanged={() => setRefreshKey((key) => key + 1)} onViewDetail={(item) => setSelectedDetail({ kind: "quest", item })} />
            : <EmptyWorkspaceSection role={role} kind="quests" count={counts.quests} loading={loading} quests={workspaceData.quests} onViewDetail={setSelectedDetail} />)}
          {activeView === "Members" && role === "admin" && <EmptyWorkspaceSection role={role} kind="members" count={counts.members} loading={loading} members={workspaceData.members} onToggleMemberAccess={toggleMemberAccess} memberActionId={memberActionId} />}
          {activeView === "Membership" && role === "member" && <MemberCard counts={counts} loading={loading} name={displayName} email={user.email ?? ""} sleepUntil={sleepUntil} />}
          {activeView === "Profile" && role === "member" && profileData && <MemberProfile profile={profileData} sleepUntil={sleepUntil} userId={user.id} onProfileSaved={updateProfile} onSleepModeChanged={updateSleepMode} />}
        </div>
        {selectedDetail && <CommunityDetailDialog detail={selectedDetail} role={role} sleeping={Boolean(sleepUntil && new Date(sleepUntil) > new Date())} onToggleParticipation={() => void toggleParticipation(selectedDetail)} onClose={() => setSelectedDetail(null)} />}
        <footer className="page-footer"><span>BUILT FOR THE MILES AHEAD <b>✳</b></span><span>ORBIT · Community, in motion.</span></footer>
      </main>
    </div>
  );
}

function AdminOverview({ counts, loading, onNavigate }: { counts: Counts; loading: boolean; onNavigate: (view: ViewName) => void }) {
  return <>
    <section className="metric-grid workspace-metrics">
      <Metric title="Members" value={counts.members} icon="users" loading={loading} />
      <Metric title="Events" value={counts.events} icon="calendar" loading={loading} />
      <Metric title="Quests" value={counts.quests} icon="flag" loading={loading} />
      <Metric title="Community" value="ORBIT" icon="grid" loading={loading} />
    </section>
    <section className="workspace-panel admin-welcome-panel"><span className="eyebrow">YOUR COMMUNITY, IN ONE PLACE</span><h2>Welcome to your admin workspace.</h2><p>Manage your members, create and update community events, and publish quests—all changes here update the live ORBIT workspace.</p></section>
    <section className="workspace-quicklinks"><button onClick={() => onNavigate("Members")}><span className="quicklink-icon green"><Icon name="users" /></span><span><b>Member directory</b><small>Review members and control access</small></span><span className="quicklink-arrow">↗</span></button><button onClick={() => onNavigate("Events")}><span className="quicklink-icon peach"><Icon name="calendar" /></span><span><b>Manage events</b><small>Create, edit, cancel, or remove events</small></span><span className="quicklink-arrow">↗</span></button><button onClick={() => onNavigate("Quests")}><span className="quicklink-icon lavender"><Icon name="flag" /></span><span><b>Manage quests</b><small>Create and update crew challenges</small></span><span className="quicklink-arrow">↗</span></button></section>
  </>;
}

function MemberOverview({ counts, loading, name, email, events, quests, onNavigate, onViewDetail }: { counts: Counts; loading: boolean; name: string; email: string; events: CommunityEvent[]; quests: CommunityQuest[]; onNavigate: (view: ViewName) => void; onViewDetail: (detail: CommunityDetail) => void }) {
  return <>
    <section className="member-welcome-card"><div className="welcome-card-copy"><span className="eyebrow">YOU’RE PART OF THE CREW</span><h2>Good to have you here, {name}.</h2><p>Your community membership is ready. Find an event or take on a quest when you’re ready.</p><button className="button button-primary" onClick={() => onNavigate("Events")}>Explore what’s happening <span>↗</span></button></div><OrbitSymbol className="welcome-card-mark" decorative /></section>
    <section className="metric-grid workspace-metrics member-metrics"><Metric title="My membership" value={counts.crewNumber === null ? "—" : `MZ-${String(counts.crewNumber).padStart(4, "0")}`} icon="card" loading={loading} /><Metric title="Community events" value={counts.events} icon="calendar" loading={loading} /><Metric title="Open quests" value={counts.quests} icon="flag" loading={loading} /><Metric title="My XP" value={counts.xp} icon="grid" loading={loading} /></section>
    <section className="content-grid member-content-grid"><div className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">A GOOD PLACE TO START</span><h2>Find your next moment</h2></div><button className="text-link" onClick={() => onNavigate("Events")}>See events <span>↗</span></button></div>{events.length === 0 ? <EmptyMessage title="No events just yet" detail="When an organizer adds an event, you’ll find it here." /> : <EventList events={events.slice(0, 3)} onView={(item) => onViewDetail({ kind: "event", item })} />}</div><div className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">PROGRESS, NOT PERFECTION</span><h2>Quests for you</h2></div><button className="text-link" onClick={() => onNavigate("Quests")}>Explore <span>↗</span></button></div>{quests.length === 0 ? <EmptyMessage title="Your next challenge is on its way" detail="New crew quests will show up here." /> : <QuestList quests={quests.slice(0, 3)} onView={(item) => onViewDetail({ kind: "quest", item })} />}</div></section>
    <p className="member-account-note">Signed in as <b>{email}</b>. Your member profile is managed by your account.</p>
  </>;
}

function MemberCard({ counts, loading, name, email, sleepUntil }: { counts: Counts; loading: boolean; name: string; email: string; sleepUntil: string | null }) {
  const crewId = counts.crewNumber === null ? "—" : `MZ-${String(counts.crewNumber).padStart(4, "0")}`;
  const sleeping = Boolean(sleepUntil && new Date(sleepUntil) > new Date());
  return <><section className="page-heading"><div><span className="eyebrow">YOUR COMMUNITY, YOUR CARD</span><h1>Membership</h1><p className="page-intro">Your place in the crew, always close at hand.</p></div></section>{sleeping && <div className="sleep-notice" role="status">Sleep mode is on until {new Date(sleepUntil!).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. Your membership card is hibernating.</div>}<div className={`member-card ${sleeping ? "member-card-sleeping" : ""}`}><div className="member-card-top"><div className="brand-lockup brand-light"><OrbitLogo className="card-orbit-logo" /></div><span className="card-chip">{sleeping ? "HIBERNATING" : "CREW MEMBER"}</span></div><div className="card-member-info"><span className="eyebrow">GOOD TO HAVE YOU HERE</span><h2>{name}</h2><span>{email}</span></div><div className="card-footer"><div><span className="eyebrow">YOUR CREW ID</span><b>{loading ? "…" : crewId}</b></div><span className="member-card-mark">✳</span></div></div></>;
}

function CalendarView({ events, quests, onViewDetail }: { events: CommunityEvent[]; quests: CommunityQuest[]; onViewDetail: (detail: CommunityDetail) => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const offset = (month.getDay() + 6) % 7;
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((offset + dayCount) / 7) * 7;
  const days = Array.from({ length: cellCount }, (_, index) => {
    const number = index - offset + 1;
    return number > 0 && number <= dayCount ? number : null;
  });
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const entriesOn = (day: number) => {
    const dateKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return [
      ...events.filter((item) => localDateKey(item.start_at) === dateKey).map((item) => ({ kind: "event" as const, item })),
      ...quests.filter((item) => item.deadline && localDateKey(item.deadline) === dateKey).map((item) => ({ kind: "quest" as const, item })),
    ];
  };
  return <section className="calendar-panel workspace-panel">
    <div className="calendar-heading"><div><span className="eyebrow">ORBIT SCHEDULE</span><h1>Community calendar</h1><p className="page-intro">Plan around upcoming events and quest deadlines.</p></div><div className="calendar-controls"><button type="button" className="button button-secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">‹</button><b>{monthLabel}</b><button type="button" className="button button-secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">›</button></div></div>
    <div className="calendar-grid" role="grid" aria-label={monthLabel}>
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
      {days.map((day, index) => {
        const entries = day === null ? [] : entriesOn(day);
        const today = day !== null && new Date().getFullYear() === month.getFullYear() && new Date().getMonth() === month.getMonth() && new Date().getDate() === day;
        return <div className={`calendar-day ${day === null ? "calendar-day-empty" : ""} ${today ? "calendar-day-today" : ""}`} role="gridcell" key={`${month.toISOString()}-${index}`}>
          {day !== null && <><span className="calendar-day-number">{day}</span><div className="calendar-day-items">{entries.map((entry) => <button type="button" className={`calendar-event calendar-event-${entry.kind}`} key={`${entry.kind}-${entry.item.id}`} onClick={() => onViewDetail(entry)} title={`${entry.kind === "event" ? "Event" : "Quest"}: ${entry.item.title}`}><span>{entry.kind === "event" ? "E" : "Q"}</span>{entry.item.title}</button>)}</div></>}
        </div>;
      })}
    </div>
    <div className="calendar-legend"><span><i className="legend-event" />Event</span><span><i className="legend-quest" />Quest deadline</span></div>
  </section>;
}

function localDateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function MemberProfile({ profile, sleepUntil, userId, onProfileSaved, onSleepModeChanged }: { profile: ProfileData; sleepUntil: string | null; userId: string; onProfileSaved: (profile: ProfileData) => void; onSleepModeChanged: (until: string | null) => void }) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [photo, setPhoto] = useState<File | null>(null);
  const [days, setDays] = useState("7");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const sleeping = Boolean(sleepUntil && new Date(sleepUntil) > new Date());

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      let avatarUrl = profile.avatarUrl;
      if (photo) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 5 * 1024 * 1024) {
          throw new Error("Choose a JPG, PNG, or WebP image up to 5 MB.");
        }
        const { error: uploadError } = await supabase.storage.from("profile-photos").upload(`${userId}/avatar`, photo, { upsert: true, contentType: photo.type });
        if (uploadError) throw uploadError;
        avatarUrl = `${supabase.storage.from("profile-photos").getPublicUrl(`${userId}/avatar`).data.publicUrl}?updated=${Date.now()}`;
      }
      const cleanName = fullName.trim();
      if (!cleanName) throw new Error("Display name cannot be empty.");
      const { error: updateError } = await supabase.from("profiles").update({ full_name: cleanName, avatar_url: avatarUrl }).eq("id", userId);
      if (updateError) throw updateError;
      onProfileSaved({ ...profile, fullName: cleanName, avatarUrl });
      setPhoto(null);
      setMessage("Profile updated.");
    } catch (saveError) {
      console.error("Could not update member profile.", saveError);
      setError(saveError instanceof Error ? saveError.message : "Could not update profile.");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The password confirmation does not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated.");
    } catch (passwordError) {
      console.error("Could not update member password.", passwordError);
      setError(passwordError instanceof Error ? passwordError.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSleepMode() {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const nextUntil = sleeping ? null : new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString();
      const { error: updateError } = await createClient().from("memberships").update({ sleep_until: nextUntil }).eq("user_id", userId).eq("status", "active");
      if (updateError) throw updateError;
      onSleepModeChanged(nextUntil);
      setMessage(sleeping ? "Sleep mode ended. Welcome back to ORBIT." : `Sleep mode is on for ${days} days.`);
    } catch (sleepError) {
      console.error("Could not update membership sleep mode.", sleepError);
      setError(sleepError instanceof Error ? sleepError.message : "Could not update sleep mode.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <section className="page-heading"><div><span className="eyebrow">YOUR ACCOUNT, YOUR SETTINGS</span><h1>Personal profile</h1><p className="page-intro">Update how you appear to your crew and manage your membership status.</p></div></section>
    {(error || message) && <div className={error ? "workspace-error" : "workspace-success"} role={error ? "alert" : "status"}>{error || message}</div>}
    <form className="workspace-panel profile-settings" onSubmit={saveProfile}>
      <div className="profile-photo-preview" aria-label="Current profile photo" style={profile.avatarUrl ? { backgroundImage: `url("${profile.avatarUrl}")`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>{profile.avatarUrl ? "" : profile.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</div>
      <label className="management-field">Display name<input value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={100} /></label>
      <label className="management-field">Profile photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /><small>JPG, PNG, or WebP, up to 5 MB.</small></label>
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
    </form>
    <form className="workspace-panel profile-settings" onSubmit={changePassword}>
      <div><span className="eyebrow">ACCOUNT SECURITY</span><h2>Change password</h2><p className="page-intro">Choose a new password with at least 8 characters.</p></div>
      <label className="management-field">New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required /></label>
      <label className="management-field">Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required /></label>
      <button className="button button-secondary" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
    </form>
    <section className="workspace-panel sleep-settings">
      <div><span className="eyebrow">MEMBERSHIP HIBERNATION</span><h2>{sleeping ? "Sleep mode is active" : "Take a break when you need one"}</h2><p className="page-intro">{sleeping ? `Your membership card is inactive until ${new Date(sleepUntil!).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. You can wake it up at any time.` : "While asleep, events and quests are hidden and you cannot join them. Your account and progress remain safe."}</p></div>
      {!sleeping && <label className="management-field">Sleep duration<select value={days} onChange={(event) => setDays(event.target.value)}><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></label>}
      <button className={sleeping ? "button button-primary" : "button button-secondary"} type="button" onClick={() => void toggleSleepMode()} disabled={busy}>{busy ? "Updating…" : sleeping ? "Wake membership" : "Enter sleep mode"}</button>
    </section>
  </>;
}

function EmptyWorkspaceSection({ role, kind, count, loading, events = [], quests = [], members = [], onToggleMemberAccess, memberActionId, onViewDetail }: { role: WorkspaceRole; kind: "events" | "quests" | "members"; count: number; loading: boolean; events?: CommunityEvent[]; quests?: CommunityQuest[]; members?: DirectoryMember[]; onToggleMemberAccess?: (member: DirectoryMember) => void; memberActionId?: string | null; onViewDetail?: (detail: CommunityDetail) => void }) {
  const title = kind === "events" ? "Events" : kind === "quests" ? "Quests & missions" : "Member directory";
  const detail = kind === "events" ? "Community events will appear here once they’re created." : kind === "quests" ? "Quests will appear here once an admin creates them." : "Member accounts appear here after people sign up.";
  const hasData = kind === "events" ? events.length > 0 : kind === "quests" ? quests.length > 0 : members.length > 0;
  return <><section className="page-heading"><div><span className="eyebrow">{role === "admin" ? "ORBIT COMMUNITY" : "YOUR ORBIT COMMUNITY"}</span><h1>{title}</h1><p className="page-intro">{role === "admin" ? "Review members and control member access." : "Everything here comes from your community workspace."}</p></div></section>{hasData ? <section className="workspace-panel data-list-panel">{kind === "events" && <EventList events={events} onView={onViewDetail ? (item) => onViewDetail({ kind: "event", item }) : undefined} />}{kind === "quests" && <QuestList quests={quests} onView={onViewDetail ? (item) => onViewDetail({ kind: "quest", item }) : undefined} />}{kind === "members" && <MemberList members={members} onToggleAccess={onToggleMemberAccess} busyMemberId={memberActionId} />}</section> : <section className="workspace-panel empty-page-panel"><span className="empty-illustration"><Icon name={kind === "events" ? "calendar" : kind === "quests" ? "flag" : "users"} /></span><span className="eyebrow">{loading ? "LOADING" : `${count} ${kind.toUpperCase()}`}</span><h2>{loading ? "Getting your workspace ready" : kind === "members" ? "The crew starts here." : "A fresh start."}</h2><p>{loading ? "Checking the latest ORBIT data." : detail}</p></section>}</>;
}

function localDateTimeValue(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function EventManager({ events, adminId, onChanged, onViewDetail }: { events: CommunityEvent[]; adminId: string; onChanged: () => void; onViewDetail: (event: CommunityEvent) => void }) {
  const emptyDraft: EventDraft = { title: "", description: "", visibility: "public", status: "open", startAt: "", location: "", capacity: "" };
  const [draft, setDraft] = useState<EventDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function editEvent(event: CommunityEvent) {
    setDraft({ title: event.title, description: event.description, visibility: event.visibility, status: event.status, startAt: localDateTimeValue(event.start_at), location: event.location, capacity: event.capacity === null ? "" : String(event.capacity) });
    setEditingId(event.id);
    setFormOpen(true);
    setError("");
  }

  function closeForm() {
    setDraft(emptyDraft);
    setEditingId(null);
    setFormOpen(false);
    setError("");
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: community, error: communityError } = await supabase.from("communities").select("id").eq("slug", "orbit").single();
      if (communityError) throw communityError;
      const values = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        visibility: draft.visibility,
        status: draft.status,
        start_at: new Date(draft.startAt).toISOString(),
        location: draft.location.trim(),
        capacity: draft.capacity ? Number(draft.capacity) : null,
      };
      const result = editingId
        ? await supabase.from("events").update(values).eq("id", editingId)
        : await supabase.from("events").insert({ ...values, created_by: adminId, community_id: community.id });
      if (result.error) throw result.error;
      closeForm();
      onChanged();
    } catch (saveError) {
      console.error("Could not save event.", saveError);
      setError(saveError instanceof Error ? saveError.message : "Could not save event.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvent(event: CommunityEvent) {
    if (!window.confirm(`Delete "${event.title}" and its registrations? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      const { error: deleteError } = await createClient().from("events").delete().eq("id", event.id);
      if (deleteError) throw deleteError;
      onChanged();
    } catch (deleteError) {
      console.error("Could not delete event.", deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete event.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <section className="page-heading management-heading"><div><span className="eyebrow">ORBIT COMMUNITY</span><h1>Events</h1><p className="page-intro">Create events and control their details, visibility, and status.</p></div><button className="button button-primary" onClick={() => { closeForm(); setFormOpen(true); }}>Create event <span>＋</span></button></section>
    {error && <div className="workspace-error" role="alert"><b>Event action failed.</b><span>{error}</span></div>}
    {formOpen && <form className="workspace-panel management-form" onSubmit={saveEvent}>
      <div className="management-form-heading"><div><span className="eyebrow">{editingId ? "UPDATE ORBIT EVENT" : "NEW ORBIT EVENT"}</span><h2>{editingId ? "Edit event" : "Create an event"}</h2></div></div>
      <div className="management-form-grid">
        <label className="management-field">Event name<input required maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label className="management-field">Date and time<input required type="datetime-local" value={draft.startAt} onChange={(event) => setDraft({ ...draft, startAt: event.target.value })} /></label>
        <label className="management-field">Location<input maxLength={160} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label>
        <label className="management-field">Capacity (optional)<input type="number" min="1" step="1" value={draft.capacity} onChange={(event) => setDraft({ ...draft, capacity: event.target.value })} /></label>
        <label className="management-field">Visibility<select value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as EventDraft["visibility"] })}><option value="public">Public to members</option><option value="private">Private</option></select></label>
        <label className="management-field">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as EventDraft["status"] })}><option value="open">Open</option><option value="cancelled">Cancelled</option><option value="completed">Completed</option></select></label>
        <label className="management-field management-field-wide">Description<textarea rows={4} maxLength={3000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      </div>
      <div className="management-form-actions"><button type="button" className="button button-secondary" onClick={closeForm} disabled={busy}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Create event"}</button></div>
    </form>}
    {events.length ? <section className="workspace-panel data-list-panel management-list"><EventList events={events} onEdit={editEvent} onDelete={deleteEvent} onView={onViewDetail} busy={busy} /></section> : <section className="workspace-panel empty-page-panel"><span className="empty-illustration"><Icon name="calendar" /></span><span className="eyebrow">0 EVENTS</span><h2>Ready to bring the crew together?</h2><p>Create the first event and it will appear here for members.</p></section>}
  </>;
}

function QuestManager({ quests, adminId, onChanged, onViewDetail }: { quests: CommunityQuest[]; adminId: string; onChanged: () => void; onViewDetail: (quest: CommunityQuest) => void }) {
  const emptyDraft: QuestDraft = { title: "", description: "", xpReward: "0", goal: "1", deadline: "" };
  const [draft, setDraft] = useState<QuestDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function editQuest(quest: CommunityQuest) {
    setDraft({ title: quest.title, description: quest.description, xpReward: String(quest.xp_reward), goal: String(quest.goal), deadline: quest.deadline ? localDateTimeValue(quest.deadline) : "" });
    setEditingId(quest.id);
    setFormOpen(true);
    setError("");
  }

  function closeForm() {
    setDraft(emptyDraft);
    setEditingId(null);
    setFormOpen(false);
    setError("");
  }

  async function saveQuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: community, error: communityError } = await supabase.from("communities").select("id").eq("slug", "orbit").single();
      if (communityError) throw communityError;
      const values = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        xp_reward: Number(draft.xpReward),
        goal: Number(draft.goal),
        deadline: draft.deadline ? new Date(draft.deadline).toISOString() : null,
      };
      const result = editingId
        ? await supabase.from("quests").update(values).eq("id", editingId)
        : await supabase.from("quests").insert({ ...values, created_by: adminId, community_id: community.id });
      if (result.error) throw result.error;
      closeForm();
      onChanged();
    } catch (saveError) {
      console.error("Could not save quest.", saveError);
      setError(saveError instanceof Error ? saveError.message : "Could not save quest.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuest(quest: CommunityQuest) {
    if (!window.confirm(`Delete "${quest.title}" and its submissions? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      const { error: deleteError } = await createClient().from("quests").delete().eq("id", quest.id);
      if (deleteError) throw deleteError;
      onChanged();
    } catch (deleteError) {
      console.error("Could not delete quest.", deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete quest.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <section className="page-heading management-heading"><div><span className="eyebrow">ORBIT COMMUNITY</span><h1>Quests &amp; missions</h1><p className="page-intro">Set goals and XP rewards, and control the quest deadline.</p></div><button className="button button-primary" onClick={() => { closeForm(); setFormOpen(true); }}>Create quest <span>＋</span></button></section>
    {error && <div className="workspace-error" role="alert"><b>Quest action failed.</b><span>{error}</span></div>}
    {formOpen && <form className="workspace-panel management-form" onSubmit={saveQuest}>
      <div className="management-form-heading"><div><span className="eyebrow">{editingId ? "UPDATE ORBIT QUEST" : "NEW ORBIT QUEST"}</span><h2>{editingId ? "Edit quest" : "Create a quest"}</h2></div></div>
      <div className="management-form-grid">
        <label className="management-field">Quest name<input required maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label className="management-field">Deadline (optional)<input type="datetime-local" value={draft.deadline} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} /></label>
        <label className="management-field">XP reward<input required type="number" min="0" step="1" value={draft.xpReward} onChange={(event) => setDraft({ ...draft, xpReward: event.target.value })} /></label>
        <label className="management-field">Goal<input required type="number" min="1" step="1" value={draft.goal} onChange={(event) => setDraft({ ...draft, goal: event.target.value })} /></label>
        <label className="management-field management-field-wide">Description<textarea rows={4} maxLength={3000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      </div>
      <div className="management-form-actions"><button type="button" className="button button-secondary" onClick={closeForm} disabled={busy}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Create quest"}</button></div>
    </form>}
    {quests.length ? <section className="workspace-panel data-list-panel management-list"><QuestList quests={quests} onEdit={editQuest} onDelete={deleteQuest} onView={onViewDetail} busy={busy} /></section> : <section className="workspace-panel empty-page-panel"><span className="empty-illustration"><Icon name="flag" /></span><span className="eyebrow">0 QUESTS</span><h2>Give the crew a challenge.</h2><p>Create a quest with a goal and XP reward to get started.</p></section>}
  </>;
}

function EventList({ events, onEdit, onDelete, onView, busy = false }: { events: CommunityEvent[]; onEdit?: (event: CommunityEvent) => void; onDelete?: (event: CommunityEvent) => void; onView?: (event: CommunityEvent) => void; busy?: boolean }) {
  return (
    <div className="workspace-data-list">
      {events.map((event) => (
        <article className="workspace-data-row" key={event.id}>
          <span className="quicklink-icon peach"><Icon name="calendar" /></span>
          <span className="workspace-data-copy">
            <b>{event.title}</b>
            <small>{new Date(event.start_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}{event.location ? ` · ${event.location}` : ""} · {event.visibility}{onEdit ? ` · ${event.participants?.length ?? 0} joined` : ""}</small>
          </span>
          <span className={`status-pill ${event.status === "open" ? "active" : "pending"}`}><i />{event.status}</span>
          {onView && <button type="button" className="button button-secondary detail-view-button" onClick={() => onView(event)} aria-label={`View details for ${event.title}`} title="View details"><Icon name="eye" /></button>}
          {onEdit && onDelete && (
            <div className="management-row-actions">
              <button className="button button-secondary" onClick={() => onEdit(event)} disabled={busy}>Edit</button>
              <button className="button button-danger" onClick={() => onDelete(event)} disabled={busy}>Delete</button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function QuestList({ quests, onEdit, onDelete, onView, busy = false }: { quests: CommunityQuest[]; onEdit?: (quest: CommunityQuest) => void; onDelete?: (quest: CommunityQuest) => void; onView?: (quest: CommunityQuest) => void; busy?: boolean }) {
  return <div className="workspace-data-list">{quests.map((quest) => <article className="workspace-data-row" key={quest.id}><span className="quicklink-icon lavender"><Icon name="flag" /></span><span className="workspace-data-copy"><b>{quest.title}</b><small>{quest.xp_reward} XP · Goal {quest.goal}{quest.deadline ? ` · Due ${new Date(quest.deadline).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : ""}{onEdit ? ` · ${quest.participants?.length ?? 0} joined` : ""}</small></span>{onView && <button type="button" className="button button-secondary detail-view-button" onClick={() => onView(quest)} aria-label={`View details for ${quest.title}`} title="View details"><Icon name="eye" /></button>}{onEdit && <div className="management-row-actions"><button className="button button-secondary" onClick={() => onEdit(quest)} disabled={busy}>Edit</button>{onDelete && <button className="button button-danger" onClick={() => onDelete(quest)} disabled={busy}>Delete</button>}</div>}</article>)}</div>;
}

function CommunityDetailDialog({ detail, role, sleeping, onToggleParticipation, onClose }: { detail: CommunityDetail; role: WorkspaceRole; sleeping: boolean; onToggleParticipation: () => void; onClose: () => void }) {
  const isEvent = detail.kind === "event";
  const title = detail.item.title;
  const participants = detail.item.participants ?? [];
  const deadlinePassed = detail.kind === "quest" && detail.item.deadline !== null && new Date(detail.item.deadline) <= new Date();
  const eventClosed = detail.kind === "event" && detail.item.status !== "open";

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card community-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="community-detail-title">
        <div className="modal-heading">
          <div><span className="eyebrow">{isEvent ? "ORBIT COMMUNITY EVENT" : "ORBIT COMMUNITY QUEST"}</span><h2 id="community-detail-title">{title}</h2></div>
          <button className="button button-secondary" onClick={onClose} aria-label="Close details">Close</button>
        </div>
        {isEvent
          ? <div className="community-detail-content">
              <p>{detail.item.description || "No description provided."}</p>
              <dl className="community-detail-list">
                <div><dt>Date and time</dt><dd>{new Date(detail.item.start_at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}</dd></div>
                <div><dt>Location</dt><dd>{detail.item.location || "Not specified"}</dd></div>
                <div><dt>Capacity</dt><dd>{detail.item.capacity === null ? role === "admin" ? `${participants.length} joined` : "No limit" : role === "admin" ? `${participants.length} / ${detail.item.capacity} joined` : `${detail.item.capacity} maximum attendees`}</dd></div>
                <div><dt>Visibility</dt><dd>{detail.item.visibility}</dd></div>
                <div><dt>Status</dt><dd>{detail.item.status}</dd></div>
              </dl>
            </div>
          : <div className="community-detail-content">
              <p>{detail.item.description || "No description provided."}</p>
              <dl className="community-detail-list">
                <div><dt>XP reward</dt><dd>{detail.item.xp_reward} XP</dd></div>
                <div><dt>Goal</dt><dd>{detail.item.goal}</dd></div>
                <div><dt>Deadline</dt><dd>{detail.item.deadline ? new Date(detail.item.deadline).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" }) : "No deadline"}</dd></div>
              </dl>
            </div>}
        {role === "admin" && <section className="participant-list"><h3>Joined members ({participants.length})</h3>{participants.length ? <ul>{participants.map((participant) => <li key={participant.userId}><b>{participant.fullName}</b><span>@{participant.username}</span></li>)}</ul> : <p>No members have joined yet.</p>}</section>}
        {role === "member" && <div className="participation-actions">{sleeping && <p>Your membership is asleep, so you can’t join activities right now.</p>}<button type="button" className={`button ${detail.item.registered ? "button-secondary" : "button-primary"}`} onClick={onToggleParticipation} disabled={sleeping || (!detail.item.registered && (eventClosed || deadlinePassed))}>{detail.item.registered ? "Leave activity" : "Join activity"}</button></div>}
      </section>
    </div>
  );
}

function MemberList({ members, onToggleAccess, busyMemberId }: { members: DirectoryMember[]; onToggleAccess?: (member: DirectoryMember) => void; busyMemberId?: string | null }) {
  return <div className="workspace-data-list">{members.map((member) => {
    const sleeping = Boolean(member.sleepUntil && new Date(member.sleepUntil) > new Date());
    return <article className="workspace-data-row" key={member.userId}><span className="avatar">{member.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span><span className="workspace-data-copy"><b>{member.fullName}</b><small>@{member.username} · MZ-{String(member.crewNumber).padStart(4, "0")} · Joined {new Date(member.joinedAt).toLocaleDateString()}{sleeping ? ` · Asleep until ${new Date(member.sleepUntil!).toLocaleDateString()}` : ""}</small></span><span className={`status-pill ${sleeping ? "paused" : member.status === "active" ? "active" : "pending"}`}><i />{sleeping ? "sleeping" : member.status}</span>{onToggleAccess && member.status !== "left" && <button className={member.status === "active" ? "button button-danger" : "button button-secondary"} onClick={() => onToggleAccess(member)} disabled={busyMemberId === member.userId}>{busyMemberId === member.userId ? "Updating…" : member.status === "active" ? "Suspend" : "Reactivate"}</button>}</article>;
  })}</div>;
}

function Metric({ title, value, icon, loading }: { title: string; value: number | string; icon: "users" | "calendar" | "flag" | "grid" | "card"; loading: boolean }) {
  const tone = icon === "users" || icon === "card" ? "green" : icon === "calendar" ? "peach" : icon === "flag" ? "lavender" : "yellow";
  return <article className="metric-card"><div className="metric-top"><span>{title}</span><span className={`metric-icon ${tone}`}><Icon name={icon} /></span></div><strong>{loading ? "…" : typeof value === "number" ? value.toLocaleString() : value}</strong><span className="metric-change">Live ORBIT data</span></article>;
}

function EmptyMessage({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-message"><span>✳</span><b>{title}</b><p>{detail}</p></div>;
}
