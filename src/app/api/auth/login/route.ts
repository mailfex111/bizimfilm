import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { checkDistributedRateLimit, extractClientIp } from "@/lib/rateLimit";

const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_SECONDS = 5 * 60;

export async function POST(request: NextRequest) {
  const ip = extractClientIp(request.headers);

  const ipDecision = await checkDistributedRateLimit(
    `login:ip:${ip}`,
    LOGIN_MAX_ATTEMPTS,
    LOGIN_WINDOW_SECONDS
  );

  if (!ipDecision.allowed) {
    return NextResponse.json(
      {
        error:
          "Çok fazla giriş denemesi yaptınız. Lütfen birkaç dakika bekleyip tekrar deneyin.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(ipDecision.retryAfterSeconds) },
      }
    );
  }

  let identifier = "";
  let password = "";
  try {
    const body = (await request.json()) as {
      username?: string;
      identifier?: string;
      password?: string;
    };
    identifier = (body.username || body.identifier || "").trim();
    password = body.password || "";
  } catch {
    return NextResponse.json({ error: "Geçersiz istek biçimi." }, { status: 400 });
  }

  if (!identifier || !password) {
    return NextResponse.json(
      { error: "Kullanıcı adı ve şifre zorunludur." },
      { status: 400 }
    );
  }

  let targetEmail = identifier;

  // Resolve username strictly server-side without revealing account existence.
  // Pre-existing real-email accounts also continue working transparently.
  if (!identifier.includes("@")) {
    const admin = createServiceRoleClient();
    if (!admin) {
      return NextResponse.json(
        { error: "Sunucu kimlik doğrulama yapılandırması eksik." },
        { status: 500 }
      );
    }

    const { data: profileRow } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", identifier)
      .maybeSingle();

    if (!profileRow?.id) {
      return NextResponse.json(
        { error: "Kullanıcı adı veya şifre hatalı." },
        { status: 401 }
      );
    }

    const { data: authUser } = await admin.auth.admin.getUserById(profileRow.id);
    if (!authUser?.user?.email) {
      return NextResponse.json(
        { error: "Kullanıcı adı veya şifre hatalı." },
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
    return NextResponse.json(
      { error: "Kullanıcı adı veya şifre hatalı." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
