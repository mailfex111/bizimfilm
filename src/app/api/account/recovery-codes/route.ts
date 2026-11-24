import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  generateRecoveryCodes,
  RECOVERY_CODE_COUNT,
} from "@/lib/recoveryCodes";

/**
 * GET /api/account/recovery-codes
 * Returns ONLY the count of remaining active unused single-use recovery codes.
 * Never returns hashes, salts, or plaintext codes.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik." },
      { status: 500 }
    );
  }

  const { count, error } = await admin
    .from("account_recovery_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("used_at", null)
    .is("revoked_at", null);

  if (error) {
    return NextResponse.json(
      { error: "Kurtarma kodu bilgisi okunamadı." },
      { status: 500 }
    );
  }

  return NextResponse.json({ remainingCount: count ?? 0 });
}

/**
 * POST /api/account/recovery-codes
 * Revokes all previous unused recovery codes and generates 6 fresh single-use
 * codes (stored only as per-code salted SHA-256 hashes, returned ONCE).
 */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik." },
      { status: 500 }
    );
  }

  // Revoke previous unused codes
  const { error: revokeErr } = await admin
    .from("account_recovery_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("used_at", null)
    .is("revoked_at", null);

  if (revokeErr) {
    return NextResponse.json(
      { error: "Önceki kurtarma kodları iptal edilemedi." },
      { status: 500 }
    );
  }

  const generated = generateRecoveryCodes(RECOVERY_CODE_COUNT);
  const { error: insertErr } = await admin
    .from("account_recovery_codes")
    .insert(
      generated.map((g) => ({
        user_id: user.id,
        code_salt: g.salt,
        code_hash: g.hash,
      }))
    );

  if (insertErr) {
    return NextResponse.json(
      { error: "Yeni kurtarma kodları oluşturulamadı." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    recoveryCodes: generated.map((g) => g.plainCode),
    remainingCount: generated.length,
  });
}
