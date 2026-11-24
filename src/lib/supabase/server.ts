import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export async function createServerSupabaseClient() {
  const { url, publishableKey, isConfigured } = getSupabasePublicConfig();
  if (!isConfigured) {
    throw new Error(
      "Supabase ortam değişkenleri (NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) eksik."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Safe to ignore when called inside a Server Component render
        }
      },
    },
  });
}
