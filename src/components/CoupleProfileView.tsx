"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Image as ImageIcon,
  PlaySquare,
  Music,
  Copy,
  Check,
  KeyRound,
  XCircle,
  Settings,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatTurkishDate } from "@/lib/dateUtils";
import { formatBytes } from "@/lib/mediaOptimizer";
import { type CoupleInvite, type NavTab } from "@/types";

interface CoupleProfileViewProps {
  photosCount: number;
  videosCount: number;
  tracksCount: number;
  pagesCount: number;
  onSelectTab: (tab: NavTab) => void;
  onOpenSettings: () => void;
}

export default function CoupleProfileView({
  photosCount,
  videosCount,
  tracksCount,
  pagesCount,
  onSelectTab,
  onOpenSettings,
}: CoupleProfileViewProps) {
  const { user, couple, members, memberAvatarUrls, storageBreakdown } = useAuth();
  const [invites, setInvites] = useState<CoupleInvite[]>([]);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [latestInviteCode, setLatestInviteCode] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    if (!couple) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("couple_invites")
      .select("id, couple_id, expires_at, used_at, revoked_at, created_by, created_at")
      .eq("couple_id", couple.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setInvites((data || []) as CoupleInvite[]);
    setNowTs(Date.now());
  }, [couple]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadInvites();
    });
    return () => {
      active = false;
    };
  }, [loadInvites]);

  const handleCreateInvite = async () => {
    setInviteError(null);
    setCreatingInvite(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_couple_invite", {
        p_expires_hours: 72,
      });
      if (error) {
        setInviteError(error.message);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.invite_code) {
        setLatestInviteCode(row.invite_code);
      }
      await loadInvites();
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    const supabase = createClient();
    await supabase.rpc("revoke_couple_invite", { p_invite_id: inviteId });
    await loadInvites();
  };

  const inviteLink =
    latestInviteCode && typeof window !== "undefined"
      ? `${window.location.origin}/?invite=${latestInviteCode}`
      : "";

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
    <section className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 py-8 pb-28 space-y-8">
      {/* Couple Summary Banner */}
      <div className="rounded-2xl border border-[#343438] bg-[#18181B] p-6 sm:p-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="flex items-center -space-x-3">
              {members.map((m) => {
                const url = memberAvatarUrls[m.user_id];
                const name = m.profile?.display_name || "Üye";
                return url ? (
                  <img
                    key={m.id}
                    src={url}
                    alt={name}
                    className="h-16 w-16 rounded-full border-2 border-[#101012] object-cover"
                  />
                ) : (
                  <span
                    key={m.id}
                    className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#101012] bg-[#222226] text-[18px] font-semibold text-[#F5F5F7]"
                  >
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                );
              })}
            </div>
            <div>
              <span className="text-[12px] font-medium uppercase tracking-wider text-[#D88A96]">
                Özel Çift Alanı ({members.length}/2 Üye)
              </span>
              <h1 className="mt-1 text-[28px] sm:text-[34px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
                {couple?.couple_name}
              </h1>
              {couple?.relationship_start_date && (
                <p className="mt-1 text-[14px] text-[#A1A1A6]">
                  Başlangıç: {formatTurkishDate(couple.relationship_start_date)}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F5F5F7] hover:bg-white px-4 py-2.5 text-[13px] font-medium text-[#101012] transition-apple cursor-pointer"
          >
            <Settings className="h-4 w-4" />
            <span>Hesap Ayarları ve Yedekleme</span>
          </button>
        </div>

        {/* Real DB Counts */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div
            onClick={() => onSelectTab("ani-kitabi")}
            className="rounded-xl border border-[#343438] bg-[#101012] p-5 cursor-pointer hover:border-[#A1A1A6]/50 transition-apple"
          >
            <BookOpen className="h-4 w-4 text-[#D88A96] mb-3" />
            <div className="text-[24px] font-semibold text-[#F5F5F7] tabular-nums">
              {pagesCount}
            </div>
            <div className="text-[12px] text-[#A1A1A6] mt-0.5">Anı Kitabı Sayfası</div>
          </div>

          <div
            onClick={() => onSelectTab("fotograflar")}
            className="rounded-xl border border-[#343438] bg-[#101012] p-5 cursor-pointer hover:border-[#A1A1A6]/50 transition-apple"
          >
            <ImageIcon className="h-4 w-4 text-[#D88A96] mb-3" />
            <div className="text-[24px] font-semibold text-[#F5F5F7] tabular-nums">
              {photosCount}
            </div>
            <div className="text-[12px] text-[#A1A1A6] mt-0.5">Fotoğraf</div>
          </div>

          <div
            onClick={() => onSelectTab("videolar")}
            className="rounded-xl border border-[#343438] bg-[#101012] p-5 cursor-pointer hover:border-[#A1A1A6]/50 transition-apple"
          >
            <PlaySquare className="h-4 w-4 text-[#D88A96] mb-3" />
            <div className="text-[24px] font-semibold text-[#F5F5F7] tabular-nums">
              {videosCount}
            </div>
            <div className="text-[12px] text-[#A1A1A6] mt-0.5">Video</div>
          </div>

          <div
            onClick={() => onSelectTab("muzik")}
            className="rounded-xl border border-[#343438] bg-[#101012] p-5 cursor-pointer hover:border-[#A1A1A6]/50 transition-apple"
          >
            <Music className="h-4 w-4 text-[#D88A96] mb-3" />
            <div className="text-[24px] font-semibold text-[#F5F5F7] tabular-nums">
              {tracksCount}
            </div>
            <div className="text-[12px] text-[#A1A1A6] mt-0.5">Şarkı</div>
          </div>
        </div>
      </div>

      {/* Partner Invite & Storage Breakdown Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Partner Invitations Card */}
        <div className="rounded-2xl border border-[#343438] bg-[#18181B] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-[#F5F5F7]">
                Partner Davet Yönetimi
              </h2>
              <p className="text-[12px] text-[#A1A1A6] mt-0.5">
                Her çift alanında en fazla 2 aktif üye bulunabilir.
              </p>
            </div>
            {members.length < 2 && (
              <button
                type="button"
                disabled={creatingInvite}
                onClick={() => void handleCreateInvite()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F5F7] hover:bg-white px-3.5 py-2 text-[12px] font-medium text-[#101012] cursor-pointer disabled:opacity-50"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>{creatingInvite ? "Üretiliyor..." : "Davet Kodu Oluştur"}</span>
              </button>
            )}
          </div>

          {inviteError && (
            <p className="rounded-lg border border-[#D88A96]/40 bg-[#101012] p-3 text-[12px] text-[#F5F5F7]">
              {inviteError}
            </p>
          )}

          {members.length >= 2 && (
            <div className="rounded-xl border border-[#343438] bg-[#101012] p-4 text-[13px] text-[#A1A1A6]">
              Çift alanınızda 2 aktif üye bağlı. Yeni davet oluşturulamaz.
              <div className="mt-3 space-y-1.5">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between text-[13px] text-[#F5F5F7]"
                  >
                    <span>
                      {m.profile?.display_name} (@{m.profile?.username})
                    </span>
                    <span className="text-[11px] text-[#D88A96]">
                      {m.user_id === user?.id ? "Siz" : "Partner"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {latestInviteCode && (
            <div className="rounded-xl border border-[#D88A96]/40 bg-[#101012] p-4 space-y-2.5">
              <div className="text-[11px] font-medium uppercase tracking-wider text-[#D88A96]">
                Tek Kullanımlık Davet Kodu (Yalnızca Şimdi Gösterilir)
              </div>
              <div className="font-mono text-[12px] text-[#F5F5F7] break-all select-all">
                {latestInviteCode}
              </div>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteLink);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#222226] hover:bg-[#343438] px-3 py-1.5 text-[12px] font-medium text-[#F5F5F7] cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[#D88A96]" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Bağlantı Kopyalandı" : "Davet Bağlantısını Kopyala"}</span>
              </button>
            </div>
          )}

          {invites.length > 0 && (
            <div className="space-y-2">
              <div className="text-[12px] font-medium text-[#A1A1A6]">
                Davet Geçmişi
              </div>
              {invites.map((inv) => {
                const isActive =
                  !inv.used_at &&
                  !inv.revoked_at &&
                  new Date(inv.expires_at).getTime() > nowTs;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-lg border border-[#343438]/70 bg-[#101012] px-3.5 py-2.5 text-[12px]"
                  >
                    <div>
                      <span className="text-[#F5F5F7]">
                        {inv.used_at
                          ? "Kullanıldı"
                          : inv.revoked_at
                          ? "İptal Edildi"
                          : isActive
                          ? "Aktif Davet"
                          : "Süresi Doldu"}
                      </span>
                      <div className="text-[11px] text-[#A1A1A6]">
                        Son geçerlilik:{" "}
                        {new Date(inv.expires_at).toLocaleString("tr-TR")}
                      </div>
                    </div>
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => void handleRevokeInvite(inv.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#D88A96] hover:underline cursor-pointer"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>İptal Et</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Real Server-Side Storage Breakdown Card */}
        <div className="rounded-2xl border border-[#343438] bg-[#18181B] p-6 space-y-5">
          <div>
            <h2 className="text-[17px] font-semibold text-[#F5F5F7]">
              Depolama Kullanımı
            </h2>
            <p className="text-[12px] text-[#A1A1A6] mt-0.5">
              Çift başına gerçek zamanlı sunucu doğrulamalı depolama kotası
            </p>
          </div>

          {storageBreakdown ? (
            <>
              <div>
                <div className="flex items-baseline justify-between text-[13px] mb-2">
                  <span className="font-medium text-[#F5F5F7]">
                    {formatBytes(storageBreakdown.total_used_bytes)} /{" "}
                    {formatBytes(storageBreakdown.quota_bytes)}
                  </span>
                  <span className="text-[#D88A96] font-medium tabular-nums">
                    %{usedPct}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#222226]">
                  <div
                    className="h-full rounded-full bg-[#D88A96] transition-all duration-300"
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-[#343438]/70 bg-[#101012] p-3">
                  <div className="text-[11px] text-[#A1A1A6]">Fotoğraflar</div>
                  <div className="mt-1 text-[14px] font-semibold text-[#F5F5F7] tabular-nums">
                    {formatBytes(
                      storageBreakdown.photos_bytes + storageBreakdown.assets_bytes
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-[#343438]/70 bg-[#101012] p-3">
                  <div className="text-[11px] text-[#A1A1A6]">Videolar</div>
                  <div className="mt-1 text-[14px] font-semibold text-[#F5F5F7] tabular-nums">
                    {formatBytes(storageBreakdown.videos_bytes)}
                  </div>
                </div>
                <div className="rounded-xl border border-[#343438]/70 bg-[#101012] p-3">
                  <div className="text-[11px] text-[#A1A1A6]">Müzikler</div>
                  <div className="mt-1 text-[14px] font-semibold text-[#F5F5F7] tabular-nums">
                    {formatBytes(storageBreakdown.audio_bytes)}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-[#A1A1A6]">
              Depolama bilgileri yükleniyor...
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
