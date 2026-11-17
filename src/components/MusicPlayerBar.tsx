"use client";

import React, { useState } from "react";
import {
  SkipBack,
  Pause,
  Play,
  SkipForward,
  Volume2,
  ListMusic,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { type NavTab } from "@/types";

interface MusicPlayerBarProps {
  onSelectTab: (tab: NavTab) => void;
}

export default function MusicPlayerBar({ onSelectTab }: MusicPlayerBarProps) {
  const { currentCouple } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressPct, setProgressPct] = useState(36);
  const [volumePct, setVolumePct] = useState(78);

  const artistSubtitle = currentCouple
    ? `${currentCouple.partner1Name} & ${currentCouple.partner2Name} Seçkisi`
    : "Özel Çalma Listesi";

  return (
    <footer
      aria-label="Müzik Oynatıcı"
      className="fixed bottom-0 inset-x-0 z-40 h-16 bg-[#18181B]/95 backdrop-blur-md border-t border-[#343438] px-4 sm:px-6 lg:px-10 flex items-center justify-between gap-4"
    >
      {/* Left: Album Art + Track Title & Artist */}
      <div className="flex items-center gap-3 min-w-0 w-[34%] sm:w-[28%]">
        <img
          src="/images/album-art.webp"
          alt="Albüm kapağı"
          width={40}
          height={40}
          className="h-10 w-10 rounded-md object-cover border border-[#343438] shrink-0"
        />
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-[#F5F5F7] truncate">
            {currentCouple?.songTitle || "Bizim Şarkımız"}
          </div>
          <p className="text-[11px] text-[#A1A1A6] truncate">{artistSubtitle}</p>
        </div>
      </div>

      {/* Center: Compact Spotify-Style Transport + Progress Bar */}
      <div className="flex flex-col items-center justify-center flex-1 max-w-lg">
        <div className="flex items-center gap-5 mb-1">
          <button
            type="button"
            aria-label="Önceki"
            onClick={() => setProgressPct(12)}
            className="text-[#A1A1A6] hover:text-[#F5F5F7] transition-apple cursor-pointer"
          >
            <SkipBack className="h-3.5 w-3.5 fill-current" />
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying((prev) => !prev)}
            aria-label={isPlaying ? "Duraklat" : "Oynat"}
            title="Görsel Önizleme Oynatıcısı"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F5F5F7] hover:bg-white text-[#101012] transition-apple cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-[#101012]" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-[#101012] ml-0.5" />
            )}
          </button>

          <button
            type="button"
            aria-label="Sonraki"
            onClick={() => setProgressPct(68)}
            className="text-[#A1A1A6] hover:text-[#F5F5F7] transition-apple cursor-pointer"
          >
            <SkipForward className="h-3.5 w-3.5 fill-current" />
          </button>
        </div>

        <div className="flex items-center gap-2.5 w-full max-w-[400px]">
          <span className="text-[11px] text-[#A1A1A6] tabular-nums">1:24</span>
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.min(
                100,
                Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * 100))
              );
              setProgressPct(pct);
            }}
            className="group relative h-1 flex-1 rounded-full bg-[#343438] cursor-pointer"
          >
            <div
              className="h-full rounded-full bg-[#D88A96]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[11px] text-[#A1A1A6] tabular-nums">3:56</span>
        </div>
      </div>

      {/* Right: Volume Level & Playlist Shortcut */}
      <div className="hidden sm:flex items-center justify-end gap-3 w-[28%]">
        <Volume2 className="h-4 w-4 text-[#A1A1A6] shrink-0" />
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.min(
              100,
              Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * 100))
            );
            setVolumePct(pct);
          }}
          className="relative h-1 w-20 rounded-full bg-[#343438] cursor-pointer"
        >
          <div
            className="h-full rounded-full bg-[#F5F5F7]"
            style={{ width: `${volumePct}%` }}
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
