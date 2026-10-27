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
        { id: string; full_name: string; username: string; is_admin: boolean; created_at: string; updated_at: string },
        { id: string; full_name: string; username: string; is_admin?: boolean },
        { full_name?: string; username?: string; is_admin?: boolean; updated_at?: string }
      >;
      communities: Table<
        { id: string; name: string; slug: string; description: string; created_at: string },
        { name: string; slug: string; description?: string },
        { name?: string; description?: string }
      >;
      memberships: Table<
        { id: string; community_id: string; user_id: string; crew_number: number; status: "active" | "suspended" | "left"; created_at: string },
        { community_id: string; user_id: string; status?: "active" | "suspended" | "left" },
        { status?: "active" | "suspended" | "left" }
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
