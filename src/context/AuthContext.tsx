"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { type User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { clearSignedUrlCache, getSignedUrl } from "@/lib/storage";
import {
  type Couple,
  type CoupleMember,
  type Profile,
  type StorageBreakdown,
  type UserPreferences,
} from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  couple: Couple | null;
  members: CoupleMember[];
  memberAvatarUrls: Record<string, string>;
  preferences: UserPreferences | null;
  storageBreakdown: StorageBreakdown | null;
  isLoading: boolean;
  schemaError: string | null;
  refreshAccount: () => Promise<void>;
  refreshStorage: () => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (params: {
    email: string;
    password: string;
    username: string;
    displayName: string;
  }) => Promise<{ ok: boolean; needsEmailVerification?: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  updateProfile: (updates: {
    display_name?: string;
    username?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  updatePreferences: (
    patch: Partial<
      Pick<
        UserPreferences,
        | "autoplay_music"
        | "music_volume"
        | "theme"
        | "notification_preferences"
        | "last_open_book_id"
        | "last_open_page_order"
      >
    >
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [members, setMembers] = useState<CoupleMember[]>([]);
  const [memberAvatarUrls, setMemberAvatarUrls] = useState<Record<string, string>>({});
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [storageBreakdown, setStorageBreakdown] = useState<StorageBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const refreshStorage = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_couple_storage_breakdown");
      if (!error && Array.isArray(data) && data[0]) {
        const row = data[0];
        setStorageBreakdown({
          photos_bytes: Number(row.photos_bytes || 0),
          videos_bytes: Number(row.videos_bytes || 0),
          audio_bytes: Number(row.audio_bytes || 0),
          assets_bytes: Number(row.assets_bytes || 0),
          total_used_bytes: Number(row.total_used_bytes || 0),
          quota_bytes: Number(row.quota_bytes || 524288000),
        });
      }
    } catch {
      // Ignore if couple not yet created
    }
  }, []);

  const loadAccountContext = useCallback(
    async (activeUser: User | null) => {
      if (!activeUser) {
        setProfile(null);
        setCouple(null);
        setMembers([]);
        setMemberAvatarUrls({});
        setPreferences(null);
        setStorageBreakdown(null);
        setSchemaError(null);
        setIsLoading(false);
        return;
      }

      const supabase = createClient();
      setSchemaError(null);

      try {
        // 1. Load user's own profile & preferences
        const [profileRes, prefRes, membershipRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, username, display_name, avatar_path, created_at, updated_at")
            .eq("id", activeUser.id)
            .maybeSingle(),
          supabase
            .from("user_preferences")
            .select(
              "user_id, autoplay_music, music_volume, theme, notification_preferences, last_open_book_id, last_open_page_order, updated_at"
            )
            .eq("user_id", activeUser.id)
            .maybeSingle(),
          supabase
            .from("couple_members")
            .select("id, couple_id, user_id, role, joined_at")
            .eq("user_id", activeUser.id)
            .maybeSingle(),
        ]);

        // Detect missing migration cleanly
        const possibleErr =
          profileRes.error || prefRes.error || membershipRes.error;
        if (
          possibleErr &&
          (possibleErr.code === "42P01" ||
            possibleErr.message?.includes("does not exist") ||
            possibleErr.message?.includes("Could not find the table"))
        ) {
          setSchemaError(
            "Veritabanı tabloları Supabase projenizde henüz oluşturulmamış. Lütfen hazırlanan SQL migration dosyasını Supabase SQL Editor üzerinde çalıştırın."
          );
          setIsLoading(false);
          return;
        }

        let currentProfile = profileRes.data as Profile | null;
        if (!currentProfile) {
          const fallbackUsername = (
            (activeUser.user_metadata?.username as string) ||
            (activeUser.email?.split("@")[0] || "miora_user").replace(/[^a-zA-Z0-9._-]/g, "")
          ).slice(0, 24);
          const fallbackDisplay =
            (activeUser.user_metadata?.display_name as string) ||
            activeUser.email?.split("@")[0] ||
            "Kullanıcı";

          const { data: createdProf } = await supabase
            .from("profiles")
            .upsert({
              id: activeUser.id,
              username:
                fallbackUsername.length >= 3
                  ? fallbackUsername
                  : `user_${activeUser.id.slice(0, 6)}`,
              display_name: fallbackDisplay,
            })
            .select("id, username, display_name, avatar_path, created_at, updated_at")
            .single();
          currentProfile = createdProf as Profile | null;
        }
        setProfile(currentProfile);

        let currentPref = prefRes.data as UserPreferences | null;
        if (!currentPref) {
          const { data: createdPref } = await supabase
            .from("user_preferences")
            .upsert({ user_id: activeUser.id })
            .select(
              "user_id, autoplay_music, music_volume, theme, notification_preferences, last_open_book_id, last_open_page_order, updated_at"
            )
            .single();
          currentPref = createdPref as UserPreferences | null;
        }
        setPreferences(currentPref);

        // 2. Load couple + partner members if user belongs to a couple
        const myMembership = membershipRes.data;
        if (!myMembership?.couple_id) {
          setCouple(null);
          setMembers([]);
          setStorageBreakdown(null);
          if (currentProfile?.avatar_path) {
            const url = await getSignedUrl("avatars", currentProfile.avatar_path);
            setMemberAvatarUrls(url ? { [activeUser.id]: url } : {});
          } else {
            setMemberAvatarUrls({});
          }
          setIsLoading(false);
          return;
        }

        const [coupleRes, allMembersRes] = await Promise.all([
          supabase
            .from("couples")
            .select(
              "id, couple_name, relationship_start_date, cover_image_path, default_track_media_id, realtime_channel_epoch, created_by, created_at, updated_at"
            )
            .eq("id", myMembership.couple_id)
            .maybeSingle(),
          supabase
            .from("couple_members")
            .select("id, couple_id, user_id, role, joined_at")
            .eq("couple_id", myMembership.couple_id)
            .order("joined_at", { ascending: true }),
        ]);

        setCouple((coupleRes.data as Couple) || null);

        const rawMembers = (allMembersRes.data || []) as CoupleMember[];
        const memberUserIds = rawMembers.map((m) => m.user_id);

        let memberProfiles: Profile[] = [];
        if (memberUserIds.length > 0) {
          const { data: profRows } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_path, created_at, updated_at")
            .in("id", memberUserIds);
          memberProfiles = (profRows || []) as Profile[];
        }

        const profMap = new Map(memberProfiles.map((p) => [p.id, p]));
        const hydratedMembers = rawMembers.map((m) => ({
          ...m,
          profile: profMap.get(m.user_id) || null,
        }));
        setMembers(hydratedMembers);

        // Resolve signed URLs for partner avatars
        const avatarMap: Record<string, string> = {};
        await Promise.all(
          memberProfiles.map(async (p) => {
            if (p.avatar_path) {
              const url = await getSignedUrl("avatars", p.avatar_path);
              if (url) avatarMap[p.id] = url;
            }
          })
        );
        setMemberAvatarUrls(avatarMap);

        await refreshStorage();
      } catch (err) {
        setSchemaError(
          err instanceof Error ? err.message : "Supabase hesap bilgileri yüklenemedi."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [refreshStorage]
  );

  const refreshAccount = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user: latestUser },
    } = await supabase.auth.getUser();
    setUser(latestUser);
    await loadAccountContext(latestUser);
  }, [loadAccountContext]);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    const init = async () => {
      const {
        data: { user: initialUser },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(initialUser);
      await loadAccountContext(initialUser);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      void loadAccountContext(nextUser);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadAccountContext]);

  const signIn = async (
    identifier: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      return { ok: false, error: "E-posta/kullanıcı adı ve şifre zorunludur." };
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: cleanId, password }),
      });

      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        return {
          ok: false,
          error: payload.error || "Giriş başarısız. Bilgilerinizi kontrol edin.",
        };
      }

      // Sync browser client session state after server route cookie login
      await refreshAccount();
      return { ok: true };
    } catch {
      return { ok: false, error: "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin." };
    }
  };

  const signUp = async (params: {
    email: string;
    password: string;
    username: string;
    displayName: string;
  }): Promise<{ ok: boolean; needsEmailVerification?: boolean; error?: string }> => {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanUsername = params.username.trim().toLowerCase();
    const cleanDisplay = params.displayName.trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { ok: false, error: "Geçerli bir e-posta adresi girin." };
    }
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(cleanUsername)) {
      return {
        ok: false,
        error: "Kullanıcı adı 3–32 karakter olmalı ve yalnızca harf, rakam, ., _, - içermelidir.",
      };
    }
    if (cleanDisplay.length < 1) {
      return { ok: false, error: "Lütfen adınızı girin." };
    }
    if (params.password.length < 8) {
      return { ok: false, error: "Şifreniz en az 8 karakter olmalıdır." };
    }

    const supabase = createClient();
    const redirectBase =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || "https://bizimfilm.vercel.app";

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: params.password,
      options: {
        emailRedirectTo: `${redirectBase}/auth/callback`,
        data: {
          username: cleanUsername,
          display_name: cleanDisplay,
        },
      },
    });

    if (error) {
      return {
        ok: false,
        error:
          error.message.toLowerCase().includes("already registered")
            ? "Bu e-posta adresi ile zaten kayıtlı bir hesap bulunuyor."
            : error.message,
      };
    }

    const needsEmailVerification = !data.session;
    if (data.session?.user) {
      setUser(data.session.user);
      await loadAccountContext(data.session.user);
    }

    return { ok: true, needsEmailVerification };
  };

  const requestPasswordReset = async (
    email: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { ok: false, error: "Lütfen geçerli bir e-posta adresi girin." };
    }

    const supabase = createClient();
    const redirectBase =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || "https://bizimfilm.vercel.app";

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${redirectBase}/auth/callback?next=/auth/reset-password`,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  };

  const updatePassword = async (
    newPassword: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (newPassword.length < 8) {
      return { ok: false, error: "Yeni şifreniz en az 8 karakter olmalıdır." };
    }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  };

  const updateProfile = async (updates: {
    display_name?: string;
    username?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: "Oturum bulunamadı." };
    const supabase = createClient();
    const payload: Record<string, string> = {};

    if (updates.display_name !== undefined) {
      const trimmed = updates.display_name.trim();
      if (!trimmed) return { ok: false, error: "Ad alanı boş bırakılamaz." };
      payload.display_name = trimmed;
    }
    if (updates.username !== undefined) {
      const trimmed = updates.username.trim().toLowerCase();
      if (!/^[a-zA-Z0-9._-]{3,32}$/.test(trimmed)) {
        return {
          ok: false,
          error: "Kullanıcı adı 3–32 karakter (harf, rakam, ., _, -) olmalıdır.",
        };
      }
      payload.username = trimmed;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id)
      .select("id, username, display_name, avatar_path, created_at, updated_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "Bu kullanıcı adı zaten kullanımda." };
      }
      return { ok: false, error: error.message };
    }

    setProfile(data as Profile);
    await refreshAccount();
    return { ok: true };
  };

  const updatePreferences = async (
    patch: Partial<
      Pick<
        UserPreferences,
        | "autoplay_music"
        | "music_volume"
        | "theme"
        | "notification_preferences"
        | "last_open_book_id"
        | "last_open_page_order"
      >
    >
  ) => {
    if (!user) return;
    const supabase = createClient();
    setPreferences((prev) => (prev ? { ...prev, ...patch } : prev));
    await supabase
      .from("user_preferences")
      .upsert({ user_id: user.id, ...patch });
  };

  const signOut = async () => {
    const supabase = createClient();
    clearSignedUrlCache();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setCouple(null);
    setMembers([]);
    setMemberAvatarUrls({});
    setPreferences(null);
    setStorageBreakdown(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        couple,
        members,
        memberAvatarUrls,
        preferences,
        storageBreakdown,
        isLoading,
        schemaError,
        refreshAccount,
        refreshStorage,
        signIn,
        signUp,
        requestPasswordReset,
        updatePassword,
        updateProfile,
        updatePreferences,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
