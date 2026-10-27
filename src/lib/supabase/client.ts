"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseConfig } from "./config";

let client: SupabaseClient<Database> | undefined;

export function createClient() {
  if (client) return client;
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured. Add the public project URL and publishable key to .env.local.");
  client = createBrowserClient<Database>(config.url, config.key);
  return client;
}
