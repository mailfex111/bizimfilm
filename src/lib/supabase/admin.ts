import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

/**
 * Strictly server-only privileged Supabase client.
 * Never imported by client components; reads SUPABASE_SERVICE_ROLE_KEY from server env only.
 */
export function createServiceRoleClient(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error("SECURITY_VIOLATION: Service role client cannot be used in browser.");
  }

  const { url } = getSupabasePublicConfig();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !serviceKey) {
    return null;
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
