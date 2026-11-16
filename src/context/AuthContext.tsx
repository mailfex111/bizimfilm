"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { COUPLE_ACCOUNTS, ensureCoupleSeedData } from "@/lib/db";
import { type CoupleAccount, type CoupleId } from "@/types";

const SESSION_STORAGE_KEY = "bizimfilm_active_couple_v1";

function resolveCoupleId(input: string): CoupleId | null {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (
    normalized === "cift1" ||
    normalized === "emir & hazal" ||
    normalized === "emir ve hazal" ||
    normalized === "emirhazal" ||
    normalized === "emir" ||
    normalized === "hazal"
  ) {
    return "cift1";
  }

  if (
    normalized === "cift2" ||
    normalized === "sümeyya & berke" ||
    normalized === "sumeyya & berke" ||
    normalized === "sümeyya ve berke" ||
    normalized === "sumeyya ve berke" ||
    normalized === "sümeyyaberke" ||
    normalized === "sumeyyaberke" ||
    normalized === "sümeyya" ||
    normalized === "sumeyya" ||
    normalized === "berke"
  ) {
    return "cift2";
  }

  if (
    normalized === "cift3" ||
    normalized === "gamze & onur" ||
    normalized === "gamze ve onur" ||
    normalized === "gamzeonur" ||
    normalized === "gamze" ||
    normalized === "onur"
  ) {
    return "cift3";
  }

  return null;
}

const VALID_PASSWORDS = new Set(["Demo1234!", "1234", "123456", "bizimfilm"]);

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
    const cleanPass = password.trim();

    if (!username.trim() || !cleanPass) {
      return {
        ok: false,
        error: "Lütfen kullanıcı adı ve şifre alanlarını doldurun.",
      };
    }

    const matchedCoupleId = resolveCoupleId(username);
    if (!matchedCoupleId || !VALID_PASSWORDS.has(cleanPass)) {
      return {
        ok: false,
        error: "Kullanıcı adı veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.",
      };
    }

    const account = COUPLE_ACCOUNTS[matchedCoupleId];
    await ensureCoupleSeedData(matchedCoupleId);

    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, matchedCoupleId);
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
