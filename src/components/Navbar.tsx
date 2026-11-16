"use client";

import React, { useEffect, useState } from "react";
import {
  Heart,
  Home,
  BookOpen,
  Image as ImageIcon,
  PlaySquare,
  Music,
  User,
  Search,
  Bell,
  ChevronDown,
  Users,
  Plus,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { type CoupleId, type NavTab } from "@/types";

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenSettingsModal: () => void;
  unreadNotificationsCount?: number;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "ana-sayfa", label: "Ana Sayfa", icon: Home },
  { id: "ani-kitabi", label: "Anı Kitabı", icon: BookOpen },
  { id: "fotograflar", label: "Fotoğraflar", icon: ImageIcon },
  { id: "videolar", label: "Videolar", icon: PlaySquare },
  { id: "muzik", label: "Müzik", icon: Music },
  { id: "biz", label: "Biz", icon: User },
];

export default function Navbar({
  activeTab,
  onSelectTab,
  onOpenSearch,
  onOpenNotifications,
  onOpenSettingsModal,
  unreadNotificationsCount = 3,
}: NavbarProps) {
  const { currentCouple, logout, switchDemoCouple } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePartner, setActivePartner] = useState<"p1" | "p2">("p1");
  const [showCoupleSwitcher, setShowCoupleSwitcher] = useState(false);

  // Open dropdown initially only on wide desktop screens on Ana Sayfa to match reference image
  useEffect(() => {
    if (window.innerWidth >= 1024 && activeTab === "ana-sayfa") {
      setProfileMenuOpen(true);
    } else {
      setProfileMenuOpen(false);
    }
  }, [activeTab]);

  const partner1Label = currentCouple?.partner1Name || "Ben";
  const partner2Label = currentCouple?.partner2Name || "Sen";

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
    if (tab !== "ana-sayfa") {
      setProfileMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-gradient-to-r from-[#240a10] via-[#2c0d15] to-[#1e080e] border-b border-rose-200/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
      <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Heart + BizimFilm Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Menüyü Aç/Kapat"
            className="flex lg:hidden h-8 w-8 items-center justify-center rounded-lg border border-rose-200/15 bg-rose-950/40 text-rose-100 hover:bg-rose-900/50 transition"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => handleNavClick("ana-sayfa")}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none"
          >
            <Heart className="h-5 w-5 text-[#f06c82] stroke-[2] group-hover:scale-105 transition-transform" />
            <span className="font-serif italic text-[20px] font-semibold tracking-wide text-white">
              BizimFilm
              <span className="text-[#f06c82] text-[11px] ml-0.5 not-italic align-middle">♥</span>
            </span>
          </button>
        </div>

        {/* Center Navigation Links (Desktop) */}
        <nav
          aria-label="Ana Navigasyon"
          className="hidden lg:flex items-center gap-1.5 xl:gap-2"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1 text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? "bg-[#4d1724] text-white border border-rose-300/20 shadow-[0_2px_12px_rgba(200,30,58,0.28)]"
                    : "text-rose-100/80 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    isActive ? "text-white" : "text-rose-200/75"
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Search, Bell, Couple Avatars & Dropdown */}
        <div className="relative flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Arama"
            title="Anılarda Ara"
            className="flex h-7 w-7 items-center justify-center rounded-full text-rose-100/85 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Bildirimler"
            title="Bildirimler"
            className="relative flex h-7 w-7 items-center justify-center rounded-full text-rose-100/85 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#f06c82] ring-2 ring-[#240a10]" />
            )}
          </button>

          {/* Dual Couple Avatars Button */}
          <button
            type="button"
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            aria-expanded={profileMenuOpen}
            aria-label="Aile Hesabı Menüsü"
            className="flex items-center gap-1 rounded-full py-0.5 pl-1 pr-1 hover:bg-white/5 transition cursor-pointer focus:outline-none"
          >
            <div className="flex items-center -space-x-2">
              <img
                src={currentCouple?.avatar1 || "/images/avatar-ben.webp"}
                alt={partner1Label}
                width={26}
                height={26}
                className="h-6 w-6 rounded-full border-2 border-[#2a0c13] object-cover shadow-sm"
              />
              <img
                src={currentCouple?.avatar2 || "/images/avatar-sen.webp"}
                alt={partner2Label}
                width={26}
                height={26}
                className="h-6 w-6 rounded-full border-2 border-[#2a0c13] object-cover shadow-sm"
              />
            </div>
            <ChevronDown
              className={`h-3 w-3 text-rose-200/80 transition-transform duration-200 ${
                profileMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Profile Dropdown Menu (Matches Reference Image 1:1) */}
          {profileMenuOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-44 rounded-xl border border-rose-200/15 bg-[#1e0a0f]/95 p-2 shadow-[0_14px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl">
              {/* Top Pill: Aile Hesabı */}
              <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-[#38121c] px-2.5 py-1.5 border border-rose-300/15 text-[11px] font-semibold text-[#f2738a]">
                <Users className="h-3.5 w-3.5 text-[#f2738a]" />
                <span>Aile Hesabı</span>
              </div>

              {/* Partner 1: Ben ♡ */}
              <button
                type="button"
                onClick={() => setActivePartner("p1")}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11px] transition cursor-pointer ${
                  activePartner === "p1"
                    ? "bg-white/10 text-white font-medium"
                    : "text-rose-100/80 hover:bg-white/5"
                }`}
              >
                <img
                  src={currentCouple?.avatar1 || "/images/avatar-ben.webp"}
                  alt={partner1Label}
                  width={22}
                  height={22}
                  className="h-5 w-5 rounded-full object-cover border border-rose-300/30"
                />
                <span>
                  {partner1Label} <span className="text-[#f2738a]">♡</span>
                </span>
              </button>

              {/* Partner 2: Sen ♡ */}
              <button
                type="button"
                onClick={() => setActivePartner("p2")}
                className={`mt-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11px] transition cursor-pointer ${
                  activePartner === "p2"
                    ? "bg-white/10 text-white font-medium"
                    : "text-rose-100/80 hover:bg-white/5"
                }`}
              >
                <img
                  src={currentCouple?.avatar2 || "/images/avatar-sen.webp"}
                  alt={partner2Label}
                  width={22}
                  height={22}
                  className="h-5 w-5 rounded-full object-cover border border-rose-300/30"
                />
                <span>
                  {partner2Label} <span className="text-[#f2738a]">♡</span>
                </span>
              </button>

              {/* + Profil Ekle / Demo Çift Değiştir */}
              <button
                type="button"
                onClick={() => setShowCoupleSwitcher((prev) => !prev)}
                className="mt-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11px] text-rose-100/80 hover:bg-white/5 hover:text-white transition cursor-pointer"
              >
                <Plus className="h-3 w-3 text-rose-200/70 ml-0.5" />
                <span>Profil Ekle</span>
              </button>

              {showCoupleSwitcher && (
                <div className="my-1 rounded-lg bg-black/50 p-1.5 border border-rose-200/10 space-y-1">
                  {(["cift1", "cift2", "cift3"] as CoupleId[]).map((cid) => (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => {
                        void switchDemoCouple(cid);
                        setShowCoupleSwitcher(false);
                      }}
                      className={`w-full rounded px-2 py-0.5 text-left text-[10px] flex items-center justify-between cursor-pointer ${
                        currentCouple?.id === cid
                          ? "bg-[#c81e3a] text-white font-medium"
                          : "text-rose-100/75 hover:bg-white/10"
                      }`}
                    >
                      <span>{cid.toUpperCase()}</span>
                      {currentCouple?.id === cid && <span>Aktif</span>}
                    </button>
                  ))}
                </div>
              )}

              <div className="my-1 h-px bg-rose-200/10" />

              {/* Hesap Ayarları (Yedekleme dahil) */}
              <button
                type="button"
                onClick={() => {
                  onOpenSettingsModal();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11px] text-rose-100/80 hover:bg-white/5 hover:text-white transition cursor-pointer"
              >
                <Settings className="h-3 w-3 text-rose-200/70 ml-0.5" />
                <span>Hesap Ayarları</span>
              </button>

              {/* Çıkış Yap */}
              <button
                type="button"
                onClick={logout}
                className="mt-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11px] text-rose-200/90 hover:bg-rose-950/80 hover:text-rose-100 transition cursor-pointer"
              >
                <LogOut className="h-3 w-3 text-rose-300/80 ml-0.5" />
                <span>Çıkış Yap</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobil Navigasyon"
          className="lg:hidden border-t border-rose-200/10 bg-[#1a070c]/95 px-4 py-3 backdrop-blur-xl"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition ${
                    isActive
                      ? "bg-[#4d1724] text-white border border-rose-300/25"
                      : "bg-white/5 text-rose-100/80 hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-4 w-4 text-[#f06c82]" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
