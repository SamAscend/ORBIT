import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type EventNotification = {
  id: string;
  user_id: string;
  event_id: string | null;
  event_title: string;
  kind: "registration_confirmed" | "waitlisted" | "waitlist_promoted" | "event_updated" | "event_cancelled" | "event_reminder";
};

type EmailQueueItem = {
  notification_id: string;
  attempts: number;
  notification: EventNotification;
};

const emailCopy: Record<EventNotification["kind"], { subject: string; message: string }> = {
  registration_confirmed: { subject: "Your ORBIT event spot is confirmed", message: "Your spot is confirmed. We look forward to seeing you there." },
  waitlisted: { subject: "You’re on the ORBIT event waitlist", message: "You’re on the waitlist. We’ll email you if a spot opens up." },
  waitlist_promoted: { subject: "A spot opened up for your ORBIT event", message: "A spot opened up and you’ve been moved into the event." },
  event_updated: { subject: "An ORBIT event has changed", message: "The event details have changed. Check the latest information below." },
  event_cancelled: { subject: "An ORBIT event was cancelled", message: "This event has been cancelled." },
  event_reminder: { subject: "A reminder about your ORBIT event", message: "Your event is coming up in about 24 hours." },
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function eventDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  const expectedSecret = Deno.env.get("ORBIT_NOTIFICATION_CRON_SECRET");
  if (!expectedSecret || request.headers.get("authorization") !== `Bearer ${expectedSecret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("ORBIT_NOTIFICATION_FROM");
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !from) {
    console.error("Event notification worker is missing required environment configuration.");
    return Response.json({ error: "Event email delivery is not configured." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: reminderError } = await supabase.rpc("enqueue_orbit_event_reminders");
  if (reminderError) {
    console.error("Could not enqueue ORBIT event reminders.", reminderError);
    return Response.json({ error: "Could not enqueue event reminders." }, { status: 500 });
  }

  const { data: queue, error: queueError } = await supabase
    .from("event_notification_emails")
    .select("notification_id, attempts, notification:event_notifications(id, user_id, event_id, event_title, kind)")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(50);
  if (queueError) {
    console.error("Could not load queued ORBIT event emails.", queueError);
    return Response.json({ error: "Could not load queued event emails." }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  for (const rawItem of queue ?? []) {
    const item = rawItem as EmailQueueItem | null;
    if (!item?.notification) {
      console.error("Skipping an event email without its notification record.", rawItem.notification_id);
      continue;
    }

    try {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(item.notification.user_id);
      if (userError) throw userError;
      const email = userData.user?.email;
      if (!email) throw new Error("The event attendee has no email address.");

      let eventDetails = "";
      if (item.notification.event_id) {
        const { data: event, error: eventError } = await supabase
          .from("events")
          .select("start_at, location")
          .eq("id", item.notification.event_id)
          .maybeSingle();
        if (eventError) throw eventError;
        if (event) {
          eventDetails = `<p><strong>When:</strong> ${escapeHtml(eventDate(event.start_at))}</p><p><strong>Where:</strong> ${escapeHtml(event.location || "See ORBIT for details")}</p>`;
        }
      }

      const copy = emailCopy[item.notification.kind];
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": item.notification.id,
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: copy.subject,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#34443a"><p>${escapeHtml(copy.message)}</p><h2>${escapeHtml(item.notification.event_title)}</h2>${eventDetails}<p>Open your ORBIT workspace to see the latest event details.</p></div>`,
        }),
      });
      if (!response.ok) {
        throw new Error(`Resend returned HTTP ${response.status}.`);
      }

      const { error: updateError } = await supabase
        .from("event_notification_emails")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("notification_id", item.notification_id);
      if (updateError) throw updateError;
      sent += 1;
    } catch (sendError) {
      const attempts = item.attempts + 1;
      const terminal = attempts >= 5;
      const retryMinutes = Math.min(60, 2 ** attempts);
      const message = sendError instanceof Error ? sendError.message : "Email delivery failed.";
      console.error("Could not deliver an ORBIT event email.", { notificationId: item.notification_id, message });
      const { error: updateError } = await supabase
        .from("event_notification_emails")
        .update({
          status: terminal ? "failed" : "pending",
          attempts,
          next_attempt_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
          last_error: message.slice(0, 500),
        })
        .eq("notification_id", item.notification_id);
      if (updateError) {
        console.error("Could not update a failed ORBIT event email.", updateError);
      }
      failed += 1;
    }
  }

  return Response.json({ queued: queue?.length ?? 0, sent, failed });
});
