import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Sun, Moon, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CommTheme = 'dark' | 'light' | 'midnight';

const STORAGE_KEY = 'comm_theme';

interface ThemePalette {
  bg: string;        // page background
  panel: string;     // panel/list background
  panelAlt: string;  // alt panel (slightly different)
  border: string;
  text: string;
  textMuted: string;
  accent: string;        // accent fill (buttons, badges)
  accentSoft: string;    // soft accent (active row tint)
  bubbleOut: string;     // outgoing message bubble
  bubbleIn: string;      // incoming message bubble
  bubbleOutText: string;
  bubbleInText: string;
}

const palettes: Record<CommTheme, ThemePalette> = {
  dark: {
    bg: '#1a1a2e',
    panel: '#16213e',
    panelAlt: '#1f2a4a',
    border: 'rgba(255,255,255,0.08)',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.55)',
    accent: '#00d2ff',
    accentSoft: 'rgba(0,210,255,0.12)',
    bubbleOut: '#00d2ff',
    bubbleIn: '#1f2a4a',
    bubbleOutText: '#0b1020',
    bubbleInText: '#ffffff',
  },
  light: {
    bg: '#ffffff',
    panel: '#f0f2f5',
    panelAlt: '#e9ebef',
    border: 'rgba(0,0,0,0.08)',
    text: '#111b21',
    textMuted: 'rgba(17,27,33,0.55)',
    accent: '#25D366',
    accentSoft: 'rgba(37,211,102,0.12)',
    bubbleOut: '#dcf8c6',
    bubbleIn: '#ffffff',
    bubbleOutText: '#111b21',
    bubbleInText: '#111b21',
  },
  midnight: {
    bg: '#000000',
    panel: '#111111',
    panelAlt: '#1a1a1a',
    border: 'rgba(255,255,255,0.06)',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.5)',
    accent: '#7c3aed',
    accentSoft: 'rgba(124,58,237,0.18)',
    bubbleOut: '#7c3aed',
    bubbleIn: '#1a1a1a',
    bubbleOutText: '#ffffff',
    bubbleInText: '#ffffff',
  },
};

interface CommThemeCtx {
  theme: CommTheme;
  setTheme: (t: CommTheme) => void;
  cycle: () => void;
  palette: ThemePalette;
}

const Ctx = createContext<CommThemeCtx | null>(null);

function readInitial(): CommTheme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light' || stored === 'midnight') return stored;
  return 'dark';
}

export function useCommTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCommTheme must be used inside CommThemeProvider');
  return ctx;
}

interface ProviderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps a communication page with themeable CSS variables.
 * The wrapper itself sets the background + text color, so all children
 * automatically inherit the theme.
 */
export function CommThemeProvider({ children, className }: ProviderProps) {
  const [theme, setThemeState] = useState<CommTheme>(readInitial);
  const palette = palettes[theme];

  const setTheme = useCallback((t: CommTheme) => {
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
  }, []);

  const cycle = useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'dark' ? 'light' : prev === 'light' ? 'midnight' : 'dark';
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'dark' || e.newValue === 'light' || e.newValue === 'midnight')) {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const styleVars = {
    '--comm-bg': palette.bg,
    '--comm-panel': palette.panel,
    '--comm-panel-alt': palette.panelAlt,
    '--comm-border': palette.border,
    '--comm-text': palette.text,
    '--comm-text-muted': palette.textMuted,
    '--comm-accent': palette.accent,
    '--comm-accent-soft': palette.accentSoft,
    '--comm-bubble-out': palette.bubbleOut,
    '--comm-bubble-in': palette.bubbleIn,
    '--comm-bubble-out-text': palette.bubbleOutText,
    '--comm-bubble-in-text': palette.bubbleInText,
    backgroundColor: palette.bg,
    color: palette.text,
  } as React.CSSProperties;

  return (
    <Ctx.Provider value={{ theme, setTheme, cycle, palette }}>
      <div data-comm-theme={theme} className={cn('min-h-full', className)} style={styleVars}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

/** Small icon button that cycles dark → light → midnight → dark */
export function CommThemeToggle({ className }: { className?: string }) {
  const { theme, cycle, palette } = useCommTheme();
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Sparkles;
  const label = theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'Midnight';

  return (
    <button
      onClick={cycle}
      title={`Theme: ${label} (click to switch)`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all hover-scale',
        className
      )}
      style={{
        backgroundColor: palette.accentSoft,
        color: palette.accent,
        border: `1px solid ${palette.border}`,
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}

/** Generate a deterministic color from a string (for avatar fallbacks). */
export function colorFromName(name?: string | null): string {
  if (!name) return '#64748b';
  const palette = ['#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#84cc16'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export function initialsFromName(name?: string | null): string {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/** Friendly relative timestamp: just now / Xm / HH:MM / Mon DD */
export function formatCommTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m`;
  const sameDay = new Date(now).toDateString() === d.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
