import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'mm-theme';

function readStored(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch { /* دسترسی به storage ممکن نیست */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(mode: ThemeMode): void {
  const root = document.documentElement;
  root.setAttribute('data-mm-theme', mode);
  root.setAttribute('data-bs-theme', mode);
  root.classList.toggle('dark-style', mode === 'dark');
  root.classList.toggle('light-style', mode === 'light');
}

/** پیش از بوت انگولار (main.ts) صدا زده می‌شود */
export function applyStoredTheme(): void {
  apply(readStored());
}

/** حالت روشن/تیره‌ی برنامه (در مرورگر کاربر ذخیره می‌شود) */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(readStored());

  toggle(): void {
    this.set(this.mode() === 'dark' ? 'light' : 'dark');
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    apply(mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* نادیده */ }
  }
}
