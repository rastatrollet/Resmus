import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        // Read from localStorage implicitly handles persistence
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            return (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system';
        }
        return 'system';
    });

    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const root = window.document.documentElement;

        const applyTheme = () => {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const effectiveDark = theme === 'dark' || (theme === 'system' && systemDark);

            setIsDark(effectiveDark);

            if (effectiveDark) {
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
        const handleSystemChange = () => {
            if (theme === 'system') applyTheme();
        };

        mediaQuery.addEventListener('change', handleSystemChange);
        return () => mediaQuery.removeEventListener('change', handleSystemChange);
    }, [theme]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
