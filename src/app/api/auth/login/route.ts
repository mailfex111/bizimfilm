import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

// Sliding-window rate limit per IP (10 login attempts per 5 minutes)
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX_ATTEMPTS = 10;
const attemptLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const prev = (attemptLog.get(ip) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (prev.length >= RATE_MAX_ATTEMPTS) {
    attemptLog.set(ip, prev);
    return true;
  }
  prev.push(now);
  attemptLog.set(ip, prev);
  return false;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      {
        error:
          "Çok fazla giriş denemesi yaptınız. Lütfen birkaç dakika bekleyip tekrar deneyin.",
      },
      { status: 429 }
    );
  }

  let identifier = "";
  let password = "";
  try {
    const body = (await request.json()) as { identifier?: string; password?: string };
    identifier = (body.identifier || "").trim();
    password = body.password || "";
  } catch {
    return NextResponse.json({ error: "Geçersiz istek biçimi." }, { status: 400 });
  }

  if (!identifier || !password) {
    return NextResponse.json(
      { error: "E-posta/kullanıcı adı ve şifre zorunludur." },
      { status: 400 }
    );
  }

  let targetEmail = identifier;

  // If identifier does not contain '@', resolve username strictly server-side
  // without ever exposing whether the username or email exists to the client.
  if (!identifier.includes("@")) {
    const admin = createServiceRoleClient();
    if (!admin) {
      return NextResponse.json(
        {
          error:
            "Kullanıcı adı ile giriş için sunucu yapılandırması (SUPABASE_SERVICE_ROLE_KEY) gereklidir. Lütfen e-posta adresinizle giriş yapın.",
        },
        { status: 400 }
      );
    }

    const { data: profileRow } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", identifier)
      .maybeSingle();

    if (!profileRow?.id) {
      // Constant generic message to prevent account enumeration
      return NextResponse.json(
        { error: "Giriş bilgileri hatalı. Lütfen kontrol edin." },
        { status: 401 }
      );
    }

    const { data: authUser } = await admin.auth.admin.getUserById(profileRow.id);
    if (!authUser?.user?.email) {
      return NextResponse.json(
        { error: "Giriş bilgileri hatalı. Lütfen kontrol edin." },
        { status: 401 }
      );
    }

    targetEmail = authUser.user.email;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password,
  });

  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes("email not confirmed")) {
      return NextResponse.json(
        {
          error:
            "E-posta adresiniz henüz doğrulanmamış. Lütfen gelen kutunuzdaki doğrulama bağlantısına tıklayın.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Giriş bilgileri hatalı. Lütfen kontrol edin." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
