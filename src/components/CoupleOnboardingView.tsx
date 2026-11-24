"use client";

import React, { useState } from "react";
import {
  Upload,
  Check,
  Copy,
  AlertCircle,
  LogOut,
  Users,
  KeyRound,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { uploadUserAvatar } from "@/lib/storage";

function getInitialInviteFromBrowser(): string {
  if (typeof window === "undefined") return "";
  try {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("invite") ||
      window.sessionStorage.getItem("miora_pending_invite") ||
      ""
    ).trim();
  } catch {
    return "";
  }
}

export default function CoupleOnboardingView() {
  const { user, profile, memberAvatarUrls, refreshAccount, updateProfile, signOut } =
    useAuth();

  const [inviteCode, setInviteCode] = useState<string>(getInitialInviteFromBrowser);
  const [tab, setTab] = useState<"create" | "join">(() =>
    getInitialInviteFromBrowser() ? "join" : "create"
  );
  const [displayNameOverride, setDisplayNameOverride] = useState<string | null>(null);
  const displayName = displayNameOverride ?? profile?.display_name ?? "";
  const [coupleName, setCoupleName] = useState("");
  const [startDate, setStartDate] = useState("");

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setError(null);
    setAvatarUploading(true);
    try {
      await uploadUserAvatar(user.id, file, profile?.avatar_path);
      await refreshAccount();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profil fotoğrafı yüklenemedi.");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  };

  const handleCreateCouple = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!coupleName.trim()) {
      setError("Lütfen ortak çift alanınız için bir başlık girin (örn: Bizim Hikayemiz).");
      return;
    }

    setSubmitting(true);
    try {
      if (displayName.trim() && displayName.trim() !== profile?.display_name) {
        await updateProfile({ display_name: displayName.trim() });
      }

      const supabase = createClient();
      const { error: createErr } = await supabase.rpc("create_couple_space", {
        p_couple_name: coupleName.trim(),
        p_relationship_start_date: startDate || null,
      });

      if (createErr) {
        setError(createErr.message || "Çift alanı oluşturulamadı.");
        return;
      }

      // Immediately generate initial single-use partner invite code
      const { data: inviteData } = await supabase.rpc("create_couple_invite", {
        p_expires_hours: 72,
      });
      const row = Array.isArray(inviteData) ? inviteData[0] : inviteData;
      if (row?.invite_code) {
        setCreatedInvite({
          code: row.invite_code,
          expiresAt: row.expires_at,
        });
      } else {
        await refreshAccount();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = inviteCode.trim();
    if (!cleanCode) {
      setError("Lütfen partnerinizden aldığınız davet kodunu girin.");
      return;
    }

    setSubmitting(true);
    try {
      if (displayName.trim() && displayName.trim() !== profile?.display_name) {
        await updateProfile({ display_name: displayName.trim() });
      }

      const supabase = createClient();
      const { error: acceptErr } = await supabase.rpc("accept_couple_invite", {
        p_token: cleanCode,
      });

      if (acceptErr) {
        setError(acceptErr.message || "Davet kodu geçersiz veya süresi dolmuş.");
        return;
      }

      try {
        window.sessionStorage.removeItem("miora_pending_invite");
      } catch {
        // Ignore
      }
      await refreshAccount();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Davet kabul edilemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  const inviteLink =
    createdInvite && typeof window !== "undefined"
      ? `${window.location.origin}/?invite=${createdInvite.code}`
      : "";

  const handleCopyInvite = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const myAvatarUrl = user ? memberAvatarUrls[user.id] : null;

  return (
    <div className="min-h-screen w-full bg-[#101012] text-[#F5F5F7] flex flex-col">
      <header className="h-14 border-b border-[#343438]/60 px-6 lg:px-10 flex items-center justify-between">
        <span className="text-[18px] font-semibold tracking-[-0.025em]">Miora</span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#A1A1A6] hover:text-[#F5F5F7] transition-apple cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Çıkış Yap</span>
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl rounded-2xl border border-[#343438] bg-[#18181B] p-6 sm:p-10">
          {createdInvite ? (
            <div className="space-y-6">
              <div>
                <span className="text-[12px] font-medium uppercase tracking-wider text-[#D88A96]">
                  Çift Alanınız Hazır
                </span>
                <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
                  Partnerinizi davet edin.
                </h1>
                <p className="mt-2 text-[14px] text-[#A1A1A6]">
                  Aşağıdaki tek kullanımlık davet bağlantısını veya kodu partnerinizle paylaşın.
                  Davet 72 saat geçerlidir ve yalnızca bir kişi tarafından kullanılabilir.
                </p>
              </div>

              <div className="rounded-xl border border-[#343438] bg-[#101012] p-4 space-y-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#A1A1A6]">
                    Davet Kodu
                  </span>
                  <div className="mt-1 font-mono text-[13px] text-[#F5F5F7] break-all select-all">
                    {createdInvite.code}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#343438]/60 flex items-center justify-between gap-3">
                  <span className="text-[12px] text-[#A1A1A6] truncate">{inviteLink}</span>
                  <button
                    type="button"
                    onClick={() => void handleCopyInvite()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#222226] hover:bg-[#343438] px-3 py-1.5 text-[12px] font-medium text-[#F5F5F7] shrink-0 transition-apple cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#D88A96]" />
                        <span>Kopyalandı</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Bağlantıyı Kopyala</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void refreshAccount()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#F5F5F7] hover:bg-white py-2.5 text-[14px] font-medium text-[#101012] transition-apple cursor-pointer"
              >
                <span>Ortak Alanımıza Geç</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
                  Özel alanınızı kurun.
                </h1>
                <p className="mt-2 text-[14px] text-[#A1A1A6]">
                  Profil bilgilerinizi tamamlayın, yeni bir çift alanı oluşturun veya partnerinizin
                  gönderdiği davet kodunu girin.
                </p>
              </div>

              {/* Profile Step */}
              <div className="mb-7 pb-6 border-b border-[#343438]/70 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="relative h-16 w-16 rounded-full border border-[#343438] bg-[#101012] overflow-hidden flex items-center justify-center shrink-0">
                  {myAvatarUrl ? (
                    <img
                      src={myAvatarUrl}
                      alt={displayName || "Profil"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[20px] font-semibold text-[#A1A1A6]">
                      {(displayName || profile?.username || "M").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <label className="block text-[12px] font-medium text-[#A1A1A6]">
                    Görünen Adınız
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayNameOverride(e.target.value)}
                      placeholder="Adınız"
                      className="flex-1 rounded-lg border border-[#343438] bg-[#101012] px-3 py-2 text-[14px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
                    />
                    <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#343438] bg-[#222226] hover:bg-[#343438] px-3 py-2 text-[12px] font-medium text-[#F5F5F7] cursor-pointer transition-apple">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{avatarUploading ? "Yükleniyor..." : "Fotoğraf"}</span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,image/*"
                        onChange={handleAvatarUpload}
                        disabled={avatarUploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Mode Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#101012] border border-[#343438] mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setTab("create");
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 text-[13px] font-medium transition-apple cursor-pointer ${
                    tab === "create"
                      ? "bg-[#222226] text-[#F5F5F7]"
                      : "text-[#A1A1A6] hover:text-[#F5F5F7]"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Yeni Çift Alanı Oluştur</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab("join");
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 text-[13px] font-medium transition-apple cursor-pointer ${
                    tab === "join"
                      ? "bg-[#222226] text-[#F5F5F7]"
                      : "text-[#A1A1A6] hover:text-[#F5F5F7]"
                  }`}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Davet Kodu ile Katıl</span>
                </button>
              </div>

              {tab === "create" ? (
                <form onSubmit={handleCreateCouple} className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-medium text-[#A1A1A6] mb-1.5">
                      Çift Alanı Adı
                    </label>
                    <input
                      type="text"
                      value={coupleName}
                      onChange={(e) => setCoupleName(e.target.value)}
                      placeholder="Örn: Bizim Hikayemiz"
                      className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3.5 py-2.5 text-[14px] text-[#F5F5F7] placeholder-[#A1A1A6]/45 focus:border-[#D88A96] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-[#A1A1A6] mb-1.5">
                      İlişki Başlangıç Tarihi (isteğe bağlı)
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3.5 py-2.5 text-[14px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
                    />
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-lg border border-[#D88A96]/40 bg-[#101012] p-3 text-[13px] text-[#F5F5F7]"
                    >
                      <AlertCircle className="h-4 w-4 text-[#D88A96] shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-[#F5F5F7] hover:bg-white py-2.5 text-[14px] font-medium text-[#101012] transition-apple cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? "Oluşturuluyor..." : "Çift Alanını Oluştur ve Davet Kodu Al"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAcceptInvite} className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-medium text-[#A1A1A6] mb-1.5">
                      Partner Davet Kodu
                    </label>
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="Partnerinizden gelen davet kodunu yapıştırın"
                      className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3.5 py-2.5 font-mono text-[13px] text-[#F5F5F7] placeholder-[#A1A1A6]/45 focus:border-[#D88A96] focus:outline-none"
                    />
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-lg border border-[#D88A96]/40 bg-[#101012] p-3 text-[13px] text-[#F5F5F7]"
                    >
                      <AlertCircle className="h-4 w-4 text-[#D88A96] shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-[#F5F5F7] hover:bg-white py-2.5 text-[14px] font-medium text-[#101012] transition-apple cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? "Katılınıyor..." : "Daveti Kabul Et ve Katıl"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
