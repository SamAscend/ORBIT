"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { useLanguage } from "@/lib/i18n";

type Announcement = Database["public"]["Tables"]["announcements"]["Row"];
type AnnouncementDraft = { title: string; body: string; isPublished: boolean; isPinned: boolean };
type AnnouncementRole = "admin" | "member";

const emptyDraft: AnnouncementDraft = { title: "", body: "", isPublished: true, isPinned: false };

export function Announcements({ role, userId, onNavigate }: {
  role: AnnouncementRole;
  userId: string;
  onNavigate: (view: "Events" | "Chat") => void;
}) {
  const { t, locale } = useLanguage();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<AnnouncementDraft>(emptyDraft);
  const isAdmin = role === "admin";

  useEffect(() => {
    let active = true;

    async function loadAnnouncements() {
      setLoading(true);
      setError("");
      try {
        const query = createClient().from("announcements").select("*")
          .order("is_pinned", { ascending: false })
          .order("created_at", { ascending: false });
        const { data, error: loadError } = isAdmin
          ? await query
          : await query.eq("is_published", true);
        if (loadError) throw loadError;
        if (active) setAnnouncements(data);
      } catch (loadError) {
        console.error("Could not load ORBIT announcements.", loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load announcements.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAnnouncements();
    return () => { active = false; };
  }, [isAdmin]);

  function startCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function startEdit(announcement: Announcement) {
    setEditing(announcement);
    setDraft({
      title: announcement.title,
      body: announcement.body,
      isPublished: announcement.is_published,
      isPinned: announcement.is_pinned,
    });
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setDraft(emptyDraft);
  }

  async function saveAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || !body) {
      setError("Enter both a title and message before saving.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      const values = {
        title,
        body,
        is_published: draft.isPublished,
        is_pinned: draft.isPinned,
      };
      if (editing) {
        const { data, error: updateError } = await supabase.from("announcements")
          .update(values)
          .eq("id", editing.id)
          .select("*")
          .single();
        if (updateError) throw updateError;
        setAnnouncements((current) => sortAnnouncements(current.map((item) => item.id === data.id ? data : item)));
        setNotice("Announcement updated.");
      } else {
        const { data: community, error: communityError } = await supabase.from("communities")
          .select("id")
          .eq("slug", "orbit")
          .single();
        if (communityError) throw communityError;
        const { data, error: insertError } = await supabase.from("announcements")
          .insert({ ...values, community_id: community.id, created_by: userId })
          .select("*")
          .single();
        if (insertError) throw insertError;
        setAnnouncements((current) => sortAnnouncements([...current, data]));
        setNotice(draft.isPublished ? "Announcement published." : "Draft saved.");
      }
      closeForm();
    } catch (saveError) {
      console.error("Could not save ORBIT announcement.", saveError);
      setError(saveError instanceof Error ? saveError.message : "Could not save announcement.");
    } finally {
      setBusy(false);
    }
  }

  async function updateAnnouncement(announcement: Announcement, changes: Pick<Announcement, "is_published" | "is_pinned">) {
    setBusyId(announcement.id);
    setError("");
    setNotice("");
    try {
      const { data, error: updateError } = await createClient().from("announcements")
        .update(changes)
        .eq("id", announcement.id)
        .select("*")
        .single();
      if (updateError) throw updateError;
      setAnnouncements((current) => sortAnnouncements(current.map((item) => item.id === data.id ? data : item)));
      setNotice(changes.is_published !== announcement.is_published
        ? changes.is_published ? "Announcement published." : "Announcement moved to drafts."
        : changes.is_pinned ? "Announcement pinned." : "Announcement unpinned.");
    } catch (updateError) {
      console.error("Could not update ORBIT announcement.", updateError);
      setError(updateError instanceof Error ? updateError.message : "Could not update announcement.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteAnnouncement(announcement: Announcement) {
    if (!window.confirm(`Permanently delete "${announcement.title}"?`)) return;
    setBusyId(announcement.id);
    setError("");
    setNotice("");
    try {
      const { error: deleteError } = await createClient().from("announcements")
        .delete()
        .eq("id", announcement.id);
      if (deleteError) throw deleteError;
      setAnnouncements((current) => current.filter((item) => item.id !== announcement.id));
      setNotice("Announcement deleted.");
    } catch (deleteError) {
      console.error("Could not delete ORBIT announcement.", deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete announcement.");
    } finally {
      setBusyId(null);
    }
  }

  return <>
    <section className="page-heading management-heading">
      <div>
        <span className="eyebrow">{t(isAdmin ? "ORBIT COMMUNITY" : "FROM THE ORBIT TEAM")}</span>
        <h1>{t(isAdmin ? "Community updates" : "Crew updates")}</h1>
        <p className="page-intro">{t(isAdmin ? "Share important updates where the whole crew can find them." : "Official announcements and important news from your ORBIT team.")}</p>
      </div>
      {isAdmin && <button type="button" className="button button-primary" onClick={startCreate} disabled={busy}>{t("New update")} <span>＋</span></button>}
    </section>
    {error && <div className="workspace-error" role="alert"><b>{t("Update failed.")}</b><span>{error}</span></div>}
    {notice && <div className="workspace-success" role="status">{notice}</div>}
    {isAdmin && formOpen && <form className="workspace-panel management-form announcement-form" onSubmit={saveAnnouncement}>
      <div className="management-form-heading"><div><span className="eyebrow">{t(editing ? "EDIT COMMUNITY UPDATE" : "NEW COMMUNITY UPDATE")}</span><h2>{t(editing ? "Edit update" : "Write an update")}</h2></div></div>
      <label className="management-field">{t("Title")}<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={140} required /></label>
      <label className="management-field">{t("Message")}<textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} maxLength={5000} rows={6} required /></label>
      <div className="announcement-options">
        <label><input type="checkbox" checked={draft.isPublished} onChange={(event) => setDraft({ ...draft, isPublished: event.target.checked })} /> {t("Publish now")}</label>
        <label><input type="checkbox" checked={draft.isPinned} onChange={(event) => setDraft({ ...draft, isPinned: event.target.checked })} /> {t("Pin to top")}</label>
      </div>
      <div className="management-form-actions">
        <button type="button" className="button button-secondary" onClick={closeForm} disabled={busy}>{t("Cancel")}</button>
        <button type="submit" className="button button-primary" disabled={busy}>{busy ? t("Saving…") : editing ? t("Save changes") : draft.isPublished ? t("Publish update") : t("Save draft")}</button>
      </div>
    </form>}
    <section className="workspace-panel announcement-board">
      <div className="panel-heading"><div><span className="eyebrow">{t(isAdmin ? "PUBLISHED & DRAFTS" : "LATEST NEWS")}</span><h2>{t(isAdmin ? "All updates" : "The ORBIT bulletin")}</h2></div><span className="count-badge">{announcements.length}</span></div>
      {loading
        ? <p className="announcement-empty">{t("Loading updates…")}</p>
        : announcements.length === 0
          ? <div className="empty-message announcement-empty-state">
              <span>✳</span>
              <b>{t(isAdmin ? "No updates yet" : "All quiet for now")}</b>
              <p>{t(isAdmin ? "Post an update to give the crew one reliable place for important news." : "Updates will appear here when an admin publishes one.")}</p>
              {isAdmin
                ? <button type="button" className="button button-primary" onClick={startCreate}>{t("Create first update")} <span>＋</span></button>
                : <div className="announcement-empty-actions">
                    <button type="button" className="button button-secondary" onClick={() => onNavigate("Events")}>{t("Explore events")} <span>↗</span></button>
                    <button type="button" className="button button-secondary" onClick={() => onNavigate("Chat")}>{t("Open crew chat")} <span>↗</span></button>
                  </div>}
            </div>
          : <div className="announcement-list">{announcements.map((announcement) => <article className={`announcement-card ${announcement.is_pinned ? "pinned" : ""} ${!announcement.is_published ? "draft" : ""}`} key={announcement.id}>
              <header><div className="announcement-badges">
                {announcement.is_pinned && <span className="announcement-pin">✦ {t("PINNED")}</span>}
                {!announcement.is_published && isAdmin && <span className="announcement-draft">{t("DRAFT")}</span>}
              </div>
              {isAdmin && <div className="announcement-actions">
                <button type="button" className="button button-secondary" onClick={() => startEdit(announcement)} disabled={busy || busyId !== null}>{t("Edit")}</button>
                <button type="button" className="button button-secondary" onClick={() => void updateAnnouncement(announcement, { is_pinned: !announcement.is_pinned, is_published: announcement.is_published })} disabled={busy || busyId !== null}>{busyId === announcement.id ? t("Saving…") : announcement.is_pinned ? t("Unpin") : t("Pin")}</button>
                <button type="button" className="button button-secondary" onClick={() => void updateAnnouncement(announcement, { is_published: !announcement.is_published, is_pinned: announcement.is_pinned })} disabled={busy || busyId !== null}>{announcement.is_published ? t("Unpublish") : t("Publish")}</button>
                <button type="button" className="button button-danger" onClick={() => void deleteAnnouncement(announcement)} disabled={busy || busyId !== null}>{t("Delete")}</button>
              </div>}
              </header>
              <h3>{announcement.title}</h3>
              <p>{announcement.body}</p>
              <footer>{t(announcement.is_published ? "Published" : "Draft")} · {new Date(announcement.updated_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</footer>
            </article>)}</div>}
    </section>
  </>;
}

function sortAnnouncements(announcements: Announcement[]) {
  return [...announcements].sort((a, b) =>
    Number(b.is_pinned) - Number(a.is_pinned)
    || Date.parse(b.created_at) - Date.parse(a.created_at));
}
