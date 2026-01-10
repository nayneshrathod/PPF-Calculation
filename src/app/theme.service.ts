import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private readonly THEME_KEY = 'ppf-calc-theme';

    // Signal for reactive theme state
    theme = signal<Theme>(this.getInitialTheme());

    constructor() {
        // Apply theme on initialization
        effect(() => {
            this.applyTheme(this.theme());
        });
    }

    private getInitialTheme(): Theme {
        // Check localStorage first
        const stored = localStorage.getItem(this.THEME_KEY) as Theme | null;
        if (stored === 'light' || stored === 'dark') {
            return stored;
        }

        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }

        return 'light';
    }

    toggleTheme() {
        const newTheme: Theme = this.theme() === 'light' ? 'dark' : 'light';
        this.theme.set(newTheme);
        localStorage.setItem(this.THEME_KEY, newTheme);
    }

    setTheme(theme: Theme) {
        this.theme.set(theme);
        localStorage.setItem(this.THEME_KEY, theme);
    }

    private applyTheme(theme: Theme) {
        const root = document.documentElement;

        if (theme === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
        } else {
            root.classList.add('light');
            root.classList.remove('dark');
        }
    }
}
