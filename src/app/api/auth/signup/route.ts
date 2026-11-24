import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  generateInternalAuthEmail,
  generateRecoveryCodes,
  isValidUsername,
  RECOVERY_CODE_COUNT,
} from "@/lib/recoveryCodes";

// Sliding-window rate limit per IP (8 signups per 15 minutes)
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_SIGNUPS = 8;
const signupLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const prev = (signupLog.get(ip) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (prev.length >= RATE_MAX_SIGNUPS) {
    signupLog.set(ip, prev);
    return true;
  }
  prev.push(now);
  signupLog.set(ip, prev);
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
          "Çok fazla kayıt denemesi yaptınız. Lütfen birkaç dakika bekleyip tekrar deneyin.",
      },
      { status: 429 }
    );
  }

  let displayName = "";
  let username = "";
  let password = "";
  let confirmPassword = "";

  try {
    const body = (await request.json()) as {
      displayName?: string;
      username?: string;
      password?: string;
      confirmPassword?: string;
    };
    displayName = (body.displayName || "").trim();
    username = (body.username || "").trim().toLowerCase();
    password = body.password || "";
    confirmPassword = body.confirmPassword || "";
  } catch {
    return NextResponse.json({ error: "Geçersiz istek biçimi." }, { status: 400 });
  }

  if (displayName.length < 2 || displayName.length > 80) {
    return NextResponse.json(
      { error: "Lütfen ad soyadınızı girin (en az 2 karakter)." },
      { status: 400 }
    );
  }

  if (!isValidUsername(username)) {
    return NextResponse.json(
      {
        error:
          "Kullanıcı adı 3–32 karakter olmalı ve yalnızca küçük harf, rakam, nokta (.), alt çizgi (_) veya tire (-) içermelidir.",
      },
      { status: 400 }
    );
  }

  if (password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { error: "Şifreniz en az 8 karakter olmalıdır." },
      { status: 400 }
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.json(
      { error: "Şifre ve şifre tekrarı birbiriyle eşleşmiyor." },
      { status: 400 }
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Sunucu kimlik doğrulama yapılandırması eksik." },
      { status: 500 }
    );
  }

  // 1. Check case-insensitive username uniqueness before creating auth user
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (existingProfile?.id) {
    return NextResponse.json(
      {
        error:
          "Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.",
      },
      { status: 409 }
    );
  }

  // 2. Create confirmed Supabase Auth account with unique non-routable internal email
  const internalEmail = generateInternalAuthEmail();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      display_name: displayName,
    },
  });

  if (createErr || !created?.user) {
    return NextResponse.json(
      { error: createErr?.message || "Hesap oluşturulamadı." },
      { status: 400 }
    );
  }

  const newUserId = created.user.id;

  try {
    // 3. Enforce DB-level atomic username uniqueness against concurrent signup races:
    // If handle_new_auth_user trigger had to append a random suffix because another
    // concurrent request claimed `username` first, reject cleanly & roll back auth user.
    const { data: createdProfile } = await admin
      .from("profiles")
      .select("username")
      .eq("id", newUserId)
      .maybeSingle();

    if (!createdProfile) {
      const { error: insertProfErr } = await admin.from("profiles").insert({
        id: newUserId,
        username,
        display_name: displayName,
      });
      if (insertProfErr) {
        await admin.auth.admin.deleteUser(newUserId);
        return NextResponse.json(
          {
            error:
              "Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.",
          },
          { status: 409 }
        );
      }
    } else if (createdProfile.username.toLowerCase() !== username) {
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        {
          error:
            "Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.",
        },
        { status: 409 }
      );
    }

    // 4. Generate 6 single-use recovery codes (store ONLY salted SHA-256 hashes!)
    const generated = generateRecoveryCodes(RECOVERY_CODE_COUNT);
    const { error: codeInsertErr } = await admin
      .from("account_recovery_codes")
      .insert(
        generated.map((g) => ({
          user_id: newUserId,
          code_salt: g.salt,
          code_hash: g.hash,
        }))
      );

    if (codeInsertErr) {
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        {
          error:
            "Kurtarma kodları oluşturulamadı. Lütfen veritabanı migration 009'un uygulandığından emin olun.",
        },
        { status: 500 }
      );
    }

    // 5. Sign the user in immediately so SSR session cookies are active
    const supabase = await createServerSupabaseClient();
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password,
    });

    if (signInErr) {
      return NextResponse.json(
        { error: "Hesabınız oluşturuldu ancak oturum açılamadı. Giriş yapmayı deneyin." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        username,
        recoveryCodes: generated.map((g) => g.plainCode),
      },
      { status: 201 }
    );
  } catch {
    await admin.auth.admin.deleteUser(newUserId).catch(() => {});
    return NextResponse.json(
      { error: "Kayıt işlemi sırasında beklenmeyen bir hata oluştu." },
      { status: 500 }
    );
  }
}
