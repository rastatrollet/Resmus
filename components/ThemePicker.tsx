import React, { useEffect } from 'react';
import { Check } from 'lucide-react';

const THEMES = {
    sky: {
        name: 'Himmelsblå',
        colors: {
            50: '#f0f9ff',
            100: '#e0f2fe',
            200: '#bae6fd',
            300: '#7dd3fc',
            400: '#38bdf8',
            500: '#0ea5e9',
            600: '#0284c7',
            700: '#0369a1',
            800: '#075985',
            900: '#0c4a6e',
            950: '#082f49',
        }
    },
    emerald: {
        name: 'Smaragd',
        colors: {
            50: '#ecfdf5',
            100: '#d1fae5',
            200: '#a7f3d0',
            300: '#6ee7b7',
            400: '#34d399',
            500: '#10b981',
            600: '#059669',
            700: '#047857',
            800: '#065f46',
            900: '#064e3b',
            950: '#022c22',
        }
    },
    rose: {
        name: 'Ros',
        colors: {
            50: '#fff1f2',
            100: '#ffe4e6',
            200: '#fecdd3',
            300: '#fda4af',
            400: '#fb7185',
            500: '#f43f5e',
            600: '#e11d48',
            700: '#be123c',
            800: '#9f1239',
            900: '#881337',
            950: '#4c0519',
        }
    },
    violet: {
        name: 'Viol',
        colors: {
            50: '#f5f3ff',
            100: '#ede9fe',
            200: '#ddd6fe',
            300: '#c4b5fd',
            400: '#a78bfa',
            500: '#8b5cf6',
            600: '#7c3aed',
            700: '#6d28d9',
            800: '#5b21b6',
            900: '#4c1d95',
            950: '#2e1065',
        }
    },
    amber: {
        name: 'Bärnsten',
        colors: {
            50: '#fffbeb',
            100: '#fef3c7',
            200: '#fde68a',
            300: '#fcd34d',
            400: '#fbbf24',
            500: '#f59e0b',
            600: '#d97706',
            700: '#b45309',
            800: '#92400e',
            900: '#78350f',
            950: '#451a03',
        }
    }
};

type ThemeKey = keyof typeof THEMES;

export const applyAccentTheme = (key: string) => {
    const themeKey = (Object.keys(THEMES).includes(key) ? key : 'sky') as ThemeKey;
    const theme = THEMES[themeKey];
    const root = document.documentElement;

    Object.entries(theme.colors).forEach(([shade, value]) => {
        root.style.setProperty(`--color-primary-${shade}`, value);
    });
};

export const ThemePicker = () => {
    const [currentTheme, setCurrentTheme] = React.useState<ThemeKey>(() => {
        return (localStorage.getItem('resmus_accent_theme') as ThemeKey) || 'sky';
    });

    const [isDark, setIsDark] = React.useState(false);

    useEffect(() => {
        // Apply saved theme on mount
        applyAccentTheme(currentTheme);

        // Check global theme setting (sync with SettingsView)
        const checkTheme = () => {
            const savedTheme = localStorage.getItem('theme');
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const effectiveDark = savedTheme === 'dark' || (savedTheme === 'system' && systemDark); // Default to system-like behavior
            // Note: SettingsView defaults to 'system' if null.

            // Check actual DOM class (source of truth)
            const domHasDark = document.documentElement.classList.contains('dark');
            setIsDark(domHasDark);
        };

        checkTheme();

        // Listen for storage events (if SettingsView changes theme)
        window.addEventListener('storage', checkTheme);
        return () => window.removeEventListener('storage', checkTheme);
    }, []);

    const toggleDark = () => {
        const newMode = !document.documentElement.classList.contains('dark'); // Toggle current state
        setIsDark(newMode);

        const themeVal = newMode ? 'dark' : 'light';
        localStorage.setItem('theme', themeVal);

        // Update DOM immediately
        if (newMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');

        // Notify other components
        window.dispatchEvent(new Event('storage'));
    };

    const handleSelect = (key: ThemeKey) => {
        setCurrentTheme(key);
        localStorage.setItem('resmus_accent_theme', key);
        applyAccentTheme(key);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-xl">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Mörkt läge</span>
                <button
                    onClick={toggleDark}
                    className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`}
                >
                    <span
                        className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform ${isDark ? 'translate-x-6' : 'translate-x-0'}`}
                    />
                </button>
            </div>

            <div className="grid grid-cols-5 gap-2">
                {Object.entries(THEMES).map(([key, theme]) => (
                    <button
                        key={key}
                        onClick={() => handleSelect(key as ThemeKey)}
                        className={`relative group flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${currentTheme === key ? 'bg-slate-100 dark:bg-slate-800 ring-2 ring-offset-2 ring-primary-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        title={theme.name}
                    >
                        <div
                            className="w-8 h-8 rounded-full shadow-sm flex items-center justify-center transition-transform group-hover:scale-110"
                            style={{ backgroundColor: theme.colors[500] }}
                        >
                            {currentTheme === key && <Check size={16} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            {theme.name}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

