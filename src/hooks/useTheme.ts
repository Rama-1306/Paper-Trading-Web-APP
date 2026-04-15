'use client';

import { useEffect, useState } from 'react';

export type ThemeId =
    | 'light'
    | 'dark'
    | 'ocean'
    | 'ocean-dark'
    | 'forest'
    | 'forest-dark'
    | 'purple'
    | 'purple-dark';

const THEME_KEY = 'wu-theme';

export function useTheme() {
    const [theme, setThemeState] = useState<ThemeId>('light');
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Read theme from localStorage
        const saved = (localStorage.getItem(THEME_KEY) as ThemeId) || 'light';
        setThemeState(saved);
        applyTheme(saved);
        setIsLoaded(true);
    }, []);

    const setTheme = (newTheme: ThemeId) => {
        localStorage.setItem(THEME_KEY, newTheme);
        setThemeState(newTheme);
        applyTheme(newTheme);
    };

    return { theme, setTheme, isLoaded };
}

function applyTheme(id: ThemeId) {
    if (id === 'light') {
        delete document.documentElement.dataset.theme;
    } else {
        document.documentElement.dataset.theme = id;
    }
}
