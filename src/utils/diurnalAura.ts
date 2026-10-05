/**
 * Diurnal Dynamic Ambient Glow & Shift Engine
 * Shifts ambient lighting organically across time of day or thematic flow states:
 *
 * Circadian Rhythms:
 * - Morning Dawn (06:00 – 12:00): Warm amber & rose luminescence
 * - Midday Zenith (12:00 – 17:00): Electric indigo & sky clarity
 * - Golden Dusk (17:00 – 20:00): Warm terracotta & copper sunset aura
 * - Evening Cosmic (20:00 – 00:00): Deep cosmic obsidian & violet calm
 * - Midnight Starlight (00:00 – 06:00): Ethereal deep space obsidian & cyan/indigo calm
 *
 * Specialized Flow Atmospheres:
 * - Northern Aurora (Borealis): Polar emerald, arctic teal & violet ribbon glow
 * - Solar Flare (High Energy): Radiant coral, vivid tangerine & energized crimson
 * - Forest Canopy (Zen Moss): Grounding deep emerald, sage luminescence & herbal mist
 * - Cyber Synthwave (Retro Neon): Cyberpunk hot magenta, electric cyan & dark grid glow
 * - Oceanic Abyss (Bioluminescence): Marine sapphire, abyss cyan & fathom deep navy
 * - Twilight Lavender (Velvet Calm): Soothing lilac, amethyst aura & dreamlike mist
 */

export type DiurnalPeriod =
  | 'morning'
  | 'midday'
  | 'dusk'
  | 'evening'
  | 'midnight'
  | 'aurora'
  | 'solar'
  | 'forest'
  | 'synthwave'
  | 'abyss'
  | 'twilight';

export type DiurnalOverride = 'auto' | DiurnalPeriod;

export interface DiurnalConfig {
  period: DiurnalPeriod;
  label: string;
  subtitle: string;
  description: string;
  timeTag: string;
  category: 'circadian' | 'thematic';
  previewGradient: string;
  glowColor1: string;
  glowColor2: string;
  orb1Class: string;
  orb2Class: string;
  orb3Class: string;
  orb4Class: string;
}

