"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { COUPLE_ACCOUNTS, ensureCoupleSeedData } from "@/lib/db";
import { type CoupleAccount, type CoupleId } from "@/types";

const SESSION_STORAGE_KEY = "bizimfilm_active_couple_v1";

const DEMO_CREDENTIALS: Record<CoupleId, string> = {
  cift1: "Demo1234!",
  cift2: "Demo1234!",
  cift3: "Demo1234!",
};

interface AuthContextValue {
  currentCouple: CoupleAccount | null;
  isHydrated: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  switchDemoCouple: (coupleId: CoupleId) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentCouple, setCurrentCouple] = useState<CoupleAccount | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedId = window.localStorage.getItem(SESSION_STORAGE_KEY) as CoupleId | null;
      if (savedId && COUPLE_ACCOUNTS[savedId]) {
        setCurrentCouple(COUPLE_ACCOUNTS[savedId]);
        void ensureCoupleSeedData(savedId);
      }
    } catch {
      // Ignore storage access errors
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const login = async (
    username: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const cleanUser = username.trim().toLowerCase() as CoupleId;
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      return {
        ok: false,
        error: "Lütfen kullanıcı adı ve şifre alanlarını doldurun.",
      };
    }

    const expectedPass = DEMO_CREDENTIALS[cleanUser];
    if (!expectedPass || expectedPass !== cleanPass) {
      return {
        ok: false,
        error:
          "Kullanıcı adı veya şifre hatalı. Lütfen demo hesap bilgilerini (cift1, cift2 veya cift3 / Demo1234!) kontrol edin.",
      };
    }

    const account = COUPLE_ACCOUNTS[cleanUser];
    await ensureCoupleSeedData(cleanUser);

    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, cleanUser);
    } catch {
      // Ignore storage access errors
    }

    setCurrentCouple(account);
    return { ok: true };
  };

  const logout = () => {
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage access errors
    }
    setCurrentCouple(null);
  };

  const switchDemoCouple = async (coupleId: CoupleId) => {
    if (!COUPLE_ACCOUNTS[coupleId]) return;
    await ensureCoupleSeedData(coupleId);
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, coupleId);
    } catch {
      // Ignore
    }
    setCurrentCouple(COUPLE_ACCOUNTS[coupleId]);
  };

  return (
    <AuthContext.Provider
      value={{
        currentCouple,
        isHydrated,
        login,
        logout,
        switchDemoCouple,
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
