"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { useLanguage } from "@/lib/i18n";

const pageSize = 50;
const messageFields = "id, sender_id, body, is_hidden, moderated_at, created_at";

type MessageRecord = Pick<
  Database["public"]["Tables"]["chat_messages"]["Row"],
  "id" | "sender_id" | "body" | "is_hidden" | "moderated_at" | "created_at"
>;
type ChatMessage = MessageRecord & { authorName: string; authorIsAdmin: boolean; avatarUrl: string | null };
type ChatProfile = { id: string; full_name: string; avatar_url: string | null; is_admin: boolean };
type ChatRole = "admin" | "member";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "FM";
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort((first, second) =>
    first.created_at.localeCompare(second.created_at) || first.id.localeCompare(second.id),
  );
}

async function hydrateMessages(records: MessageRecord[]): Promise<ChatMessage[]> {
  const senderIds = [...new Set(records.flatMap((record) => record.sender_id ? [record.sender_id] : []))];
  const supabase = createClient();
  const profilesResult = senderIds.length
    ? await supabase.from("profiles").select("id, full_name, avatar_url, is_admin").in("id", senderIds)
    : { data: [], error: null };
  if (profilesResult.error) throw profilesResult.error;

  const profiles = new Map((profilesResult.data as ChatProfile[]).map((profile) => [profile.id, profile]));
  return records.map((record) => {
    const profile = record.sender_id ? profiles.get(record.sender_id) : undefined;
    return {
      ...record,
      authorName: profile ? profile.is_admin ? "ADMIN" : profile.full_name : "Former member",
      authorIsAdmin: profile?.is_admin ?? false,
      avatarUrl: profile?.avatar_url ?? null,
    };
  });
}

