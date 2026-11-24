import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { AudioPlayerProvider } from "@/context/AudioPlayerContext";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  variable: "--font-playfair",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Miora — Özel Dijital Anı Alanı",
  description:
    "Fotoğraflarınız, hikâyeleriniz, müzikleriniz ve unutmak istemediğiniz anlarınız. Yalnızca ikinize özel.",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101012",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-[#101012] text-[#F5F5F7] antialiased selection:bg-[#D88A96]/30 selection:text-[#F5F5F7]">
        <AuthProvider>
          <AudioPlayerProvider>{children}</AudioPlayerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
