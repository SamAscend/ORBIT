"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GlobalChat } from "@/components/global-chat";
import { Announcements } from "@/components/announcements";
import { MemberHub, MemberReportManager } from "@/components/member-hub";
import { MemberPresence } from "@/components/member-presence";
import { QRCodeCanvas } from "qrcode.react";
import type { Database } from "@/lib/supabase/database.types";
import type { User } from "@supabase/supabase-js";
import { OrbitLogo, OrbitSymbol } from "@/components/orbit-logo";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import { WorkspaceOnboarding } from "@/components/workspace-onboarding";

type WorkspaceRole = "admin" | "member";
type GreetingKey = "Welcome" | "Good morning" | "Good afternoon" | "Good evening";
type Counts = { members: number; events: number; quests: number; xp: number; crewNumber: number | null; membershipStatus: MembershipRecord["status"] | null; verificationToken: string | null };
type ViewName = "Overview" | "Calendar" | "Events" | "Quests" | "Quest Review" | "My Progress" | "Members" | "Membership" | "Profile" | "Chat" | "Updates" | "Reports";
type Participant = { userId: string; fullName: string; username: string };
type EventRegistrationStatus = "registered" | "waitlisted" | null;
type EventAvailability = Database["public"]["Functions"]["get_orbit_event_availability"]["Returns"][number];
type CommunityEvent = Pick<Database["public"]["Tables"]["events"]["Row"], "id" | "title" | "description" | "visibility" | "start_at" | "location" | "capacity" | "status"> & {
  registered?: boolean;
  registrationStatus?: EventRegistrationStatus;
  registeredCount?: number;
  waitlistCount?: number;
  waitlistPosition?: number | null;
  participants?: Participant[];
  waitlistedParticipants?: Participant[];
};
type CommunityQuest = Pick<Database["public"]["Tables"]["quests"]["Row"], "id" | "title" | "description" | "xp_reward" | "goal" | "deadline"> & { registered?: boolean; participants?: Participant[] };
type QuestSubmission = Database["public"]["Tables"]["quest_submissions"]["Row"];
type MembershipRecord = Pick<Database["public"]["Tables"]["memberships"]["Row"], "user_id" | "crew_number" | "status" | "created_at" | "sleep_until" | "verification_token">;
type DirectoryMember = { userId: string; fullName: string; username: string; crewNumber: number; status: string; joinedAt: string; sleepUntil: string | null };
type ProfileData = { fullName: string; username: string; avatarUrl: string | null };
type WorkspaceData = { events: CommunityEvent[]; quests: CommunityQuest[]; members: DirectoryMember[] };
type EventDraft = { title: string; description: string; visibility: "public" | "private"; status: "open" | "cancelled" | "completed"; startAt: string; location: string; capacity: string };
type QuestDraft = { title: string; description: string; xpReward: string; goal: string; deadline: string };
type CommunityDetail = { kind: "event"; item: CommunityEvent } | { kind: "quest"; item: CommunityQuest };
type ListFilterOption = { value: string; label: string };

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
    return "The ORBIT database is missing a required migration. Run migrations 202610270005_calendar_profiles_and_participation.sql, 202610270006_membership_lifecycle_and_verification.sql, 202610270007_global_chat.sql, 202611010001_member_interactions.sql, 202611010002_fix_member_interaction_rls.sql, 202611010003_quest_submission_review.sql, 202611010004_admin_clear_global_chat.sql, 202611010005_event_capacity_waitlist.sql, and 202611010006_community_announcements.sql in the Supabase SQL Editor, then reload this page.";
  }

  return message;
}