export const DIURNAL_CONFIGS: Record<DiurnalPeriod, DiurnalConfig> = {
  morning: {
    period: 'morning',
    label: 'Morning Dawn',
    subtitle: 'Warm Amber & Rose',
    description: 'Warm amber & rose luminescence for peaceful morning intention',
    timeTag: '06:00 – 12:00',
    category: 'circadian',
    previewGradient: 'from-amber-400 via-rose-400 to-orange-400',
    glowColor1: '#F59E0B',
    glowColor2: '#F43F5E',
    orb1Class: 'bg-amber-400/35 dark:bg-amber-500/28',
    orb2Class: 'bg-rose-400/30 dark:bg-rose-500/25',
    orb3Class: 'bg-orange-400/25 dark:bg-orange-600/20',
    orb4Class: 'bg-amber-300/20 dark:bg-yellow-500/18',
  },
  midday: {
    period: 'midday',
    label: 'Midday Zenith',
    subtitle: 'Electric Sky & Indigo',
    description: 'Electric indigo & sky clarity for high-output deep work',
    timeTag: '12:00 – 17:00',
    category: 'circadian',
    previewGradient: 'from-indigo-500 via-sky-400 to-blue-500',
    glowColor1: '#6366F1',
    glowColor2: '#38BDF8',
    orb1Class: 'bg-indigo-500/35 dark:bg-indigo-600/28',
    orb2Class: 'bg-sky-400/30 dark:bg-sky-500/25',
    orb3Class: 'bg-blue-500/25 dark:bg-blue-600/20',
    orb4Class: 'bg-cyan-400/20 dark:bg-cyan-600/18',
  },
  dusk: {
    period: 'dusk',
    label: 'Golden Dusk',
    subtitle: 'Copper & Terracotta',
    description: 'Warm terracotta & copper sunset horizon for relaxed focus',
    timeTag: '17:00 – 20:00',
    category: 'circadian',
    previewGradient: 'from-amber-500 via-orange-500 to-purple-800',
    glowColor1: '#EA580C',
    glowColor2: '#9333EA',
    orb1Class: 'bg-amber-500/35 dark:bg-amber-600/28',
    orb2Class: 'bg-orange-500/30 dark:bg-orange-600/25',
    orb3Class: 'bg-rose-500/28 dark:bg-rose-700/22',
    orb4Class: 'bg-purple-700/25 dark:bg-purple-900/28',
  },
  evening: {
    period: 'evening',
    label: 'Evening Cosmic',
    subtitle: 'Obsidian & Royal Violet',
    description: 'Deep cosmic obsidian & violet calm for mindful wrap-up',
    timeTag: '20:00 – 00:00',
    category: 'circadian',
    previewGradient: 'from-violet-600 via-purple-700 to-indigo-900',
    glowColor1: '#8B5CF6',
    glowColor2: '#4F46E5',
    orb1Class: 'bg-violet-600/35 dark:bg-violet-700/30',
    orb2Class: 'bg-indigo-600/30 dark:bg-indigo-800/28',
    orb3Class: 'bg-purple-600/28 dark:bg-purple-950/25',
    orb4Class: 'bg-blue-700/25 dark:bg-slate-900/35',
  },
  midnight: {
    period: 'midnight',
    label: 'Midnight Starlight',
    subtitle: 'Deep Space & Cyan Nebula',
    description: 'Deep celestial obsidian & starlight shimmer for quiet hyperfocus',
    timeTag: '00:00 – 06:00',
    category: 'circadian',
    previewGradient: 'from-indigo-900 via-cyan-500 to-slate-950',
    glowColor1: '#06B6D4',
    glowColor2: '#3B82F6',
    orb1Class: 'bg-indigo-700/35 dark:bg-indigo-950/35',
    orb2Class: 'bg-cyan-500/30 dark:bg-cyan-500/25',
    orb3Class: 'bg-violet-900/28 dark:bg-violet-950/30',
    orb4Class: 'bg-blue-900/30 dark:bg-slate-950/40',
  },
  aurora: {
    period: 'aurora',
    label: 'Northern Aurora',
    subtitle: 'Borealis Emerald & Teal',
    description: 'Emerald green, arctic teal & polar violet electromagnetic ribbons',
    timeTag: 'Flow State',
    category: 'thematic',
    previewGradient: 'from-emerald-400 via-teal-400 to-violet-600',
    glowColor1: '#10B981',
    glowColor2: '#8B5CF6',
    orb1Class: 'bg-emerald-500/35 dark:bg-emerald-500/30',
    orb2Class: 'bg-teal-400/32 dark:bg-teal-500/28',
    orb3Class: 'bg-cyan-400/28 dark:bg-cyan-600/24',
    orb4Class: 'bg-violet-600/26 dark:bg-purple-900/30',
  },
  solar: {
    period: 'solar',
    label: 'Solar Flare',
    subtitle: 'High-Energy Crimson & Gold',
    description: 'Radiant coral, vivid tangerine & energetic crimson for peak sprint bursts',
    timeTag: 'Peak Energy',
    category: 'thematic',
    previewGradient: 'from-orange-500 via-rose-500 to-amber-400',
    glowColor1: '#F97316',
    glowColor2: '#EF4444',
    orb1Class: 'bg-orange-500/38 dark:bg-orange-500/30',
    orb2Class: 'bg-rose-500/34 dark:bg-rose-600/28',
    orb3Class: 'bg-amber-400/30 dark:bg-amber-600/25',
    orb4Class: 'bg-red-500/28 dark:bg-red-900/28',
  },
  forest: {
    period: 'forest',
    label: 'Forest Canopy',
    subtitle: 'Zen Moss & Herbal Sage',
    description: 'Grounding deep emerald, sage luminescence & herbal eucalyptus mist',
    timeTag: 'Grounding Calm',
    category: 'thematic',
    previewGradient: 'from-emerald-600 via-green-500 to-teal-700',
    glowColor1: '#059669',
    glowColor2: '#10B981',
    orb1Class: 'bg-emerald-600/35 dark:bg-emerald-700/30',
    orb2Class: 'bg-green-500/32 dark:bg-green-600/26',
    orb3Class: 'bg-teal-600/28 dark:bg-teal-800/24',
    orb4Class: 'bg-lime-600/22 dark:bg-emerald-950/35',
  },
  synthwave: {
    period: 'synthwave',
    label: 'Cyber Synthwave',
    subtitle: 'Neon Magenta & Cyan',
    description: 'Cyberpunk hot magenta, electric cyan & dark grid glow for retro hacking',
    timeTag: 'Cyber Focus',
    category: 'thematic',
    previewGradient: 'from-fuchsia-500 via-cyan-400 to-purple-800',
    glowColor1: '#D946EF',
    glowColor2: '#06B6D4',
    orb1Class: 'bg-fuchsia-500/35 dark:bg-fuchsia-600/30',
    orb2Class: 'bg-cyan-400/32 dark:bg-cyan-500/28',
    orb3Class: 'bg-pink-500/30 dark:bg-pink-600/25',
    orb4Class: 'bg-indigo-600/28 dark:bg-purple-950/35',
  },
  abyss: {
    period: 'abyss',
    label: 'Oceanic Abyss',
    subtitle: 'Marine Sapphire & Fathom Navy',
    description: 'Deep marine sapphire, abyss cyan & fathom deep navy contemplation',
    timeTag: 'Deep Think',
    category: 'thematic',
    previewGradient: 'from-blue-600 via-cyan-500 to-slate-950',
    glowColor1: '#2563EB',
    glowColor2: '#06B6D4',
    orb1Class: 'bg-blue-600/35 dark:bg-blue-700/30',
    orb2Class: 'bg-cyan-500/32 dark:bg-cyan-600/26',
    orb3Class: 'bg-teal-500/28 dark:bg-teal-700/24',
    orb4Class: 'bg-indigo-950/35 dark:bg-slate-950/42',
  },
  twilight: {
    period: 'twilight',
    label: 'Twilight Lavender',
    subtitle: 'Soothing Amethyst & Lilac',
    description: 'Soothing lilac, amethyst aura & dreamlike twilight mist for unwinding',
    timeTag: 'Soothing Focus',
    category: 'thematic',
    previewGradient: 'from-purple-400 via-pink-400 to-indigo-600',
    glowColor1: '#A855F7',
    glowColor2: '#EC4899',
    orb1Class: 'bg-purple-400/35 dark:bg-purple-500/28',
    orb2Class: 'bg-indigo-400/32 dark:bg-indigo-500/26',
    orb3Class: 'bg-pink-400/26 dark:bg-pink-600/22',
    orb4Class: 'bg-violet-700/26 dark:bg-slate-900/32',
  },
};

