export function getSupabasePublicConfig(): {
  url: string;
  publishableKey: string;
  isConfigured: boolean;
} {
  const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const normalizedUrl = rawUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");

  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  return {
    url: normalizedUrl,
    publishableKey,
    isConfigured: Boolean(normalizedUrl && publishableKey),
  };
}
