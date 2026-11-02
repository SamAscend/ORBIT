"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { useLanguage } from "@/lib/i18n";

type EventNotification = Database["public"]["Tables"]["event_notifications"]["Row"];
type NotificationTarget = { eventId: string | null; questId: string | null };

const notificationMessages: Record<EventNotification["kind"], { title: string; detail: string }> = {
  registration_confirmed: { title: "You’re registered", detail: "Your spot is confirmed for this event." },
  waitlisted: { title: "You’re on the waitlist", detail: "We’ll let you know if a spot opens up." },
  waitlist_promoted: { title: "A spot opened up", detail: "You’ve been moved from the waitlist into this event." },
  event_updated: { title: "Event details changed", detail: "Check the latest time, location, and details." },
  event_cancelled: { title: "Event cancelled", detail: "This event is no longer going ahead." },
  event_reminder: { title: "Event tomorrow", detail: "Your event is coming up in about 24 hours." },
  quest_published: { title: "New quest available", detail: "A new quest has been published for the ORBIT crew." },
};

export function EventNotificationCenter({ userId, onOpenNotification }: { userId: string; onOpenNotification: (target: NotificationTarget) => void }) {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<EventNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchNotifications = useCallback(async () => {
    const supabase = createClient();
    const [listResult, countResult] = await Promise.all([
      supabase.from("event_notifications")
        .select("id, user_id, event_id, quest_id, event_title, kind, created_at, read_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("event_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null),
    ]);

    if (listResult.error) throw listResult.error;
    if (countResult.error) throw countResult.error;
    return { notifications: listResult.data, unreadCount: countResult.count ?? 0 };
  }, [userId]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    void fetchNotifications()
      .then(({ notifications: nextNotifications, unreadCount: nextUnreadCount }) => {
        if (!active) return;
        setNotifications(nextNotifications);
        setUnreadCount(nextUnreadCount);
        setError("");
      })
      .catch((loadError: unknown) => {
        console.error("Could not load event notifications.", loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load notifications.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const channel = supabase
      .channel(`event-notifications-${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "event_notifications",
        filter: `user_id=eq.${userId}`,
      }, () => {
        void fetchNotifications()
          .then(({ notifications: nextNotifications, unreadCount: nextUnreadCount }) => {
            if (!active) return;
            setNotifications(nextNotifications);
            setUnreadCount(nextUnreadCount);
            setError("");
          })
          .catch((loadError: unknown) => {
            console.error("Could not refresh event notifications.", loadError);
            if (active) setError(loadError instanceof Error ? loadError.message : "Could not refresh notifications.");
          });
      })
      .subscribe((status, subscribeError) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Event notification updates could not connect.", subscribeError);
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [fetchNotifications, userId]);

  async function markAsRead(notification: EventNotification) {
    if (notification.read_at) {
      setOpen(false);
      onOpenNotification({ eventId: notification.event_id, questId: notification.quest_id });
      return;
    }

    setUpdating(true);
    try {
      const { error: updateError } = await createClient()
        .from("event_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notification.id)
        .is("read_at", null);
      if (updateError) throw updateError;
      setNotifications((current) => current.map((item) => item.id === notification.id
        ? { ...item, read_at: new Date().toISOString() }
        : item));
      setUnreadCount((current) => Math.max(0, current - 1));
      setOpen(false);
      onOpenNotification({ eventId: notification.event_id, questId: notification.quest_id });
    } catch (updateError) {
      console.error("Could not mark the event notification as read.", updateError);
      setError(updateError instanceof Error ? updateError.message : "Could not update notification.");
    } finally {
      setUpdating(false);
    }
  }

  async function markAllAsRead() {
    setUpdating(true);
    try {
      const readAt = new Date().toISOString();
      const { error: updateError } = await createClient()
        .from("event_notifications")
        .update({ read_at: readAt })
        .eq("user_id", userId)
        .is("read_at", null);
      if (updateError) throw updateError;
      setNotifications((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
      setUnreadCount(0);
    } catch (updateError) {
      console.error("Could not mark event notifications as read.", updateError);
      setError(updateError instanceof Error ? updateError.message : "Could not update notifications.");
    } finally {
      setUpdating(false);
    }
  }

  return <div className="event-notification-center">
    <button
      className="event-notification-toggle"
      type="button"
      aria-label={unreadCount ? `${t("Notifications")}: ${unreadCount} ${t("unread")}` : t("Notifications")}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={() => setOpen((current) => !current)}
    >
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
      {unreadCount > 0 && <span className="event-notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <section className="event-notification-popover" role="dialog" aria-label={t("Event notifications")}>
      <header className="event-notification-heading">
        <div><b>{t("Notifications")}</b><small>{unreadCount ? `${unreadCount} ${t("unread")}` : t("You’re all caught up")}</small></div>
        {unreadCount > 0 && <button type="button" onClick={() => void markAllAsRead()} disabled={updating}>{t("Mark all read")}</button>}
      </header>
      {error && <p className="event-notification-error" role="alert">{error}</p>}
      {loading
        ? <p className="event-notification-empty">{t("Loading notifications…")}</p>
        : notifications.length
          ? <ul className="event-notification-list">{notifications.map((notification) => {
            const message = notificationMessages[notification.kind];
            return <li key={notification.id}>
              <button
                type="button"
                className={`event-notification-item ${notification.read_at ? "" : "unread"}`}
                onClick={() => void markAsRead(notification)}
                disabled={updating}
              >
                <span className="event-notification-dot" aria-hidden="true" />
                <span className="event-notification-copy">
                  <b>{t(message.title)}</b>
                  <strong>{notification.event_title}</strong>
                  <small>{t(message.detail)}</small>
                  <time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString()}</time>
                </span>
              </button>
            </li>;
          })}</ul>
          : <p className="event-notification-empty">{t("Event updates and RSVP reminders will show up here.")}</p>}
    </section>}
  </div>;
}
