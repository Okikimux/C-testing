'use client';

import { useCallback, useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

export type ThemePreference = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'campora-theme';

function prefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Puts the resolved theme on <html>. The CSS reads [data-theme="dark"]. */
export function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && prefersDark());
  const root = document.documentElement;
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.style.colorScheme = dark ? 'dark' : 'light';
}

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  // Read the saved choice after hydration (the head script already painted the right colours).
  useEffect(() => { setPreferenceState(readPreference()); }, []);

  // While on "System", follow the device when it switches between light and dark.
  useEffect(() => {
    if (preference !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [preference]);

  // Keep other open tabs in step.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = readPreference();
      setPreferenceState(next);
      applyTheme(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch { /* storage blocked: the choice still applies for this visit */ }
    applyTheme(next);
  }, []);

  return { preference, setPreference };
}

const OPTIONS: Array<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

/** Light / Dark / System picker, used in the account menu. */
export function ThemeSwitch() {
  const { preference, setPreference } = useTheme();
  return <div className="themeRow">
    <span className="themeLabel" id="theme-label">Appearance</span>
    <div className="themeOptions" role="radiogroup" aria-labelledby="theme-label">
      {OPTIONS.map(({ value, label, Icon }) => <button
        key={value}
        type="button"
        role="radio"
        aria-checked={preference === value}
        onClick={() => setPreference(value)}
      ><Icon size={15} aria-hidden="true" />{label}</button>)}
    </div>
  </div>;
}
