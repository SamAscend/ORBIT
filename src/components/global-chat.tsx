"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

const pageSize = 50;
const messageFields = "id, sender_id, body, is_hidden, moderated_at, created_at";

type MessageRecord = Pick<
  Database["public"]["Tables"]["chat_messages"]["Row"],
  "id" | "sender_id" | "body" | "is_hidden" | "moderated_at" | "created_at"
>;
type ChatMessage = MessageRecord & { authorName: string; avatarUrl: string | null };
type ChatProfile = { id: string; full_name: string; avatar_url: string | null };
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
    ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", senderIds)
    : { data: [], error: null };
  if (profilesResult.error) throw profilesResult.error;

  const profiles = new Map((profilesResult.data as ChatProfile[]).map((profile) => [profile.id, profile]));
  return records.map((record) => {
    const profile = record.sender_id ? profiles.get(record.sender_id) : undefined;
    return {
      ...record,
      authorName: profile?.full_name ?? "Former member",
      avatarUrl: profile?.avatar_url ?? null,
    };
  });
}

export function GlobalChat({ role, userId }: { role: ChatRole; userId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [live, setLive] = useState(false);
  const [error, setError] = useState("");
  const oldestMessage = messages[0];

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadLatestMessages() {
      try {
        const { data, error: loadError } = await supabase.from("chat_messages")
          .select(messageFields)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(pageSize);
        if (loadError) throw loadError;
        const hydrated = await hydrateMessages(data as MessageRecord[]);
        if (!active) return;
        setMessages((current) => mergeMessages(current, hydrated));
        setHasOlderMessages(data.length === pageSize);
        setError("");
      } catch (loadError) {
        console.error("Could not load ORBIT global chat.", loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load chat messages.");
      } finally {
        if (active) setLoading(false);
      }
    }

    async function refreshMessage(id: string) {
      try {
        const { data, error: refreshError } = await supabase.from("chat_messages")
          .select(messageFields)
          .eq("id", id)
          .maybeSingle();
        if (refreshError) throw refreshError;
        if (!data) return;
        const [message] = await hydrateMessages([data as MessageRecord]);
        if (active) setMessages((current) => mergeMessages(current, [message]));
      } catch (refreshError) {
        console.error("Could not refresh an ORBIT chat message.", refreshError);
        if (active) setError(refreshError instanceof Error ? refreshError.message : "Could not refresh a chat message.");
      }
    }

    void loadLatestMessages();
    const channel = supabase.channel(`orbit-global-chat:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, (payload) => {
        const record = (payload.new ?? payload.old) as Record<string, unknown>;
        if (typeof record.id === "string") void refreshMessage(record.id);
      })
      .subscribe((status) => {
        if (active) setLive(status === "SUBSCRIBED");
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function loadOlderMessages() {
    if (!oldestMessage || loadingOlder || !hasOlderMessages) return;
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
      setMessages((current) => mergeMessages(current, [message]));
      setDraft("");
    } catch (sendError) {
      console.error("Could not send an ORBIT chat message.", sendError);
      setError(sendError instanceof Error ? sendError.message : "Could not send your message.");
    } finally {
      setSending(false);
    }
  }

  async function toggleHidden(message: ChatMessage) {
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
      setMessages((current) => mergeMessages(current, [updatedMessage]));
    } catch (moderationError) {
      console.error("Could not moderate an ORBIT chat message.", moderationError);
      setError(moderationError instanceof Error ? moderationError.message : "Could not update this message.");
    } finally {
      setModeratingId(null);
    }
  }

  return <section className="global-chat-page">
    <header className="page-heading global-chat-heading">
      <div><span className="eyebrow">THE ORBIT LOUNGE</span><h1>Global chat</h1><p className="page-intro">One shared space for the whole crew and the ORBIT team.</p></div>
      <span className={`chat-live-status ${live ? "connected" : ""}`}><i />{live ? "Live" : "Connecting"}</span>
    </header>
    <section className="workspace-panel global-chat-panel" aria-label="ORBIT global chat">
      <div className="chat-message-list" aria-live="polite">
        {hasOlderMessages && <button className="chat-load-older" type="button" onClick={() => void loadOlderMessages()} disabled={loadingOlder}>{loadingOlder ? "Loading…" : "Load older messages"}</button>}
        {loading && messages.length === 0
          ? <div className="chat-empty-state">Loading the ORBIT conversation…</div>
          : messages.length === 0
            ? <div className="chat-empty-state"><span>✳</span><b>Start the conversation.</b><p>Say hello to your ORBIT community.</p></div>
            : messages.map((message) => {
              const isOwnMessage = message.sender_id === userId;
              return <article className={`chat-message ${isOwnMessage ? "chat-message-own" : ""} ${message.is_hidden ? "chat-message-hidden" : ""}`} key={message.id}>
                <span className="chat-avatar" aria-hidden="true" style={message.avatarUrl ? { backgroundImage: `url("${message.avatarUrl}")` } : undefined}>{message.avatarUrl ? "" : initials(message.authorName)}</span>
                <div className="chat-message-content">
                  <div className="chat-message-heading"><b>{message.authorName}</b>{message.sender_id === userId && <span className="chat-you-badge">YOU</span>}<time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></div>
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
      <form className="chat-compose-form" onSubmit={sendMessage}>
        <label className="management-field"><span className="visually-hidden">Write a message</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} rows={2} placeholder="Share something with the crew…" disabled={!live || sending} required /></label>
        <div className="chat-compose-footer"><small>Messages are saved. Up to 8 per minute · 1,000 characters maximum.</small><button className="button button-primary" type="submit" disabled={!live || sending || !draft.trim()}>{sending ? "Sending…" : "Send message"} <span>↗</span></button></div>
      </form>
    </section>
  </section>;
}
