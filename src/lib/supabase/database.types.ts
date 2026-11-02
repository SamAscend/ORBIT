type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        { id: string; full_name: string; username: string; avatar_url: string | null; is_admin: boolean; show_online_status: boolean; created_at: string; updated_at: string },
        { id: string; full_name: string; username: string; avatar_url?: string | null; is_admin?: boolean; show_online_status?: boolean },
        { full_name?: string; username?: string; avatar_url?: string | null; is_admin?: boolean; show_online_status?: boolean; updated_at?: string }
      >;
      orbit_passkey_accounts: Table<
        { user_id: string; enrolled_at: string },
        { user_id: string; enrolled_at?: string },
        never
      >;
      chat_messages: Table<
        { id: string; sender_id: string | null; body: string; is_hidden: boolean; moderated_at: string | null; moderated_by: string | null; created_at: string },
        { sender_id: string | null; body: string; is_hidden?: boolean; moderated_at?: string | null; moderated_by?: string | null },
        { is_hidden?: boolean; moderated_at?: string | null; moderated_by?: string | null }
      >;
      orbit_chat_state: Table<
        { id: boolean; cleared_at: string; cleared_by: string | null; deleted_count: number },
        { id?: boolean; cleared_at?: string; cleared_by?: string | null; deleted_count?: number },
        { cleared_at?: string; cleared_by?: string | null; deleted_count?: number }
      >;
      direct_conversations: Table<
        { id: string; participant_one_id: string; participant_two_id: string; created_at: string },
        { participant_one_id: string; participant_two_id: string },
        never
      >;
      direct_messages: Table<
        { id: string; conversation_id: string; sender_id: string; body: string; created_at: string },
        { conversation_id: string; sender_id: string; body: string },
        never
      >;
      member_blocks: Table<
        { blocker_id: string; blocked_id: string; created_at: string },
        { blocker_id: string; blocked_id: string },
        never
      >;
      member_reports: Table<
        { id: string; reporter_id: string; reported_id: string; reason: string; status: "open" | "resolved"; created_at: string; reviewed_at: string | null; reviewed_by: string | null },
        { reporter_id: string; reported_id: string; reason: string; status?: "open" | "resolved"; reviewed_at?: string | null; reviewed_by?: string | null },
        { status?: "open" | "resolved"; reviewed_at?: string | null; reviewed_by?: string | null }
      >;
      communities: Table<
        { id: string; name: string; slug: string; description: string; created_at: string },
        { name: string; slug: string; description?: string },
        { name?: string; description?: string }
      >;
      announcements: Table<
        { id: string; community_id: string; title: string; body: string; is_published: boolean; is_pinned: boolean; created_by: string; created_at: string; updated_at: string },
        { community_id: string; title: string; body: string; created_by: string; is_published?: boolean; is_pinned?: boolean },
        { title?: string; body?: string; is_published?: boolean; is_pinned?: boolean }
      >;
      event_notifications: Table<
        { id: string; user_id: string; event_id: string | null; quest_id: string | null; event_title: string; kind: "registration_confirmed" | "waitlisted" | "waitlist_promoted" | "event_updated" | "event_cancelled" | "event_reminder" | "quest_published"; created_at: string; read_at: string | null },
        never,
        { read_at?: string | null }
      >;
      event_notification_emails: Table<
        { notification_id: string; status: "pending" | "sent" | "failed"; attempts: number; next_attempt_at: string; sent_at: string | null; last_error: string | null },
        never,
        never
      >;
      memberships: Table<
        { id: string; community_id: string; user_id: string; crew_number: number; status: "active" | "suspended" | "left"; sleep_until: string | null; verification_token: string; created_at: string },
        { community_id: string; user_id: string; status?: "active" | "suspended" | "left" },
        { status?: "active" | "suspended" | "left"; sleep_until?: string | null }
      >;
      events: Table<
        { id: string; community_id: string; title: string; description: string; visibility: "public" | "private"; status: "open" | "cancelled" | "completed"; start_at: string; location: string; capacity: number | null; created_by: string; created_at: string },
        { community_id: string; title: string; description?: string; visibility?: "public" | "private"; status?: "open" | "cancelled" | "completed"; start_at: string; location?: string; capacity?: number | null; created_by: string },
        { title?: string; description?: string; visibility?: "public" | "private"; status?: "open" | "cancelled" | "completed"; start_at?: string; location?: string; capacity?: number | null }
      >;
      event_registrations: Table<
        { id: string; event_id: string; user_id: string; status: "registered" | "waitlisted" | "cancelled"; waitlisted_at: string | null; created_at: string },
        { event_id: string; user_id: string; status?: "registered" | "waitlisted" | "cancelled"; waitlisted_at?: string | null },
        { status?: "registered" | "waitlisted" | "cancelled"; waitlisted_at?: string | null }
      >;
      quest_registrations: Table<
        { id: string; quest_id: string; user_id: string; status: "registered" | "cancelled"; created_at: string },
        { quest_id: string; user_id: string; status?: "registered" | "cancelled" },
        { status?: "registered" | "cancelled" }
      >;
      quests: Table<
        { id: string; community_id: string; title: string; description: string; xp_reward: number; goal: number; deadline: string | null; created_by: string; created_at: string },
        { community_id: string; title: string; description?: string; xp_reward?: number; goal?: number; deadline?: string | null; created_by: string },
        { title?: string; description?: string; xp_reward?: number; goal?: number; deadline?: string | null }
      >;
      quest_submissions: Table<
        { id: string; quest_id: string; user_id: string; submission_text: string; status: "submitted" | "verified" | "rejected"; reviewer_feedback: string; reviewed_by: string | null; reviewed_at: string | null; created_at: string },
        { quest_id: string; user_id: string; submission_text: string },
        { status?: "submitted" | "verified" | "rejected"; reviewer_feedback?: string; reviewed_by?: string | null; reviewed_at?: string | null }
      >;
      xp_ledger: Table<
        { id: string; community_id: string; user_id: string; submission_id: string | null; points: number; created_at: string },
        { community_id: string; user_id: string; submission_id?: string | null; points: number },
        never
      >;
    };
    Views: Record<string, never>;
    Functions: {
      is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      clear_orbit_global_chat: { Args: Record<PropertyKey, never>; Returns: number };
      join_orbit_event: { Args: { p_event_id: string }; Returns: string };
      leave_orbit_event: { Args: { p_event_id: string }; Returns: number };
      get_orbit_event_availability: {
        Args: Record<PropertyKey, never>;
        Returns: { event_id: string; registered_count: number; waitlist_count: number; my_status: string | null; my_waitlist_position: number | null }[];
      };
      submit_orbit_quest_work: { Args: { p_quest_id: string; p_submission_text: string }; Returns: string };
      review_orbit_quest_submission: { Args: { p_submission_id: string; p_status: string; p_feedback?: string }; Returns: string };
      pause_own_membership: { Args: Record<PropertyKey, never>; Returns: undefined };
      verify_orbit_membership: { Args: { p_token: string }; Returns: { member_name: string; crew_number: number }[] };
      get_orbit_member_directory: { Args: Record<PropertyKey, never>; Returns: { user_id: string; full_name: string; username: string; avatar_url: string | null; crew_number: number; show_online_status: boolean }[] };
      create_orbit_direct_conversation: { Args: { p_other_user_id: string }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