const STORAGE_KEY = 'flowtask_diurnal_override';
const INTENSITY_KEY = 'flowtask_diurnal_intensity';
export const DEFAULT_DIURNAL_INTENSITY = 0.65; // 65% balanced presence

export function getDiurnalPeriod(override?: DiurnalOverride, date: Date = new Date()): DiurnalPeriod {
  const effectiveOverride = override || loadDiurnalOverride();
  if (effectiveOverride !== 'auto') {
    return effectiveOverride;
  }

  const hour = date.getHours();
  if (hour >= 6 && hour < 12) {
    return 'morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'midday';
  }
  if (hour >= 17 && hour < 20) {
    return 'dusk';
  }
  if (hour >= 20 && hour < 24) {
    return 'evening';
  }
  return 'midnight';
}

export function getDiurnalConfig(period: DiurnalPeriod): DiurnalConfig {
  return DIURNAL_CONFIGS[period] || DIURNAL_CONFIGS.midday;
}

export function loadDiurnalOverride(): DiurnalOverride {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      const saved = localStorage.getItem(STORAGE_KEY) as DiurnalOverride;
      if (saved && (saved === 'auto' || Object.prototype.hasOwnProperty.call(DIURNAL_CONFIGS, saved))) {
        return saved;
      }
    }
  } catch {
    // LocalStorage unavailable
  }
  return 'auto';
}

export function loadDiurnalIntensity(): number {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      const saved = localStorage.getItem(INTENSITY_KEY);
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 1.0) {
          return parsed;
        }
      }
    }
  } catch {
    // LocalStorage unavailable
  }
  return DEFAULT_DIURNAL_INTENSITY;
}

export function saveDiurnalIntensity(intensity: number): void {
  const clamped = Math.max(0.1, Math.min(1.0, intensity));
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(INTENSITY_KEY, clamped.toString());
    }
  } catch {
    // LocalStorage unavailable
  }

  const period = getDiurnalPeriod();
  applyDiurnalToDom(period, clamped);

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('diurnal-change', {
      detail: { override: loadDiurnalOverride(), period, intensity: clamped },
    }));
  }
}

export function applyDiurnalToDom(period: DiurnalPeriod, intensity: number = loadDiurnalIntensity()): void {
  if (typeof document === 'undefined') return;
  const config = getDiurnalConfig(period);
  const root = document.documentElement;
  root.setAttribute('data-diurnal', period);
  root.style.setProperty('--diurnal-glow-1', config.glowColor1);
  root.style.setProperty('--diurnal-glow-2', config.glowColor2);
  root.style.setProperty('--diurnal-intensity', intensity.toString());
}

export function saveDiurnalOverride(override: DiurnalOverride): void {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(STORAGE_KEY, override);
    }
  } catch {
    // LocalStorage unavailable
  }

  const period = getDiurnalPeriod(override);
  const intensity = loadDiurnalIntensity();
  applyDiurnalToDom(period, intensity);

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('diurnal-change', {
      detail: { override, period, intensity },
    }));
  }
}
