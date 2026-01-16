import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { List, Settings, Search, AlertTriangle, BusFront, Maximize, Minimize, Star, Globe, Trophy } from 'lucide-react';
import { DigitalClock } from './components/DigitalClock';
import { DeparturesBoard } from './components/DeparturesBoard';
import { TripPlanner } from './components/TripPlanner';
import { TrafficDisruptions } from './components/TrafficDisruptions';
import { SettingsView } from './components/SettingsView';
import { applyAccentTheme } from './components/ThemePicker';
import { FavoritesView } from './components/FavoritesView';
import { LiveMap } from './components/LiveMap';
import { NotFound } from './components/NotFound';

import { TranslationProvider, useTranslation } from './components/TranslationProvider';


import { UpdateNotification } from './components/UpdateNotification';

const AppContent = () => {
  // Update checker is now handled by the notification component internally or we can hoist it. 
  // But UpdateNotification uses the hook itself as per my design.

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const location = useLocation();

  // Analytics Tracking for SPA Route Changes
  useEffect(() => {
    if ((window as any).gtag) {
      (window as any).gtag('config', 'G-XXXXXXXXXX', {
        page_path: location.pathname + location.search
      });
    }
  }, [location]);

  // Theme Management
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system';
  });

  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.error("Error attempting to enable fullscreen:", err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    // Initialize Accent Theme
    const savedAccent = localStorage.getItem('resmus_accent_theme') || 'sky';
    applyAccentTheme(savedAccent);

    const root = window.document.documentElement;
    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        root.classList.add('dark');
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0f172a');
      } else {
        root.classList.remove('dark');
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0ea5e9');
      }
    };
    applyTheme();
    localStorage.setItem('theme', theme);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => { if (theme === 'system') applyTheme(); };
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);
  return (
    <div className="flex h-[100dvh] w-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300 font-sans selection:bg-sky-500/30 no-context-menu">
      <UpdateNotification />

      {/* --- DESKTOP SIDEBAR (Visible on lg screens) --- */}
      <aside className={`hidden ${isFullscreen ? 'hidden' : 'md:flex'} w-64 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
              <BusFront className="text-white" size={22} />
            </div>
            <div>
              <h1 className="font-black text-xl text-slate-800 dark:text-white tracking-tight leading-none">Resmus</h1>
            </div>
          </div>

          <nav className="space-y-2">
            {[
              { to: "/", icon: List, label: "Avgångar" },
              { to: "/favorites", icon: Star, label: "Favoriter" },
              { to: "/map", icon: Globe, label: "Karta" },
              { to: "/disruptions", icon: AlertTriangle, label: "Störningar" },
              { to: "/settings", icon: Settings, label: "Inställningar" }
            ].map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${isActive ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30 scale-105' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:scale-[1.02]'}`}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            {isFullscreen ? 'Avsluta helskärm' : 'Helskärmsläge'}
          </button>

          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl flex items-center justify-between">
            <DigitalClock />
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col h-full relative w-full">
        {/* Header - Mobile Only */}
        <header className="md:hidden flex-none bg-sky-500 dark:bg-slate-900 text-white shadow-lg z-[60] pt-safe-top relative overflow-hidden transition-colors">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-500 to-sky-600 dark:from-slate-900 dark:to-slate-800"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none mix-blend-overlay"></div>

          <div className="max-w-4xl mx-auto w-full px-4 h-14 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/10 dark:bg-white/5 rounded-xl flex items-center justify-center border border-white/20 dark:border-white/10 shadow-lg backdrop-blur-md">
                <BusFront className="text-white" size={18} />
              </div>
              <div className="flex flex-col justify-center">
                <span className="font-black text-lg leading-none tracking-tight">Resmus</span>
              </div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 px-3 py-1 rounded-full border border-white/10 text-xs backdrop-blur-md shadow-inner font-medium">
              <DigitalClock />
            </div>
          </div>
        </header>

        {/* Header - Desktop Only - Search Bar Location */}
        <header className="hidden md:flex flex-none h-16 items-center justify-between px-8 z-40 bg-slate-50 dark:bg-slate-950">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
            {(() => {
              if (location.pathname === '/') return 'Avgångar';
              if (location.pathname === '/favorites') return 'Favoriter';
              if (location.pathname === '/map') return 'Karta';
              if (location.pathname === '/disruptions') return 'Störningar';
              if (location.pathname === '/settings') return 'Inställningar';
              if (location.pathname === '/search') return 'Reseplanerare';
              return 'Resmus';
            })()}
          </h2>

          <NavLink
            to="/search"
            className={({ isActive }) => `flex items-center gap-3 px-6 py-3 rounded-full font-bold text-sm shadow-md transition-all duration-300 ${isActive ? 'bg-sky-500 text-white ring-4 ring-sky-500/20' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:border-sky-500 hover:text-sky-500'}`}
          >
            <Search size={20} strokeWidth={2.5} />
            <span className="uppercase tracking-wider">Sök resa</span>
          </NavLink>
        </header>

        {/* Content Body */}
        <main className={`flex-1 relative overflow-hidden w-full bg-slate-100 dark:bg-black transition-all duration-300 ${isFullscreen ? 'p-0' : 'md:p-6'}`}>
          <div className={`h-full w-full mx-auto bg-slate-50 dark:bg-slate-950 shadow-2xl relative flex flex-col overflow-hidden transition-all duration-300
                    ${isFullscreen
              ? 'max-w-none rounded-none border-none'
              : 'max-w-4xl md:max-w-6xl md:rounded-[2rem] md:border border-slate-200 dark:border-slate-800'
            }
                `}>

            <Routes>
              <Route path="/" element={<div className="h-full flex flex-col animate-in fade-in duration-300"><DeparturesBoard mode="departures" /></div>} />
              <Route path="/favorites" element={<div className="h-full flex flex-col animate-in fade-in duration-300"><FavoritesView /></div>} />
              <Route path="/disruptions" element={<div className="h-full flex flex-col animate-in fade-in duration-300"><TrafficDisruptions /></div>} />


              <Route path="/settings" element={
                <div className="h-full flex flex-col animate-in fade-in duration-300">
                  <SettingsView
                    deferredPrompt={deferredPrompt}
                  />
                </div>
              } />

              <Route path="/map" element={<div className="h-full animate-in fade-in zoom-in-95 duration-300"><LiveMap /></div>} />



              {/* Catch all route for 404 */}
              <Route path="*" element={<div className="h-full flex flex-col animate-in fade-in duration-300"><NotFound /></div>} />
            </Routes>

            {/* Floating Exit Fullscreen Button - Visible only on hover */}
            {isFullscreen && (
              <div className="absolute bottom-0 inset-x-0 h-32 z-50 flex items-end justify-end p-8 bg-gradient-to-t from-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
                <button
                  onClick={toggleFullscreen}
                  className="bg-slate-900/90 dark:bg-slate-100/90 hover:bg-slate-900 dark:hover:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-full font-bold shadow-xl backdrop-blur-md flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                >
                  <Minimize size={18} />
                  <span>Avsluta helskärm</span>
                </button>
              </div>
            )}

          </div>
        </main>

        {/* Footer Navigation - MOBILE ONLY */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-sky-500 pb-safe pt-1 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] border-t border-sky-600">
          <div className="flex justify-around items-end h-14">
            {[
              { to: "/", icon: List, label: "Avgångar" },
              { to: "/disruptions", icon: AlertTriangle, label: "Info" },
              { to: "/settings", icon: Settings, label: "Mer" }
            ].map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `flex-1 flex flex-col items-center justify-center h-full gap-1 transition-all active:scale-95 ${isActive ? 'text-white' : 'text-white/60 hover:text-white/80'}`}>
                {({ isActive }) => (
                  <>
                    <div className={`p-1 rounded-full transition-all ${isActive ? 'bg-white/10' : ''}`}>
                      <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span className={`text-[10px] font-bold tracking-wide ${isActive ? 'opacity-100' : 'opacity-80'}`}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
};

import { ToastProvider } from './components/ToastProvider';

export default () => (
  <TranslationProvider>
    <ToastProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </ToastProvider>
  </TranslationProvider>
);
