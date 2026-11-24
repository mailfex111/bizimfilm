"use client";

import { createBrowserClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const { url, publishableKey, isConfigured } = getSupabasePublicConfig();
  if (!isConfigured) {
    throw new Error(
      "Supabase ortam değişkenleri (NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) yapılandırılmamış."
    );
  }

  browserClient = createBrowserClient(url, publishableKey);
  return browserClient;
}
