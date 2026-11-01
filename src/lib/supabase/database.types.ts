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
      chat_messages: Table<
        { id: string; sender_id: string | null; body: string; is_hidden: boolean; moderated_at: string | null; moderated_by: string | null; created_at: string },
        { sender_id: string | null; body: string; is_hidden?: boolean; moderated_at?: string | null; moderated_by?: string | null },
        { is_hidden?: boolean; moderated_at?: string | null; moderated_by?: string | null }
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
        { id: string; event_id: string; user_id: string; status: "registered" | "cancelled"; created_at: string },
        { event_id: string; user_id: string; status?: "registered" | "cancelled" },
        { status?: "registered" | "cancelled" }
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
        { id: string; quest_id: string; user_id: string; submission_text: string; status: "submitted" | "verified" | "rejected"; reviewed_by: string | null; reviewed_at: string | null; created_at: string },
        { quest_id: string; user_id: string; submission_text: string },
        { status?: "submitted" | "verified" | "rejected"; reviewed_by?: string | null; reviewed_at?: string | null }
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
      pause_own_membership: { Args: Record<PropertyKey, never>; Returns: undefined };
      verify_orbit_membership: { Args: { p_token: string }; Returns: { member_name: string; crew_number: number }[] };
      get_orbit_member_directory: { Args: Record<PropertyKey, never>; Returns: { user_id: string; full_name: string; username: string; avatar_url: string | null; crew_number: number; show_online_status: boolean }[] };
      create_orbit_direct_conversation: { Args: { p_other_user_id: string }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
