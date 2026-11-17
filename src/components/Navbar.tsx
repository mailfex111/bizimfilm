"use client";

import React, { useState } from "react";
import {
  Search,
  Bell,
  ChevronDown,
  Settings,
  LogOut,
  Menu,
  X,
  Check,
  User,
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

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: "ana-sayfa", label: "Ana Sayfa" },
  { id: "ani-kitabi", label: "Anı Kitabı" },
  { id: "fotograflar", label: "Fotoğraflar" },
  { id: "videolar", label: "Videolar" },
  { id: "muzik", label: "Müzik" },
];

const COUPLE_LIST: { id: CoupleId; names: string }[] = [
  { id: "cift1", names: "Emir ve Hazal" },
  { id: "cift2", names: "Sümeyya ve Berke" },
  { id: "cift3", names: "Gamze ve Onur" },
];

export default function Navbar({
  activeTab,
  onSelectTab,
  onOpenSearch,
  onOpenNotifications,
  onOpenSettingsModal,
  unreadNotificationsCount = 2,
}: NavbarProps) {
  const { currentCouple, logout, switchDemoCouple } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const partner1Label = currentCouple?.partner1Name || "Emir";
  const partner2Label = currentCouple?.partner2Name || "Hazal";
  const coupleFullName = `${partner1Label} & ${partner2Label}`;

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#101012]/90 backdrop-blur-md border-b border-[#343438]/60">
      <div className="mx-auto flex h-14 max-w-[1360px] items-center justify-between px-4 sm:px-6 lg:px-10">
        {/* Left: Minimal Wordmark + Mobile Menu Trigger */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Menü"
            className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg border border-[#343438] bg-[#18181B] text-[#F5F5F7] hover:bg-[#222226] transition-apple"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => handleNavClick("ana-sayfa")}
            className="text-[18px] font-semibold tracking-[-0.025em] text-[#F5F5F7] hover:opacity-85 transition-apple cursor-pointer focus:outline-none"
          >
            BizimFilm
          </button>
        </div>

        {/* Center: Clean Minimal Navigation Links */}
        <nav
          aria-label="Ana Navigasyon"
          className="hidden md:flex items-center gap-7 h-full"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`relative h-full flex items-center text-[14px] font-medium transition-apple cursor-pointer ${
                  isActive
                    ? "text-[#F5F5F7]"
                    : "text-[#A1A1A6] hover:text-[#F5F5F7]"
                }`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 inset-x-0 h-[2px] rounded-full bg-[#D88A96]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Search, Notifications, Profile Menu */}
        <div className="relative flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Arama"
            title="Ara"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#A1A1A6] hover:bg-[#18181B] hover:text-[#F5F5F7] transition-apple cursor-pointer"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Bildirimler"
            title="Bildirimler"
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[#A1A1A6] hover:bg-[#18181B] hover:text-[#F5F5F7] transition-apple cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[#D88A96]" />
            )}
          </button>

          {/* Couple Profile Pill */}
          <button
            type="button"
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            aria-expanded={profileMenuOpen}
            aria-label="Profil Menüsü"
            className="flex items-center gap-2 rounded-full border border-[#343438] bg-[#18181B] hover:bg-[#222226] py-1 pl-1.5 pr-2.5 transition-apple cursor-pointer focus:outline-none"
          >
            <div className="flex items-center -space-x-1.5">
              <img
                src={currentCouple?.avatar1 || "/images/avatar-ben.webp"}
                alt={partner1Label}
                width={24}
                height={24}
                className="h-6 w-6 rounded-full border border-[#101012] object-cover"
              />
              <img
                src={currentCouple?.avatar2 || "/images/avatar-sen.webp"}
                alt={partner2Label}
                width={24}
                height={24}
                className="h-6 w-6 rounded-full border border-[#101012] object-cover"
              />
            </div>
            <span className="hidden sm:inline text-[13px] font-medium text-[#F5F5F7]">
              {coupleFullName}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-[#A1A1A6] transition-transform duration-150 ${
                profileMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Clean Profile Dropdown */}
          {profileMenuOpen && (
            <>
              <div
                onClick={() => setProfileMenuOpen(false)}
                className="fixed inset-0 z-40"
              />
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-xl border border-[#343438] bg-[#18181B] p-2 shadow-2xl">
                <div className="px-3 py-2 border-b border-[#343438]/70 mb-1.5">
                  <div className="text-[13px] font-semibold text-[#F5F5F7]">
                    {coupleFullName}
                  </div>
                  <div className="text-[11px] text-[#A1A1A6]">
                    {currentCouple?.anniversaryDate}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleNavClick("biz")}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-[#F5F5F7] hover:bg-[#222226] transition-apple cursor-pointer"
                >
                  <User className="h-3.5 w-3.5 text-[#A1A1A6]" />
                  <span>Çift Profilimiz</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    onOpenSettingsModal();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-[#F5F5F7] hover:bg-[#222226] transition-apple cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5 text-[#A1A1A6]" />
                  <span>Veri ve Yedekleme</span>
                </button>

                <div className="my-1.5 h-px bg-[#343438]/70" />

                <div className="px-3 py-1 text-[11px] font-medium text-[#A1A1A6]">
                  Hesap Değiştir
                </div>
                {COUPLE_LIST.map((item) => {
                  const isCurrent = currentCouple?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        void switchDemoCouple(item.id);
                        setProfileMenuOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-[12px] text-[#F5F5F7] hover:bg-[#222226] transition-apple cursor-pointer"
                    >
                      <span>{item.names}</span>
                      {isCurrent && <Check className="h-3.5 w-3.5 text-[#D88A96]" />}
                    </button>
                  );
                })}

                <div className="my-1.5 h-px bg-[#343438]/70" />

                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-[#D88A96] hover:bg-[#222226] transition-apple cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Çıkış Yap</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobil Navigasyon"
          className="md:hidden border-t border-[#343438] bg-[#18181B] px-4 py-3"
        >
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-[14px] font-medium transition-apple ${
                    isActive
                      ? "bg-[#222226] text-[#F5F5F7]"
                      : "text-[#A1A1A6] hover:bg-[#222226]/50 hover:text-[#F5F5F7]"
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D88A96]" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
