"use client";

import React, { useRef, useState } from "react";
import {
  Upload,
  Play,
  Pause,
  Trash2,
  Star,
  Clock,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Check,
  Music,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/mediaOptimizer";
import { deleteCoupleMedia, uploadCoupleMedia } from "@/lib/storage";
import { type MediaItem, type Playlist } from "@/types";

interface MusicViewProps {
  coupleId: string;
  tracks: MediaItem[];
  playlists: Playlist[];
  onTracksChange: () => Promise<void>;
}

export default function MusicView({
  coupleId,
  tracks,
  playlists,
  onTracksChange,
}: MusicViewProps) {
  const { couple, preferences, refreshAccount, refreshStorage, updatePreferences } =
    useAuth();
  const { currentTrack, isPlaying, playTrack, togglePlayPause } = useAudioPlayer();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((prev) => (prev === msg ? null : prev)), 3600);
  };

  const handleUploadAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setError(null);

    if (!rightsConfirmed) {
      setError("Lütfen ses dosyasını yükleme hakkına sahip olduğunuzu onaylayın.");
      return;
    }

    setUploading(true);
    setUploadProgress(5);

    try {
      const uploaded = await uploadCoupleMedia({
        coupleId,
        file,
        mediaType: "audio",
        title: file.name.replace(/\.[^.]+$/, ""),
        onProgress: (pct) => setUploadProgress(pct),
      });

      // Add to default playlist automatically if one exists
      const defaultPlaylist = playlists.find((p) => p.is_default) || playlists[0];
      if (defaultPlaylist) {
        const supabase = createClient();
        await supabase.from("playlist_tracks").insert({
          playlist_id: defaultPlaylist.id,
          couple_id: coupleId,
          media_id: uploaded.id,
          track_order: tracks.length,
        });
      }

      await Promise.all([onTracksChange(), refreshStorage()]);
      showToast(`"${uploaded.title}" müzik listenize eklendi.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ses dosyası yüklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  const handleSetDefaultEntranceSong = async (track: MediaItem) => {
    const supabase = createClient();
    const nextId = couple?.default_track_media_id === track.id ? null : track.id;
    const { error: err } = await supabase
      .from("couples")
      .update({ default_track_media_id: nextId })
      .eq("id", coupleId);

    if (err) {
      setError(err.message);
      return;
    }
    await refreshAccount();
    showToast(
      nextId
        ? `"${track.title}" giriş şarkınız olarak belirlendi.`
        : "Varsayılan giriş şarkısı kaldırıldı."
    );
  };

  const handleDeleteTrack = async (track: MediaItem) => {
    try {
      await deleteCoupleMedia(track.id);
      await Promise.all([onTracksChange(), refreshStorage(), refreshAccount()]);
      showToast(`"${track.title}" silindi.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Şarkı silinemedi.");
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistTitle.trim()) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("playlists").insert({
      couple_id: coupleId,
      title: newPlaylistTitle.trim(),
      is_default: playlists.length === 0,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setNewPlaylistTitle("");
    await onTracksChange();
    showToast("Yeni çalma listesi oluşturuldu.");
  };

  const handleMoveTrack = async (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= tracks.length) return;
    const defaultPlaylist = playlists.find((p) => p.is_default) || playlists[0];
    if (!defaultPlaylist) return;

    const reordered = [...tracks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);

    const supabase = createClient();
    await Promise.all(
      reordered.map((t, order) =>
        supabase
          .from("playlist_tracks")
          .upsert(
            {
              playlist_id: defaultPlaylist.id,
              couple_id: coupleId,
              media_id: t.id,
              track_order: order,
            },
            { onConflict: "playlist_id,media_id" }
          )
      )
    );
    await onTracksChange();
  };

  return (
    <section className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10 py-8 pb-28">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Sidebar: Playlist Info, Entrance Autoplay & Upload */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-2xl border border-[#343438] bg-[#18181B] p-6">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#D88A96]">
              Ortak Müzik Arşivi
            </span>
            <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[#F5F5F7]">
              Bizim Şarkılarımız
            </h1>
            <p className="mt-1 text-[13px] text-[#A1A1A6]">
              {tracks.length} şarkı • Sayfalar arası geçişte kesintisiz çalar
            </p>

            {/* Entrance Autoplay Preference */}
            <div className="mt-5 pt-4 border-t border-[#343438]/70 flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium text-[#F5F5F7]">
                  Girişte müziği başlat
                </div>
                <p className="text-[11px] text-[#A1A1A6]">
                  Varsayılan şarkıyı otomatik oynatmayı dener
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(preferences?.autoplay_music)}
                onClick={() =>
                  void updatePreferences({
                    autoplay_music: !preferences?.autoplay_music,
                  })
                }
                className={`relative h-6 w-11 rounded-full transition-apple cursor-pointer ${
                  preferences?.autoplay_music ? "bg-[#D88A96]" : "bg-[#343438]"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[#F5F5F7] transition-transform ${
                    preferences?.autoplay_music ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Audio Upload with Rights Confirmation */}
            <div className="mt-5 pt-4 border-t border-[#343438]/70 space-y-3">
              <label className="flex items-start gap-2.5 text-[12px] text-[#A1A1A6] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rightsConfirmed}
                  onChange={(e) => setRightsConfirmed(e.target.checked)}
                  className="mt-0.5 accent-[#D88A96]"
                />
                <span>
                  Yükleyeceğim ses dosyasının kullanım hakkına sahip olduğumu onaylıyorum (MP3, M4A, WAV, OGG — maks. 25 MB).
                </span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,audio/webm,.mp3,.m4a,.wav,.ogg"
                onChange={handleUploadAudio}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploading || !rightsConfirmed}
                onClick={() => fileInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#F5F5F7] hover:bg-white py-2.5 text-[13px] font-medium text-[#101012] transition-apple cursor-pointer disabled:opacity-40"
              >
                <Upload className="h-4 w-4" />
                <span>
                  {uploading ? `Yükleniyor (%${uploadProgress})` : "Ses Dosyası Yükle"}
                </span>
              </button>
            </div>
          </div>

          {/* Playlists List */}
          <div className="rounded-2xl border border-[#343438] bg-[#18181B] p-5">
            <h2 className="text-[14px] font-semibold text-[#F5F5F7] mb-3">
              Çalma Listeleri ({playlists.length})
            </h2>
            <div className="space-y-1.5 mb-3">
              {playlists.map((pl) => (
                <div
                  key={pl.id}
                  className="flex items-center justify-between rounded-lg bg-[#101012] px-3 py-2 text-[13px] text-[#F5F5F7]"
                >
                  <span className="truncate">{pl.title}</span>
                  {pl.is_default && (
                    <span className="text-[11px] text-[#D88A96]">Varsayılan</span>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={handleCreatePlaylist} className="flex gap-2">
              <input
                type="text"
                value={newPlaylistTitle}
                onChange={(e) => setNewPlaylistTitle(e.target.value)}
                placeholder="Yeni liste adı..."
                className="flex-1 rounded-lg border border-[#343438] bg-[#101012] px-3 py-1.5 text-[12px] text-[#F5F5F7] focus:border-[#D88A96] focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg border border-[#343438] bg-[#222226] hover:bg-[#343438] px-3 py-1.5 text-[12px] font-medium text-[#F5F5F7] cursor-pointer"
              >
                Ekle
              </button>
            </form>
          </div>
        </div>

        {/* Right Tracklist Table */}
        <div className="lg:col-span-8 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-[#D88A96]/40 bg-[#18181B] px-4 py-3 text-[13px] text-[#F5F5F7]">
              <AlertCircle className="h-4 w-4 text-[#D88A96] shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {toast && (
            <div className="flex items-center gap-2 rounded-lg border border-[#343438] bg-[#18181B] px-4 py-3 text-[13px] text-[#F5F5F7]">
              <Check className="h-4 w-4 text-[#D88A96] shrink-0" />
              <span>{toast}</span>
            </div>
          )}

          <div className="rounded-2xl border border-[#343438] bg-[#18181B] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#343438]/70 flex items-center justify-between text-[12px] font-medium text-[#A1A1A6]">
              <span># Parça</span>
              <Clock className="h-3.5 w-3.5" />
            </div>

            {tracks.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <Music className="h-6 w-6 text-[#A1A1A6] mx-auto mb-2.5" />
                <p className="text-[16px] font-medium text-[#F5F5F7]">
                  Birlikte dinlediğiniz ilk şarkıyı ekleyin.
                </p>
                <p className="mt-1 text-[13px] text-[#A1A1A6]">
                  Sol panelden kullanım hakkına sahip olduğunuz ses dosyalarını yükleyip çalabilirsiniz.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#343438]/50">
                {tracks.map((track, idx) => {
                  const isCurrent = currentTrack?.id === track.id;
                  const isEntrance = couple?.default_track_media_id === track.id;

                  return (
                    <div
                      key={track.id}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-[#222226] transition-apple gap-3"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() =>
                            isCurrent ? void togglePlayPause() : void playTrack(track)
                          }
                          aria-label={isCurrent && isPlaying ? "Duraklat" : "Oynat"}
                          className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 transition-apple cursor-pointer ${
                            isCurrent
                              ? "bg-[#D88A96] text-[#101012]"
                              : "bg-[#222226] text-[#F5F5F7] hover:bg-[#F5F5F7] hover:text-[#101012]"
                          }`}
                        >
                          {isCurrent && isPlaying ? (
                            <Pause className="h-3.5 w-3.5 fill-current" />
                          ) : (
                            <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <div
                            className={`text-[14px] font-medium truncate ${
                              isCurrent ? "text-[#D88A96]" : "text-[#F5F5F7]"
                            }`}
                          >
                            {track.title || track.original_filename || "Şarkı"}
                          </div>
                          <div className="text-[12px] text-[#A1A1A6] truncate">
                            {isEntrance ? "Giriş şarkınız • " : ""}
                            {track.created_at.slice(0, 10)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => void handleMoveTrack(idx, "up")}
                          title="Yukarı taşı"
                          className="rounded p-1.5 text-[#A1A1A6] hover:text-[#F5F5F7] disabled:opacity-25 cursor-pointer"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === tracks.length - 1}
                          onClick={() => void handleMoveTrack(idx, "down")}
                          title="Aşağı taşı"
                          className="rounded p-1.5 text-[#A1A1A6] hover:text-[#F5F5F7] disabled:opacity-25 cursor-pointer"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSetDefaultEntranceSong(track)}
                          title="Varsayılan giriş şarkısı yap"
                          className={`rounded p-1.5 transition-apple cursor-pointer ${
                            isEntrance
                              ? "text-[#D88A96]"
                              : "text-[#A1A1A6] hover:text-[#F5F5F7]"
                          }`}
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${isEntrance ? "fill-[#D88A96]" : ""}`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteTrack(track)}
                          title="Şarkıyı sil"
                          className="rounded p-1.5 text-[#A1A1A6] hover:text-[#D88A96] cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[12px] text-[#A1A1A6] tabular-nums w-11 text-right">
                          {formatDuration(track.duration)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
