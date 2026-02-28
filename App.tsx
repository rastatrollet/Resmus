import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faSliders, faTriangleExclamation, faBus, faExpand, faCompress, faStar, faGlobe, faTrophy, faList, faCog, faSearch, faExclamationTriangle, faMap } from '@fortawesome/free-solid-svg-icons';
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
import { ToggleSwitch } from './components/ToggleSwitch';
import { TrafikverketService } from './services/trafikverketService';

import { ToastProvider } from './components/ToastProvider';
import { ThemeProvider } from './components/ThemeContext';
import { TripMonitorProvider } from './contexts/TripMonitorContext';

const AppContent = () => {
  // Update checker is now handled by the notification component internally or we can hoist it. 
  // But UpdateNotification uses the hook itself as per my design.

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const location = useLocation();

  // Analytics Tracking for SPA Route Changes
  useEffect(() => {
    if ((window as any).gtag) {
      (window as any).gtag('config', 'G-TGN3ZKHQBS', {
        page_path: location.pathname + location.search
      });
    }
  }, [location]);

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
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);
  return (
    <div className="flex h-[100dvh] w-screen bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 dark:from-slate-950 dark:to-slate-900 overflow-hidden transition-colors duration-300 font-sans selection:bg-sky-500/30 no-context-menu">
      <UpdateNotification />


      {/* --- DESKTOP SIDEBAR (Visible on lg screens) --- */}
      <aside className={`hidden ${isFullscreen ? 'hidden' : 'md:flex'} w-80 flex-col bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-xl border-r border-slate-200/60 dark:border-slate-800/60 z-50 transition-all duration-300`}>
        <div className="p-8">
          <div className="flex items-center gap-4 mb-12 px-2">
            <div className="group relative w-12 h-12">
              <div className="absolute inset-0 bg-sky-500 rounded-2xl rotate-6 transition-transform group-hover:rotate-12 opacity-20 dark:opacity-40"></div>
              <div className="relative w-12 h-12 bg-sky-500 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-sky-500/20 transition-transform group-hover:scale-105 active:scale-95">
                <FontAwesomeIcon icon={faBus} className="text-xl transform -scale-x-100" />
              </div>
            </div>
            <div className="flex flex-col">
              <h1 className="font-black text-3xl text-slate-800 dark:text-white tracking-tighter leading-none">Resmus</h1>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-0.5 mt-1">Beta</span>
            </div>
          </div>

          <nav className="space-y-3 flex-1">
            {[
              { to: "/", icon: faClock, label: "Avgångar" },
              { to: "/map", icon: faMap, label: "Karta" },
              // { to: "/favorites", icon: faStar, label: "Favoriter" },
              { to: "/disruptions", icon: faTriangleExclamation, label: "Störningar" },
              { to: "/settings", icon: faSliders, label: "Inställningar" }
            ].map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-[15px] transition-all duration-300 group relative overflow-hidden ${isActive
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25 translate-x-2'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-none hover:translate-x-1'}`}
              >
                {({ isActive }) => (
                  <>
                    <FontAwesomeIcon icon={icon} className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                    <span className="relative z-10">{label}</span>
                    {isActive && <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20"></div>}
                  </>
                )}
              </NavLink>
            ))}
          </nav>


        </div>

        <div className="mt-auto p-8 space-y-6">
          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="w-full group flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center transition-colors group-hover:bg-sky-100 dark:group-hover:bg-sky-900/30 group-hover:text-sky-600 dark:group-hover:text-sky-400">
              {isFullscreen ? <FontAwesomeIcon icon={faCompress} className="w-3.5 h-3.5" /> : <FontAwesomeIcon icon={faExpand} className="w-3.5 h-3.5" />}
            </div>
            <span>{isFullscreen ? 'Avsluta helskärm' : 'Helskärmsläge'}</span>
          </button>

          {/* Clock Removed */}
        </div>
      </aside >

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col h-full relative w-full">
        {/* Header - Mobile Only - Polished Glass Plus */}
        <header className="md:hidden flex-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 z-[60] pt-safe-top sticky top-0 transition-colors duration-300">
          <div className="max-w-4xl mx-auto w-full px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Logo / Icon */}
              <div className="relative group">
                <div className="absolute inset-0 bg-sky-500 blur-sm opacity-20 rounded-xl"></div>
                <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-sky-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20 relative z-10">
                  <FontAwesomeIcon icon={faBus} className="text-sm transform -scale-x-100" />
                </div>
              </div>
              <span className="font-black text-xl tracking-tighter text-slate-800 dark:text-white leading-none">Resmus</span>
            </div>

            {/* Clock Removed */}
          </div>
        </header>

        {/* Header - Desktop Only - Search Bar Location */}
        <header className={`hidden ${location.pathname === '/map' ? 'md:hidden' : 'md:flex'} flex-none h-24 items-center justify-between px-12 z-40`}>
          <div>
            <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter drop-shadow-sm leading-none mb-1">
              {(() => {
                const path = location.pathname;
                if (path === '/') return 'Avgångar';
                if (path === '/favorites') return 'Favoriter';
                if (path === '/map') return 'Karta';
                if (path === '/disruptions') return 'Störningar';
                if (path === '/settings') return 'Inställningar';
                if (path === '/search') return 'Reseplanerare';
                return 'Resmus';
              })()}
            </h2>
            <p className="text-slate-400 dark:text-slate-500 font-medium text-sm">
              {(() => {
                const path = location.pathname;
                if (path === '/') return 'Hitta din nästa resa';
                if (path === '/disruptions') return 'Trafikläget just nu';
                if (path === '/settings') return 'Anpassa din upplevelse';
                return 'Stockholm & Västra Götaland';
              })()}
            </p>
          </div>
        </header>

        {/* Content Body */}
        <main className={`flex-1 relative overflow-hidden w-full transition-all duration-500 ease-out ${isFullscreen || location.pathname === '/map' ? 'p-0' : 'md:p-8 md:pt-0'}`}>
          <div className={`h-full w-full mx-auto bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-black/50 relative flex flex-col overflow-hidden transition-all duration-500 border border-white/20 dark:border-white/10
                    ${isFullscreen || location.pathname === '/map'
              ? 'max-w-none rounded-none border-none'
              : 'w-full md:rounded-[3rem]'
            }
                `}>

            {/* Top Ad Unit */}


            <Routes>
              <Route path="/" element={<div className="h-full flex flex-col animate-in fade-in duration-300"><DeparturesBoard mode="departures" /></div>} />
              <Route path="/station/:stationId" element={<div className="h-full flex flex-col animate-in fade-in duration-300"><DeparturesBoard mode="departures" /></div>} />
              <Route path="/favorites" element={<div className="h-full flex flex-col animate-in fade-in duration-300"><FavoritesView /></div>} />
              <Route path="/disruptions" element={<div className="h-full flex flex-col animate-in fade-in duration-300"><TrafficDisruptions /></div>} />


              <Route path="/settings" element={
                <div className="h-full flex flex-col animate-in fade-in duration-300">
                  <SettingsView
                    deferredPrompt={deferredPrompt}
                  />
                </div>
              } />

              <Route path="/map/:regionId?" element={<div className="h-full animate-in fade-in zoom-in-95 duration-300"><LiveMap /></div>} />



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
                  <FontAwesomeIcon icon={faCompress} className="text-lg" />
                  <span>Avsluta helskärm</span>
                </button>
              </div>
            )}

          </div>
        </main>

        {/* Footer Navigation - MOBILE ONLY - Fixed Bottom Safe Area */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe shadow-lg">
          <div className="flex justify-between items-center h-16 px-8">
            {[
              { to: "/", icon: faClock, label: "Avgångar" },
              { to: "/search", icon: faSearch, label: "Sök Resa" }, // Added Search per request
              { to: "/map", icon: faMap, label: "Karta" },
              { to: "/disruptions", icon: faTriangleExclamation, label: "Störningar" }, // Changed Label to "Störningar" to match header, removed "Info"
              { to: "/settings", icon: faSliders, label: "Mer" }
            ].map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `flex flex-col items-center justify-center gap-1 transition-all duration-300 ${isActive ? 'text-sky-500 dark:text-sky-400 scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                <FontAwesomeIcon icon={icon} className="text-xl mb-0.5" />
                <span className="text-[10px] font-bold tracking-wide">
                  {label}
                </span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div >
  );
};

export default () => (
  <ThemeProvider>
    <TranslationProvider>
      <ToastProvider>
        <TripMonitorProvider>
          <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppContent />
          </HashRouter>
        </TripMonitorProvider>
      </ToastProvider>
    </TranslationProvider>
  </ThemeProvider>
);
