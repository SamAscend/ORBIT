"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type DirectoryMember = Database["public"]["Functions"]["get_orbit_member_directory"]["Returns"][number];
type Conversation = Database["public"]["Tables"]["direct_conversations"]["Row"];
type DirectMessage = Database["public"]["Tables"]["direct_messages"]["Row"];
type MemberProfile = { id: string; full_name: string; username: string; avatar_url: string | null; show_online_status: boolean };
type Thread = { id: string; member: MemberProfile; lastMessage: DirectMessage | null };
type HubTab = "members" | "messages" | "blocked";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "FM";
}

function avatarStyle(url: string | null): CSSProperties | undefined {
  return url ? { backgroundImage: `url("${url}")` } : undefined;
}

function mergeMessages(current: DirectMessage[], incoming: DirectMessage[]) {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort((first, second) =>
    first.created_at.localeCompare(second.created_at) || first.id.localeCompare(second.id),
  );
}

function memberHubErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return typeof error === "string" ? error : "Could not load member interactions.";
  }
  const details = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const message = typeof details.message === "string" ? details.message : "Could not load member interactions.";
  if (
    details.code === "PGRST204"
    || details.code === "PGRST205"
    || details.code === "PGRST202"
    || details.code === "42703"
    || details.code === "42P01"
    || details.code === "42883"
    || message.toLowerCase().includes("schema cache")
    || message.toLowerCase().includes("does not exist")
  ) {
    return "Member interactions are not fully set up in the database yet. Run migrations 202611010001_member_interactions.sql and 202611010002_fix_member_interaction_rls.sql in the Supabase SQL Editor, then reload.";
  }
  const extraDetails = typeof details.details === "string" ? details.details : "";
  const hint = typeof details.hint === "string" ? details.hint : "";
  const code = typeof details.code === "string" ? ` (${details.code})` : "";
  return [message + code, extraDetails, hint].filter(Boolean).join(" ");
}