function greetingFor(hour: number): GreetingKey {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function subscribeToPageOrigin() {
  return () => {};
}

function getPageOrigin() {
  return window.location.origin;
}

function useCurrentTimestamp() {
  const [timestamp, setTimestamp] = useState<number | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setTimestamp(Date.now()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  return timestamp;
}

function Icon({ name }: { name: "grid" | "calendar" | "flag" | "users" | "card" | "settings" | "logout" | "eye" | "chat" }) {
  const paths: Record<typeof name, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    flag: <><path d="M5 21V5" /><path d="M5 5c5-4 9 4 14 0v10c-5 4-9-4-14 0" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2-.7a6 6 0 0 0-.6-1.4l1-1.8-2.1-2.1-1.8 1a6 6 0 0 0-1.5-.6l-.6-2h-3l-.7 2a6 6 0 0 0-1.4.6l-1.8-1-2.1 2.1 1 1.8a6 6 0 0 0-.6 1.5l-2 .6v3l2 .7a6 6 0 0 0 .6 1.4l-1 1.8 2.1 2.1 1.8-1a6 6 0 0 0 1.5.6l.6 2h3l.7-2a6 6 0 0 0 1.4-.6l1.8 1 2.1-2.1-1-1.8a6 6 0 0 0 .6-1.5z" transform="translate(2 1) scale(.83)" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6a7.5 7.5 0 1 1 17-3.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>,
  };
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function ListToolbar({ search, onSearchChange, filter, onFilterChange, options, searchLabel, resultCount }: {
  search: string;
  onSearchChange: (value: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  options: ListFilterOption[];
  searchLabel: string;
  resultCount: number;
}) {
  return <div className="list-toolbar">
    <label className="list-search-field">
      <span className="visually-hidden">Search {searchLabel}</span>
      <input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={`Search ${searchLabel}…`} />
    </label>
    <label className="list-filter-field">
      <span className="visually-hidden">Filter {searchLabel}</span>
      <select value={filter} onChange={(event) => onFilterChange(event.target.value)} aria-label={`Filter ${searchLabel}`}>
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
    </label>
    <span className="list-result-count" aria-live="polite">{resultCount} {resultCount === 1 ? "result" : "results"}</span>
  </div>;
}

function NoListResults({ itemLabel }: { itemLabel: string }) {
  return <div className="list-no-results" role="status">No {itemLabel} match your search or filter.</div>;
}

export function Workspace({ role, user }: { role: WorkspaceRole; user: User }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [view, setView] = useState<ViewName>("Overview");
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [greeting, setGreeting] = useState("Welcome");
  const [counts, setCounts] = useState<Counts>({ members: 0, events: 0, quests: 0, xp: 0, crewNumber: null, membershipStatus: null, verificationToken: null });
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData>({ events: [], quests: [], members: [] });
  const [memberSubmissions, setMemberSubmissions] = useState<QuestSubmission[]>([]);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [showOnlineStatus, setShowOnlineStatus] = useState(false);
  const [sleepUntil, setSleepUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [participationBusy, setParticipationBusy] = useState(false);
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
    if (loading) return;
    let active = true;
    const timer = window.setTimeout(() => {
      try {
        const key = `orbit-onboarding-v1:${role}:${user.id}`;
        if (active) setOnboardingOpen(window.localStorage.getItem(key) !== "completed");
      } catch (storageError) {
        console.error("Could not read the ORBIT onboarding preference.", storageError);
        if (active) setOnboardingOpen(true);
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loading, role, user.id]);

  const dismissOnboarding = useCallback(() => {
    try {
      window.localStorage.setItem(`orbit-onboarding-v1:${role}:${user.id}`, "completed");
    } catch (storageError) {
      console.error("Could not save the ORBIT onboarding preference.", storageError);
    }
    setOnboardingOpen(false);
  }, [role, user.id]);

  useEffect(() => {
    let active = true;

    async function loadCounts() {
      setLoading(true);
      setError("");

      try {
        const supabase = createClient();
        const membershipQuery = role === "admin"
          ? supabase.from("memberships").select("user_id, crew_number, status, created_at, sleep_until, verification_token").neq("status", "left").order("created_at", { ascending: false }).limit(1000)
          : supabase.from("memberships").select("user_id, crew_number, status, created_at, sleep_until, verification_token", { count: "exact" }).eq("user_id", user.id).limit(1);
        const [membershipResult, eventResult, questResult, availabilityResult] = await Promise.all([
          membershipQuery,
          supabase.from("events").select("id, title, description, visibility, start_at, location, capacity, status", { count: "exact" }).order("start_at", { ascending: true }).limit(1000),
          supabase.from("quests").select("id, title, description, xp_reward, goal, deadline", { count: "exact" }).order("created_at", { ascending: false }).limit(1000),
          supabase.rpc("get_orbit_event_availability"),
        ]);
        if (membershipResult.error) throw membershipResult.error;
        if (eventResult.error) throw eventResult.error;
        if (questResult.error) throw questResult.error;
        if (availabilityResult.error) throw availabilityResult.error;

        let xp = 0;
        const memberships = membershipResult.data as MembershipRecord[];
        let crewNumber: number | null = null;
        let membershipStatus: MembershipRecord["status"] | null = null;
        let verificationToken: string | null = null;
        let directoryMembers: DirectoryMember[] = [];
        let profile: ProfileData | null = null;
        let memberQuestRegistrations = new Set<string>();
        let submissions: QuestSubmission[] = [];
        const eventParticipants = new Map<string, Participant[]>();
        const eventWaitlistedParticipants = new Map<string, Participant[]>();
        const questParticipants = new Map<string, Participant[]>();
        const eventAvailability = new Map<string, EventAvailability>(availabilityResult.data.map((availability) => [availability.event_id, availability]));
        if (role === "admin") {
          const userIds = memberships.map((membership) => membership.user_id);
          const [profilesResult, eventRegistrationsResult, questRegistrationsResult] = await Promise.all([
            userIds.length
              ? supabase.from("profiles").select("id, full_name, username, is_admin").in("id", userIds)
              : Promise.resolve({ data: [], error: null }),
            supabase.from("event_registrations").select("event_id, user_id, status, waitlisted_at")
              .in("status", ["registered", "waitlisted"]).order("waitlisted_at", { ascending: true }),
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
            if (!attendee) continue;
            if (registration.status === "registered") {
              eventParticipants.set(registration.event_id, [...(eventParticipants.get(registration.event_id) ?? []), attendee]);
            } else {
              eventWaitlistedParticipants.set(registration.event_id, [...(eventWaitlistedParticipants.get(registration.event_id) ?? []), attendee]);
            }
          }
          for (const registration of questRegistrationsResult.data) {
            const attendee = attendeeProfiles.get(registration.user_id);
            if (attendee) questParticipants.set(registration.quest_id, [...(questParticipants.get(registration.quest_id) ?? []), attendee]);
          }
        }
        if (role === "member") {
          crewNumber = memberships[0]?.crew_number ?? null;
          membershipStatus = memberships[0]?.status ?? null;
          verificationToken = memberships[0]?.verification_token ?? null;
          const [profileResult, xpResult, questRegistrationsResult, submissionsResult] = await Promise.all([
            supabase.from("profiles").select("full_name, username, avatar_url, show_online_status").eq("id", user.id).maybeSingle(),
            supabase.from("xp_ledger").select("points").eq("user_id", user.id),
            supabase.from("quest_registrations").select("quest_id").eq("user_id", user.id).eq("status", "registered"),
            supabase.from("quest_submissions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
          ]);
          if (profileResult.error) throw profileResult.error;
          if (xpResult.error) throw xpResult.error;
          if (questRegistrationsResult.error) throw questRegistrationsResult.error;
          if (submissionsResult.error) throw submissionsResult.error;
          submissions = submissionsResult.data;
          memberQuestRegistrations = new Set(questRegistrationsResult.data.map((registration) => registration.quest_id));
          profile = profileResult.data ? { fullName: profileResult.data.full_name, username: profileResult.data.username, avatarUrl: profileResult.data.avatar_url } : null;
          setProfileUsername(profile?.username ?? "");
          setProfileData(profile);
          setShowOnlineStatus(profileResult.data?.show_online_status ?? false);
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
            membershipStatus,
            verificationToken,
          });
          setWorkspaceData({
            events: eventResult.data.map((communityEvent) => ({
              ...communityEvent,
              registered: eventAvailability.get(communityEvent.id)?.my_status === "registered",
              registrationStatus: eventAvailability.get(communityEvent.id)?.my_status === "registered"
                ? "registered"
                : eventAvailability.get(communityEvent.id)?.my_status === "waitlisted" ? "waitlisted" : null,
              registeredCount: eventAvailability.get(communityEvent.id)?.registered_count ?? 0,
              waitlistCount: eventAvailability.get(communityEvent.id)?.waitlist_count ?? 0,
              waitlistPosition: eventAvailability.get(communityEvent.id)?.my_waitlist_position ?? null,
              participants: eventParticipants.get(communityEvent.id) ?? [],
              waitlistedParticipants: eventWaitlistedParticipants.get(communityEvent.id) ?? [],
            })),
            quests: questResult.data.map((communityQuest) => ({
              ...communityQuest,
              registered: memberQuestRegistrations.has(communityQuest.id),
              participants: questParticipants.get(communityQuest.id) ?? [],
            })),
            members: directoryMembers,
          });
          setMemberSubmissions(submissions);
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
    setParticipationBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const itemId = detail.item.id;
      if (detail.kind === "event") {
        const currentStatus = detail.item.registrationStatus ?? (detail.item.registered ? "registered" : null);
        const leaving = currentStatus !== null;
        let nextStatus: EventRegistrationStatus;
        let promotedCount = 0;
        if (leaving) {
          const result = await supabase.rpc("leave_orbit_event", { p_event_id: itemId });
          if (result.error) throw result.error;
          promotedCount = result.data;
          nextStatus = null;
        } else {
          const result = await supabase.rpc("join_orbit_event", { p_event_id: itemId });
          if (result.error) throw result.error;
          nextStatus = result.data === "waitlisted" ? "waitlisted" : "registered";
        }
        setSelectedDetail((current) => {
          if (!current || current.kind !== "event" || current.item.id !== itemId) return current;
          const previousStatus = current.item.registrationStatus ?? (current.item.registered ? "registered" : null);
          const registeredCount = current.item.registeredCount ?? current.item.participants?.length ?? 0;
          const waitlistCount = current.item.waitlistCount ?? 0;
          return {
            kind: "event",
            item: {
              ...current.item,
              registered: nextStatus === "registered",
              registrationStatus: nextStatus,
              registeredCount: registeredCount
                + (nextStatus === "registered" ? 1 : 0)
                - (leaving && previousStatus === "registered" ? 1 : 0)
                + promotedCount,
              waitlistCount: waitlistCount
                + (nextStatus === "waitlisted" ? 1 : 0)
                - (leaving && previousStatus === "waitlisted" ? 1 : 0)
                - promotedCount,
              waitlistPosition: nextStatus === "waitlisted" ? waitlistCount + 1 : null,
            },
          };
        });
        setRefreshKey((key) => key + 1);
        return;
      }

      const existing = await supabase.from("quest_registrations").select("id, status").eq("quest_id", itemId).eq("user_id", user.id).maybeSingle();
      if (existing.error) throw existing.error;
      const nextStatus = detail.item.registered ? "cancelled" : "registered";
      const result = existing.data
        ? await supabase.from("quest_registrations").update({ status: nextStatus }).eq("id", existing.data.id)
        : await supabase.from("quest_registrations").insert({ quest_id: itemId, user_id: user.id });
      if (result.error) throw result.error;
      setSelectedDetail((current) => {
        if (!current || current.kind !== detail.kind || current.item.id !== itemId) return current;
        if (current.kind !== "quest") return current;
        return { kind: "quest", item: { ...current.item, registered: nextStatus === "registered" } };
      });
      setRefreshKey((key) => key + 1);
    } catch (actionError) {
      console.error("Could not update event or quest participation.", actionError);
      setError(actionError instanceof Error ? actionError.message : "Could not update participation.");
    } finally {
      setParticipationBusy(false);
    }
  }

  async function submitQuestWork(questId: string, submissionText: string) {
    if (role !== "member") return;
    const { error: submissionError } = await createClient().rpc("submit_orbit_quest_work", {
      p_quest_id: questId,
      p_submission_text: submissionText,
    });
    if (submissionError) {
      console.error("Could not submit ORBIT quest work.", submissionError);
      throw submissionError;
    }
    setRefreshKey((key) => key + 1);
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

  const adminNavigation: { label: ViewName; icon: "grid" | "calendar" | "flag" | "users" | "chat" }[] = [
    { label: "Overview", icon: "grid" },
    { label: "Calendar", icon: "calendar" },
    { label: "Events", icon: "calendar" },
    { label: "Quests", icon: "flag" },
    { label: "Quest Review", icon: "flag" },
    { label: "Members", icon: "users" },
    { label: "Reports", icon: "flag" },
    { label: "Chat", icon: "chat" },
    { label: "Updates", icon: "chat" },
  ];
  const memberNavigation: { label: ViewName; icon: "grid" | "calendar" | "flag" | "card" | "settings" | "chat" | "users" }[] = [
    { label: "Overview", icon: "grid" },
    { label: "Calendar", icon: "calendar" },
    { label: "Events", icon: "calendar" },
    { label: "Quests", icon: "flag" },
    { label: "My Progress", icon: "flag" },
    { label: "Members", icon: "users" },
    { label: "Chat", icon: "chat" },
    { label: "Updates", icon: "chat" },
    { label: "Membership", icon: "card" },
    { label: "Profile", icon: "settings" },
  ];
  const navigation = role === "admin" ? adminNavigation : memberNavigation;
  const mobilePrimaryViews: ViewName[] = ["Overview", "Calendar", "Events", "Quests"];
  const mobileSecondaryNavigation = navigation.filter((item) => !mobilePrimaryViews.includes(item.label));
  const activeView = view;

  return (
    <div className={`workspace-shell ${role === "member" && activeView === "Membership" ? "print-membership-card" : ""}`}>
      {role === "member" && <MemberPresence userId={user.id} enabled={showOnlineStatus} />}
      <aside className="workspace-sidebar">
        <Link className="brand-lockup" href={role === "admin" ? "/admin" : "/member"}><OrbitLogo className="sidebar-orbit-logo" /></Link>
        <div className="community-switcher"><span className="community-avatar"><OrbitSymbol className="community-orbit-symbol" /></span><span className="community-switch-copy"><b>ORBIT</b><small>{role === "admin" ? "Admin workspace" : "Your community"}</small></span></div>
        <nav className="workspace-nav" aria-label={`${role} navigation`}>
          <span className="nav-group-label">{role === "admin" ? t("Admin workspace") : t("YOUR ORBIT CREW")}</span>
          {navigation.map((item) => <button key={item.label} className={`nav-item ${activeView === item.label ? "active" : ""} ${mobilePrimaryViews.includes(item.label) ? "mobile-nav-primary" : "mobile-nav-secondary"}`} onClick={() => { setView(item.label); setMobileMoreOpen(false); }} aria-current={activeView === item.label ? "page" : undefined}><Icon name={item.icon} /><span>{t(item.label)}</span></button>)}
          {mobileSecondaryNavigation.length > 0 && <button className={`mobile-nav-more ${mobileMoreOpen || mobileSecondaryNavigation.some((item) => item.label === activeView) ? "active" : ""}`} type="button" aria-expanded={mobileMoreOpen} aria-controls="mobile-nav-more-menu" onClick={() => setMobileMoreOpen((open) => !open)}><span>•••</span><span>{t("More")}</span></button>}
          {mobileMoreOpen && mobileSecondaryNavigation.length > 0 && <div className="mobile-nav-more-menu" id="mobile-nav-more-menu">{mobileSecondaryNavigation.map((item) => <button type="button" key={item.label} className={`nav-item ${activeView === item.label ? "active" : ""}`} onClick={() => { setView(item.label); setMobileMoreOpen(false); }} aria-current={activeView === item.label ? "page" : undefined}><Icon name={item.icon} /><span>{t(item.label)}</span></button>)}</div>}
        </nav>
        <div className="workspace-sidebar-bottom"><div className="sidebar-quote"><span>✳</span><p>{role === "admin" ? t("A well-run community gives everyone room to grow.") : t("A crew is just people who keep showing up for each other.")}</p><small>THE ORBIT WAY</small></div><div className="sidebar-footnote">MADE FOR THE MILES AHEAD <span>© 2026</span></div></div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar"><div className="workspace-header-left">{activeView !== "Overview" && <button className="workspace-back-button" onClick={() => setView("Overview")} aria-label={t("Back")}><span aria-hidden="true">←</span><span>{t("Back")}</span></button>}<div className="breadcrumb"><span>ORBIT</span><span>›</span><b>{t(activeView)}</b></div></div><div className="workspace-account"><LanguageSwitcher /><span className={`role-chip ${role}`}>{role === "admin" ? "ADMIN" : "MEMBER"}</span><span className="avatar avatar-profile" aria-label="Profile photo" style={profileData?.avatarUrl ? { backgroundImage: `url("${profileData.avatarUrl}")`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>{profileData?.avatarUrl ? "" : role === "admin" ? "AD" : displayName.slice(0, 2).toUpperCase()}</span><div className="profile-copy"><b>{displayName}</b><small>{role === "admin" ? t("Platform administrator") : profileUsername ? `@${profileUsername}` : t("Crew member")}</small></div><button className="signout-button" onClick={signOut} disabled={signingOut} aria-label={t("Sign out")}><Icon name="logout" /></button></div></header>
        <div className="workspace-content">
          <section className="welcome-row">
            <div><div className="eyebrow">{role === "admin" ? t("PLATFORM ADMINISTRATION") : t("Your community")}</div><h1>{t(greeting)}, {displayName} <span className="wave">✳</span></h1><p className="page-intro">{role === "admin" ? t("Here’s a clear view of your ORBIT community.") : t("Your place in the crew, and everything happening around you.")}</p></div>
            {role === "admin" && <span className="workspace-admin-badge"><Icon name="settings" /> {t("Admin workspace")}</span>}
          </section>

          {error && <div className="workspace-error" role="alert"><b>{t("Could not load your workspace.")}</b><span>{error}</span><button onClick={() => router.refresh()}>{t("Try again")}</button></div>}

          {activeView === "Overview" && (role === "admin"
            ? <AdminOverview counts={counts} loading={loading} events={workspaceData.events} quests={workspaceData.quests} members={workspaceData.members} onNavigate={setView} onViewDetail={setSelectedDetail} />
            : <MemberOverview counts={counts} loading={loading} name={displayName} email={user.email ?? ""} events={workspaceData.events} quests={workspaceData.quests} onNavigate={setView} onViewDetail={setSelectedDetail} />)}
          {activeView === "Calendar" && <CalendarView events={workspaceData.events} quests={workspaceData.quests} onViewDetail={setSelectedDetail} />}
          {activeView === "Events" && (role === "admin"
            ? <EventManager events={workspaceData.events} adminId={user.id} onChanged={() => setRefreshKey((key) => key + 1)} onViewDetail={(item) => setSelectedDetail({ kind: "event", item })} />
            : <EmptyWorkspaceSection role={role} kind="events" count={counts.events} loading={loading} events={workspaceData.events} onViewDetail={setSelectedDetail} />)}
          {activeView === "Quests" && (role === "admin"
            ? <QuestManager quests={workspaceData.quests} adminId={user.id} onChanged={() => setRefreshKey((key) => key + 1)} onViewDetail={(item) => setSelectedDetail({ kind: "quest", item })} />
            : <EmptyWorkspaceSection role={role} kind="quests" count={counts.quests} loading={loading} quests={workspaceData.quests} onViewDetail={setSelectedDetail} />)}
          {activeView === "Quest Review" && role === "admin" && <QuestReviewManager />}
          {activeView === "My Progress" && role === "member" && <MemberProgress submissions={memberSubmissions} quests={workspaceData.quests} xp={counts.xp} loading={loading} onNavigate={setView} />}
          {activeView === "Updates" && <Announcements role={role} userId={user.id} onNavigate={setView} />}
          {activeView === "Members" && role === "admin" && <EmptyWorkspaceSection role={role} kind="members" count={counts.members} loading={loading} members={workspaceData.members} onToggleMemberAccess={toggleMemberAccess} memberActionId={memberActionId} />}
          {activeView === "Members" && role === "member" && <MemberHub userId={user.id} showOnlineStatus={showOnlineStatus} onOnlineStatusChange={setShowOnlineStatus} />}
          {activeView === "Reports" && role === "admin" && <MemberReportManager adminId={user.id} />}
          {activeView === "Membership" && role === "member" && <MemberCard counts={counts} loading={loading} name={displayName} sleepUntil={sleepUntil} />}
          {activeView === "Profile" && role === "member" && profileData && <MemberProfile profile={profileData} sleepUntil={sleepUntil} userId={user.id} onProfileSaved={updateProfile} onSleepModeChanged={updateSleepMode} />}
          {activeView === "Chat" && <GlobalChat role={role} userId={user.id} />}
        </div>
        {selectedDetail && <CommunityDetailDialog detail={selectedDetail} role={role} sleeping={Boolean(sleepUntil && new Date(sleepUntil) > new Date())} participationBusy={participationBusy} submissions={memberSubmissions} onSubmitQuestWork={submitQuestWork} onToggleParticipation={() => void toggleParticipation(selectedDetail)} onClose={() => setSelectedDetail(null)} />}
        {onboardingOpen && <WorkspaceOnboarding
          name={displayName}
          actions={role === "admin"
            ? [
                { label: "Create a quest", description: "Set a goal and reward for your crew.", onChoose: () => { dismissOnboarding(); setView("Quests"); } },
                { label: "Create an event", description: "Bring members together with an event.", onChoose: () => { dismissOnboarding(); setView("Events"); } },
                { label: "Post an update", description: "Share important news with every member.", onChoose: () => { dismissOnboarding(); setView("Updates"); } },
              ]
            : [
                { label: "Find an event", description: "See what your ORBIT crew is planning.", onChoose: () => { dismissOnboarding(); setView("Events"); } },
                { label: "Meet your crew", description: "Find members and start a conversation.", onChoose: () => { dismissOnboarding(); setView("Members"); } },
                { label: "Read crew updates", description: "Check official news from your ORBIT team.", onChoose: () => { dismissOnboarding(); setView("Updates"); } },
              ]}
          onDismiss={dismissOnboarding}
        />}
        <footer className="page-footer"><span>BUILT FOR THE MILES AHEAD <b>✳</b></span><span>ORBIT · {t("A COMMUNITY, IN MOTION")}.</span></footer>
      </main>
    </div>
  );
}

function AdminOverview({ counts, loading, events, quests, members, onNavigate, onViewDetail }: {
  counts: Counts;
  loading: boolean;
  events: CommunityEvent[];
  quests: CommunityQuest[];
  members: DirectoryMember[];
  onNavigate: (view: ViewName) => void;
  onViewDetail: (detail: CommunityDetail) => void;
}) {
  const { t } = useLanguage();
  const now = useCurrentTimestamp();
  const upcomingEvents = events
    .filter((event) => now !== null && event.status === "open" && new Date(event.start_at).getTime() >= now)
    .sort((first, second) => first.start_at.localeCompare(second.start_at))
    .slice(0, 3);
  const upcomingQuests = quests
    .filter((quest) => now !== null && quest.deadline && new Date(quest.deadline).getTime() >= now)
    .sort((first, second) => (first.deadline ?? "").localeCompare(second.deadline ?? ""))
    .slice(0, 3);
  const pausedMembers = members.filter((member) => member.status !== "active").length;

  return <>
    <section className="metric-grid workspace-metrics">
      <Metric title={t("Members")} value={counts.members} icon="users" loading={loading} />
      <Metric title={t("Events")} value={counts.events} icon="calendar" loading={loading} />
      <Metric title={t("Quests")} value={counts.quests} icon="flag" loading={loading} />
      <Metric title="Community" value="ORBIT" icon="grid" loading={loading} />
    </section>
    <section className="admin-overview-grid">
      <div className="workspace-panel admin-schedule-panel">
        <div className="panel-heading"><div><span className="eyebrow">WHAT’S NEXT</span><h2>Upcoming activity</h2></div></div>
        <div className="admin-schedule-columns">
          <section><div className="admin-schedule-title"><h3>Events</h3><button className="text-link" onClick={() => onNavigate("Events")}>Manage <span>↗</span></button></div>
            {upcomingEvents.length ? <EventList events={upcomingEvents} onView={(item) => onViewDetail({ kind: "event", item })} /> : <p className="admin-overview-empty">{now === null || loading ? "Checking upcoming events…" : <>No upcoming open events. <button className="text-link" onClick={() => onNavigate("Events")}>Create one</button></>}</p>}
          </section>
          <section><div className="admin-schedule-title"><h3>Quest deadlines</h3><button className="text-link" onClick={() => onNavigate("Quests")}>Manage <span>↗</span></button></div>
            {upcomingQuests.length ? <QuestList quests={upcomingQuests} onView={(item) => onViewDetail({ kind: "quest", item })} /> : <p className="admin-overview-empty">{now === null || loading ? "Checking quest deadlines…" : <>No upcoming quest deadlines. <button className="text-link" onClick={() => onNavigate("Quests")}>Create one</button></>}</p>}
          </section>
        </div>
      </div>
      <section className={`workspace-panel admin-attention-panel ${pausedMembers ? "has-attention" : ""}`}>
        <span className="eyebrow">MEMBERSHIP CHECK-IN</span>
        <div className="admin-attention-count">{loading ? "…" : pausedMembers.toLocaleString()}</div>
        <h2>{pausedMembers === 1 ? "Membership to review" : "Memberships to review"}</h2>
        <p>{loading ? "Checking member access status." : pausedMembers ? "These members have paused or suspended access." : "All listed memberships are currently active."}</p>
        <button className="button button-secondary" onClick={() => onNavigate("Members")}>Open member directory <span>↗</span></button>
      </section>
    </section>
    <section className="workspace-quicklinks"><button onClick={() => onNavigate("Members")}><span className="quicklink-icon green"><Icon name="users" /></span><span><b>Member directory</b><small>Review members and control access</small></span><span className="quicklink-arrow">↗</span></button><button onClick={() => onNavigate("Events")}><span className="quicklink-icon peach"><Icon name="calendar" /></span><span><b>Manage events</b><small>Create, edit, cancel, or remove events</small></span><span className="quicklink-arrow">↗</span></button><button onClick={() => onNavigate("Quests")}><span className="quicklink-icon lavender"><Icon name="flag" /></span><span><b>Manage quests</b><small>Create and update crew challenges</small></span><span className="quicklink-arrow">↗</span></button></section>
  </>;
}

function MemberOverview({ counts, loading, name, email, events, quests, onNavigate, onViewDetail }: { counts: Counts; loading: boolean; name: string; email: string; events: CommunityEvent[]; quests: CommunityQuest[]; onNavigate: (view: ViewName) => void; onViewDetail: (detail: CommunityDetail) => void }) {
  const { t } = useLanguage();
  return <>
    <section className="member-welcome-card"><div className="welcome-card-copy"><span className="eyebrow">{t("YOUR ORBIT CREW")}</span><h2>{t("Welcome")}, {name}.</h2><p>{t("Your place in the crew, and everything happening around you.")}</p><button className="button button-primary" onClick={() => onNavigate("Events")}>{t("Events")} <span>↗</span></button></div><OrbitSymbol className="welcome-card-mark" decorative /></section>
    <section className="metric-grid workspace-metrics member-metrics"><Metric title={t("Membership")} value={counts.crewNumber === null ? "—" : `MZ-${String(counts.crewNumber).padStart(4, "0")}`} icon="card" loading={loading} /><Metric title={t("Events")} value={counts.events} icon="calendar" loading={loading} /><Metric title={t("Quests")} value={counts.quests} icon="flag" loading={loading} /><Metric title={t("My Progress")} value={counts.xp} icon="grid" loading={loading} /></section>
    <section className="content-grid member-content-grid"><div className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">A GOOD PLACE TO START</span><h2>Find your next moment</h2></div><button className="text-link" onClick={() => onNavigate("Events")}>See events <span>↗</span></button></div>{events.length === 0 ? <EmptyMessage title="No events just yet" detail="When an organizer adds an event, you’ll find it here." /> : <EventList events={events.slice(0, 3)} onView={(item) => onViewDetail({ kind: "event", item })} />}</div><div className="workspace-panel"><div className="panel-heading"><div><span className="eyebrow">PROGRESS, NOT PERFECTION</span><h2>Quests for you</h2></div><button className="text-link" onClick={() => onNavigate("Quests")}>Explore <span>↗</span></button></div>{quests.length === 0 ? <EmptyMessage title="Your next challenge is on its way" detail="New crew quests will show up here." /> : <QuestList quests={quests.slice(0, 3)} onView={(item) => onViewDetail({ kind: "quest", item })} />}</div></section>
    <p className="member-account-note">Signed in as <b>{email}</b>. Your member profile is managed by your account.</p>
  </>;
}

function MemberCard({ counts, loading, name, sleepUntil }: { counts: Counts; loading: boolean; name: string; sleepUntil: string | null }) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const crewId = counts.crewNumber === null ? "—" : `MZ-${String(counts.crewNumber).padStart(4, "0")}`;
  const sleeping = Boolean(sleepUntil && new Date(sleepUntil) > new Date());
  const origin = useSyncExternalStore(subscribeToPageOrigin, getPageOrigin, () => "");
  const verificationUrl = origin && counts.verificationToken
    ? new URL(`/verify/${counts.verificationToken}`, origin).toString()
    : "";

  const statusLabel = counts.membershipStatus === "active"
    ? "ACTIVE MEMBER"
    : counts.membershipStatus === "suspended"
      ? "SUSPENDED"
      : counts.membershipStatus === "left"
        ? "MEMBERSHIP ENDED"
        : "STATUS UNAVAILABLE";

  async function saveCardAsPdf() {
    const qrCanvas = qrCanvasRef.current;
    if (!qrCanvas) {
      setSaveError("The membership card is not ready yet. Please try again.");
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), loadMembershipLogo()]);
      const canvas = drawMembershipCard({ name, statusLabel, crewId, qrCanvas, logo });
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [85.6, 54],
      });
      const fileName = `ORBIT-membership-${crewId}.pdf`;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 85.6, 54);

      downloadPdf(pdf.output("blob"), fileName);
    } catch (error) {
      setSaveError(error instanceof Error ? `Could not create the PDF: ${error.message}` : "Could not create the PDF. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">YOUR COMMUNITY, YOUR CARD</span>
          <h1>Membership</h1>
          <p className="page-intro">Keep a copy on your device or print a wallet-sized card.</p>
        </div>
      </section>
      {sleeping && <div className="sleep-notice" role="status">Sleep mode is on until {new Date(sleepUntil!).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. Your membership remains active, but participation is paused.</div>}
      <section className="membership-print-area" aria-label="Membership card">
        <div className="membership-card-actions">
          <p>Download a wallet-sized PDF directly to your device.</p>
          <button
            type="button"
            className="button button-primary"
            onClick={saveCardAsPdf}
            disabled={saving || loading || counts.crewNumber === null || !verificationUrl}
          >
            {saving ? "Creating PDF…" : "Download / Save as PDF"}
          </button>
        </div>
        {saveError && <p className="membership-save-error" role="alert">{saveError}</p>}
        <div className="member-card">
          <div className="member-card-top">
            <div className="brand-lockup brand-light"><OrbitLogo className="card-orbit-logo" /></div>
            <span className="card-chip">{loading ? "LOADING" : statusLabel}</span>
          </div>
          <div className="card-member-info">
            <span className="eyebrow">GOOD TO HAVE YOU HERE</span>
            <h2>{name}</h2>
            <span>ORBIT COMMUNITY</span>
          </div>
          <div className="member-card-qr">
            {verificationUrl
              ? <QRCodeCanvas ref={qrCanvasRef} value={verificationUrl} size={176} level="M" title="Scan to verify this ORBIT membership" />
              : <span>VERIFY<br />ONLINE</span>}
            <small>SCAN TO VERIFY</small>
          </div>
          <div className="card-footer">
            <div><span className="eyebrow">YOUR CREW ID</span><b>{loading ? "…" : crewId}</b></div>
            <span className="member-card-mark">✳</span>
          </div>
          <div className="member-card-disclaimer">STATUS MAY CHANGE · VERIFY ONLINE</div>
        </div>
        <p className="card-note">A saved or printed card is an offline snapshot. Scan its QR code for current status; inactive or ended memberships will not verify.</p>
      </section>
    </>
  );
}

function loadMembershipLogo() {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the ORBIT logo."));
    image.src = "/images/orbit-logo.png";
  });
}

function drawMembershipCard({
  name,
  statusLabel,
  crewId,
  qrCanvas,
  logo,
}: {
  name: string;
  statusLabel: string;
  crewId: string;
  qrCanvas: HTMLCanvasElement;
  logo: HTMLImageElement;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1012;
  canvas.height = 638;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the membership card image.");

  const scale = canvas.width / 85.6;
  const mm = (value: number) => value * scale;
  const roundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
    const left = mm(x);
    const top = mm(y);
    const right = mm(x + width);
    const bottom = mm(y + height);
    const corner = mm(radius);
    context.beginPath();
    context.moveTo(left + corner, top);
    context.lineTo(right - corner, top);
    context.quadraticCurveTo(right, top, right, top + corner);
    context.lineTo(right, bottom - corner);
    context.quadraticCurveTo(right, bottom, right - corner, bottom);
    context.lineTo(left + corner, bottom);
    context.quadraticCurveTo(left, bottom, left, bottom - corner);
    context.lineTo(left, top + corner);
    context.quadraticCurveTo(left, top, left + corner, top);
    context.closePath();
  };

  context.fillStyle = "#315d49";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255,255,255,0.09)";
  context.lineWidth = mm(0.2);
  context.beginPath();
  context.ellipse(mm(61), mm(13), mm(25), mm(25), 0, 0, Math.PI * 2);
  context.ellipse(mm(61), mm(13), mm(32), mm(32), 0, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#fff";
  roundedRect(3.2, 3.2, 34, 10.2, 1.2);
  context.fill();
  context.drawImage(logo, mm(4.2), mm(4.35), mm(31.5), mm(7.75));

  context.strokeStyle = "rgba(255,255,255,0.38)";
  context.lineWidth = mm(0.2);
  roundedRect(60, 5, 22, 7, 3.5);
  context.stroke();
  context.fillStyle = "#e0eadf";
  context.font = `600 ${mm(2.05)}px Arial, Helvetica, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(statusLabel, mm(71), mm(8.5), mm(20));

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#b5cbb7";
  context.font = `700 ${mm(1.75)}px Arial, Helvetica, sans-serif`;
  context.fillText("GOOD TO HAVE YOU HERE", mm(3.2), mm(26.5));

  const maxNameWidth = mm(51);
  const words = name.trim().split(/\s+/).filter(Boolean);
  let nameFontSize = mm(5.5);
  context.font = `normal ${nameFontSize}px Georgia, "Times New Roman", serif`;
  let lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxNameWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  if (lines.length > 2 || (lines.length === 1 && context.measureText(lines[0]).width > maxNameWidth)) {
    nameFontSize = mm(4.7);
    context.font = `normal ${nameFontSize}px Georgia, "Times New Roman", serif`;
    lines = [];
    line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxNameWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    if (lines.length > 2) lines = [lines[0], `${lines[1].slice(0, 20)}…`];
  }

  context.fillStyle = "#fff";
  context.font = `normal ${nameFontSize}px Georgia, "Times New Roman", serif`;
  const nameTop = lines.length > 1 ? 31.7 : 34.2;
  lines.forEach((value, index) => context.fillText(value, mm(3.2), mm(nameTop + index * 4.2), maxNameWidth));

  context.fillStyle = "#c3d2c4";
  context.font = `normal ${mm(1.75)}px Arial, Helvetica, sans-serif`;
  context.fillText("ORBIT COMMUNITY", mm(3.2), mm(lines.length > 1 ? 40.2 : 39.3));

  context.fillStyle = "#fff";
  roundedRect(63.5, 24.7, 19.5, 19.5, 1.2);
  context.fill();
  context.imageSmoothingEnabled = false;
  context.drawImage(qrCanvas, mm(64.5), mm(25.7), mm(17.5), mm(17.5));
  context.imageSmoothingEnabled = true;
  context.fillStyle = "#d6e3d4";
  context.font = `600 ${mm(1.25)}px Arial, Helvetica, sans-serif`;
  context.textAlign = "center";
  context.fillText("SCAN TO VERIFY", mm(73.25), mm(46.1));

  context.textAlign = "left";
  context.fillStyle = "#b3c9b4";
  context.font = `700 ${mm(1.6)}px Arial, Helvetica, sans-serif`;
  context.fillText("YOUR CREW ID", mm(3.2), mm(45.2));
  context.fillStyle = "#fff";
  context.font = `600 ${mm(2.7)}px Arial, Helvetica, sans-serif`;
  context.fillText(crewId, mm(3.2), mm(50));
  context.fillStyle = "#b3c9b4";
  context.font = `normal ${mm(1.35)}px Arial, Helvetica, sans-serif`;
  context.fillText("STATUS MAY CHANGE - VERIFY ONLINE", mm(3.2), mm(52.4));

  return canvas;
}

function downloadPdf(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function CalendarView({ events, quests, onViewDetail }: { events: CommunityEvent[]; quests: CommunityQuest[]; onViewDetail: (detail: CommunityDetail) => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [calendarDisplay, setCalendarDisplay] = useState<"month" | "agenda">("month");
  useEffect(() => {
    const mobileViewport = window.matchMedia("(max-width: 760px)");
    const timeout = window.setTimeout(() => setCalendarDisplay(mobileViewport.matches ? "agenda" : "month"), 0);
    const updateDisplay = (event: MediaQueryListEvent) => setCalendarDisplay(event.matches ? "agenda" : "month");
    mobileViewport.addEventListener("change", updateDisplay);
    return () => {
      window.clearTimeout(timeout);
      mobileViewport.removeEventListener("change", updateDisplay);
    };
  }, []);
  const offset = (month.getDay() + 6) % 7;
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((offset + dayCount) / 7) * 7;
  const days = Array.from({ length: cellCount }, (_, index) => {
    const number = index - offset + 1;
    return number > 0 && number <= dayCount ? number : null;
  });
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const agendaEntries = [
    ...events.map((item) => ({ kind: "event" as const, item, date: item.start_at })),
    ...quests.flatMap((item) => item.deadline ? [{ kind: "quest" as const, item, date: item.deadline }] : []),
  ].filter((entry) => {
    const date = new Date(entry.date);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
  }).sort((first, second) => first.date.localeCompare(second.date));
  const entriesOn = (day: number) => {
    const dateKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return [
      ...events.filter((item) => localDateKey(item.start_at) === dateKey).map((item) => ({ kind: "event" as const, item })),
      ...quests.filter((item) => item.deadline && localDateKey(item.deadline) === dateKey).map((item) => ({ kind: "quest" as const, item })),
    ];
  };
  return <section className="calendar-panel workspace-panel">
    <div className="calendar-heading"><div><span className="eyebrow">ORBIT SCHEDULE</span><h1>Community calendar</h1><p className="page-intro">Plan around upcoming events and quest deadlines.</p></div><div className="calendar-heading-actions"><div className="calendar-view-switch" role="group" aria-label="Calendar view"><button type="button" className={calendarDisplay === "month" ? "selected" : ""} aria-pressed={calendarDisplay === "month"} onClick={() => setCalendarDisplay("month")}>Month</button><button type="button" className={calendarDisplay === "agenda" ? "selected" : ""} aria-pressed={calendarDisplay === "agenda"} onClick={() => setCalendarDisplay("agenda")}>Agenda</button></div><div className="calendar-controls"><button type="button" className="button button-secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">‹</button><b>{monthLabel}</b><button type="button" className="button button-secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">›</button></div></div></div>
    {calendarDisplay === "month" ? <div className="calendar-grid" role="grid" aria-label={monthLabel}>
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
      {days.map((day, index) => {
        const entries = day === null ? [] : entriesOn(day);
        const today = day !== null && new Date().getFullYear() === month.getFullYear() && new Date().getMonth() === month.getMonth() && new Date().getDate() === day;
        return <div className={`calendar-day ${day === null ? "calendar-day-empty" : ""} ${today ? "calendar-day-today" : ""}`} role="gridcell" key={`${month.toISOString()}-${index}`}>
          {day !== null && <><span className="calendar-day-number">{day}</span><div className="calendar-day-items">{entries.map((entry) => <button type="button" className={`calendar-event calendar-event-${entry.kind}`} key={`${entry.kind}-${entry.item.id}`} onClick={() => onViewDetail(entry)} title={`${entry.kind === "event" ? "Event" : "Quest"}: ${entry.item.title}`}><span>{entry.kind === "event" ? "E" : "Q"}</span>{entry.item.title}</button>)}</div></>}
        </div>;
      })}
    </div> : <div className="calendar-agenda" aria-label={`Agenda for ${monthLabel}`}>
      {agendaEntries.length ? agendaEntries.map((entry) => {
        const date = new Date(entry.date);
        const isEvent = entry.kind === "event";
        const title = entry.item.title;
        const supportingText = entry.kind === "event"
          ? [date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }), entry.item.location, entry.item.status].filter(Boolean).join(" · ")
          : `Quest deadline · ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
        return <article className="calendar-agenda-row" key={`${entry.kind}-${entry.item.id}`}>
          <span className={`date-tile ${isEvent ? "sage" : "blue"}`}><b>{date.getDate()}</b><span>{date.toLocaleDateString(undefined, { month: "short" })}</span></span>
          <span className="calendar-agenda-copy"><b>{title}</b><small>{isEvent ? "Event" : "Quest"} · {supportingText}</small></span>
          <button type="button" className="button button-secondary" onClick={() => entry.kind === "event" ? onViewDetail({ kind: "event", item: entry.item }) : onViewDetail({ kind: "quest", item: entry.item })}>View details</button>
        </article>;
      }) : <div className="list-no-results">Nothing scheduled for {monthLabel}.</div>}
    </div>}
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
  const [leaving, setLeaving] = useState(false);
  const [leaveFormOpen, setLeaveFormOpen] = useState(false);
  const [leavePassword, setLeavePassword] = useState("");
  const [leaveConfirmation, setLeaveConfirmation] = useState("");
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

  async function pauseMembership() {
    if (!window.confirm("Pause your ORBIT membership? Your account and progress will stay saved, but you will lose access until an administrator reactivates your membership.")) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: pauseError } = await supabase.rpc("pause_own_membership");
      if (pauseError) throw pauseError;
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error("Membership was paused, but the member could not be signed out.", signOutError);
        setError("Your membership is paused, but we could not sign you out. Please sign out manually. An administrator can reactivate your membership.");
        return;
      }
      window.location.replace("/?access=paused");
    } catch (pauseError) {
      console.error("Could not pause the member's ORBIT membership.", pauseError);
      setError(pauseError instanceof Error ? pauseError.message : "Could not pause your membership.");
    } finally {
      setBusy(false);
    }
  }

  async function leaveOrbit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (leaveConfirmation !== "LEAVE ORBIT") {
      setError('Type "LEAVE ORBIT" to confirm permanent account closure.');
      return;
    }
    if (!leavePassword) {
      setError("Enter your current password to confirm account closure.");
      return;
    }

    setLeaving(true);
    try {
      const response = await fetch("/api/membership/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: leaveConfirmation, password: leavePassword }),
      });
      const result = await response.json() as { error?: string; success?: boolean };
      if (!response.ok || !result.success) throw new Error(result.error ?? "Your account could not be closed.");

      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) console.error("The account was closed, but the browser session could not be cleared.", signOutError);
      window.location.replace("/?account=closed");
    } catch (leaveError) {
      console.error("Could not close the ORBIT account.", leaveError);
      setError(leaveError instanceof Error ? leaveError.message : "Your account could not be closed.");
      setLeaving(false);
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
      <div><span className="eyebrow">MEMBERSHIP HIBERNATION</span><h2>{sleeping ? "Sleep mode is active" : "Take a break when you need one"}</h2><p className="page-intro">{sleeping ? `Your membership remains active until ${new Date(sleepUntil!).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}, but participation is paused. You can wake it up at any time.` : "While asleep, events and quests are hidden and you cannot join them. Your account and progress remain safe."}</p></div>
      {!sleeping && <label className="management-field">Sleep duration<select value={days} onChange={(event) => setDays(event.target.value)}><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></label>}
      <button className={sleeping ? "button button-primary" : "button button-secondary"} type="button" onClick={() => void toggleSleepMode()} disabled={busy}>{busy ? "Updating…" : sleeping ? "Wake membership" : "Enter sleep mode"}</button>
    </section>
    <section className="workspace-panel membership-exit-settings">
      <div><span className="eyebrow">MEMBERSHIP OPTIONS</span><h2>Need a longer break?</h2><p>Pause your membership to keep your account and progress. An administrator can reactivate it when you are ready.</p></div>
      <button className="button button-secondary" type="button" onClick={() => void pauseMembership()} disabled={busy || leaving}>{busy ? "Pausing…" : "Pause membership"}</button>
    </section>
    <section className="workspace-panel membership-exit-settings membership-leave-settings">
      <div><span className="eyebrow">PERMANENT ACCOUNT CLOSURE</span><h2>Leave ORBIT</h2><p>Closing your account permanently removes your profile, membership, participation history, progress, and profile photo from the live ORBIT database. This cannot be undone by an administrator. A copy already saved to a device cannot be remotely deleted, but its live verification will stop working.</p><p>If you only lost access to your account, use password recovery instead. Your saved data stays in ORBIT unless you choose to close the account.</p></div>
      {!leaveFormOpen
        ? <button className="button button-danger" type="button" onClick={() => { setError(""); setLeaveFormOpen(true); }} disabled={busy}>Continue to account closure</button>
        : <form className="leave-account-form" onSubmit={leaveOrbit}>
            <label className="management-field">Current password<input type="password" autoComplete="current-password" value={leavePassword} onChange={(event) => setLeavePassword(event.target.value)} required /></label>
            <label className="management-field">Type LEAVE ORBIT to confirm<input value={leaveConfirmation} onChange={(event) => setLeaveConfirmation(event.target.value)} autoComplete="off" required /></label>
            <div className="management-form-actions"><button className="button button-secondary" type="button" onClick={() => { setLeaveFormOpen(false); setLeavePassword(""); setLeaveConfirmation(""); setError(""); }} disabled={leaving}>Cancel</button><button className="button button-danger" type="submit" disabled={leaving}>{leaving ? "Closing account…" : "Permanently close account"}</button></div>
          </form>}
    </section>
  </>;
}

