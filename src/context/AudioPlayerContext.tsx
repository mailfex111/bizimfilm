"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { getSignedUrl } from "@/lib/storage";
import { type MediaItem } from "@/types";

export type RepeatMode = "off" | "all" | "one";

interface AudioPlayerContextValue {
  queue: MediaItem[];
  currentTrack: MediaItem | null;
  currentIndex: number;
  isPlaying: boolean;
  isLoadingTrack: boolean;
  autoplayBlocked: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  setQueueTracks: (tracks: MediaItem[], defaultTrackId?: string | null) => void;
  playTrack: (track: MediaItem) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  resumeBlockedAutoplay: () => Promise<void>;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | undefined>(undefined);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const { preferences, updatePreferences } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoplayAttemptedRef = useRef<string | null>(null);

  const [queue, setQueue] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [localVolume, setLocalVolume] = useState<number | null>(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");

  const volume =
    localVolume ??
    (preferences && typeof preferences.music_volume === "number"
      ? Math.min(1, Math.max(0, Number(preferences.music_volume)))
      : 0.75);

  const currentTrack =
    currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

  // Initialize singleton HTMLAudioElement once on client
  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = volume;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep external HTMLAudioElement volume synchronized with derived volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const loadAndPlayIndex = useCallback(
    async (tracks: MediaItem[], idx: number, isAutoplay = false) => {
      const audio = audioRef.current;
      const track = tracks[idx];
      if (!audio || !track) return;

      setCurrentIndex(idx);
      setIsLoadingTrack(true);
      setAutoplayBlocked(false);

      try {
        const signedUrl = await getSignedUrl("couple-music", track.storage_path);
        if (!signedUrl) {
          setIsPlaying(false);
          return;
        }
        if (audio.src !== signedUrl) {
          audio.src = signedUrl;
        }
        setDuration(track.duration || 0);
        setCurrentTime(0);

        try {
          await audio.play();
          setIsPlaying(true);
          setAutoplayBlocked(false);
        } catch (playErr) {
          setIsPlaying(false);
          if (isAutoplay) {
            setAutoplayBlocked(true);
          } else {
            console.warn("Audio playback blocked:", playErr);
          }
        }
      } finally {
        setIsLoadingTrack(false);
      }
    },
    []
  );

  const nextTrack = useCallback(async () => {
    if (queue.length === 0) return;
    let nextIdx: number;
    if (shuffle && queue.length > 1) {
      do {
        nextIdx = Math.floor(Math.random() * queue.length);
      } while (nextIdx === currentIndex);
    } else {
      nextIdx = currentIndex + 1;
      if (nextIdx >= queue.length) {
        if (repeatMode === "all") {
          nextIdx = 0;
        } else {
          setIsPlaying(false);
          return;
        }
      }
    }
    await loadAndPlayIndex(queue, nextIdx, false);
  }, [queue, shuffle, currentIndex, repeatMode, loadAndPlayIndex]);

  const prevTrack = useCallback(async () => {
    if (queue.length === 0) return;
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    const prevIdx = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
    await loadAndPlayIndex(queue, prevIdx, false);
  }, [queue, currentIndex, loadAndPlayIndex]);

  // Attach HTMLAudioElement event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      if (repeatMode === "one") {
        audio.currentTime = 0;
        void audio.play().catch(() => {});
      } else {
        void nextTrack();
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [repeatMode, nextTrack]);

  const setQueueTracks = useCallback(
    (tracks: MediaItem[], defaultTrackId?: string | null) => {
      setQueue(tracks);
      if (tracks.length === 0) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
        setCurrentIndex(-1);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        return;
      }

      // Preserve currently playing track index if it still exists
      if (currentTrack) {
        const stillIdx = tracks.findIndex((t) => t.id === currentTrack.id);
        if (stillIdx >= 0) {
          setCurrentIndex(stillIdx);
          return;
        }
      }

      const preferredIdx = defaultTrackId
        ? tracks.findIndex((t) => t.id === defaultTrackId)
        : 0;
      const targetIdx = preferredIdx >= 0 ? preferredIdx : 0;
      setCurrentIndex(targetIdx);
      setDuration(tracks[targetIdx]?.duration || 0);

      // Attempt entrance song autoplay once per track if user enabled autoplay_music
      const autoplayKey = `${tracks[targetIdx].id}:${preferences?.autoplay_music}`;
      if (
        preferences?.autoplay_music &&
        autoplayAttemptedRef.current !== autoplayKey
      ) {
        autoplayAttemptedRef.current = autoplayKey;
        void loadAndPlayIndex(tracks, targetIdx, true);
      }
    },
    [currentTrack, preferences?.autoplay_music, loadAndPlayIndex]
  );

  const playTrack = useCallback(
    async (track: MediaItem) => {
      const idx = queue.findIndex((t) => t.id === track.id);
      if (idx >= 0) {
        await loadAndPlayIndex(queue, idx, false);
      } else {
        const nextQueue = [track, ...queue];
        setQueue(nextQueue);
        await loadAndPlayIndex(nextQueue, 0, false);
      }
    },
    [queue, loadAndPlayIndex]
  );

  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || queue.length === 0) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    if (!audio.src && currentIndex >= 0) {
      await loadAndPlayIndex(queue, currentIndex, false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
      setAutoplayBlocked(false);
    } catch {
      if (currentIndex >= 0) {
        await loadAndPlayIndex(queue, currentIndex, false);
      }
    }
  }, [isPlaying, queue, currentIndex, loadAndPlayIndex]);

  const resumeBlockedAutoplay = useCallback(async () => {
    setAutoplayBlocked(false);
    await togglePlayPause();
  }, [togglePlayPause]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
    setCurrentTime(audio.currentTime);
  }, []);

  const setVolume = useCallback(
    (vol: number) => {
      const clamped = Math.min(1, Math.max(0, vol));
      setLocalVolume(clamped);
      if (audioRef.current) {
        audioRef.current.volume = clamped;
      }
      void updatePreferences({ music_volume: Number(clamped.toFixed(2)) });
    },
    [updatePreferences]
  );

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => !prev);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((prev) =>
      prev === "off" ? "all" : prev === "all" ? "one" : "off"
    );
  }, []);

  return (
    <AudioPlayerContext.Provider
      value={{
        queue,
        currentTrack,
        currentIndex,
        isPlaying,
        isLoadingTrack,
        autoplayBlocked,
        currentTime,
        duration,
        volume,
        shuffle,
        repeatMode,
        setQueueTracks,
        playTrack,
        togglePlayPause,
        nextTrack,
        prevTrack,
        seekTo,
        setVolume,
        toggleShuffle,
        cycleRepeat,
        resumeBlockedAutoplay,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer(): AudioPlayerContextValue {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) {
    throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  }
  return ctx;
}