export function MemberHub({ userId, showOnlineStatus, onOnlineStatusChange }: {
  userId: string;
  showOnlineStatus: boolean;
  onOnlineStatusChange: (enabled: boolean) => void;
}) {
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [blockedMembers, setBlockedMembers] = useState<MemberProfile[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [tab, setTab] = useState<HubTab>("members");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [live, setLive] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;

    async function loadHub() {
      setLoading(true);
      setError("");
      try {
        const supabase = createClient();
        const [directoryResult, blockResult, conversationResult] = await Promise.all([
          supabase.rpc("get_orbit_member_directory"),
          supabase.from("member_blocks").select("blocked_id").eq("blocker_id", userId),
          supabase.from("direct_conversations").select("*")
            .or(`participant_one_id.eq.${userId},participant_two_id.eq.${userId}`)
            .order("created_at", { ascending: false }),
        ]);
        if (directoryResult.error) throw directoryResult.error;
        if (blockResult.error) throw blockResult.error;
        if (conversationResult.error) throw conversationResult.error;

        const blockedIds = blockResult.data.map((block) => block.blocked_id);
        const conversations = conversationResult.data as Conversation[];
        const peerIds = [...new Set([
          ...conversations.map((conversation) =>
            conversation.participant_one_id === userId ? conversation.participant_two_id : conversation.participant_one_id,
          ),
          ...blockedIds,
        ])];
        const [profileListResult, messagePreviewResult] = await Promise.all([
          peerIds.length
            ? supabase.from("profiles").select("id, full_name, username, avatar_url, show_online_status").in("id", peerIds)
            : Promise.resolve({ data: [], error: null }),
          conversations.length
            ? supabase.from("direct_messages").select("*").in("conversation_id", conversations.map((conversation) => conversation.id))
                .order("created_at", { ascending: false }).limit(200)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (profileListResult.error) throw profileListResult.error;
        if (messagePreviewResult.error) throw messagePreviewResult.error;

        const profiles = new Map((profileListResult.data as MemberProfile[]).map((profile) => [profile.id, profile]));
        const previews = new Map<string, DirectMessage>();
        for (const message of messagePreviewResult.data as DirectMessage[]) {
          if (!previews.has(message.conversation_id)) previews.set(message.conversation_id, message);
        }
        const loadedThreads = conversations.flatMap((conversation) => {
          const peerId = conversation.participant_one_id === userId
            ? conversation.participant_two_id
            : conversation.participant_one_id;
          const member = profiles.get(peerId);
          return member ? [{ id: conversation.id, member, lastMessage: previews.get(conversation.id) ?? null }] : [];
        });

        if (!active) return;
        setMembers(directoryResult.data);
        setThreads(loadedThreads);
        setBlockedMembers(blockedIds.flatMap((id) => profiles.has(id) ? [profiles.get(id)!] : []));
      } catch (loadError) {
        console.error("Could not load the ORBIT member hub.", loadError);
        if (active) setError(memberHubErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadHub();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const channel = supabase.channel("orbit-member-presence", {
      config: { presence: { key: userId }, private: true },
    });
    channel.on("presence", { event: "sync" }, () => {
      const online = new Set<string>();
      for (const [key, entries] of Object.entries(channel.presenceState<{ user_id: string }>())) {
        if (entries.some((entry) => entry.user_id === key)) online.add(key);
      }
      if (active) setOnlineUserIds(online);
    }).subscribe((status, subscribeError) => {
      if (!active) return;
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("Could not read ORBIT online presence.", subscribeError);
      }
    });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const selectedConversationId = selected?.id;

  useEffect(() => {
    if (!selectedConversationId) return;
    const conversationId = selectedConversationId;
    let active = true;
    const supabase = createClient();

    async function loadMessages() {
      try {
        const { data, error: loadError } = await supabase.from("direct_messages").select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (loadError) throw loadError;
        if (active) setMessages((current) => mergeMessages(current, [...data].reverse()));
      } catch (loadError) {
        console.error("Could not load ORBIT direct messages.", loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load this conversation.");
      }
    }

    void loadMessages();
    const channel = supabase.channel(`orbit-direct-messages:${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "direct_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const incoming = payload.new as DirectMessage;
        if (active) setMessages((current) => mergeMessages(current, [incoming]));
      })
      .subscribe((status) => {
        if (active) setLive(status === "SUBSCRIBED");
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [selectedConversationId]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const source = tab === "members" ? members : tab === "messages"
      ? threads.map((thread) => ({ user_id: thread.member.id, full_name: thread.member.full_name, username: thread.member.username, avatar_url: thread.member.avatar_url, crew_number: 0, show_online_status: thread.member.show_online_status }))
      : blockedMembers.map((member) => ({ user_id: member.id, full_name: member.full_name, username: member.username, avatar_url: member.avatar_url, crew_number: 0, show_online_status: member.show_online_status }));
    return source.filter((member) =>
      `${member.full_name} ${member.username} ${member.crew_number || ""}`.toLocaleLowerCase().includes(query),
    );
  }, [blockedMembers, members, search, tab, threads]);

  async function openConversation(member: MemberProfile) {
    setError("");
    try {
      const supabase = createClient();
      const { data, error: conversationError } = await supabase.rpc("create_orbit_direct_conversation", {
        p_other_user_id: member.id,
      });
      if (conversationError) throw conversationError;
      const thread: Thread = { id: data, member, lastMessage: null };
      setMessages([]);
      setLive(false);
      setSelected(threads.find((item) => item.id === data) ?? thread);
      setTab("messages");
      setThreads((current) => [current.find((item) => item.id === data) ?? thread, ...current.filter((item) => item.id !== data)]);
    } catch (openError) {
      console.error("Could not open an ORBIT direct conversation.", openError);
      setError(openError instanceof Error ? openError.message : "Could not open this conversation.");
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!selected || !body || sending) return;
    setSending(true);
    setError("");
    try {
      const { data, error: sendError } = await createClient().from("direct_messages")
        .insert({ conversation_id: selected.id, sender_id: userId, body })
        .select("*")
        .single();
      if (sendError) throw sendError;
      setMessages((current) => mergeMessages(current, [data]));
      setThreads((current) => current.map((thread) =>
        thread.id === selected.id ? { ...thread, lastMessage: data } : thread,
      ));
      setDraft("");
    } catch (sendError) {
      console.error("Could not send an ORBIT direct message.", sendError);
      setError(memberHubErrorMessage(sendError));
    } finally {
      setSending(false);
    }
  }

  async function updateOnlineStatus(enabled: boolean) {
    setSavingStatus(true);
    setError("");
    try {
      const { error: updateError } = await createClient().from("profiles")
        .update({ show_online_status: enabled })
        .eq("id", userId);
      if (updateError) throw updateError;
      onOnlineStatusChange(enabled);
    } catch (updateError) {
      console.error("Could not save the online-status preference.", updateError);
      setError(updateError instanceof Error ? updateError.message : "Could not save your online-status preference.");
    } finally {
      setSavingStatus(false);
    }
  }

  async function toggleBlock(member: MemberProfile, isBlocked: boolean) {
    setError("");
    try {
      const supabase = createClient();
      const result = isBlocked
        ? await supabase.from("member_blocks").delete().eq("blocked_id", member.id)
        : await supabase.from("member_blocks").insert({ blocker_id: userId, blocked_id: member.id });
      if (result.error) throw result.error;
      if (isBlocked) {
        setBlockedMembers((current) => current.filter((blocked) => blocked.id !== member.id));
        const { data: directory, error: directoryError } = await supabase.rpc("get_orbit_member_directory");
        if (directoryError) throw directoryError;
        setMembers(directory);
      } else {
        setBlockedMembers((current) => [...current, member]);
        setMembers((current) => current.filter((directoryMember) => directoryMember.user_id !== member.id));
      }
      setThreads((current) => current.filter((thread) => thread.member.id !== member.id));
      if (selected?.member.id === member.id) {
        setSelected(null);
        setMessages([]);
        setLive(false);
      }
      setTab(isBlocked ? "members" : "blocked");
    } catch (blockError) {
      console.error("Could not update the ORBIT member block.", blockError);
      setError(blockError instanceof Error ? blockError.message : "Could not update this block.");
    }
  }

  async function reportMember(member: MemberProfile) {
    const reason = window.prompt(`Tell ORBIT admins why you are reporting ${member.full_name}. Please include at least 10 characters.`);
    if (reason === null) return;
    if (reason.trim().length < 10 || reason.trim().length > 1000) {
      setError("Please provide between 10 and 1,000 characters so admins can review your report.");
      return;
    }

    setError("");
    setNotice("");
    try {
      const { error: reportError } = await createClient().from("member_reports").insert({
        reporter_id: userId,
        reported_id: member.id,
        reason: reason.trim(),
      });
      if (reportError) throw reportError;
      setNotice("Your report was sent to ORBIT admins.");
    } catch (reportError) {
      console.error("Could not submit an ORBIT member report.", reportError);
      setError(reportError instanceof Error ? reportError.message : "Could not submit your report.");
    }
  }

  return <section className="member-hub-page">
    <header className="page-heading member-hub-heading">
      <div><span className="eyebrow">YOUR ORBIT CREW</span><h1>Members</h1><p className="page-intro">Meet the crew, see who’s around, and start a private conversation.</p></div>
      <label className="online-preference">
        <input type="checkbox" checked={showOnlineStatus} disabled={savingStatus} onChange={(event) => void updateOnlineStatus(event.target.checked)} />
        <span><b>Show my online status</b><small>Only active ORBIT members can see it.</small></span>
      </label>
    </header>
    {error && <div className="workspace-error" role="alert"><b>Member interaction failed.</b><span>{error}</span><button type="button" onClick={() => setError("")}>Dismiss</button></div>}
    {notice && <div className="member-hub-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")}>Dismiss</button></div>}
    <div className="member-hub-layout">
      <section className="workspace-panel member-hub-directory" aria-label="Member directory">
        <div className="member-hub-tabs" role="tablist" aria-label="Member lists">
          {(["members", "messages", "blocked"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => { setTab(item); setSearch(""); }}>{item === "members" ? `Crew (${members.length})` : item === "messages" ? `Messages (${threads.length})` : `Blocked (${blockedMembers.length})`}</button>)}
        </div>
        <label className="member-hub-search"><span className="visually-hidden">Search members</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${tab}…`} /></label>
        <div className="member-hub-list" aria-live="polite">
          {loading
            ? <p className="member-hub-empty">Loading your ORBIT crew…</p>
            : filteredMembers.length === 0
              ? <p className="member-hub-empty">{tab === "messages" ? "No conversations yet. Choose someone in the crew to say hello." : tab === "blocked" ? "You haven’t blocked anyone." : "No members match that search."}</p>
              : filteredMembers.map((member) => {
                const isOnline = member.show_online_status && onlineUserIds.has(member.user_id);
                const presenceLabel = !member.show_online_status ? "Status hidden" : isOnline ? "Online" : "Offline";
                const thread = threads.find((item) => item.member.id === member.user_id);
                const isBlocked = tab === "blocked";
                return <article className={`member-hub-person ${selected?.member.id === member.user_id ? "selected" : ""}`} key={member.user_id}>
                  <span className="member-hub-avatar" aria-hidden="true" style={avatarStyle(member.avatar_url)}>{member.avatar_url ? "" : initials(member.full_name)}</span>
                  <div className="member-hub-person-copy"><b>{member.full_name}</b><small>@{member.username} {member.crew_number ? `· Crew #${member.crew_number}` : ""}</small><span className={`member-hub-presence ${isOnline ? "online" : ""}`}><i />{presenceLabel}</span></div>
                  {isBlocked
                    ? <button className="member-hub-secondary-action" type="button" onClick={() => void toggleBlock({
                      id: member.user_id,
                      full_name: member.full_name,
                      username: member.username,
                      avatar_url: member.avatar_url,
                      show_online_status: member.show_online_status,
                    }, true)}>Unblock</button>
                    : <button className="member-hub-message-action" type="button" onClick={() => void openConversation({
                      id: member.user_id,
                      full_name: member.full_name,
                      username: member.username,
                      avatar_url: member.avatar_url,
                      show_online_status: member.show_online_status,
                    })}>{tab === "messages" ? "Open" : thread ? "Message" : "Say hello"}</button>}
                </article>;
              })}
        </div>
      </section>
      <section className="workspace-panel member-hub-conversation" aria-label="Direct messages">
        {selected
          ? <>
              <header className="member-hub-chat-heading">
                <span className="member-hub-avatar" aria-hidden="true" style={avatarStyle(selected.member.avatar_url)}>{selected.member.avatar_url ? "" : initials(selected.member.full_name)}</span>
                <div><b>{selected.member.full_name}</b><small>@{selected.member.username} · {!selected.member.show_online_status ? "Status hidden" : onlineUserIds.has(selected.member.id) ? "Online" : "Offline"}</small></div>
                <button type="button" className="member-hub-secondary-action" onClick={() => void reportMember(selected.member)}>Report</button>
                <button type="button" className="member-hub-secondary-action" onClick={() => {
                  if (window.confirm(`Block ${selected.member.full_name}? This hides the conversation and prevents new messages in either direction.`)) {
                    void toggleBlock(selected.member, false);
                  }
                }}>Block</button>
              </header>
              <div className="member-hub-messages" aria-live="polite">
                {messages.length === 0
                  ? <div className="member-hub-empty"><b>Start a conversation.</b><span>Say hello to {selected.member.full_name.split(/\s+/)[0]}.</span></div>
                  : messages.map((message) => <article className={`member-hub-message ${message.sender_id === userId ? "own" : ""}`} key={message.id}>
                      <p>{message.body}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
                    </article>)}
              </div>
              <form className="member-hub-compose" onSubmit={sendMessage}>
                <label className="visually-hidden" htmlFor="member-hub-message">Write a private message</label>
                <textarea id="member-hub-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={2} placeholder="Write a message…" disabled={!live || sending} required />
                <button className="button button-primary" type="submit" disabled={!live || sending || !draft.trim()}>{sending ? "Sending…" : "Send"} <span>↗</span></button>
                <small>Messages are stored on ORBIT’s database and are not end-to-end encrypted. Don’t send sensitive information.</small>
              </form>
            </>
          : <div className="member-hub-empty member-hub-no-selection"><span>✳</span><b>Make a connection.</b><p>Choose a member to start a private conversation.</p></div>}
      </section>
    </div>
  </section>;
}

type ReportRecord = Database["public"]["Tables"]["member_reports"]["Row"];
type ReportProfile = { id: string; full_name: string; username: string };
type MemberReport = ReportRecord & { reporter: ReportProfile | null; reported: ReportProfile | null };

export function MemberReportManager({ adminId }: { adminId: string }) {
  const [reports, setReports] = useState<MemberReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadReports() {
      try {
        const supabase = createClient();
        const { data, error: loadError } = await supabase.from("member_reports")
          .select("id, reporter_id, reported_id, reason, status, created_at, reviewed_at, reviewed_by")
          .order("created_at", { ascending: false });
        if (loadError) throw loadError;
        const profileIds = [...new Set(data.flatMap((report) => [report.reporter_id, report.reported_id]))];
        const profileResult = profileIds.length
          ? await supabase.from("profiles").select("id, full_name, username").in("id", profileIds)
          : { data: [], error: null };
        if (profileResult.error) throw profileResult.error;
        const profiles = new Map((profileResult.data as ReportProfile[]).map((profile) => [profile.id, profile]));
        if (active) setReports(data.map((report) => ({
          ...report,
          reporter: profiles.get(report.reporter_id) ?? null,
          reported: profiles.get(report.reported_id) ?? null,
        })));
      } catch (loadError) {
        console.error("Could not load ORBIT member reports.", loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load member reports.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadReports();
    return () => { active = false; };
  }, []);

  async function resolveReport(report: MemberReport) {
    setSavingId(report.id);
    setError("");
    try {
      const { error: updateError } = await createClient().from("member_reports").update({
        status: "resolved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
      }).eq("id", report.id);
      if (updateError) throw updateError;
      setReports((current) => current.map((item) => item.id === report.id
        ? { ...item, status: "resolved", reviewed_at: new Date().toISOString(), reviewed_by: adminId }
        : item));
    } catch (updateError) {
      console.error("Could not resolve an ORBIT member report.", updateError);
      setError(updateError instanceof Error ? updateError.message : "Could not resolve this report.");
    } finally {
      setSavingId(null);
    }
  }

  return <section className="member-report-page">
    <header className="page-heading"><div><span className="eyebrow">COMMUNITY SAFETY</span><h1>Member reports</h1><p className="page-intro">Review reports submitted by ORBIT members.</p></div></header>
    {error && <div className="workspace-error" role="alert"><b>Report action failed.</b><span>{error}</span></div>}
    <div className="workspace-panel member-report-list">
      {loading
        ? <p className="member-hub-empty">Loading reports…</p>
        : reports.length === 0
          ? <p className="member-hub-empty">There are no member reports to review.</p>
          : reports.map((report) => <article className="member-report-item" key={report.id}>
              <div className="member-report-heading"><b>{report.reported?.full_name ?? "Former member"} <small>@{report.reported?.username ?? "unknown"}</small></b><span className={`member-report-status ${report.status}`}>{report.status}</span></div>
              <p>{report.reason}</p>
              <footer><span>Reported by {report.reporter?.full_name ?? "Former member"} · {new Date(report.created_at).toLocaleString()}</span>{report.status === "open" && <button className="button button-secondary" type="button" onClick={() => void resolveReport(report)} disabled={savingId === report.id}>{savingId === report.id ? "Saving…" : "Mark resolved"}</button>}</footer>
            </article>)}
    </div>
  </section>;
}