function EmptyWorkspaceSection({ role, kind, count, loading, events = [], quests = [], members = [], onToggleMemberAccess, memberActionId, onViewDetail }: { role: WorkspaceRole; kind: "events" | "quests" | "members"; count: number; loading: boolean; events?: CommunityEvent[]; quests?: CommunityQuest[]; members?: DirectoryMember[]; onToggleMemberAccess?: (member: DirectoryMember) => void; memberActionId?: string | null; onViewDetail?: (detail: CommunityDetail) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const now = useCurrentTimestamp();
  const title = kind === "events" ? "Events" : kind === "quests" ? "Quests & missions" : "Member directory";
  const detail = kind === "events" ? "Community events will appear here once they’re created." : kind === "quests" ? "Quests will appear here once an admin creates them." : "Member accounts appear here after people sign up.";
  const hasData = kind === "events" ? events.length > 0 : kind === "quests" ? quests.length > 0 : members.length > 0;
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleEvents = events.filter((event) => {
    const matchesSearch = `${event.title} ${event.description} ${event.location}`.toLocaleLowerCase().includes(normalizedSearch);
    return matchesSearch && (filter === "all" || event.status === filter);
  });
  const visibleQuests = quests.filter((quest) => {
    const matchesSearch = `${quest.title} ${quest.description}`.toLocaleLowerCase().includes(normalizedSearch);
    const deadline = quest.deadline ? new Date(quest.deadline).getTime() : null;
    const matchesFilter = filter === "all" || (filter === "upcoming" && (deadline === null || (now !== null && deadline >= now))) || (filter === "past" && deadline !== null && now !== null && deadline < now);
    return matchesSearch && matchesFilter;
  });
  const visibleMembers = members.filter((member) => {
    const sleeping = Boolean(member.sleepUntil && new Date(member.sleepUntil) > new Date());
    const matchesSearch = `${member.fullName} ${member.username} ${member.crewNumber}`.toLocaleLowerCase().includes(normalizedSearch);
    const matchesFilter = filter === "all"
      || (filter === "active" && member.status === "active" && !sleeping)
      || (filter === "paused" && member.status !== "active" && !sleeping)
      || (filter === "sleeping" && sleeping);
    return matchesSearch && matchesFilter;
  });
  const visibleCount = kind === "events" ? visibleEvents.length : kind === "quests" ? visibleQuests.length : visibleMembers.length;
  const options = kind === "events"
    ? [{ value: "all", label: "All statuses" }, { value: "open", label: "Open" }, { value: "cancelled", label: "Cancelled" }, { value: "completed", label: "Completed" }]
    : kind === "quests"
      ? [{ value: "all", label: "All deadlines" }, { value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past deadline" }]
      : [{ value: "all", label: "All members" }, { value: "active", label: "Active" }, { value: "paused", label: "Paused" }, { value: "sleeping", label: "Sleep mode" }];
  const itemLabel = kind === "events" ? "events" : kind === "quests" ? "quests" : "members";
  const searchLabel = kind === "members" ? "members" : itemLabel;

  return <>
    <section className="page-heading"><div><span className="eyebrow">{role === "admin" ? "ORBIT COMMUNITY" : "YOUR ORBIT COMMUNITY"}</span><h1>{title}</h1><p className="page-intro">{role === "admin" ? "Review members and control member access." : "Everything here comes from your community workspace."}</p></div></section>
    {hasData
      ? <section className="workspace-panel data-list-panel">
          <ListToolbar search={search} onSearchChange={setSearch} filter={filter} onFilterChange={setFilter} options={options} searchLabel={searchLabel} resultCount={visibleCount} />
          {kind === "events" && (visibleEvents.length ? <EventList events={visibleEvents} onView={onViewDetail ? (item) => onViewDetail({ kind: "event", item }) : undefined} /> : <NoListResults itemLabel={itemLabel} />)}
          {kind === "quests" && (visibleQuests.length ? <QuestList quests={visibleQuests} onView={onViewDetail ? (item) => onViewDetail({ kind: "quest", item }) : undefined} /> : <NoListResults itemLabel={itemLabel} />)}
          {kind === "members" && (visibleMembers.length ? <MemberList members={visibleMembers} onToggleAccess={onToggleMemberAccess} busyMemberId={memberActionId} /> : <NoListResults itemLabel={itemLabel} />)}
        </section>
      : <section className="workspace-panel empty-page-panel"><span className="empty-illustration"><Icon name={kind === "events" ? "calendar" : kind === "quests" ? "flag" : "users"} /></span><span className="eyebrow">{loading ? "LOADING" : `${count} ${kind.toUpperCase()}`}</span><h2>{loading ? "Getting your workspace ready" : kind === "members" ? "The crew starts here." : "A fresh start."}</h2><p>{loading ? "Checking the latest ORBIT data." : detail}</p></section>}
  </>;
}

function localDateTimeValue(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function EventManager({ events, adminId, onChanged, onViewDetail }: { events: CommunityEvent[]; adminId: string; onChanged: () => void; onViewDetail: (event: CommunityEvent) => void }) {
  const { t } = useLanguage();
  const emptyDraft: EventDraft = { title: "", description: "", visibility: "public", status: "open", startAt: "", location: "", capacity: "" };
  const [draft, setDraft] = useState<EventDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleEvents = events.filter((event) =>
    `${event.title} ${event.description} ${event.location}`.toLocaleLowerCase().includes(normalizedSearch)
    && (filter === "all" || event.status === filter),
  );

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
    <section className="page-heading management-heading"><div><span className="eyebrow">{t("ORBIT COMMUNITY")}</span><h1>{t("Events")}</h1><p className="page-intro">{t("Create events and control their details, visibility, and status.")}</p></div><button className="button button-primary" onClick={() => { closeForm(); setFormOpen(true); }}>{t("Create event")} <span>＋</span></button></section>
    {error && <div className="workspace-error" role="alert"><b>{t("Event action failed.")}</b><span>{error}</span></div>}
    {formOpen && <form className="workspace-panel management-form" onSubmit={saveEvent}>
      <div className="management-form-heading"><div><span className="eyebrow">{t(editingId ? "UPDATE ORBIT EVENT" : "NEW ORBIT EVENT")}</span><h2>{t(editingId ? "Edit event" : "Create an event")}</h2></div></div>
      <div className="management-form-grid">
        <label className="management-field">{t("Event name")}<input required maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label className="management-field">{t("Date and time")}<input required type="datetime-local" value={draft.startAt} onChange={(event) => setDraft({ ...draft, startAt: event.target.value })} /></label>
        <label className="management-field">{t("Location")}<input maxLength={160} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label>
        <label className="management-field">{t("Capacity (optional)")}<input type="number" min="1" step="1" value={draft.capacity} onChange={(event) => setDraft({ ...draft, capacity: event.target.value })} /></label>
        <label className="management-field">{t("Visibility")}<select value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as EventDraft["visibility"] })}><option value="public">{t("Public to members")}</option><option value="private">{t("Private")}</option></select></label>
        <label className="management-field">{t("Status")}<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as EventDraft["status"] })}><option value="open">Open</option><option value="cancelled">Cancelled</option><option value="completed">Completed</option></select></label>
        <label className="management-field management-field-wide">{t("Description")}<textarea rows={4} maxLength={3000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      </div>
      <div className="management-form-actions"><button type="button" className="button button-secondary" onClick={closeForm} disabled={busy}>{t("Cancel")}</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? t("Saving…") : editingId ? t("Save changes") : t("Create event")}</button></div>
    </form>}
    {events.length ? <section className="workspace-panel data-list-panel management-list">
      <ListToolbar search={search} onSearchChange={setSearch} filter={filter} onFilterChange={setFilter} options={[{ value: "all", label: "All statuses" }, { value: "open", label: "Open" }, { value: "cancelled", label: "Cancelled" }, { value: "completed", label: "Completed" }]} searchLabel="events" resultCount={visibleEvents.length} />
      {visibleEvents.length ? <EventList events={visibleEvents} onEdit={editEvent} onDelete={deleteEvent} onView={onViewDetail} busy={busy} /> : <NoListResults itemLabel="events" />}
    </section> : <section className="workspace-panel empty-page-panel"><span className="empty-illustration"><Icon name="calendar" /></span><span className="eyebrow">0 EVENTS</span><h2>Ready to bring the crew together?</h2><p>Create the first event and it will appear here for members.</p></section>}
  </>;
}

