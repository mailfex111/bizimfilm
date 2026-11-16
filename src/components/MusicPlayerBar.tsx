"use client";

import React, { useState } from "react";
import {
  Heart,
  Shuffle,
  SkipBack,
  Pause,
  Play,
  SkipForward,
  Repeat,
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

  return (
    <footer
      aria-label="Müzik Oynatıcı"
      className="fixed bottom-0 inset-x-0 z-40 h-[66px] sm:h-[70px] bg-gradient-to-r from-[#2b0c14] via-[#3a111c] to-[#270b12] border-t border-rose-200/15 px-3 sm:px-6 lg:px-10 shadow-[0_-10px_35px_rgba(0,0,0,0.75)] flex items-center justify-between gap-3"
    >
      {/* Left: Album Art + Track Info */}
      <div className="flex items-center gap-3 min-w-0 w-[32%] sm:w-[26%]">
        <img
          src="/images/album-art.webp"
          alt="Bizim Şarkımız kapak görseli"
          width={44}
          height={44}
          className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg object-cover border border-rose-200/20 shadow-md shrink-0"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-white truncate">
            <span className="truncate">
              {currentCouple?.songTitle || "Bizim Şarkımız"}
            </span>
            <Heart className="h-3.5 w-3.5 text-rose-200/90 shrink-0" />
          </div>
          <p className="text-[10px] sm:text-[11px] text-rose-100/65 truncate">
            {currentCouple?.songSubtitle || "Sana Özel Çalma Listesi"}
          </p>
        </div>
      </div>

      {/* Center: Transport Controls + Seek Bar */}
      <div className="flex flex-col items-center justify-center flex-1 max-w-xl">
        <div className="flex items-center gap-4 sm:gap-5 mb-1">
          <button
            type="button"
            aria-label="Karıştır (Demo)"
            onClick={() => onSelectTab("muzik")}
            className="text-rose-200/75 hover:text-white transition cursor-pointer inline-flex"
          >
            <Shuffle className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            aria-label="Önceki Şarkı (Demo)"
            onClick={() => setProgressPct(15)}
            className="text-white/90 hover:text-white transition cursor-pointer"
          >
            <SkipBack className="h-4 w-4 fill-white" />
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying((prev) => !prev)}
            aria-label={isPlaying ? "Duraklat (Görsel Demo)" : "Oynat (Görsel Demo)"}
            title="Görsel Demo Oynatıcı"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f27c90] hover:bg-[#f78da0] text-[#280910] shadow-[0_0_16px_rgba(242,124,144,0.55)] transition cursor-pointer"
          >
            {isPlaying ? (
              <Play className="h-4 w-4 fill-[#280910] ml-0.5" />
            ) : (
              <Pause className="h-4 w-4 fill-[#280910]" />
            )}
          </button>

          <button
            type="button"
            aria-label="Sonraki Şarkı (Demo)"
            onClick={() => setProgressPct(62)}
            className="text-white/90 hover:text-white transition cursor-pointer"
          >
            <SkipForward className="h-4 w-4 fill-white" />
          </button>

          <button
            type="button"
            aria-label="Tekrarla (Demo)"
            onClick={() => onSelectTab("muzik")}
            className="text-rose-200/75 hover:text-white transition cursor-pointer inline-flex"
          >
            <Repeat className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Seek Progress Bar matching 1:24 — 3:56 */}
        <div className="flex items-center gap-2.5 w-full max-w-[440px]">
          <span className="text-[10px] sm:text-[11px] font-medium text-rose-100/75 tabular-nums">
            1:24
          </span>
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.min(
                100,
                Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * 100))
              );
              setProgressPct(pct);
            }}
            className="relative h-1 flex-1 rounded-full bg-white/20 cursor-pointer"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#e85d75] to-[#f58fa0]"
              style={{ width: `${progressPct}%` }}
            />
            <span
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]"
              style={{ left: `${progressPct}%` }}
            />
          </div>
          <span className="text-[10px] sm:text-[11px] font-medium text-rose-100/75 tabular-nums">
            3:56
          </span>
        </div>
      </div>

      {/* Right: Volume Slider + Queue Icon */}
      <div className="hidden sm:flex items-center justify-end gap-3 w-[26%]">
        <Volume2 className="h-4 w-4 text-rose-100/80 shrink-0" />
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.min(
              100,
              Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * 100))
            );
            setVolumePct(pct);
          }}
          className="relative h-1 w-20 md:w-24 rounded-full bg-white/20 cursor-pointer"
        >
          <div
            className="h-full rounded-full bg-[#f27c90]"
            style={{ width: `${volumePct}%` }}
          />
          <span
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-white shadow"
            style={{ left: `${volumePct}%` }}
          />
        </div>
        <button
          type="button"
          onClick={() => onSelectTab("muzik")}
          aria-label="Çalma Listesi"
          title="Müzik Listemiz"
          className="text-rose-100/80 hover:text-white p-1 transition cursor-pointer"
        >
          <ListMusic className="h-4 w-4" />
        </button>
      </div>
    </footer>
  );
}
