import React, { useState } from 'react';
import { Settings, Moon, Sun, Monitor, Download, Smartphone, Info, ChevronRight, Palette, Globe, Server } from 'lucide-react';
import { Provider } from '../types';
import { ThemePicker } from './ThemePicker';

interface SettingsViewProps {
  deferredPrompt: any;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ deferredPrompt }) => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system';
  });

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {

      }
      // Clear the deferredPrompt
      (window as any).deferredPrompt = null;
    }
  };

  const [provider, setProvider] = useState<Provider>(() => {
    return (localStorage.getItem('resmus_default_provider') as Provider) || Provider.VASTTRAFIK;
  });

  const updateProvider = (newProvider: Provider) => {
    setProvider(newProvider);
    localStorage.setItem('resmus_default_provider', newProvider);
    // Dispatch event so DeparturesBoard can listen if it wants (optional, but good practice)
    window.dispatchEvent(new Event('storage'));
  };

  const updateTheme = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    const root = window.document.documentElement;
    const isDark = newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');

    if (isDark) {
      root.classList.add('dark');
      metaThemeColor?.setAttribute('content', '#0f172a');
    } else {
      root.classList.remove('dark');
      metaThemeColor?.setAttribute('content', '#0ea5e9');
    }

    // Notify App.tsx of theme change
    window.dispatchEvent(new Event('storage'));
  };


  const settingsSections = [
    {
      title: 'Utseende',
      icon: <Monitor className="text-sky-500" size={20} />,
      items: [
        {
          label: 'Tema',
          value: theme === 'light' ? 'Ljust' : theme === 'dark' ? 'Mörkt' : 'System',
          action: (
            <div className="flex items-center gap-2">
              {[
                { key: 'light', label: 'Ljust', icon: Sun },
                { key: 'dark', label: 'Mörkt', icon: Moon },
                { key: 'system', label: 'System', icon: Monitor }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => updateTheme(key as any)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${theme === key
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          )
        }
      ]
    },
    {
      title: 'Datakälla',
      icon: <Server className="text-emerald-500" size={20} />,
      items: [
        {
          label: 'Förvald API-tjänst',
          value: provider === Provider.VASTTRAFIK ? 'Västtrafik (Standard)' : 'Trafiklab (Hela Sverige)',
          action: (
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateProvider(Provider.VASTTRAFIK)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${provider === Provider.VASTTRAFIK ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-emerald-500'}`}
              >
                Västtrafik
              </button>
              <button
                onClick={() => updateProvider(Provider.RESROBOT)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${provider === Provider.RESROBOT ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-emerald-500'}`}
              >
                Hela Sverige
              </button>
            </div>
          )
        }
      ]
    },
    {
      title: 'App',
      icon: <Smartphone className="text-purple-500" size={20} />,
      items: [
        {
          label: 'Installera appen',
          value: '',
          action: deferredPrompt ? (
            <button
              onClick={handleInstall}
              className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
            >
              <Download size={16} />
              Installera
            </button>
          ) : (
            <span className="text-slate-500 dark:text-slate-400 text-sm">Redan installerad</span>
          )
        }
      ]
    },
    {
      title: 'Om',
      icon: <Info className="text-orange-500" size={20} />,
      items: [
        {
          label: 'Version',
          value: '2026.2.0 (Beta)',
          action: null
        },
        {
          label: 'Utvecklaren',
          value: 'Resmus Development',
          action: null
        },
        {
          label: 'Senast uppdaterad',
          value: new Date().toLocaleString(),
          action: null
        }
      ]
    }
  ];

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-950 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-sky-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-sky-500/20">
            <Settings className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Inställningar</h1>
          <p className="text-slate-600 dark:text-slate-400">Anpassa din upplevelse</p>
        </div>

        {/* Settings Sections */}
        {settingsSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                {section.icon}
                <h2 className="font-bold text-lg text-slate-800 dark:text-white">{section.title}</h2>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {section.items.map((item, itemIndex) => (
                <div key={itemIndex} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex-1">
                    <div className="font-bold text-slate-800 dark:text-white mb-1">{item.label}</div>
                    {item.value && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">{item.value}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {item.action}
                    {!item.action && <ChevronRight className="text-slate-400" size={20} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Resmus 2026 - Modern kollektivtrafik i realtid
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            © 2026 Resmus Development
          </p>
        </div>
      </div>
    </div>
  );
};