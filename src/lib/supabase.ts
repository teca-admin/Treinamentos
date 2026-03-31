import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = async (): Promise<SupabaseClient> => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const res = await fetch("/api/config/supabase");
  const config = await res.json();
  
  if (!supabaseInstance) {
    supabaseInstance = createClient(config.url, config.key);
  }
  
  return supabaseInstance;
};
