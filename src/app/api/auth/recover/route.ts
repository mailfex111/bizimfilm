import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  hashRecoveryCode,
  isValidUsername,
  normalizeRecoveryCode,
  verifyRecoveryCodeHash,
} from "@/lib/recoveryCodes";

// Strict brute-force protection: max 5 recovery attempts per 15 min per IP or username
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_ATTEMPTS = 5;
const ipAttempts = new Map<string, number[]>();
const userAttempts = new Map<string, number[]>();

function hitLimit(store: Map<string, number[]>, key: string): boolean {
  const now = Date.now();
  const prev = (store.get(key) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (prev.length >= RATE_MAX_ATTEMPTS) {
    store.set(key, prev);
    return true;
  }
  prev.push(now);
  store.set(key, prev);
  return false;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (hitLimit(ipAttempts, ip)) {
    return NextResponse.json(
      {
        error:
          "Çok fazla kurtarma denemesi yaptınız. Güvenliğiniz için lütfen 15 dakika sonra tekrar deneyin.",
      },
      { status: 429 }
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

  if (hitLimit(userAttempts, username)) {
    return NextResponse.json(
      {
        error:
          "Bu hesap için çok fazla kurtarma denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.",
      },
      { status: 429 }
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
    // Perform dummy hash work to avoid timing-based username enumeration
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
  const { error: passErr } = await admin.auth.admin.updateUserById(profileRow.id, {
    password: newPassword,
  });

  if (passErr) {
    // Roll back code consumption if Auth update failed
    await admin
      .from("account_recovery_codes")
      .update({ used_at: null })
      .eq("id", matchedId);
    return NextResponse.json(
      { error: passErr.message || "Şifre güncellenemedi." },
      { status: 500 }
    );
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
