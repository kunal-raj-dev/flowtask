/**
 * Diurnal Dynamic Ambient Glow & Shift Engine
 * Shifts ambient lighting organically across time of day:
 * - Morning (06:00 – 12:00): Warm amber/rose luminescence
 * - Midday (12:00 – 18:00): Electric indigo/sky clarity
 * - Evening/Night (18:00 – 06:00): Deep cosmic obsidian/violet calm
 */

export type DiurnalPeriod = 'morning' | 'midday' | 'evening';
export type DiurnalOverride = 'auto' | 'morning' | 'midday' | 'evening';

export interface DiurnalConfig {
  period: DiurnalPeriod;
  label: string;
  description: string;
  orb1Class: string;
  orb2Class: string;
  orb3Class: string;
  orb4Class: string;
}

const DIURNAL_CONFIGS: Record<DiurnalPeriod, DiurnalConfig> = {
  morning: {
    period: 'morning',
    label: 'Morning Dawn',
    description: 'Warm amber & rose luminescence for peaceful morning intention',
    orb1Class: 'bg-amber-400/[0.06] dark:bg-amber-500/[0.04]',
    orb2Class: 'bg-rose-400/[0.05] dark:bg-rose-500/[0.03]',
    orb3Class: 'bg-orange-300/[0.04] dark:bg-orange-600/[0.02]',
    orb4Class: 'bg-yellow-200/[0.04] dark:bg-yellow-500/[0.02]',
  },
  midday: {
    period: 'midday',
    label: 'Midday Zenith',
    description: 'Electric indigo & sky clarity for high-output deep work',
    orb1Class: 'bg-indigo-500/[0.05] dark:bg-indigo-600/[0.04]',
    orb2Class: 'bg-sky-400/[0.04] dark:bg-sky-500/[0.03]',
    orb3Class: 'bg-stone-400/[0.03] dark:bg-stone-600/[0.02]',
    orb4Class: 'bg-slate-400/[0.03] dark:bg-slate-600/[0.02]',
  },
  evening: {
    period: 'evening',
    label: 'Evening Cosmic',
    description: 'Deep cosmic obsidian & violet calm for mindful wrap-up',
    orb1Class: 'bg-violet-700/[0.04] dark:bg-violet-800/[0.03]',
    orb2Class: 'bg-indigo-800/[0.04] dark:bg-indigo-950/[0.05]',
    orb3Class: 'bg-stone-800/[0.03] dark:bg-stone-900/[0.04]',
    orb4Class: 'bg-slate-700/[0.03] dark:bg-slate-900/[0.05]',
  },
};

const STORAGE_KEY = 'flowtask_diurnal_override';

export function getDiurnalPeriod(override?: DiurnalOverride, date: Date = new Date()): DiurnalPeriod {
  const effectiveOverride = override || loadDiurnalOverride();
  if (effectiveOverride !== 'auto') {
    return effectiveOverride;
  }

  const hour = date.getHours();
  if (hour >= 6 && hour < 12) {
    return 'morning';
  }
  if (hour >= 12 && hour < 18) {
    return 'midday';
  }
  return 'evening';
}

export function getDiurnalConfig(period: DiurnalPeriod): DiurnalConfig {
  return DIURNAL_CONFIGS[period] || DIURNAL_CONFIGS.midday;
}

export function loadDiurnalOverride(): DiurnalOverride {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      const saved = localStorage.getItem(STORAGE_KEY) as DiurnalOverride;
      if (saved && (saved === 'auto' || saved === 'morning' || saved === 'midday' || saved === 'evening')) {
        return saved;
      }
    }
  } catch {
    // LocalStorage unavailable
  }
  return 'auto';
}

export function saveDiurnalOverride(override: DiurnalOverride): void {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(STORAGE_KEY, override);
    }
  } catch {
    // LocalStorage unavailable
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('diurnal-change', { detail: override }));
  }
}
