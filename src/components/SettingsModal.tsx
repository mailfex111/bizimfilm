"use client";

import React, { useEffect, useState } from "react";
import {
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  HardDrive,
  Shield,
  User,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { exportCoupleDataArchive } from "@/lib/exportArchive";
import {
  clearLegacyIndexedDB,
  downloadLegacyLocalBackup,
  inspectLegacyIndexedDB,
  migrateLegacyToSupabase,
  type LegacyInspectionResult,
} from "@/lib/legacyMigration";
import { formatBytes } from "@/lib/mediaOptimizer";
import { uploadUserAvatar } from "@/lib/storage";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBookId: string | null;
  onDataChanged: () => Promise<void>;
}

export default function SettingsModal(props: SettingsModalProps) {
  if (!props.isOpen) return null;
  return <SettingsModalContent {...props} />;
}

function SettingsModalContent({
  onClose,
  activeBookId,
  onDataChanged,
}: SettingsModalProps) {
  const {
    user,
    profile,
    couple,
    storageBreakdown,
    updateProfile,
    updatePassword,
    refreshAccount,
    refreshStorage,
    signOut,
  } = useAuth();

  const [tab, setTab] = useState<"profile" | "storage" | "backup" | "privacy">(
    "profile"
  );

  // Profile & password state
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [newPass, setNewPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Recovery codes state
  const [recoveryRemaining, setRecoveryRemaining] = useState<number | null>(null);
  const [freshRecoveryCodes, setFreshRecoveryCodes] = useState<string[] | null>(null);
  const [regeneratingCodes, setRegeneratingCodes] = useState(false);

  // Legacy IndexedDB state
  const [legacyData, setLegacyData] = useState<LegacyInspectionResult | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationLog, setMigrationLog] = useState<string | null>(null);
  const [migrationDone, setMigrationDone] = useState(false);

  // Dangerous actions confirmation
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");

  useEffect(() => {
    let active = true;
    void inspectLegacyIndexedDB().then((res) => {
      if (active) setLegacyData(res);
    });
    void fetch("/api/account/recovery-codes")
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: { remainingCount?: number } | null) => {
        if (active && payload && typeof payload.remainingCount === "number") {
          setRecoveryRemaining(payload.remainingCount);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleRegenerateRecoveryCodes = async () => {
    setRegeneratingCodes(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/account/recovery-codes", { method: "POST" });
      const payload = (await res.json()) as {
        ok?: boolean;
        recoveryCodes?: string[];
        remainingCount?: number;
        error?: string;
      };
      if (!res.ok || !payload.ok || !payload.recoveryCodes) {
        setErrorMsg(payload.error || "Yeni kurtarma kodları oluşturulamadı.");
        return;
      }
      setFreshRecoveryCodes(payload.recoveryCodes);
      setRecoveryRemaining(payload.remainingCount ?? payload.recoveryCodes.length);
      setStatusMsg(
        "6 adet yeni tek kullanımlık kurtarma kodu oluşturuldu. Eski kullanılmamış kodlar iptal edildi."
      );
    } finally {
      setRegeneratingCodes(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await updateProfile({
        display_name: displayName,
        username,
      });
      if (!res.ok) setErrorMsg(res.error || "Profil güncellenemedi.");
      else setStatusMsg("Profil bilgileriniz güncellendi.");
    } finally {
      setBusy(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setBusy(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await uploadUserAvatar(user.id, file, profile?.avatar_path);
      await refreshAccount();
      setStatusMsg("Profil fotoğrafınız güncellendi.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Avatar yüklenemedi.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await updatePassword(newPass);
      if (!res.ok) setErrorMsg(res.error || "Şifre değiştirilemedi.");
      else {
        setNewPass("");
        setStatusMsg("Şifreniz başarıyla değiştirildi.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleExportArchive = async () => {
    if (!couple) return;
    setBusy(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await exportCoupleDataArchive(couple.id);
      setStatusMsg("Çift verileriniz ve geçici medya indirme bağlantıları dışa aktarıldı.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Dışa aktarma başarısız.");
    } finally {
      setBusy(false);
    }
  };

  const handleMigrateLegacy = async () => {
    if (!couple || !activeBookId || !legacyData) return;
    setMigrating(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await migrateLegacyToSupabase(
        couple.id,
        activeBookId,
        legacyData,
        setMigrationLog
      );
      await Promise.all([onDataChanged(), refreshStorage()]);
      setMigrationDone(true);
      setStatusMsg(
        `Aktarım tamamlandı: ${res.uploadedPhotos} fotoğraf ve ${res.importedPages} kitap sayfası hesabınıza aktarıldı (${res.skippedPhotos + res.skippedPages} mükerrer kayıt atlandı).`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Yerel aktarım başarısız oldu.");
    } finally {
      setMigrating(false);
      setMigrationLog(null);
    }
  };

  const handleClearLegacyConfirmed = async () => {
    if (!legacyData) return;
    await clearLegacyIndexedDB(legacyData.detectedDatabases);
    setLegacyData({ hasRealUserData: false, photos: [], pages: [], detectedDatabases: [] });
    setStatusMsg("Tarayıcınızdaki eski yerel veriler temizlendi.");
  };

  const handleLeaveCouple = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("leave_couple_space");
      if (error) {
        setErrorMsg(error.message);
        return;
      }
      await refreshAccount();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmDeleteText.trim().toUpperCase() !== "SIL") return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || "Hesap silinemedi.");
        return;
      }
      await signOut();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const usedPct = storageBreakdown
    ? Math.min(
        100,
        Math.round(
          (storageBreakdown.total_used_bytes /
            Math.max(1, storageBreakdown.quota_bytes)) *
            100
        )
      )
    : 0;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#343438] bg-[#18181B] p-6 text-[#F5F5F7] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#343438] pb-4 mb-5">
          <div>
            <h3 className="text-[18px] font-semibold">Hesap Ayarları ve Veri Yönetimi</h3>
            <p className="text-[12px] text-[#A1A1A6] mt-0.5">
              {profile?.username
                ? `@${profile.username}`
                : user?.email && !user.email.endsWith("@users.miora.invalid")
                ? user.email
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#A1A1A6] hover:bg-[#222226] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-[#101012] border border-[#343438] mb-5">
          {[
            { id: "profile" as const, label: "Profil & Şifre", icon: User },
            { id: "storage" as const, label: "Depolama", icon: HardDrive },
            { id: "backup" as const, label: "Yedek & Aktarım", icon: Download },
            { id: "privacy" as const, label: "Gizlilik & Hesap", icon: Shield },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setStatusMsg(null);
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-medium transition-apple cursor-pointer ${
                  tab === t.id
                    ? "bg-[#222226] text-[#F5F5F7]"
                    : "text-[#A1A1A6] hover:text-[#F5F5F7]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {statusMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#343438] bg-[#222226] p-3 text-[12px] text-[#F5F5F7]">
            <CheckCircle2 className="h-4 w-4 text-[#D88A96] shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#D88A96]/40 bg-[#222226] p-3 text-[12px] text-[#F5F5F7]">
            <AlertCircle className="h-4 w-4 text-[#D88A96] shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TAB 1: Profile & Password */}
        {tab === "profile" && (
          <div className="space-y-6">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                    Görünen Ad
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3 py-2 text-[14px] text-[#F5F5F7]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#A1A1A6] mb-1.5">
                    Kullanıcı Adı
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-lg border border-[#343438] bg-[#101012] px-3 py-2 text-[14px] text-[#F5F5F7]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#343438] bg-[#101012] hover:bg-[#222226] px-3.5 py-2 text-[12px] font-medium text-[#F5F5F7] cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Profil Fotoğrafı Değiştir</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/*"
                    onChange={handleAvatarChange}
                    disabled={busy}
                    className="hidden"
                  />
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#F5F5F7] hover:bg-white px-4 py-2 text-[13px] font-medium text-[#101012] cursor-pointer"
                >
                  Profili Kaydet
                </button>
              </div>
            </form>

            <form
              onSubmit={handleUpdatePassword}
              className="pt-5 border-t border-[#343438] space-y-3"
            >
              <h4 className="text-[14px] font-semibold">Şifre Değiştir</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Yeni şifre (en az 8 karakter)"
                  className="flex-1 rounded-lg border border-[#343438] bg-[#101012] px-3.5 py-2 text-[14px] text-[#F5F5F7]"
                />
                <button
                  type="submit"
                  disabled={busy || newPass.length < 8}
                  className="rounded-lg border border-[#343438] bg-[#222226] hover:bg-[#343438] px-4 py-2 text-[13px] font-medium text-[#F5F5F7] disabled:opacity-40 cursor-pointer"
                >
                  Şifreyi Güncelle
                </button>
              </div>
            </form>

            {/* Single-Use Account Recovery Codes Manager */}
            <div className="pt-5 border-t border-[#343438] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-[14px] font-semibold">
                    Tek Kullanımlık Kurtarma Kodları
                  </h4>
                  <p className="text-[12px] text-[#A1A1A6] mt-0.5">
                    {recoveryRemaining !== null
                      ? `Aktif kullanılmamış kurtarma kodu: ${recoveryRemaining}`
                      : "Şifrenizi unuttuğunuzda hesabınıza erişmek için kurtarma kodu oluşturabilirsiniz."}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={regeneratingCodes}
                  onClick={() => void handleRegenerateRecoveryCodes()}
                  className="rounded-lg border border-[#343438] bg-[#222226] hover:bg-[#343438] px-3.5 py-2 text-[12px] font-medium text-[#F5F5F7] disabled:opacity-40 cursor-pointer"
                >
                  {regeneratingCodes
                    ? "Oluşturuluyor..."
                    : "Yeni Kurtarma Kodları Oluştur"}
                </button>
              </div>

              {freshRecoveryCodes && (
                <div className="rounded-xl border border-[#343438] bg-[#101012] p-4 space-y-3">
                  <p className="text-[12px] text-[#D88A96]">
                    Bu kodlar yalnızca şimdi görüntülenir. Güvenli bir yere kopyalayın.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {freshRecoveryCodes.map((code, idx) => (
                      <div
                        key={code}
                        className="rounded-lg border border-[#343438]/70 bg-[#18181B] px-3 py-2 font-mono text-[12px] text-[#F5F5F7] select-all"
                      >
                        <span className="text-[#A1A1A6] mr-2 select-none">
                          {idx + 1}.
                        </span>
                        {code}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(freshRecoveryCodes.join("\n"));
                      setStatusMsg("Kurtarma kodları panoya kopyalandı.");
                    }}
                    className="rounded-lg bg-[#222226] hover:bg-[#343438] px-3 py-1.5 text-[12px] font-medium text-[#F5F5F7] cursor-pointer"
                  >
                    Tümünü Kopyala
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Storage Usage Breakdown */}
        {tab === "storage" && (
          <div className="space-y-4">
            {storageBreakdown ? (
              <>
                <div className="rounded-xl border border-[#343438] bg-[#101012] p-5">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-[14px] font-semibold">
                      Toplam: {formatBytes(storageBreakdown.total_used_bytes)} /{" "}
                      {formatBytes(storageBreakdown.quota_bytes)}
                    </span>
                    <span className="text-[13px] font-medium text-[#D88A96]">
                      %{usedPct}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#222226]">
                    <div
                      className="h-full rounded-full bg-[#D88A96]"
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-[#343438] bg-[#101012] p-4">
                    <div className="text-[12px] text-[#A1A1A6]">Fotoğraflar</div>
                    <div className="mt-1 text-[16px] font-semibold tabular-nums">
                      {formatBytes(
                        storageBreakdown.photos_bytes + storageBreakdown.assets_bytes
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#343438] bg-[#101012] p-4">
                    <div className="text-[12px] text-[#A1A1A6]">Videolar</div>
                    <div className="mt-1 text-[16px] font-semibold tabular-nums">
                      {formatBytes(storageBreakdown.videos_bytes)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#343438] bg-[#101012] p-4">
                    <div className="text-[12px] text-[#A1A1A6]">Müzikler</div>
                    <div className="mt-1 text-[16px] font-semibold tabular-nums">
                      {formatBytes(storageBreakdown.audio_bytes)}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-[13px] text-[#A1A1A6]">Depolama verisi bulunamadı.</p>
            )}
          </div>
        )}

        {/* TAB 3: Data Export & Legacy IndexedDB Migration */}
        {tab === "backup" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-[#343438] bg-[#101012] p-4 space-y-3">
              <h4 className="text-[14px] font-semibold">Bulut Arşivini Dışa Aktar</h4>
              <p className="text-[12px] text-[#A1A1A6]">
                Tüm anı kitaplarınızı, sayfalarınızı, notlarınızı, özel günlerinizi ve
                medyalarınızın geçici indirme bağlantılarını JSON olarak indirebilirsiniz.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleExportArchive()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#F5F5F7] hover:bg-white px-4 py-2 text-[13px] font-medium text-[#101012] cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Verilerimi Dışa Aktar</span>
              </button>
            </div>

            {/* Section 19: Legacy IndexedDB Migration Wizard */}
            <div className="rounded-xl border border-[#343438] bg-[#101012] p-4 space-y-3">
              <h4 className="text-[14px] font-semibold">
                Eski Yerel Tarayıcı Anılarını Aktar (IndexedDB)
              </h4>
              {legacyData?.hasRealUserData ? (
                <>
                  <p className="text-[12px] text-[#A1A1A6]">
                    Bu tarayıcıda daha önce eklediğiniz{" "}
                    <strong className="text-[#F5F5F7]">
                      {legacyData.photos.length} fotoğraf
                    </strong>{" "}
                    ve{" "}
                    <strong className="text-[#F5F5F7]">
                      {legacyData.pages.length} özel kitap sayfası
                    </strong>{" "}
                    tespit edildi. Örnek/sahte demo görselleri hariç tutuldu.
                  </p>

                  {migrationLog && (
                    <p className="text-[12px] text-[#D88A96]">{migrationLog}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={migrating || !activeBookId}
                      onClick={() => void handleMigrateLegacy()}
                      className="rounded-lg bg-[#F5F5F7] hover:bg-white px-3.5 py-2 text-[12px] font-medium text-[#101012] cursor-pointer disabled:opacity-50"
                    >
                      {migrating ? "Aktarılıyor..." : "Yerel Anıları Hesabıma Aktar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadLegacyLocalBackup(legacyData)}
                      className="rounded-lg border border-[#343438] bg-[#18181B] px-3.5 py-2 text-[12px] text-[#F5F5F7] cursor-pointer"
                    >
                      Yerel Verilerin Yedeğini İndir
                    </button>
                    {migrationDone && (
                      <button
                        type="button"
                        onClick={() => void handleClearLegacyConfirmed()}
                        className="rounded-lg border border-[#D88A96]/40 px-3.5 py-2 text-[12px] text-[#D88A96] cursor-pointer"
                      >
                        Aktarım Doğrulandı — Yerel Veriyi Temizle
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[12px] text-[#A1A1A6]">
                  Bu tarayıcıda aktarılacak eski kullanıcı yüklemesi bulunmadı.
                </p>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Privacy, Leave Couple & Account Deletion */}
        {tab === "privacy" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-[#343438] bg-[#101012] p-4 text-[12px] text-[#A1A1A6] leading-relaxed">
              <strong className="text-[#F5F5F7]">
                Gizlilik ve KVKK Teknik Bilgilendirmesi (Taslak):
              </strong>{" "}
              Miora&apos;da tüm medya dosyaları özel (private) depolama alanlarında saklanır ve
              kısa süreli imzalı bağlantılarla yalnızca çift üyelerine sunulur. Bu metin teknik
              bilgilendirme amaçlıdır; kesinleşmiş hukuki danışmanlık yerine geçmez.
            </div>

            <div className="rounded-xl border border-[#343438] bg-[#101012] p-4 space-y-3">
              <h4 className="text-[14px] font-semibold">Çift Alanından Ayrıl</h4>
              <p className="text-[12px] text-[#A1A1A6]">
                Ayrıldığınızda yalnızca kendi üyeliğiniz kaldırılır; ortak fotoğraflar, videolar ve
                anı kitapları partneriniz için korunmaya devam eder.
              </p>
              {confirmLeave ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleLeaveCouple()}
                    className="rounded-lg bg-[#D88A96] px-3.5 py-1.5 text-[12px] font-medium text-[#101012] cursor-pointer"
                  >
                    Evet, Çift Alanından Ayrıl
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmLeave(false)}
                    className="rounded-lg border border-[#343438] px-3 py-1.5 text-[12px] text-[#A1A1A6]"
                  >
                    Vazgeç
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmLeave(true)}
                  className="rounded-lg border border-[#343438] bg-[#18181B] hover:bg-[#222226] px-3.5 py-2 text-[12px] font-medium text-[#F5F5F7] cursor-pointer"
                >
                  Çift Alanından Ayrıl
                </button>
              )}
            </div>

            <div className="rounded-xl border border-[#D88A96]/35 bg-[#101012] p-4 space-y-3">
              <h4 className="text-[14px] font-semibold text-[#D88A96]">Hesabımı Sil</h4>
              <p className="text-[12px] text-[#A1A1A6]">
                Kişisel profiliniz kaldırılır. Partnerinizin ortak anıları otomatik olarak silinmez.
                Devam etmek için aşağıya <strong>SIL</strong> yazın.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  placeholder="Onay için SIL yazın"
                  className="flex-1 rounded-lg border border-[#343438] bg-[#18181B] px-3 py-2 text-[13px] text-[#F5F5F7]"
                />
                <button
                  type="button"
                  disabled={busy || confirmDeleteText.trim().toUpperCase() !== "SIL"}
                  onClick={() => void handleDeleteAccount()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#D88A96] px-4 py-2 text-[12px] font-medium text-[#101012] disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Hesabı Sil</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
