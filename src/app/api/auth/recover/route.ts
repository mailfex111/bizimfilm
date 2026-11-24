import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { checkDistributedRateLimit, extractClientIp } from "@/lib/rateLimit";
import {
  hashRecoveryCode,
  isValidUsername,
  normalizeRecoveryCode,
  verifyRecoveryCodeHash,
} from "@/lib/recoveryCodes";

const RECOVER_MAX_ATTEMPTS = 5;
const RECOVER_WINDOW_SECONDS = 15 * 60;

export async function POST(request: NextRequest) {
  const ip = extractClientIp(request.headers);

  const ipDecision = await checkDistributedRateLimit(
    `recover:ip:${ip}`,
    RECOVER_MAX_ATTEMPTS,
    RECOVER_WINDOW_SECONDS
  );

  if (!ipDecision.allowed) {
    return NextResponse.json(
      {
        error:
          "Çok fazla kurtarma denemesi yaptınız. Güvenliğiniz için lütfen 15 dakika sonra tekrar deneyin.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(ipDecision.retryAfterSeconds) },
      }
    );
  }

  let username = "";
  let recoveryCode = "";
  let newPassword = "";
  let confirmPassword = "";

  try {
    const body = (await request.json()) as {
      username?: string;
      recoveryCode?: string;
      newPassword?: string;
      confirmPassword?: string;
    };
    username = (body.username || "").trim().toLowerCase();
    recoveryCode = (body.recoveryCode || "").trim();
    newPassword = body.newPassword || "";
    confirmPassword = body.confirmPassword || "";
  } catch {
    return NextResponse.json({ error: "Geçersiz istek biçimi." }, { status: 400 });
  }

  if (!username || !recoveryCode || !newPassword) {
    return NextResponse.json(
      { error: "Kullanıcı adı, kurtarma kodu ve yeni şifre zorunludur." },
      { status: 400 }
    );
  }

  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: "Kullanıcı adı veya kurtarma kodu geçersiz." },
      { status: 401 }
    );
  }

  const userDecision = await checkDistributedRateLimit(
    `recover:user:${username}`,
    RECOVER_MAX_ATTEMPTS,
    RECOVER_WINDOW_SECONDS
  );

  if (!userDecision.allowed) {
    return NextResponse.json(
      {
        error:
          "Bu hesap için çok fazla kurtarma denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(userDecision.retryAfterSeconds) },
      }
    );
  }

  if (newPassword.length < 8 || newPassword.length > 128) {
    return NextResponse.json(
      { error: "Yeni şifreniz en az 8 karakter olmalıdır." },
      { status: 400 }
    );
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: "Yeni şifre ve şifre tekrarı birbiriyle eşleşmiyor." },
      { status: 400 }
    );
  }

  const normalized = normalizeRecoveryCode(recoveryCode);
  if (normalized.length < 12) {
    return NextResponse.json(
      { error: "Kullanıcı adı veya kurtarma kodu geçersiz." },
      { status: 401 }
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Sunucu kurtarma yapılandırması eksik." },
      { status: 500 }
    );
  }

  const { data: profileRow } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (!profileRow?.id) {
    hashRecoveryCode(normalized, "00000000000000000000000000000000");
    return NextResponse.json(
      { error: "Kullanıcı adı veya kurtarma kodu geçersiz." },
      { status: 401 }
    );
  }

  const { data: activeCodes } = await admin
    .from("account_recovery_codes")
    .select("id, code_salt, code_hash")
    .eq("user_id", profileRow.id)
    .is("used_at", null)
    .is("revoked_at", null);

  let matchedId: string | null = null;
  for (const row of activeCodes || []) {
    if (verifyRecoveryCodeHash(normalized, row.code_salt, row.code_hash)) {
      matchedId = row.id;
      break;
    }
  }

  if (!matchedId) {
    return NextResponse.json(
      { error: "Kullanıcı adı veya kurtarma kodu geçersiz." },
      { status: 401 }
    );
  }

  // Atomically consume single-use code (prevents concurrent replay races)
  const { data: claimed, error: claimErr } = await admin
    .from("account_recovery_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", matchedId)
    .is("used_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (claimErr || !claimed?.id) {
    return NextResponse.json(
      { error: "Bu kurtarma kodu zaten kullanılmış veya geçersiz." },
      { status: 401 }
    );
  }

  // Update Supabase Auth password cleanly
  const { data: updatedAuth, error: passErr } = await admin.auth.admin.updateUserById(
    profileRow.id,
    { password: newPassword }
  );

  if (passErr) {
    await admin
      .from("account_recovery_codes")
      .update({ used_at: null })
      .eq("id", matchedId);
    return NextResponse.json(
      { error: passErr.message || "Şifre güncellenemedi." },
      { status: 500 }
    );
  }

  // Globally revoke ALL existing sessions & refresh tokens across all devices
  const userEmail = updatedAuth?.user?.email;
  if (userEmail) {
    try {
      const { url, publishableKey } = getSupabasePublicConfig();
      const stateless = createClient(url, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: tempSignIn } = await stateless.auth.signInWithPassword({
        email: userEmail,
        password: newPassword,
      });
      if (tempSignIn?.session?.access_token) {
        await admin.auth.admin.signOut(tempSignIn.session.access_token, "global");
      }
    } catch {
      // Do not fail recovery response if session revocation already completed
    }
  }

  const { count } = await admin
    .from("account_recovery_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profileRow.id)
    .is("used_at", null)
    .is("revoked_at", null);

  return NextResponse.json({
    ok: true,
    remainingCodes: count ?? 0,
  });
}
