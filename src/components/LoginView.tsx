"use client";

import React, { useState } from "react";
import { Heart, Lock, User, AlertCircle, Sparkles, ShieldAlert, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const DEMO_ACCOUNTS_LIST = [
  { username: "cift1", label: "Çift 1 (Emir & Hazal)", pass: "Demo1234!" },
  { username: "cift2", label: "Çift 2 (Sümeyya & Berke)", pass: "Demo1234!" },
  { username: "cift3", label: "Çift 3 (Gamze & Onur)", pass: "Demo1234!" },
];

export default function LoginView() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(username, password);
      if (!res.ok) {
        setError(res.error || "Giriş yapılamadı.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#120609] text-white flex flex-col justify-between">
      {/* Background Romantic Sunset & Burgundy Atmosphere (Instant Paint, Zero LCP Delay) */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle at 72% 32%, rgba(200, 30, 58, 0.28) 0%, rgba(95, 18, 34, 0.22) 35%, rgba(18, 6, 9, 0.96) 75%), linear-gradient(135deg, #1b070c 0%, #120508 55%, #260a12 100%)",
        }}
      />

      {/* Top Logo Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12 border-b border-rose-200/10 bg-[#1e090f]/95">
        <div className="flex items-center gap-2.5">
          <Heart className="h-6 w-6 text-[#f06c82] stroke-[2.2]" />
          <span className="font-serif italic text-2xl tracking-wide text-white font-semibold select-none">
            BizimFilm
            <span className="text-[#f06c82] text-sm ml-0.5 not-italic">♥</span>
          </span>
        </div>
        <span className="text-xs text-rose-200/70 hidden sm:inline-flex items-center gap-1.5 bg-rose-950/60 border border-rose-300/15 px-3 py-1 rounded-full">
          <Sparkles className="h-3.5 w-3.5 text-[#f06c82]" />
          Sevgililere Özel Dijital Anı Platformu
        </span>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-rose-200/15 bg-[#210b11] p-7 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.75)]">
          <div className="text-center mb-6">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#3a121d] border border-rose-300/20 shadow-inner">
              <Heart className="h-6 w-6 text-[#f06c82] fill-[#f06c82]/20" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Bizim Hikayemiz <span className="text-[#f06c82] font-normal">♡</span>
            </h1>
            <p className="mt-1.5 text-sm text-rose-100/75">
              Fotoğraflarımız, videolarımız, müziklerimiz ve tüm anılarımız... Tek bir yerde.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="bizimfilm-username"
                className="block text-xs font-medium text-rose-100/85 mb-1.5"
              >
                Kullanıcı adı
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-300/60" />
                <input
                  id="bizimfilm-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Örn: cift1"
                  autoComplete="username"
                  className="w-full rounded-xl border border-rose-200/15 bg-[#15060a]/90 pl-10 pr-4 py-2.5 text-sm text-white placeholder-rose-200/35 focus:border-[#e63956] focus:outline-none focus:ring-2 focus:ring-[#e63956]/30 transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="bizimfilm-password"
                className="block text-xs font-medium text-rose-100/85 mb-1.5"
              >
                Şifre
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-300/60" />
                <input
                  id="bizimfilm-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-rose-200/15 bg-[#15060a]/90 pl-10 pr-10 py-2.5 text-sm text-white placeholder-rose-200/35 focus:border-[#e63956] focus:outline-none focus:ring-2 focus:ring-[#e63956]/30 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-200/50 hover:text-rose-100 transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-950/70 p-3 text-xs text-rose-100"
              >
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#c81e3a] hover:bg-[#dc2342] active:scale-[0.99] py-3 text-sm font-semibold text-white shadow-[0_6px_25px_rgba(200,30,58,0.45)] transition cursor-pointer disabled:opacity-60"
            >
              {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
            </button>
          </form>

          {/* Demo Accounts Quick Selector */}
          <div className="mt-6 pt-5 border-t border-rose-200/10">
            <p className="text-xs font-medium text-rose-200/80 mb-2.5">
              Demo Çift Hesapları (Tek tıkla doldur):
            </p>
            <div className="grid grid-cols-1 gap-2">
              {DEMO_ACCOUNTS_LIST.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => handleQuickFill(acc.username, acc.pass)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition cursor-pointer ${
                    username === acc.username
                      ? "border-[#e63956] bg-[#3b121d] text-white"
                      : "border-rose-200/10 bg-[#17070b]/80 text-rose-100/80 hover:border-rose-300/30 hover:bg-[#280c13]"
                  }`}
                >
                  <span className="font-medium">{acc.label}</span>
                  <code className="rounded bg-black/40 px-2 py-0.5 text-[11px] text-rose-300">
                    {acc.username} / {acc.pass}
                  </code>
                </button>
              ))}
            </div>
          </div>

          {/* Demo Security Notice */}
          <div className="mt-5 rounded-xl border border-amber-300/15 bg-black/35 p-3 text-[11px] leading-relaxed text-rose-100/65 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-300/80 shrink-0 mt-0.5" />
            <div>
              <strong className="text-rose-200/90">Demo Güvenlik Bilgisi:</strong> Bu giriş sistemi
              yalnızca prototip gösterimi amaçlıdır. Fotoğraflar ve anı kitabı verileri sunucuya
              gönderilmez; tarayıcınızın <strong>IndexedDB</strong> alanında her çift için ayrı
              isim alanı (namespace) altında saklanır. Tarayıcı verilerini temizlerseniz yerel
              kayıtlar silinebilir.
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-4 text-center text-xs text-rose-200/45">
        BizimFilm Dijital Anı Platformu — Prototip Sürümü
      </footer>
    </div>
  );
}
