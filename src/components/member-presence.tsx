"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function MemberPresence({ userId, enabled }: { userId: string; enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const supabase = createClient();
    const channel = supabase.channel("orbit-member-presence", {
      config: { presence: { key: userId }, private: true },
    });

    channel.subscribe(async (status, subscribeError) => {
      if (!active) return;
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("Could not connect ORBIT online presence.", subscribeError);
        return;
      }
      if (status === "SUBSCRIBED") {
        const trackStatus = await channel.track({ user_id: userId });
        if (trackStatus !== "ok" && active) {
          console.error("Could not publish ORBIT online presence.", trackStatus);
        }
      }
    });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [enabled, userId]);

  return null;
}
