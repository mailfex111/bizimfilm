import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = searchParams.get("next") || "/";

  // Prevent open redirect attacks: only allow relative internal paths
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";

  if (code) {
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${safeNext}`);
      }
    } catch {
      // Redirect to login with error query below
    }
  }

  return NextResponse.redirect(`${origin}/?auth_error=link_invalid`);
}
