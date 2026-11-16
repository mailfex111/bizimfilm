import type { Metadata, Viewport } from "next";
import { Caveat, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  weight: ["600", "700"],
  variable: "--font-playfair",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  variable: "--font-caveat",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "BizimFilm ♡ — Sevgililere Özel Dijital Anı Platformu",
  description:
    "Fotoğraflarımız, videolarımız, müziklerimiz ve tüm anılarımız... Tek bir yerde.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e080e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${playfair.variable} ${caveat.variable}`}>
      <body className="min-h-screen bg-[#110508] text-white antialiased selection:bg-[#c81e3a] selection:text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
