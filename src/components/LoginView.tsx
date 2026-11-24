"use client";

import React, { useEffect, useState } from "react";
import { Eye, EyeOff, AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type AuthMode = "login" | "signup" | "reset";

export default function LoginView() {
  const { signIn, signUp, recoverWithCode } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");

  // Login / Recovery / Signup form states
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("auth_error") === "link_invalid"
      ? "Bağlantının süresi dolmuş veya geçersiz."
      : null;
  });
  const [infoMessage, setInfoMessage] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("invite")
      ? "Partner davet bağlantısıyla geldiniz. Hesabınıza giriş yapın veya yeni hesap oluşturun."
      : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get("invite");
    if (inviteParam) {
      try {
        window.sessionStorage.setItem("miora_pending_invite", inviteParam);
      } catch {
        // Ignore storage errors
      }
    }
  }, []);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setInfoMessage(null);
    setPassword("");
    setConfirmPassword("");
    setRecoveryCode("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const res = await signIn(username, password);
        if (!res.ok) {
          setError(res.error || "Kullanıcı adı veya şifre hatalı.");
        }
      } else if (mode === "signup") {
        const res = await signUp({
          displayName,
          username,
          password,
          confirmPassword,
        });
        if (!res.ok) {
          setError(res.error || "Kayıt işlemi tamamlanamadı.");
        }
      } else {
        const res = await recoverWithCode({
          username,
          recoveryCode,
          newPassword: password,
          confirmPassword,
        });
        if (!res.ok) {
          setError(res.error || "Şifre sıfırlama başarısız oldu.");
        } else {
          setMode("login");
          setPassword("");
          setConfirmPassword("");
          setRecoveryCode("");
          setInfoMessage(
            `Şifreniz güncellendi (kalan kurtarma kodu: ${res.remainingCodes ?? 0}). Yeni şifrenizle giriş yapabilirsiniz.`
          );
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#101012] text-[#F5F5F7] grid grid-cols-1 lg:grid-cols-12">
      {/* Left Column: Editorial Visual & Brand Statement (Preserved Design) */}
      <div className="relative lg:col-span-7 flex flex-col justify-between overflow-hidden bg-[#18181B] min-h-[300px] lg:min-h-screen p-8 sm:p-12 lg:p-16 border-b lg:border-b-0 lg:border-r border-[#343438]/60">
        <div className="pointer-events-none absolute inset-0 z-0">
          <img
            src="/images/hero-couple.webp"
            alt="Miora"
            className="h-full w-full object-cover object-center opacity-60 scale-[1.01]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(16,16,18,0.58) 0%, rgba(16,16,18,0.28) 40%, rgba(16,16,18,0.94) 100%)",
            }}
          />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <span className="text-[19px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
            Miora
          </span>
          <span className="text-[12px] text-[#A1A1A6]">
            Çiftlere Özel Dijital Anı Alanı
          </span>
        </div>

        <div className="relative z-10 max-w-xl pt-14 lg:pt-0">
          <h1 className="text-[32px] sm:text-[44px] xl:text-[52px] font-semibold tracking-[-0.03em] leading-[1.08] text-[#F5F5F7]">
            Birlikte biriktirdiğiniz her şey.
          </h1>
          <p className="mt-4 text-[15px] sm:text-[17px] leading-[1.6] text-[#A1A1A6] max-w-lg font-normal">
            Fotoğraflarınız, hikâyeleriniz, videolarınız ve şarkılarınız. Yalnızca ikinize özel, güvenli ve gizli alanınızda.
          </p>
        </div>
      </div>

      {/* Right Column: Clean Minimal Form */}
      <main className="lg:col-span-5 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-20 bg-[#101012]">
        <div className="w-full max-w-[380px] mx-auto">
          <div className="mb-7">
            <h2 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.025em] text-[#F5F5F7]">
              {mode === "login"
                ? "Tekrar hoş geldiniz."
                : mode === "signup"
                ? "Hesap oluşturun."
                : "Hesap kurtarma."}
            </h2>
            <p className="mt-2 text-[14px] text-[#A1A1A6]">
              {mode === "login"
                ? "Özel alanınıza erişmek için kullanıcı adınızla giriş yapın."
                : mode === "signup"
                ? "Sadece birkaç bilgiyle hesabınızı oluşturun, doğrudan anı alanınıza geçin."
                : "Kayıt sırasında sakladığınız tek kullanımlık kurtarma koduyla yeni şifre belirleyin."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === "login" && (
              <>
                <div>
                  <label
                    htmlFor="miora-identifier"
                    className="block text-[13px] font-medium text-[#A1A1A6] mb-1.5"
                  >
                    Kullanıcı adı
                  </label>
                  <input
                    id="miora-identifier"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="kullanici.adi"
                    autoComplete="username"
                    className="w-full rounded-lg border border-[#343438] bg-[#18181B] px-3.5 py-2.5 text-[15px] text-[#F5F5F7] placeholder-[#A1A1A6]/45 focus:border-[#D88A96] focus:outline-none transition-apple"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="miora-password"
                      className="block text-[13px] font-medium text-[#A1A1A6]"
                    >
                      Şifre
                    </label>
                    <button
                      type="button"
                      onClick={() => switchMode("reset")}
                      className="text-[12px] text-[#A1A1A6] hover:text-[#F5F5F7] transition-apple cursor-pointer"
                    >
                      Şifremi unuttum
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="miora-password"
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
              </>
            )}

            {mode === "signup" && (
              <>
                <div>
                  <label
                    htmlFor="miora-display-name"
                    className="block text-[13px] font-medium text-[#A1A1A6] mb-1.5"
                  >
                    Ad soyad
                  </label>
                  <input
                    id="miora-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Adınız Soyadınız"
                    autoComplete="name"
                    className="w-full rounded-lg border border-[#343438] bg-[#18181B] px-3.5 py-2.5 text-[14px] text-[#F5F5F7] placeholder-[#A1A1A6]/45 focus:border-[#D88A96] focus:outline-none transition-apple"
                  />
                </div>

                <div>
                  <label
                    htmlFor="miora-username"
                    className="block text-[13px] font-medium text-[#A1A1A6] mb-1.5"
                  >
                    Kullanıcı adı
                  </label>
                  <input
                    id="miora-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="kullanici.adi"
                    autoComplete="username"
                    className="w-full rounded-lg border border-[#343438] bg-[#18181B] px-3.5 py-2.5 text-[14px] text-[#F5F5F7] placeholder-[#A1A1A6]/45 focus:border-[#D88A96] focus:outline-none transition-apple"
                  />
                </div>

                <div>
                  <label
                    htmlFor="miora-signup-password"
                    className="block text-[13px] font-medium text-[#A1A1A6] mb-1.5"
                  >
                    Şifre
                  </label>
                  <div className="relative">
                    <input
                      id="miora-signup-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="En az 8 karakter"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-[#343438] bg-[#18181B] pl-3.5 pr-10 py-2.5 text-[14px] text-[#F5F5F7] placeholder-[#A1A1A6]/45 focus:border-[#D88A96] focus:outline-none transition-apple"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] hover:text-[#F5F5F7] cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="miora-signup-confirm-password"
                    className="block text-[13px] font-medium text-[#A1A1A6] mb-1.5"
                  >
                    Şifre tekrarı
                  </label>
                  <input
                    id="miora-signup-confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Şifrenizi tekrar girin"
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-[#343438] bg-[#18181B] px-3.5 py-2.5 text-[14px] text-[#F5F5F7] placeholder-[#A1A1A6]/45 focus:border-[#D88A96] focus:outline-none transition-apple"
                  />
                </div>
              </>
            )}

            {mode === "reset" && (
              <>
                <div>
                  <label
                    htmlFor="miora-recover-username"
                    className="block text-[13px] font-medium text-[#A1A1A6] mb-1.5"
                  >
                    Kullanıcı adı
                  </label>
                  <input
                    id="miora-recover-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="kullanici.adi"
                    autoComplete="username"
                    className="w-full rounded-lg border border-[#343438] bg-[#18181B] px-3.5 py-2.5 text-[14px] text-[#F5F5F7] placeholder-[#A1A1A6]/45 focus:border-[#D88A96] focus:outline-none transition-apple"
                  />
                </div>

                <div>
                  <label
                    htmlFor="miora-recover-code"
                    className="block text-[13px] font-medium text-[#A1A1A6] mb-1.5"
                  >
                    Tek kullanımlık kurtarma kodu
                  </label>
                  <div className="relative">
                    <KeyRound className="h-4 w-4 text-[#A1A1A6] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="miora-recover-code"
                      type="text"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full rounded-lg border border-[#343438] bg-[#18181B] pl-10 pr-3.5 py-2.5 font-mono text-[13px] uppercase tracking-wider text-[#F5F5F7] placeholder-[#A1A1A6]/45 focus:border-[#D88A96] focus:outline-none transition-apple"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="miora-recover-password"
                    className="block text-[13px] font-medium text-[#A1A1A6] mb-1.5"
                  >
                    Yeni şifre
                  </label>
                  <input
                    id="miora-recover-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="En az 8 karakter"
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-[#343438] bg-[#18181B] px-3.5 py-2.5 text-[14px] text-[#F5F5F7] placeholder-[#A1A1A6]/45 focus:border-[#D88A96] focus:outline-none transition-apple"
                  />
                </div>

                <div>
                  <label
                    htmlFor="miora-recover-confirm"
                    className="block text-[13px] font-medium text-[#A1A1A6] mb-1.5"
                  >
                    Yeni şifre tekrarı
                  </label>
                  <input
                    id="miora-recover-confirm"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Yeni şifrenizi tekrar girin"
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-[#343438] bg-[#18181B] px-3.5 py-2.5 text-[14px] text-[#F5F5F7] placeholder-[#A1A1A6]/45 focus:border-[#D88A96] focus:outline-none transition-apple"
                  />
                </div>
              </>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-[#D88A96]/40 bg-[#18181B] p-3 text-[13px] text-[#F5F5F7]"
              >
                <AlertCircle className="h-4 w-4 text-[#D88A96] shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {infoMessage && (
              <div className="flex items-start gap-2.5 rounded-lg border border-[#343438] bg-[#18181B] p-3 text-[13px] text-[#F5F5F7]">
                <CheckCircle2 className="h-4 w-4 text-[#D88A96] shrink-0 mt-0.5" />
                <span>{infoMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#F5F5F7] hover:bg-white active:scale-[0.995] py-2.5 text-[14px] font-medium text-[#101012] transition-apple cursor-pointer disabled:opacity-50"
            >
              {loading
                ? "İşleniyor..."
                : mode === "login"
                ? "Giriş Yap"
                : mode === "signup"
                ? "Hesap Oluştur"
                : "Şifreyi Güncelle"}
            </button>
          </form>

          {/* Clean Mode Toggle */}
          <div className="mt-7 pt-6 border-t border-[#343438]/60 flex items-center justify-between text-[13px]">
            {mode === "login" ? (
              <>
                <span className="text-[#A1A1A6]">Henüz hesabınız yok mu?</span>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="font-medium text-[#F5F5F7] hover:text-[#D88A96] transition-apple cursor-pointer"
                >
                  Kayıt Ol
                </button>
              </>
            ) : (
              <>
                <span className="text-[#A1A1A6]">Zaten hesabınız var mı?</span>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="font-medium text-[#F5F5F7] hover:text-[#D88A96] transition-apple cursor-pointer"
                >
                  Giriş Yap
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
