"use client";

import React from "react";
import {
  SkipBack,
  Pause,
  Play,
  SkipForward,
  Volume2,
  ListMusic,
  Shuffle,
  Repeat,
  Repeat1,
  Music,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { formatDuration } from "@/lib/mediaOptimizer";
import { type NavTab } from "@/types";

interface MusicPlayerBarProps {
  onSelectTab: (tab: NavTab) => void;
}

export default function MusicPlayerBar({ onSelectTab }: MusicPlayerBarProps) {
  const { couple } = useAuth();
  const {
    queue,
    currentTrack,
    isPlaying,
    isLoadingTrack,
    autoplayBlocked,
    currentTime,
    duration,
    volume,
    shuffle,
    repeatMode,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seekTo,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    resumeBlockedAutoplay,
  } = useAudioPlayer();

  const progressPct =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <footer
      aria-label="Müzik Oynatıcı"
      className="fixed bottom-0 inset-x-0 z-40 h-16 bg-[#18181B]/95 backdrop-blur-md border-t border-[#343438] px-4 sm:px-6 lg:px-10 flex items-center justify-between gap-4"
    >
      {/* Left: Track Info or Empty Prompt */}
      <div className="flex items-center gap-3 min-w-0 w-[36%] sm:w-[28%]">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#343438] bg-[#222226] text-[#D88A96] shrink-0">
          <Music className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          {currentTrack ? (
            <>
              <div className="text-[13px] font-medium text-[#F5F5F7] truncate">
                {currentTrack.title || currentTrack.original_filename || "Şarkı"}
              </div>
              <p className="text-[11px] text-[#A1A1A6] truncate">
                {couple?.couple_name || "Ortak Çalma Listesi"}
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSelectTab("muzik")}
              className="text-left focus:outline-none cursor-pointer"
            >
              <div className="text-[13px] font-medium text-[#F5F5F7] hover:text-[#D88A96] transition-apple truncate">
                İlk şarkınızı ekleyin
              </div>
              <p className="text-[11px] text-[#A1A1A6] truncate">
                Henüz müzik yüklenmedi
              </p>
            </button>
          )}
        </div>
      </div>

      {/* Center: Working Audio Controls + Real Seek Bar */}
      <div className="flex flex-col items-center justify-center flex-1 max-w-lg">
        {autoplayBlocked ? (
          <button
            type="button"
            onClick={() => void resumeBlockedAutoplay()}
            className="inline-flex items-center gap-2 rounded-full bg-[#F5F5F7] hover:bg-white px-4 py-1.5 text-[12px] font-medium text-[#101012] transition-apple cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 fill-[#101012]" />
            <span>Müziği başlat</span>
          </button>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-1">
              <button
                type="button"
                aria-label="Karışık oynat"
                onClick={toggleShuffle}
                className={`hidden sm:inline-flex transition-apple cursor-pointer ${
                  shuffle ? "text-[#D88A96]" : "text-[#A1A1A6] hover:text-[#F5F5F7]"
                }`}
              >
                <Shuffle className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                aria-label="Önceki şarkı"
                disabled={queue.length === 0}
                onClick={() => void prevTrack()}
                className="text-[#A1A1A6] hover:text-[#F5F5F7] disabled:opacity-35 transition-apple cursor-pointer"
              >
                <SkipBack className="h-3.5 w-3.5 fill-current" />
              </button>

              <button
                type="button"
                disabled={queue.length === 0 || isLoadingTrack}
                onClick={() => void togglePlayPause()}
                aria-label={isPlaying ? "Duraklat" : "Oynat"}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F5F5F7] hover:bg-white text-[#101012] disabled:opacity-40 transition-apple cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5 fill-[#101012]" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-[#101012] ml-0.5" />
                )}
              </button>

              <button
                type="button"
                aria-label="Sonraki şarkı"
                disabled={queue.length === 0}
                onClick={() => void nextTrack()}
                className="text-[#A1A1A6] hover:text-[#F5F5F7] disabled:opacity-35 transition-apple cursor-pointer"
              >
                <SkipForward className="h-3.5 w-3.5 fill-current" />
              </button>

              <button
                type="button"
                aria-label="Tekrar modu"
                onClick={cycleRepeat}
                className={`hidden sm:inline-flex transition-apple cursor-pointer ${
                  repeatMode !== "off"
                    ? "text-[#D88A96]"
                    : "text-[#A1A1A6] hover:text-[#F5F5F7]"
                }`}
              >
                {repeatMode === "one" ? (
                  <Repeat1 className="h-3.5 w-3.5" />
                ) : (
                  <Repeat className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2.5 w-full max-w-[400px]">
              <span className="text-[11px] text-[#A1A1A6] tabular-nums">
                {formatDuration(currentTime)}
              </span>
              <div
                onClick={(e) => {
                  if (duration <= 0) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.min(
                    1,
                    Math.max(0, (e.clientX - rect.left) / rect.width)
                  );
                  seekTo(ratio * duration);
                }}
                className="group relative h-1 flex-1 rounded-full bg-[#343438] cursor-pointer"
              >
                <div
                  className="h-full rounded-full bg-[#D88A96]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-[11px] text-[#A1A1A6] tabular-nums">
                {formatDuration(duration)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right: Volume Slider + Queue Link */}
      <div className="hidden sm:flex items-center justify-end gap-3 w-[28%]">
        <Volume2 className="h-4 w-4 text-[#A1A1A6] shrink-0" />
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.min(
              1,
              Math.max(0, (e.clientX - rect.left) / rect.width)
            );
            setVolume(ratio);
          }}
          className="relative h-1 w-20 rounded-full bg-[#343438] cursor-pointer"
        >
          <div
            className="h-full rounded-full bg-[#F5F5F7]"
            style={{ width: `${Math.round(volume * 100)}%` }}
          />
        </div>
        <button
          type="button"
          onClick={() => onSelectTab("muzik")}
          aria-label="Müzik Listesi"
          title="Müzik Listesi"
          className="text-[#A1A1A6] hover:text-[#F5F5F7] p-1.5 rounded-lg hover:bg-[#222226] transition-apple cursor-pointer"
        >
          <ListMusic className="h-4 w-4" />
        </button>
      </div>
    </footer>
  );
}
