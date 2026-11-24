"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight, Play, Plus, Music, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import {
  formatTurkishDate,
  getDaysSince,
  getDaysUntilNextOccurrence,
} from "@/lib/dateUtils";
import { formatDuration } from "@/lib/mediaOptimizer";
import { getSignedUrlsBatch } from "@/lib/storage";
import {
  type MediaItem,
  type NavTab,
  type SpecialDateItem,
} from "@/types";

interface HomeSectionsProps {
  photos: MediaItem[];
  videos: MediaItem[];
  tracks: MediaItem[];
  specialDates: SpecialDateItem[];
  onSelectTab: (tab: NavTab) => void;
  onOpenPhotoUpload: () => void;
}

export default function HomeSections({
  photos,
  videos,
  tracks,
  specialDates,
  onSelectTab,
  onOpenPhotoUpload,
}: HomeSectionsProps) {
  const { couple, members } = useAuth();
  const { currentTrack, isPlaying, playTrack } = useAudioPlayer();

  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});

  const recentPhotos = photos.slice(0, 4);
  const recentVideos = videos.slice(0, 3);
  const recentTracks = tracks.slice(0, 4);
  const upcomingDates = specialDates.slice(0, 4);

  useEffect(() => {
    let active = true;
    const loadThumbs = async () => {
      const thumbPaths: string[] = [];
      const fallbackPhotoPaths: string[] = [];

      for (const p of recentPhotos) {
        if (p.thumbnail_path) thumbPaths.push(p.thumbnail_path);
        else fallbackPhotoPaths.push(p.storage_path);
      }
      for (const v of recentVideos) {
        if (v.thumbnail_path) thumbPaths.push(v.thumbnail_path);
      }

      const [thumbsMap, photoMap] = await Promise.all([
        thumbPaths.length > 0 ? getSignedUrlsBatch("thumbnails", thumbPaths) : {},
        fallbackPhotoPaths.length > 0
          ? getSignedUrlsBatch("couple-photos", fallbackPhotoPaths)
          : {},
      ]);

      if (active) {
        setThumbUrls({ ...photoMap, ...thumbsMap });
      }
    };
    void loadThumbs();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, videos]);

  const daysTogether = getDaysSince(couple?.relationship_start_date);

  return (
    <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 space-y-14 pb-28">
      {/* Subtle Partner Invite Prompt when only 1 member is in the couple space */}
      {members.length < 2 && (
        <div className="rounded-xl border border-[#343438] bg-[#18181B] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-[#D88A96] shrink-0" />
            <p className="text-[13px] text-[#F5F5F7]">
              Partneriniz henüz ortak alanınıza katılmadı. Tek kullanımlık davet bağlantısı oluşturup paylaşabilirsiniz.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectTab("biz")}
            className="rounded-lg bg-[#F5F5F7] hover:bg-white px-4 py-2 text-[12px] font-medium text-[#101012] shrink-0 transition-apple cursor-pointer"
          >
            Partnerinizi Davet Edin
          </button>
        </div>
      )}

      {/* 1. Son Eklenen Fotoğraflar — Real Supabase Archival Strip */}
      <section aria-label="Son Eklenen Fotoğraflar">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-[#F5F5F7]">
              Son Eklenen Fotoğraflar
            </h2>
            <p className="text-[13px] text-[#A1A1A6] mt-0.5">
              Ortak arşivinize eklenen güncel kareler
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onOpenPhotoUpload}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#D88A96] hover:text-[#F5F5F7] transition-apple cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Fotoğraf Yükle</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectTab("fotograflar")}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-[#A1A1A6] hover:text-[#F5F5F7] transition-apple cursor-pointer"
            >
              <span>Tümünü Gör ({photos.length})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {recentPhotos.length === 0 ? (
          <div className="rounded-2xl border border-[#343438]/70 bg-[#18181B] px-6 py-12 text-center">
            <p className="text-[16px] font-medium text-[#F5F5F7]">
              Henüz fotoğraf eklemediniz.
            </p>
            <p className="mt-1 text-[13px] text-[#A1A1A6]">
              İlk anınızı birlikte oluşturun ve özel galerinize ekleyin.
            </p>
            <button
              type="button"
              onClick={onOpenPhotoUpload}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#F5F5F7] hover:bg-white px-4 py-2 text-[13px] font-medium text-[#101012] transition-apple cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>İlk Fotoğrafı Yükle</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {recentPhotos.map((photo) => {
              const imgUrl =
                (photo.thumbnail_path && thumbUrls[photo.thumbnail_path]) ||
                thumbUrls[photo.storage_path];
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onSelectTab("fotograflar")}
                  className="group text-left focus:outline-none cursor-pointer"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#343438]/70 bg-[#18181B]">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={photo.title || "Fotoğraf"}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="h-full w-full animate-pulse bg-[#222226]" />
                    )}
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-medium text-[#F5F5F7] truncate">
                      {photo.title || "Adsız Fotoğraf"}
                    </span>
                    <span className="text-[12px] text-[#A1A1A6] shrink-0 tabular-nums">
                      {photo.memory_date || photo.created_at.slice(0, 10)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Birlikte Geçen Günler — Real Timezone-Safe Counter & Milestones */}
      <section aria-label="Birlikte Geçen Günler">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-[#F5F5F7]">
              Birlikte Geçen Günler
            </h2>
            <p className="text-[13px] text-[#A1A1A6] mt-0.5">
              {daysTogether !== null && couple?.relationship_start_date
                ? `${formatTurkishDate(couple.relationship_start_date)} tarihinden beri ${daysTogether.toLocaleString("tr-TR")} gün`
                : "Özel günlerinizi ve yıl dönümlerinizi takip edin"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onSelectTab("ozel-gunler")}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[#A1A1A6] hover:text-[#F5F5F7] transition-apple cursor-pointer"
          >
            <span>Özel Günler ({specialDates.length})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {upcomingDates.length === 0 ? (
          <div className="rounded-2xl border border-[#343438]/70 bg-[#18181B] px-6 py-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[15px] font-medium text-[#F5F5F7]">
                Henüz özel bir tarih eklemediniz.
              </p>
              <p className="text-[13px] text-[#A1A1A6] mt-0.5">
                Tanışma gününüzü, yıl dönümünüzü veya doğum günlerinizi kaydedin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab("ozel-gunler")}
              className="rounded-lg border border-[#343438] bg-[#222226] hover:bg-[#343438] px-4 py-2 text-[13px] font-medium text-[#F5F5F7] shrink-0 transition-apple cursor-pointer"
            >
              Özel Gün Ekle
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#343438]/80 bg-[#18181B] divide-y sm:divide-y-0 sm:divide-x divide-[#343438]/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {upcomingDates.map((d) => {
              const info = getDaysUntilNextOccurrence(d.event_date, d.repeat_yearly);
              return (
                <div
                  key={d.id}
                  onClick={() => onSelectTab("ozel-gunler")}
                  className="p-5 sm:p-6 hover:bg-[#222226]/50 transition-apple cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[#D88A96]">
                      {formatTurkishDate(d.event_date)}
                    </span>
                    <span className="text-[11px] text-[#A1A1A6] tabular-nums">
                      {info.isToday
                        ? "Bugün"
                        : info.isPastOneTime
                        ? `${info.daysRemaining} gün önce`
                        : `${info.daysRemaining} gün kaldı`}
                    </span>
                  </div>
                  <div className="mt-3">
                    <h3 className="text-[16px] font-semibold text-[#F5F5F7] tracking-[-0.01em] truncate">
                      {d.title}
                    </h3>
                    {d.description && (
                      <p className="mt-1 text-[13px] leading-relaxed text-[#A1A1A6] line-clamp-2">
                        {d.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Videolarımız & 4. Bizim Şarkılarımız — Real Split Media Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section aria-label="Videolarımız" className="lg:col-span-7">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-[#F5F5F7]">
                Videolarımız
              </h2>
              <p className="text-[13px] text-[#A1A1A6] mt-0.5">
                Hareketli anılar ve kısa kayıtlar
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab("videolar")}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-[#A1A1A6] hover:text-[#F5F5F7] transition-apple cursor-pointer"
            >
              <span>{videos.length} Video</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {recentVideos.length === 0 ? (
            <div className="rounded-xl border border-[#343438]/70 bg-[#18181B] px-6 py-10 text-center">
              <p className="text-[14px] font-medium text-[#F5F5F7]">
                Henüz video yüklemediniz.
              </p>
              <button
                type="button"
                onClick={() => onSelectTab("videolar")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#343438] bg-[#222226] hover:bg-[#343438] px-3.5 py-2 text-[12px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Video Ekle</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {recentVideos.map((vid) => {
                const thumb = vid.thumbnail_path ? thumbUrls[vid.thumbnail_path] : null;
                return (
                  <button
                    key={vid.id}
                    type="button"
                    onClick={() => onSelectTab("videolar")}
                    className="group text-left focus:outline-none cursor-pointer"
                  >
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[#343438]/70 bg-[#18181B]">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={vid.title || "Video"}
                          loading="lazy"
                          className="h-full w-full object-cover opacity-90 transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="h-full w-full bg-[#222226]" />
                      )}
                      <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-apple flex items-center justify-center">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#101012]/80 border border-[#F5F5F7]/20 text-[#F5F5F7]">
                          <Play className="h-3.5 w-3.5 fill-[#F5F5F7] ml-0.5" />
                        </div>
                      </div>
                      <span className="absolute bottom-2 right-2 rounded bg-[#101012]/85 px-1.5 py-0.5 text-[11px] font-medium text-[#F5F5F7] tabular-nums">
                        {formatDuration(vid.duration)}
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <div className="text-[15px] font-medium text-[#F5F5F7] truncate">
                        {vid.title || "Video"}
                      </div>
                      <div className="text-[12px] text-[#A1A1A6] mt-0.5">
                        {vid.memory_date || vid.created_at.slice(0, 10)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section aria-label="Bizim Şarkılarımız" className="lg:col-span-5">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-[#F5F5F7]">
                Bizim Şarkılarımız
              </h2>
              <p className="text-[13px] text-[#A1A1A6] mt-0.5">
                Anılarınıza eşlik eden ses arşivi
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab("muzik")}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-[#A1A1A6] hover:text-[#F5F5F7] transition-apple cursor-pointer"
            >
              <span>{tracks.length} Şarkı</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {recentTracks.length === 0 ? (
            <div className="rounded-xl border border-[#343438]/70 bg-[#18181B] px-6 py-10 text-center">
              <Music className="h-5 w-5 text-[#A1A1A6] mx-auto mb-2" />
              <p className="text-[14px] font-medium text-[#F5F5F7]">
                Birlikte dinlediğiniz ilk şarkıyı ekleyin.
              </p>
              <button
                type="button"
                onClick={() => onSelectTab("muzik")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#343438] bg-[#222226] hover:bg-[#343438] px-3.5 py-2 text-[12px] font-medium text-[#F5F5F7] transition-apple cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Müzik Yükle</span>
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-[#343438]/80 bg-[#18181B] divide-y divide-[#343438]/50 overflow-hidden">
              {recentTracks.map((song, i) => {
                const isCurrent = currentTrack?.id === song.id;
                return (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => void playTrack(song)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#222226] transition-apple cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span
                        className={`text-[12px] font-medium tabular-nums w-5 ${
                          isCurrent ? "text-[#D88A96]" : "text-[#A1A1A6]"
                        }`}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div
                          className={`text-[14px] font-medium truncate ${
                            isCurrent ? "text-[#D88A96]" : "text-[#F5F5F7]"
                          }`}
                        >
                          {song.title || song.original_filename || "Şarkı"}
                          {isCurrent && isPlaying ? " • Çalıyor" : ""}
                        </div>
                        <div className="text-[12px] text-[#A1A1A6] truncate">
                          {song.description || "Ortak müzik arşivimiz"}
                        </div>
                      </div>
                    </div>
                    <span className="text-[12px] text-[#A1A1A6] tabular-nums ml-3 shrink-0">
                      {formatDuration(song.duration)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
