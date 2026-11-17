"use client";

import React, { useState } from "react";
import { Eye, EyeOff, AlertCircle, X, Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const DEMO_COUPLES = [
  {
    id: "cift1",
    names: "Emir ve Hazal",
    username: "Emir ve Hazal",
    pass: "Demo1234!",
    meta: "14 Şubat 2024",
  },
  {
    id: "cift2",
    names: "Sümeyya ve Berke",
    username: "Sümeyya ve Berke",
    pass: "Demo1234!",
    meta: "21 Haziran 2023",
  },
  {
    id: "cift3",
    names: "Gamze ve Onur",
    username: "Gamze ve Onur",
    pass: "Demo1234!",
    meta: "09 Eylül 2024",
  },
];

export default function LoginView() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);

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

  const handleSelectDemoAccount = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
    setDemoModalOpen(false);
  };

  return (
    <div className="min-h-screen w-full bg-[#101012] text-[#F5F5F7] grid grid-cols-1 lg:grid-cols-12">
      {/* Left Column: Editorial Visual & Brand Statement */}
      <div className="relative lg:col-span-7 flex flex-col justify-between overflow-hidden bg-[#18181B] min-h-[340px] lg:min-h-screen p-8 sm:p-12 lg:p-16 border-b lg:border-b-0 lg:border-r border-[#343438]/60">
        {/* Photographic Backdrop with Controlled Contrast */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <img
            src="/images/hero-couple.webp"
            alt="BizimFilm"
            className="h-full w-full object-cover object-center opacity-65 scale-[1.01]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(16,16,18,0.55) 0%, rgba(16,16,18,0.25) 40%, rgba(16,16,18,0.92) 100%)",
            }}
          />
        </div>

        {/* Minimal Wordmark */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="text-[19px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
            BizimFilm
          </span>
        </div>

        {/* Bottom Editorial Copy */}
        <div className="relative z-10 max-w-xl pt-16 lg:pt-0">
          <h1 className="text-[32px] sm:text-[44px] xl:text-[52px] font-semibold tracking-[-0.03em] leading-[1.08] text-[#F5F5F7]">
            Birlikte biriktirdiğiniz her şey.
          </h1>
          <p className="mt-4 text-[15px] sm:text-[17px] leading-[1.6] text-[#A1A1A6] max-w-lg font-normal">
            Fotoğraflarınız, hikâyeleriniz ve unutmak istemediğiniz anlarınız. Yalnızca ikinize özel.
          </p>
        </div>
      </div>

      {/* Right Column: Clean Minimal Form (No Card Clutter) */}
      <main className="lg:col-span-5 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-20 bg-[#101012]">
        <div className="w-full max-w-[360px] mx-auto">
          <div className="mb-8">
            <h2 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
              Tekrar hoş geldiniz.
            </h2>
            <p className="mt-2 text-[14px] text-[#A1A1A6]">
              Özel alanınıza erişmek için hesabınızla giriş yapın.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="bizimfilm-username"
                className="block text-[13px] font-medium text-[#A1A1A6] mb-2"
              >
                Kullanıcı adı
              </label>
              <input
                id="bizimfilm-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Emir ve Hazal"
                autoComplete="username"
                className="w-full rounded-lg border border-[#343438] bg-[#18181B] px-3.5 py-2.5 text-[15px] text-[#F5F5F7] placeholder-[#A1A1A6]/45 focus:border-[#D88A96] focus:outline-none transition-apple"
              />
            </div>

            <div>
              <label
                htmlFor="bizimfilm-password"
                className="block text-[13px] font-medium text-[#A1A1A6] mb-2"
              >
                Şifre
              </label>
              <div className="relative">
                <input
                  id="bizimfilm-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-[#343438] bg-[#18181B] pl-3.5 pr-10 py-2.5 text-[15px] text-[#F5F5F7] placeholder-[#A1A1A6]/45 focus:border-[#D88A96] focus:outline-none transition-apple"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] hover:text-[#F5F5F7] transition-apple cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-[#D88A96]/40 bg-[#18181B] p-3 text-[13px] text-[#F5F5F7]"
              >
                <AlertCircle className="h-4 w-4 text-[#D88A96] shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#F5F5F7] hover:bg-white active:scale-[0.995] py-2.5 text-[14px] font-medium text-[#101012] transition-apple cursor-pointer disabled:opacity-50"
            >
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>

          {/* Subtle Link for Demo Accounts Popover/Modal */}
          <div className="mt-8 pt-6 border-t border-[#343438]/60 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setDemoModalOpen(true)}
              className="text-[13px] font-medium text-[#A1A1A6] hover:text-[#F5F5F7] transition-apple cursor-pointer"
            >
              Demo hesaplarını görüntüle
            </button>
            <span className="text-[12px] text-[#A1A1A6]/60">Yerel Önizleme</span>
          </div>
        </div>
      </main>

      {/* Clean Minimal Popover Modal for Demo Accounts */}
      {demoModalOpen && (
        <div
          onClick={() => setDemoModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-[#343438] bg-[#18181B] p-6 text-[#F5F5F7] shadow-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#343438]">
              <div>
                <h3 className="text-[16px] font-semibold text-[#F5F5F7]">
                  Önizleme Hesapları
                </h3>
                <p className="text-[12px] text-[#A1A1A6] mt-0.5">
                  Bir çift seçerek giriş bilgilerini otomatik doldurabilirsiniz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDemoModalOpen(false)}
                aria-label="Kapat"
                className="rounded-lg p-1.5 text-[#A1A1A6] hover:bg-[#222226] hover:text-[#F5F5F7] transition-apple cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {DEMO_COUPLES.map((acc) => {
                const isSelected = username === acc.username;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleSelectDemoAccount(acc.username, acc.pass)}
                    className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-apple cursor-pointer ${
                      isSelected
                        ? "border-[#D88A96] bg-[#222226]"
                        : "border-[#343438] bg-[#101012] hover:border-[#A1A1A6]/50 hover:bg-[#222226]/60"
                    }`}
                  >
                    <div>
                      <div className="text-[14px] font-medium text-[#F5F5F7]">
                        {acc.names}
                      </div>
                      <div className="text-[12px] text-[#A1A1A6] mt-0.5">
                        Kullanıcı: {acc.id} • Şifre: {acc.pass}
                      </div>
                    </div>
                    {isSelected ? (
                      <Check className="h-4 w-4 text-[#D88A96]" />
                    ) : (
                      <span className="text-[12px] text-[#A1A1A6]">Seç</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-lg bg-[#101012] border border-[#343438]/80 p-3.5 text-[12px] leading-relaxed text-[#A1A1A6]">
              Bu giriş sistemi önizleme amaçlıdır ve sunucu tabanlı kimlik doğrulaması içermez.
              Yüklediğiniz fotoğraflar ve kitap sayfaları yalnızca tarayıcınızın yerel hafızasında
              (IndexedDB) her çift için ayrı alanda saklanır.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
