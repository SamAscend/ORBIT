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
type ViewName = "Overview" | "Events" | "Quests" | "Members" | "Membership";
type CommunityEvent = Pick<Database["public"]["Tables"]["events"]["Row"], "id" | "title" | "description" | "visibility" | "start_at" | "location" | "capacity" | "status">;
type CommunityQuest = Pick<Database["public"]["Tables"]["quests"]["Row"], "id" | "title" | "description" | "xp_reward" | "goal" | "deadline">;
type MembershipRecord = Pick<Database["public"]["Tables"]["memberships"]["Row"], "user_id" | "crew_number" | "status" | "created_at">;
type DirectoryMember = { userId: string; fullName: string; username: string; crewNumber: number; status: string; joinedAt: string };
type WorkspaceData = { events: CommunityEvent[]; quests: CommunityQuest[]; members: DirectoryMember[] };
type EventDraft = { title: string; description: string; visibility: "public" | "private"; status: "open" | "cancelled" | "completed"; startAt: string; location: string; capacity: string };
type QuestDraft = { title: string; description: string; xpReward: string; goal: string; deadline: string };

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Icon({ name }: { name: "grid" | "calendar" | "flag" | "users" | "card" | "settings" | "logout" }) {
  const paths: Record<typeof name, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    flag: <><path d="M5 21V5" /><path d="M5 5c5-4 9 4 14 0v10c-5 4-9-4-14 0" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2-.7a6 6 0 0 0-.6-1.4l1-1.8-2.1-2.1-1.8 1a6 6 0 0 0-1.5-.6l-.6-2h-3l-.7 2a6 6 0 0 0-1.4.6l-1.8-1-2.1 2.1 1 1.8a6 6 0 0 0-.6 1.5l-2 .6v3l2 .7a6 6 0 0 0 .6 1.4l-1 1.8 2.1 2.1 1.8-1a6 6 0 0 0 1.5.6l.6 2h3l.7-2a6 6 0 0 0 1.4-.6l1.8 1 2.1-2.1-1-1.8a6 6 0 0 0 .6-1.5z" transform="translate(2 1) scale(.83)" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);

  const displayName = useMemo(() => {
    if (role === "admin") return "Admin";
    const name = user.user_metadata.full_name;
    return typeof name === "string" && name.trim() ? name.trim().split(/\s+/)[0] : "Member";
  }, [role, user.user_metadata.full_name]);

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
          ? supabase.from("memberships").select("user_id, crew_number, status, created_at").neq("status", "left").order("created_at", { ascending: false }).limit(1000)
          : supabase.from("memberships").select("user_id, crew_number, status, created_at", { count: "exact" }).eq("user_id", user.id).eq("status", "active").limit(1);
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
        if (role === "admin" && memberships.length > 0) {
          const userIds = memberships.map((membership) => membership.user_id);
          const profilesResult = await supabase.from("profiles").select("id, full_name, username, is_admin").in("id", userIds);
          if (profilesResult.error) throw profilesResult.error;
          const profiles = new Map(profilesResult.data.map((profile) => [profile.id, { fullName: profile.full_name, username: profile.username, isAdmin: profile.is_admin }]));
          directoryMembers = memberships.filter((membership) => !profiles.get(membership.user_id)?.isAdmin).map((membership) => ({
            userId: membership.user_id,
            fullName: profiles.get(membership.user_id)?.fullName ?? "Member",
            username: profiles.get(membership.user_id)?.username ?? "member",
            crewNumber: membership.crew_number,
            status: membership.status,
            joinedAt: membership.created_at,
          }));
        }
        if (role === "member") {
          crewNumber = memberships[0]?.crew_number ?? null;
          const [profileResult, xpResult] = await Promise.all([
            supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
            supabase.from("xp_ledger").select("points").eq("user_id", user.id),
          ]);
          if (profileResult.error) throw profileResult.error;
          if (xpResult.error) throw xpResult.error;
          setProfileUsername(profileResult.data?.username ?? "");
          xp = xpResult.data.reduce((total, entry) => total + entry.points, 0);
        }

        if (active) {
          setCounts({
            members: directoryMembers.filter((member) => member.status === "active").length,
            events: eventResult.count ?? 0,
            quests: questResult.count ?? 0,
            xp,
            crewNumber,
          });
          setWorkspaceData({
            events: eventResult.data,
            quests: questResult.data,
            members: directoryMembers,
          });
        }
      } catch (loadError) {
        console.error("Could not load workspace data from Supabase.", loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : "Workspace data could not be loaded.");
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

  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/");
      router.refresh();
    } catch (signOutError) {
      console.error("Could not sign out.", signOutError);
      setError(signOutError instanceof Error ? signOutError.message : "Could not sign out.");
      setSigningOut(false);
    }
  }

  const adminNavigation: { label: ViewName; icon: "grid" | "calendar" | "flag" | "users" }[] = [
    { label: "Overview", icon: "grid" },
    { label: "Events", icon: "calendar" },
    { label: "Quests", icon: "flag" },
    { label: "Members", icon: "users" },
  ];
  const memberNavigation: { label: ViewName; icon: "grid" | "calendar" | "flag" | "card" }[] = [
    { label: "Overview", icon: "grid" },
    { label: "Events", icon: "calendar" },
    { label: "Quests", icon: "flag" },
    { label: "Membership", icon: "card" },
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
        <header className="workspace-topbar"><div className="workspace-header-left">{activeView !== "Overview" && <button className="workspace-back-button" onClick={() => setView("Overview")} aria-label="Back to overview"><span aria-hidden="true">←</span><span>Back</span></button>}<div className="breadcrumb"><span>ORBIT</span><span>›</span><b>{activeView}</b></div></div><div className="workspace-account"><span className={`role-chip ${role}`}>{role === "admin" ? "ADMIN" : "MEMBER"}</span><span className="avatar avatar-profile">{role === "admin" ? "AD" : displayName.slice(0, 2).toUpperCase()}</span><div className="profile-copy"><b>{displayName}</b><small>{role === "admin" ? "Platform administrator" : profileUsername ? `@${profileUsername}` : "Crew member"}</small></div><button className="signout-button" onClick={signOut} disabled={signingOut} aria-label="Sign out"><Icon name="logout" /></button></div></header>
        <div className="workspace-content">
          <section className="welcome-row">
            <div><div className="eyebrow">{role === "admin" ? "PLATFORM ADMINISTRATION" : "YOUR ORBIT MEMBERSHIP"}</div><h1>{greeting}, {displayName} <span className="wave">✳</span></h1><p className="page-intro">{role === "admin" ? "Here’s a clear view of your ORBIT community." : "Your place in the crew, and everything happening around you."}</p></div>
            {role === "admin" && <span className="workspace-admin-badge"><Icon name="settings" /> Admin workspace</span>}
          </section>

          {error && <div className="workspace-error" role="alert"><b>Could not load your workspace.</b><span>{error}</span><button onClick={() => router.refresh()}>Try again</button></div>}

          {activeView === "Overview" && (role === "admin"
            ? <AdminOverview counts={counts} loading={loading} onNavigate={setView} />
            : <MemberOverview counts={counts} loading={loading} name={displayName} email={user.email ?? ""} events={workspaceData.events} quests={workspaceData.quests} onNavigate={setView} />)}
          {activeView === "Events" && (role === "admin"
            ? <EventManager events={workspaceData.events} adminId={user.id} onChanged={() => setRefreshKey((key) => key + 1)} />
            : <EmptyWorkspaceSection role={role} kind="events" count={counts.events} loading={loading} events={workspaceData.events} />)}
          {activeView === "Quests" && (role === "admin"
            ? <QuestManager quests={workspaceData.quests} adminId={user.id} onChanged={() => setRefreshKey((key) => key + 1)} />
            : <EmptyWorkspaceSection role={role} kind="quests" count={counts.quests} loading={loading} quests={workspaceData.quests} />)}
          {activeView === "Members" && role === "admin" && <EmptyWorkspaceSection role={role} kind="members" count={counts.members} loading={loading} members={workspaceData.members} onToggleMemberAccess={toggleMemberAccess} memberActionId={memberActionId} />}
          {activeView === "Membership" && role === "member" && <MemberCard counts={counts} loading={loading} name={displayName} email={user.email ?? ""} />}
        </div>
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

function MemberOverview({ counts, loading, name, email, events, quests, onNavigate }: { counts: Counts; loading: boolean; name: string; email: string; events: CommunityEvent[]; quests: CommunityQuest[]; onNavigate: (view: ViewName) => void }) {
  return <>
    <section className="member-welcome-card"><div className="welcome-card-copy"><span className="eyebrow">YOU’RE PART OF THE CREW</span><h2>Good to have you here, {name}.</h2><p>Your community membership is ready. Find an event or take on a quest when you’re ready.</p><button className="button button-primary" onClick={() => onNavigate("Events")}>Explore what’s happening <span>↗</span></button></div><OrbitSymbol className="welcome-card-mark" decorative /></section>
    <section className="metric-grid workspace-metrics member-metrics"><Metric title="My membership" value={counts.crewNumber === null ? "—" : `MZ-${String(counts.crewNumber).padStart(4, "0")}`} icon="card" loading={loading} /><Metric title="Community events" value={counts.events} icon="calendar" loading={loading} /><Metric title="Open quests" value={counts.quests} icon="flag" loading={loading} /><Metric title="My XP" value={counts.xp} icon="grid" loading={loading} /></section>
    <section className="content-grid member-content-grid"><div className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">A GOOD PLACE TO START</span><h2>Find your next moment</h2></div><button className="text-link" onClick={() => onNavigate("Events")}>See events <span>↗</span></button></div>{events.length === 0 ? <EmptyMessage title="No events just yet" detail="When an organizer adds an event, you’ll find it here." /> : <EventList events={events.slice(0, 3)} />}</div><div className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">PROGRESS, NOT PERFECTION</span><h2>Quests for you</h2></div><button className="text-link" onClick={() => onNavigate("Quests")}>Explore <span>↗</span></button></div>{quests.length === 0 ? <EmptyMessage title="Your next challenge is on its way" detail="New crew quests will show up here." /> : <QuestList quests={quests.slice(0, 3)} />}</div></section>
    <p className="member-account-note">Signed in as <b>{email}</b>. Your member profile is managed by your account.</p>
  </>;
}

function MemberCard({ counts, loading, name, email }: { counts: Counts; loading: boolean; name: string; email: string }) {
  const crewId = counts.crewNumber === null ? "—" : `MZ-${String(counts.crewNumber).padStart(4, "0")}`;
  return <><section className="page-heading"><div><span className="eyebrow">YOUR COMMUNITY, YOUR CARD</span><h1>Membership</h1><p className="page-intro">Your place in the crew, always close at hand.</p></div></section><div className="member-card"><div className="member-card-top"><div className="brand-lockup brand-light"><OrbitLogo className="card-orbit-logo" /></div><span className="card-chip">CREW MEMBER</span></div><div className="card-member-info"><span className="eyebrow">GOOD TO HAVE YOU HERE</span><h2>{name}</h2><span>{email}</span></div><div className="card-footer"><div><span className="eyebrow">YOUR CREW ID</span><b>{loading ? "…" : crewId}</b></div><span className="member-card-mark">✳</span></div></div></>;
}

function EmptyWorkspaceSection({ role, kind, count, loading, events = [], quests = [], members = [], onToggleMemberAccess, memberActionId }: { role: WorkspaceRole; kind: "events" | "quests" | "members"; count: number; loading: boolean; events?: CommunityEvent[]; quests?: CommunityQuest[]; members?: DirectoryMember[]; onToggleMemberAccess?: (member: DirectoryMember) => void; memberActionId?: string | null }) {
  const title = kind === "events" ? "Events" : kind === "quests" ? "Quests & missions" : "Member directory";
  const detail = kind === "events" ? "Community events will appear here once they’re created." : kind === "quests" ? "Quests will appear here once an admin creates them." : "Member accounts appear here after people sign up.";
  const hasData = kind === "events" ? events.length > 0 : kind === "quests" ? quests.length > 0 : members.length > 0;
  return <><section className="page-heading"><div><span className="eyebrow">{role === "admin" ? "ORBIT COMMUNITY" : "YOUR ORBIT COMMUNITY"}</span><h1>{title}</h1><p className="page-intro">{role === "admin" ? "Review members and control member access." : "Everything here comes from your community workspace."}</p></div></section>{hasData ? <section className="workspace-panel data-list-panel">{kind === "events" && <EventList events={events} />}{kind === "quests" && <QuestList quests={quests} />}{kind === "members" && <MemberList members={members} onToggleAccess={onToggleMemberAccess} busyMemberId={memberActionId} />}</section> : <section className="workspace-panel empty-page-panel"><span className="empty-illustration"><Icon name={kind === "events" ? "calendar" : kind === "quests" ? "flag" : "users"} /></span><span className="eyebrow">{loading ? "LOADING" : `${count} ${kind.toUpperCase()}`}</span><h2>{loading ? "Getting your workspace ready" : kind === "members" ? "The crew starts here." : "A fresh start."}</h2><p>{loading ? "Checking the latest ORBIT data." : detail}</p></section>}</>;
}

function localDateTimeValue(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function EventManager({ events, adminId, onChanged }: { events: CommunityEvent[]; adminId: string; onChanged: () => void }) {
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
    {events.length ? <section className="workspace-panel data-list-panel management-list"><EventList events={events} onEdit={editEvent} onDelete={deleteEvent} busy={busy} /></section> : <section className="workspace-panel empty-page-panel"><span className="empty-illustration"><Icon name="calendar" /></span><span className="eyebrow">0 EVENTS</span><h2>Ready to bring the crew together?</h2><p>Create the first event and it will appear here for members.</p></section>}
  </>;
}

function QuestManager({ quests, adminId, onChanged }: { quests: CommunityQuest[]; adminId: string; onChanged: () => void }) {
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
    {quests.length ? <section className="workspace-panel data-list-panel management-list"><QuestList quests={quests} onEdit={editQuest} onDelete={deleteQuest} busy={busy} /></section> : <section className="workspace-panel empty-page-panel"><span className="empty-illustration"><Icon name="flag" /></span><span className="eyebrow">0 QUESTS</span><h2>Give the crew a challenge.</h2><p>Create a quest with a goal and XP reward to get started.</p></section>}
  </>;
}

function EventList({ events, onEdit, onDelete, busy = false }: { events: CommunityEvent[]; onEdit?: (event: CommunityEvent) => void; onDelete?: (event: CommunityEvent) => void; busy?: boolean }) {
  return (
    <div className="workspace-data-list">
      {events.map((event) => (
        <article className="workspace-data-row" key={event.id}>
          <span className="quicklink-icon peach"><Icon name="calendar" /></span>
          <span className="workspace-data-copy">
            <b>{event.title}</b>
            <small>{new Date(event.start_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}{event.location ? ` · ${event.location}` : ""} · {event.visibility}</small>
          </span>
          <span className={`status-pill ${event.status === "open" ? "active" : "pending"}`}><i />{event.status}</span>
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

function QuestList({ quests, onEdit, onDelete, busy = false }: { quests: CommunityQuest[]; onEdit?: (quest: CommunityQuest) => void; onDelete?: (quest: CommunityQuest) => void; busy?: boolean }) {
  return <div className="workspace-data-list">{quests.map((quest) => <article className="workspace-data-row" key={quest.id}><span className="quicklink-icon lavender"><Icon name="flag" /></span><span className="workspace-data-copy"><b>{quest.title}</b><small>{quest.xp_reward} XP · Goal {quest.goal}{quest.deadline ? ` · Due ${new Date(quest.deadline).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : ""}</small></span>{onEdit && <div className="management-row-actions"><button className="button button-secondary" onClick={() => onEdit(quest)} disabled={busy}>Edit</button>{onDelete && <button className="button button-danger" onClick={() => onDelete(quest)} disabled={busy}>Delete</button>}</div>}</article>)}</div>;
}

function MemberList({ members, onToggleAccess, busyMemberId }: { members: DirectoryMember[]; onToggleAccess?: (member: DirectoryMember) => void; busyMemberId?: string | null }) {
  return <div className="workspace-data-list">{members.map((member) => <article className="workspace-data-row" key={member.userId}><span className="avatar">{member.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span><span className="workspace-data-copy"><b>{member.fullName}</b><small>@{member.username} · MZ-{String(member.crewNumber).padStart(4, "0")} · Joined {new Date(member.joinedAt).toLocaleDateString()}</small></span><span className={`status-pill ${member.status === "active" ? "active" : "pending"}`}><i />{member.status}</span>{onToggleAccess && member.status !== "left" && <button className={member.status === "active" ? "button button-danger" : "button button-secondary"} onClick={() => onToggleAccess(member)} disabled={busyMemberId === member.userId}>{busyMemberId === member.userId ? "Updating…" : member.status === "active" ? "Suspend" : "Reactivate"}</button>}</article>)}</div>;
}

function Metric({ title, value, icon, loading }: { title: string; value: number | string; icon: "users" | "calendar" | "flag" | "grid" | "card"; loading: boolean }) {
  const tone = icon === "users" || icon === "card" ? "green" : icon === "calendar" ? "peach" : icon === "flag" ? "lavender" : "yellow";
  return <article className="metric-card"><div className="metric-top"><span>{title}</span><span className={`metric-icon ${tone}`}><Icon name={icon} /></span></div><strong>{loading ? "…" : typeof value === "number" ? value.toLocaleString() : value}</strong><span className="metric-change">Live ORBIT data</span></article>;
}

function EmptyMessage({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-message"><span>✳</span><b>{title}</b><p>{detail}</p></div>;
}
