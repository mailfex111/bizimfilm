import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Safely deletes the authenticated user's personal account while preserving
 * all shared couple memories (media, memory_books, memory_pages, notes, special_dates)
 * so the remaining partner never loses shared memories.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 401 });
  }

  // 1. Non-destructively remove only this user's membership (shared couple data stays intact)
  await supabase.rpc("leave_couple_space");

  // 2. Remove user's own notifications, preferences, and profile
  await supabase.from("notifications").delete().eq("user_id", user.id);
  await supabase.from("profiles").delete().eq("id", user.id);

  // 3. Delete auth.users record if server-side SUPABASE_SERVICE_ROLE_KEY is configured
  const admin = createServiceRoleClient();
  if (!admin) {
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        partial: true,
        message:
          "Kişisel profiliniz ve çift üyeliğiniz kaldırıldı; ortak anılar korundu. Auth hesabınızın kalıcı olarak silinmesi için sunucuda SUPABASE_SERVICE_ROLE_KEY tanımlı olmalıdır.",
      },
      { status: 200 }
    );
  }

  // Also clean user's private avatar folder if present
  const { data: avatarFiles } = await admin.storage.from("avatars").list(user.id);
  if (avatarFiles && avatarFiles.length > 0) {
    await admin.storage
      .from("avatars")
      .remove(avatarFiles.map((f) => `${user.id}/${f.name}`));
  }

  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
  if (deleteErr) {
    return NextResponse.json(
      { error: "Kimlik kaydı silinirken sunucu hatası oluştu." },
      { status: 500 }
    );
  }

  await supabase.auth.signOut();
  return NextResponse.json({
    ok: true,
    message:
      "Hesabınız kalıcı olarak silindi. Partnerinizin ortak anıları korunmaya devam ediyor.",
  });
}
