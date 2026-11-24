import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { url, publishableKey, isConfigured } = getSupabasePublicConfig();

  if (isConfigured) {
    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // Refresh auth session safely on every server request
    await supabase.auth.getUser();
  }

  // Prevent private pages and user media from ever being indexed or cached across users
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  if (request.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