export function GlobalChat({ role, userId }: { role: ChatRole; userId: string }) {
  const { t, locale } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [live, setLive] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearConfirmationOpen, setClearConfirmationOpen] = useState(false);
  const [clearConfirmation, setClearConfirmation] = useState("");
  const refreshingRef = useRef(false);
  const messageGenerationRef = useRef(0);
  const lastClearAtRef = useRef<string | null>(null);
  const oldestMessage = messages[0];

  const refreshLatestMessages = useCallback(async (manual = false) => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    const requestGeneration = messageGenerationRef.current;
    if (manual) setRefreshing(true);
    try {
      const supabase = createClient();
      const [messagesResult, clearStateResult] = await Promise.all([
        supabase.from("chat_messages")
          .select(messageFields)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(pageSize),
        supabase.from("orbit_chat_state").select("cleared_at").eq("id", true).single(),
      ]);
      if (messagesResult.error) throw messagesResult.error;
      if (clearStateResult.error) throw clearStateResult.error;
      const hydrated = await hydrateMessages(messagesResult.data as MessageRecord[]);
      if (requestGeneration !== messageGenerationRef.current) return;

      const clearAt = clearStateResult.data.cleared_at;
      const chatWasCleared = lastClearAtRef.current !== null && lastClearAtRef.current !== clearAt;
      lastClearAtRef.current = clearAt;
      if (chatWasCleared) {
        messageGenerationRef.current += 1;
        setMessages(hydrated);
      } else {
        setMessages((current) => mergeMessages(current, hydrated));
      }
      setHasOlderMessages(messagesResult.data.length === pageSize);
      setError("");
    } catch (loadError) {
      console.error("Could not refresh ORBIT global chat.", loadError);
      setError(loadError instanceof Error ? loadError.message : "Could not refresh chat messages.");
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
      refreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function refreshMessage(id: string) {
      const requestGeneration = messageGenerationRef.current;
      try {
        const { data, error: refreshError } = await supabase.from("chat_messages")
          .select(messageFields)
          .eq("id", id)
          .maybeSingle();
        if (refreshError) throw refreshError;
        if (!data) return;
        const [message] = await hydrateMessages([data as MessageRecord]);
        if (active && requestGeneration === messageGenerationRef.current) {
          setMessages((current) => mergeMessages(current, [message]));
        }
      } catch (refreshError) {
        console.error("Could not refresh an ORBIT chat message.", refreshError);
        if (active) setError(refreshError instanceof Error ? refreshError.message : "Could not refresh a chat message.");
      }
    }

    const initialRefresh = window.setTimeout(() => void refreshLatestMessages(), 0);
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshLatestMessages();
    }, 5000);
    const channel = supabase.channel(`orbit-global-chat:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, (payload) => {
        const record = (payload.new ?? payload.old) as Record<string, unknown>;
        if (typeof record.id === "string") void refreshMessage(record.id);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orbit_chat_state" }, (payload) => {
        const record = payload.new as Record<string, unknown>;
        if (typeof record.cleared_at !== "string" || record.cleared_at === lastClearAtRef.current) return;
        lastClearAtRef.current = record.cleared_at;
        messageGenerationRef.current += 1;
        setMessages([]);
        setHasOlderMessages(false);
      })
      .subscribe((status) => {
        if (active) setLive(status === "SUBSCRIBED");
      });

    return () => {
      active = false;
      window.clearTimeout(initialRefresh);
      window.clearInterval(refreshInterval);
      void supabase.removeChannel(channel);
    };
  }, [refreshLatestMessages, userId]);

  async function loadOlderMessages() {
    if (!oldestMessage || loadingOlder || !hasOlderMessages) return;
    const requestGeneration = messageGenerationRef.current;
    setLoadingOlder(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error: loadError } = await supabase.from("chat_messages")
        .select(messageFields)
        .or(`created_at.lt.${oldestMessage.created_at},and(created_at.eq.${oldestMessage.created_at},id.lt.${oldestMessage.id})`)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(pageSize);
      if (loadError) throw loadError;
      const older = await hydrateMessages(data as MessageRecord[]);
      if (requestGeneration !== messageGenerationRef.current) return;
      setMessages((current) => mergeMessages(older, current));
      setHasOlderMessages(data.length === pageSize);
    } catch (loadError) {
      console.error("Could not load older ORBIT chat messages.", loadError);
      setError(loadError instanceof Error ? loadError.message : "Could not load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    const requestGeneration = messageGenerationRef.current;
    setSending(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase.from("chat_messages")
        .insert({ sender_id: userId, body })
        .select(messageFields)
        .single();
      if (insertError) throw insertError;
      const [message] = await hydrateMessages([data as MessageRecord]);
      if (requestGeneration === messageGenerationRef.current) setMessages((current) => mergeMessages(current, [message]));
      setDraft("");
    } catch (sendError) {
      console.error("Could not send an ORBIT chat message.", sendError);
      setError(sendError instanceof Error ? sendError.message : "Could not send your message.");
    } finally {
      setSending(false);
    }
  }

  async function toggleHidden(message: ChatMessage) {
    const requestGeneration = messageGenerationRef.current;
    setModeratingId(message.id);
    setError("");
    const isHidden = !message.is_hidden;
    try {
      const { data, error: updateError } = await createClient().from("chat_messages")
        .update({
          is_hidden: isHidden,
          moderated_at: isHidden ? new Date().toISOString() : null,
          moderated_by: isHidden ? userId : null,
        })
        .eq("id", message.id)
        .select(messageFields)
        .single();
      if (updateError) throw updateError;
      const [updatedMessage] = await hydrateMessages([data as MessageRecord]);
      if (requestGeneration === messageGenerationRef.current) {
        setMessages((current) => mergeMessages(current, [updatedMessage]));
      }
    } catch (moderationError) {
      console.error("Could not moderate an ORBIT chat message.", moderationError);
      setError(moderationError instanceof Error ? moderationError.message : "Could not update this message.");
    } finally {
      setModeratingId(null);
    }
  }

  async function clearGlobalChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role !== "admin" || clearConfirmation.trim() !== "CLEAR CHAT" || clearing) return;
    setClearing(true);
    setError("");
    setNotice("");
    try {
      const { data: deletedCount, error: clearError } = await createClient().rpc("clear_orbit_global_chat");
      if (clearError) throw clearError;
      messageGenerationRef.current += 1;
      setMessages([]);
      setHasOlderMessages(false);
      setClearConfirmationOpen(false);
      setClearConfirmation("");
      setNotice(`${deletedCount} ${deletedCount === 1 ? "message" : "messages"} permanently deleted from global chat.`);
    } catch (clearError) {
      console.error("Could not clear ORBIT global chat.", clearError);
      setError(clearError instanceof Error ? clearError.message : "Could not clear global chat.");
    } finally {
      setClearing(false);
    }
  }

  return <section className="global-chat-page">
    <header className="page-heading global-chat-heading">
      <div><span className="eyebrow">{t("THE ORBIT LOUNGE")}</span><h1>{t("Global chat")}</h1><p className="page-intro">{t("One shared space for the whole crew and the ORBIT team.")}</p></div>
      <div className="chat-heading-actions">
        <span className={`chat-live-status ${live ? "connected" : ""}`}><i />{live ? t("Live") : t("Checking for messages")}</span>
        <button className="chat-refresh-button" type="button" onClick={() => void refreshLatestMessages(true)} disabled={refreshing}>
          <span aria-hidden="true">↻</span> {refreshing ? t("Refreshing…") : t("Refresh")}
        </button>
        {role === "admin" && <button className="chat-clear-button" type="button" onClick={() => { setClearConfirmation(""); setClearConfirmationOpen(true); }} disabled={clearing || loading}>{t("Clear chat")}</button>}
      </div>
    </header>
    <section className="workspace-panel global-chat-panel" aria-label="ORBIT global chat">
      <div className="chat-message-list" aria-live="polite">
        {hasOlderMessages && <button className="chat-load-older" type="button" onClick={() => void loadOlderMessages()} disabled={loadingOlder}>{loadingOlder ? "Loading…" : "Load older messages"}</button>}
        {loading && messages.length === 0
          ? <div className="chat-empty-state">{t("Loading the ORBIT conversation…")}</div>
          : messages.length === 0
            ? <div className="chat-empty-state"><span>✳</span><b>{t("Start the conversation.")}</b><p>{t("Say hello to your ORBIT community.")}</p></div>
            : messages.map((message) => {
              const isOwnMessage = message.sender_id === userId;
              return <article className={`chat-message ${isOwnMessage ? "chat-message-own" : ""} ${message.is_hidden ? "chat-message-hidden" : ""}`} key={message.id}>
                <span className="chat-avatar" aria-hidden="true" style={message.avatarUrl ? { backgroundImage: `url("${message.avatarUrl}")` } : undefined}>{message.avatarUrl ? "" : initials(message.authorName)}</span>
                <div className="chat-message-content">
                  <div className="chat-message-heading">{message.authorIsAdmin ? <span className="chat-admin-badge"><span aria-hidden="true">✦</span> ADMIN</span> : <b>{message.authorName}</b>}{message.sender_id === userId && <span className="chat-you-badge">YOU</span>}<time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</time></div>
                  {message.is_hidden && role !== "admin"
                    ? <p className="chat-hidden-copy">This message was hidden by an administrator.</p>
                    : <p className="chat-message-body">{message.body}</p>}
                  {message.is_hidden && role === "admin" && <small className="chat-hidden-label">Hidden from members · message retained</small>}
                </div>
                {role === "admin" && <button className={`chat-moderate-button ${message.is_hidden ? "restore" : ""}`} type="button" onClick={() => void toggleHidden(message)} disabled={moderatingId === message.id} aria-label={`${message.is_hidden ? "Restore" : "Hide"} message from ${message.authorName}`}>{moderatingId === message.id ? "…" : message.is_hidden ? "Restore" : "Hide"}</button>}
              </article>;
            })}
      </div>
      {error && <div className="workspace-error chat-error" role="alert"><b>Chat update failed.</b><span>{error}</span><button type="button" onClick={() => window.location.reload()}>Reload</button></div>}
      {notice && <div className="workspace-success chat-notice" role="status">{notice}</div>}
      <form className="chat-compose-form" onSubmit={sendMessage}>
        <label className="management-field"><span className="visually-hidden">{t("Share something with the crew…")}</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} rows={2} placeholder={t("Share something with the crew…")} disabled={!live || sending} required /></label>
        <div className="chat-compose-footer"><small>Messages are saved. Up to 8 per minute · 1,000 characters maximum.</small><button className="button button-primary" type="submit" disabled={!live || sending || !draft.trim()}>{sending ? t("Sending…") : t("Send message")} <span>↗</span></button></div>
      </form>
    </section>
    {clearConfirmationOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !clearing) setClearConfirmationOpen(false); }}>
      <section className="modal-card chat-clear-dialog" role="dialog" aria-modal="true" aria-labelledby="chat-clear-title">
        <div className="modal-heading"><div><span className="eyebrow">ADMIN ACTION</span><h2 id="chat-clear-title">Clear global chat?</h2></div>
          <button type="button" className="button button-secondary" onClick={() => setClearConfirmationOpen(false)} disabled={clearing}>Cancel</button>
        </div>
        <p>This permanently deletes every global chat message, including messages not currently loaded. Deleted messages cannot be restored.</p>
        <form onSubmit={clearGlobalChat}>
          <label className="management-field">Type <b>CLEAR CHAT</b> to confirm
            <input autoComplete="off" value={clearConfirmation} onChange={(event) => setClearConfirmation(event.target.value)} disabled={clearing} />
          </label>
          <div className="management-form-actions">
            <button type="button" className="button button-secondary" onClick={() => setClearConfirmationOpen(false)} disabled={clearing}>Keep messages</button>
            <button type="submit" className="button button-danger" disabled={clearing || clearConfirmation.trim() !== "CLEAR CHAT"}>{clearing ? "Clearing…" : "Permanently clear chat"}</button>
          </div>
        </form>
      </section>
    </div>}
  </section>;
}