function QuestManager({ quests, adminId, onChanged, onViewDetail }: { quests: CommunityQuest[]; adminId: string; onChanged: () => void; onViewDetail: (quest: CommunityQuest) => void }) {
  const { t } = useLanguage();
  const emptyDraft: QuestDraft = { title: "", description: "", xpReward: "0", goal: "1", deadline: "" };
  const [draft, setDraft] = useState<QuestDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const now = useCurrentTimestamp();
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleQuests = quests.filter((quest) => {
    const matchesSearch = `${quest.title} ${quest.description}`.toLocaleLowerCase().includes(normalizedSearch);
    const deadline = quest.deadline ? new Date(quest.deadline).getTime() : null;
    const matchesFilter = filter === "all"
      || (filter === "upcoming" && (deadline === null || (now !== null && deadline >= now)))
      || (filter === "past" && deadline !== null && now !== null && deadline < now);
    return matchesSearch && matchesFilter;
  });

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
    <section className="page-heading management-heading"><div><span className="eyebrow">{t("ORBIT COMMUNITY")}</span><h1>{t("Quests & missions")}</h1><p className="page-intro">{t("Set goals and XP rewards, and control the quest deadline.")}</p></div><button className="button button-primary" onClick={() => { closeForm(); setFormOpen(true); }}>{t("Create quest")} <span>＋</span></button></section>
    {error && <div className="workspace-error" role="alert"><b>{t("Quest action failed.")}</b><span>{error}</span></div>}
    {formOpen && <form className="workspace-panel management-form" onSubmit={saveQuest}>
      <div className="management-form-heading"><div><span className="eyebrow">{t(editingId ? "UPDATE ORBIT QUEST" : "NEW ORBIT QUEST")}</span><h2>{t(editingId ? "Edit quest" : "Create a quest")}</h2></div></div>
      <div className="management-form-grid">
        <label className="management-field">{t("Quest name")}<input required maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label className="management-field">{t("Deadline (optional)")}<input type="datetime-local" value={draft.deadline} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} /></label>
        <label className="management-field">{t("XP reward")}<input required type="number" min="0" step="1" value={draft.xpReward} onChange={(event) => setDraft({ ...draft, xpReward: event.target.value })} /></label>
        <label className="management-field">{t("Goal")}<input required type="number" min="1" step="1" value={draft.goal} onChange={(event) => setDraft({ ...draft, goal: event.target.value })} /></label>
        <label className="management-field management-field-wide">{t("Description")}<textarea rows={4} maxLength={3000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      </div>
      <div className="management-form-actions"><button type="button" className="button button-secondary" onClick={closeForm} disabled={busy}>{t("Cancel")}</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? t("Saving…") : editingId ? t("Save changes") : t("Create quest")}</button></div>
    </form>}
    {quests.length ? <section className="workspace-panel data-list-panel management-list">
      <ListToolbar search={search} onSearchChange={setSearch} filter={filter} onFilterChange={setFilter} options={[{ value: "all", label: "All deadlines" }, { value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past deadline" }]} searchLabel="quests" resultCount={visibleQuests.length} />
      {visibleQuests.length ? <QuestList quests={visibleQuests} onEdit={editQuest} onDelete={deleteQuest} onView={onViewDetail} busy={busy} /> : <NoListResults itemLabel="quests" />}
    </section> : <section className="workspace-panel empty-page-panel"><span className="empty-illustration"><Icon name="flag" /></span><span className="eyebrow">0 {t("Quests").toUpperCase()}</span><h2>{t("Give the crew a challenge.")}</h2><p>{t("Create a quest with a goal and XP reward to get started.")}</p></section>}
  </>;
}

function MemberProgress({ submissions, quests, xp, loading, onNavigate }: {
  submissions: QuestSubmission[];
  quests: CommunityQuest[];
  xp: number;
  loading: boolean;
  onNavigate: (view: ViewName) => void;
}) {
  const questsById = new Map(quests.map((quest) => [quest.id, quest]));
  const approvedCount = submissions.filter((submission) => submission.status === "verified").length;
  const pendingCount = submissions.filter((submission) => submission.status === "submitted").length;

  return <>
    <section className="page-heading">
      <div><span className="eyebrow">YOUR QUEST JOURNEY</span><h1>My progress</h1><p className="page-intro">Track your submissions, admin feedback, and earned XP.</p></div>
      <button type="button" className="button button-primary" onClick={() => onNavigate("Quests")}>Explore quests <span>↗</span></button>
    </section>
    <section className="quest-progress-summary" aria-label="Quest progress summary">
      <div><span>Total XP</span><b>{loading ? "…" : xp}</b></div>
      <div><span>Approved submissions</span><b>{loading ? "…" : approvedCount}</b></div>
      <div><span>Waiting for review</span><b>{loading ? "…" : pendingCount}</b></div>
    </section>
    <section className="workspace-panel quest-history-panel">
      <div className="panel-heading"><div><span className="eyebrow">SUBMISSION HISTORY</span><h2>Your quest work</h2></div><span className="count-badge">{submissions.length} total</span></div>
      {loading
        ? <p className="quest-history-empty">Loading your progress…</p>
        : submissions.length === 0
          ? <div className="empty-message"><span>✳</span><b>Your first quest is waiting</b><p>Join a quest and submit your completed work to start earning XP.</p></div>
          : <div className="quest-history-list">{submissions.map((submission) => {
              const quest = questsById.get(submission.quest_id);
              return <article className="quest-history-item" key={submission.id}>
                <div className="quest-history-heading"><div><b>{quest?.title ?? "Quest no longer available"}</b><small>Submitted {new Date(submission.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</small></div>
                  <span className={`status-pill ${submission.status === "verified" ? "active" : submission.status === "rejected" ? "rejected" : "pending"}`}><i />{submission.status === "submitted" ? "Awaiting review" : submission.status}</span>
                </div>
                <p className="quest-history-text">{submission.submission_text}</p>
                {submission.status === "verified" && quest && <p className="quest-history-feedback">+{quest.xp_reward} XP awarded</p>}
                {submission.reviewer_feedback && <p className="quest-history-feedback"><b>Admin feedback:</b> {submission.reviewer_feedback}</p>}
              </article>;
            })}</div>}
    </section>
  </>;
}

type QuestReviewItem = {
  submission: QuestSubmission;
  memberName: string;
  username: string;
  questTitle: string;
  xpReward: number;
};

function QuestReviewManager() {
  const [queue, setQueue] = useState<QuestReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError("");
      try {
        const supabase = createClient();
        const { data: submissions, error: submissionError } = await supabase.from("quest_submissions")
          .select("*")
          .eq("status", "submitted")
          .order("created_at", { ascending: true });
        if (submissionError) throw submissionError;

        const userIds = [...new Set(submissions.map((submission) => submission.user_id))];
        const questIds = [...new Set(submissions.map((submission) => submission.quest_id))];
        const [profilesResult, questsResult] = await Promise.all([
          userIds.length
            ? supabase.from("profiles").select("id, full_name, username").in("id", userIds)
            : Promise.resolve({ data: [], error: null }),
          questIds.length
            ? supabase.from("quests").select("id, title, xp_reward").in("id", questIds)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (profilesResult.error) throw profilesResult.error;
        if (questsResult.error) throw questsResult.error;

        const profiles = new Map(profilesResult.data.map((profile) => [profile.id, profile]));
        const questsById = new Map(questsResult.data.map((quest) => [quest.id, quest]));
        const items = submissions.map((submission) => {
          const profile = profiles.get(submission.user_id);
          const quest = questsById.get(submission.quest_id);
          return {
            submission,
            memberName: profile?.full_name ?? "Member",
            username: profile?.username ?? "member",
            questTitle: quest?.title ?? "Quest no longer available",
            xpReward: quest?.xp_reward ?? 0,
          };
        });
        if (active) setQueue(items);
      } catch (loadError) {
        console.error("Could not load quest submissions for review.", loadError);
        const message = loadError && typeof loadError === "object" && "message" in loadError && typeof loadError.message === "string"
          ? loadError.message
          : "Could not load quest submissions.";
        if (active) setError(message);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadQueue();
    return () => { active = false; };
  }, [reloadKey]);

  async function reviewSubmission(item: QuestReviewItem, status: "verified" | "rejected", feedback: string) {
    setBusyId(item.submission.id);
    setError("");
    setNotice("");
    try {
      const { error: reviewError } = await createClient().rpc("review_orbit_quest_submission", {
        p_submission_id: item.submission.id,
        p_status: status,
        p_feedback: feedback,
      });
      if (reviewError) throw reviewError;
      setQueue((current) => current.filter((entry) => entry.submission.id !== item.submission.id));
      setNotice(status === "verified"
        ? `${item.memberName}'s work was approved. ${item.xpReward} XP was awarded.`
        : `${item.memberName}'s work was rejected with feedback.`);
    } catch (reviewError) {
      console.error("Could not review quest submission.", reviewError);
      const message = reviewError && typeof reviewError === "object" && "message" in reviewError && typeof reviewError.message === "string"
        ? reviewError.message
        : "Could not review this submission.";
      setError(message);
    } finally {
      setBusyId(null);
    }
  }

  return <>
    <section className="page-heading management-heading">
      <div><span className="eyebrow">ORBIT COMMUNITY</span><h1>Quest review</h1><p className="page-intro">Review member work and award XP for approved submissions.</p></div>
      <button type="button" className="button button-secondary" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>Refresh queue</button>
    </section>
    {error && <div className="workspace-error" role="alert"><b>Review action failed.</b><span>{error}</span></div>}
    {notice && <div className="workspace-success" role="status">{notice}</div>}
    <section className="workspace-panel quest-review-panel">
      <div className="panel-heading"><div><span className="eyebrow">PENDING SUBMISSIONS</span><h2>Needs your review</h2></div><span className="count-badge">{queue.length} pending</span></div>
      {loading
        ? <p className="quest-history-empty">Loading submissions…</p>
        : queue.length === 0
          ? <div className="empty-message"><span>✓</span><b>All caught up</b><p>New quest submissions from members will appear here.</p></div>
          : <div className="quest-review-list">{queue.map((item) => <QuestReviewCard key={item.submission.id} item={item} busy={busyId === item.submission.id} onReview={(status, feedback) => void reviewSubmission(item, status, feedback)} />)}</div>}
    </section>
  </>;
}

function QuestReviewCard({ item, busy, onReview }: {
  item: QuestReviewItem;
  busy: boolean;
  onReview: (status: "verified" | "rejected", feedback: string) => void;
}) {
  const [feedback, setFeedback] = useState("");
  return <article className="quest-review-item">
    <header><div><b>{item.memberName}</b><small>@{item.username} · {new Date(item.submission.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</small></div><span className="xp-chip">{item.xpReward} XP</span></header>
    <h3>{item.questTitle}</h3>
    <p className="quest-review-evidence">{item.submission.submission_text}</p>
    <label className="management-field">Feedback for the member
      <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={1000} rows={3} placeholder="Required when rejecting; optional when approving." />
    </label>
    <div className="quest-review-actions">
      <button type="button" className="button button-danger" onClick={() => onReview("rejected", feedback.trim())} disabled={busy || !feedback.trim()}>{busy ? "Saving…" : "Reject with feedback"}</button>
      <button type="button" className="button button-primary" onClick={() => onReview("verified", feedback.trim())} disabled={busy}>{busy ? "Saving…" : `Approve · ${item.xpReward} XP`}</button>
    </div>
  </article>;
}

function EventList({ events, onEdit, onDelete, onView, busy = false }: { events: CommunityEvent[]; onEdit?: (event: CommunityEvent) => void; onDelete?: (event: CommunityEvent) => void; onView?: (event: CommunityEvent) => void; busy?: boolean }) {
  return (
    <div className="workspace-data-list">
      {events.map((event) => (
        <article className="workspace-data-row" key={event.id}>
          <span className="quicklink-icon peach"><Icon name="calendar" /></span>
          <span className="workspace-data-copy">
            <b>{event.title}</b>
            <small>{new Date(event.start_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}{event.location ? ` · ${event.location}` : ""} · {event.visibility}{event.capacity === null ? ` · ${event.registeredCount ?? event.participants?.length ?? 0} joined` : ` · ${event.registeredCount ?? event.participants?.length ?? 0}/${event.capacity} spots`}{(event.waitlistCount ?? 0) > 0 ? ` · ${event.waitlistCount} waitlisted` : ""}</small>
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

function CommunityDetailDialog({ detail, role, sleeping, participationBusy, submissions, onSubmitQuestWork, onToggleParticipation, onClose }: {
  detail: CommunityDetail;
  role: WorkspaceRole;
  sleeping: boolean;
  participationBusy: boolean;
  submissions: QuestSubmission[];
  onSubmitQuestWork: (questId: string, submissionText: string) => Promise<void>;
  onToggleParticipation: () => void;
  onClose: () => void;
}) {
  const isEvent = detail.kind === "event";
  const title = detail.item.title;
  const participants = detail.item.participants ?? [];
  const submission = detail.kind === "quest"
    ? submissions.find((item) => item.quest_id === detail.item.id)
    : undefined;
  const deadlinePassed = detail.kind === "quest" && detail.item.deadline !== null && new Date(detail.item.deadline) <= new Date();
  const eventClosed = detail.kind === "event" && detail.item.status !== "open";
  const eventRegistrationStatus = detail.kind === "event"
    ? detail.item.registrationStatus ?? (detail.item.registered ? "registered" : null)
    : null;
  const isWaitlisted = eventRegistrationStatus === "waitlisted";
  const isAtCapacity = detail.kind === "event"
    && detail.item.capacity !== null
    && (detail.item.registeredCount ?? participants.length) >= detail.item.capacity;

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
                <div><dt>Capacity</dt><dd>{detail.item.capacity === null
                  ? `${detail.item.registeredCount ?? participants.length} joined · no limit`
                  : `${detail.item.registeredCount ?? participants.length} / ${detail.item.capacity} confirmed`}</dd></div>
                {(detail.item.waitlistCount ?? 0) > 0 && <div><dt>Waitlist</dt><dd>{detail.item.waitlistCount} {detail.item.waitlistCount === 1 ? "member" : "members"} waiting</dd></div>}
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
        {role === "admin" && <section className="participant-list"><h3>Joined members ({detail.kind === "event" ? detail.item.registeredCount ?? participants.length : participants.length})</h3>{participants.length ? <ul>{participants.map((participant) => <li key={participant.userId}><b>{participant.fullName}</b><span>@{participant.username}</span></li>)}</ul> : <p>No members have joined yet.</p>}</section>}
        {role === "admin" && detail.kind === "event" && (detail.item.waitlistedParticipants?.length ?? 0) > 0 && <section className="participant-list event-waitlisted-list"><h3>Waitlist ({detail.item.waitlistCount ?? detail.item.waitlistedParticipants?.length ?? 0})</h3><ol>{detail.item.waitlistedParticipants?.map((participant) => <li key={participant.userId}><b>{participant.fullName}</b><span>@{participant.username}</span></li>)}</ol></section>}
        {role === "member" && <div className="participation-actions">
          {sleeping && <p>Your membership is asleep, so you can’t join activities right now.</p>}
          {detail.kind === "event" && isWaitlisted && <p className="event-waitlist-notice" role="status">{detail.item.waitlistPosition
            ? `You’re on the waitlist at position ${detail.item.waitlistPosition}. We’ll confirm your spot automatically if one opens.`
            : "You’re on the waitlist. We’ll confirm your spot automatically if one opens."}</p>}
          {detail.kind === "event" && !eventRegistrationStatus && isAtCapacity && <p className="event-waitlist-notice">This event is full. Join the waitlist and we’ll move you up if a spot opens.</p>}
          <button type="button" className={`button ${eventRegistrationStatus || detail.item.registered ? "button-secondary" : "button-primary"}`} onClick={onToggleParticipation} disabled={sleeping || participationBusy || (!eventRegistrationStatus && !detail.item.registered && (eventClosed || deadlinePassed))}>
            {participationBusy ? "Updating…" : isWaitlisted ? "Leave waitlist" : eventRegistrationStatus || detail.item.registered ? "Leave activity" : detail.kind === "event" && isAtCapacity ? "Join waitlist" : "Join activity"}
          </button>
          {detail.kind === "quest" && detail.item.registered && <QuestSubmissionForm quest={detail.item} submission={submission} sleeping={sleeping} onSubmit={onSubmitQuestWork} />}
          {detail.kind === "quest" && !detail.item.registered && <p className="submission-hint">Join this quest to submit your work for review.</p>}
        </div>}
      </section>
    </div>
  );
}

function QuestSubmissionForm({ quest, submission, sleeping, onSubmit }: {
  quest: CommunityQuest;
  submission: QuestSubmission | undefined;
  sleeping: boolean;
  onSubmit: (questId: string, submissionText: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeSubmission = submission?.status === "submitted" || submission?.status === "verified";
  const deadlinePassed = quest.deadline !== null && new Date(quest.deadline) <= new Date();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(quest.id, text);
      setDraft("");
    } catch (submitError) {
      console.error("Could not submit quest work.", submitError);
      const message = submitError && typeof submitError === "object" && "message" in submitError && typeof submitError.message === "string"
        ? submitError.message
        : "Could not submit quest work.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="quest-submission-section">
    <h3>Your submission</h3>
    {submission && <div className="quest-submission-status">
      <span className={`status-pill ${submission.status === "verified" ? "active" : submission.status === "rejected" ? "rejected" : "pending"}`}><i />{submission.status === "submitted" ? "Awaiting review" : submission.status}</span>
      {submission.status === "rejected" && submission.reviewer_feedback && <p><b>Admin feedback:</b> {submission.reviewer_feedback}</p>}
    </div>}
    {activeSubmission
      ? <p className="submission-hint">{submission?.status === "verified" ? "Your work was approved. The quest XP has been added to My Progress." : "Your work is waiting for an admin to review it."}</p>
      : deadlinePassed
        ? <p className="submission-hint">This quest deadline has passed, so new submissions are closed.</p>
        : sleeping
          ? <p className="submission-hint">Wake your membership before submitting quest work.</p>
          : <form className="quest-submission-form" onSubmit={submit}>
              <label className="submission-field">Tell us what you completed
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} minLength={1} maxLength={3000} rows={4} required placeholder="Describe your work, add a link, or explain what you completed…" />
              </label>
              <div className="quest-submission-footer"><small>{draft.trim().length}/3,000 characters</small><button type="submit" className="button button-primary" disabled={busy || !draft.trim()}>{busy ? "Submitting…" : submission?.status === "rejected" ? "Resubmit work" : "Submit work"}</button></div>
              {error && <p className="quest-submission-error" role="alert">{error}</p>}
            </form>}
  </section>;
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
