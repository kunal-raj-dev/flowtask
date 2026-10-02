import React, { useState } from 'react';
import { useTaskContext, type AppTheme } from '../../context/TaskContext';
import { type SoundProfile, audioEngine } from '../../utils/audioEngine';
import {
  loadDiurnalOverride,
  saveDiurnalOverride,
  type DiurnalOverride,
} from '../../utils/diurnalAura';
import {
  Palette,
  Volume2,
  VolumeX,
  X,
  Check,
  Play,
  Sun,
  Moon,
  Sparkles,
  Compass,
  Leaf,
  Clock,
} from 'lucide-react';

interface AestheticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AestheticsModal: React.FC<AestheticsModalProps> = ({ isOpen, onClose }) => {
  const {
    theme,
    setTheme,
    soundEnabled,
    toggleSound,
    soundProfile,
    setSoundProfile,
  } = useTaskContext();

  const [diurnalOverride, setDiurnalOverride] = useState<DiurnalOverride>(() => loadDiurnalOverride());

  const handleDiurnalSelect = (override: DiurnalOverride) => {
    setDiurnalOverride(override);
    saveDiurnalOverride(override);
  };

  if (!isOpen) return null;

  const themes: {
    id: AppTheme;
    name: string;
    description: string;
    icon: React.FC<{ size?: number; className?: string }>;
    accentColor: string;
    bgPreview: string;
    borderPreview: string;
  }[] = [
    {
      id: 'light',
      name: 'Alabaster Dawn',
      description: 'Things 3 warm paper daylight with gentle daylight aura',
      icon: Sun,
      accentColor: '#F59E0B',
      bgPreview: '#FAF9F6',
      borderPreview: '#E4E2DC',
    },
    {
      id: 'dark',
      name: 'Obsidian Night',
      description: 'Linear deep cosmic obsidian space with moonlight borders',
      icon: Moon,
      accentColor: '#F59E0B',
      bgPreview: '#090B0F',
      borderPreview: '#1E232F',
    },
    {
      id: 'tokyo',
      name: 'Tokyo Dusk',
      description: 'Cyberpunk midnight navy with glowing indigo & cyan accents',
      icon: Sparkles,
      accentColor: '#6366F1',
      bgPreview: '#0B0F19',
      borderPreview: '#252F47',
    },
    {
      id: 'nord',
      name: 'Nordic Slate',
      description: 'Arctic mountain slate with cool frost & ice-blue calmness',
      icon: Compass,
      accentColor: '#88C0D0',
      bgPreview: '#242933',
      borderPreview: '#3B4252',
    },
    {
      id: 'matcha',
      name: 'Forest Matcha',
      description: 'Organic sage & calming tea green with warm earthy tranquility',
      icon: Leaf,
      accentColor: '#65A30D',
      bgPreview: '#F4F6F0',
      borderPreview: '#DFE8D5',
    },
  ];

  const soundProfiles: {
    id: SoundProfile;
    name: string;
    description: string;
  }[] = [
    {
      id: 'zen',
      name: 'Zen Singing Bowl',
      description: 'Resonant harmonic Tibetan chime for mindful completion',
    },
    {
      id: 'mechanical',
      name: 'Mechanical Switch',
      description: 'Crisp tactile keystroke snap for high-speed velocity',
    },
    {
      id: 'bubble',
      name: 'Minimal Pop',
      description: 'Soft organic water bubble pop for gentle feedback',
    },
    {
      id: 'mute',
      name: 'Completely Silent',
      description: 'Zero sound effects for total distraction-free silence',
    },
  ];

  const handleTestSound = (profile: SoundProfile, type: 'chime' | 'pop' | 'toggle' = 'chime') => {
    const prev = audioEngine.getSoundProfile();
    audioEngine.setSoundProfile(profile);
    if (type === 'pop') {
      audioEngine.playClickSound();
    } else if (type === 'toggle') {
      audioEngine.playToggleSound(true);
    } else {
      audioEngine.playCompletionChime();
    }
    audioEngine.setSoundProfile(prev);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xl animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] rounded-3xl shadow-modal overflow-hidden card-surface animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Palette size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Aesthetics & Tactile Sound Profiles
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Tailor your workspace atmosphere for deep focus
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Curated Pro Themes */}
          <div>
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
              Color Atmosphere & Themes
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {themes.map((t) => {
                const Icon = t.icon;
                const isSelected = theme === t.id;

                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`relative p-3.5 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between gap-3 card-surface ${
                      isSelected
                        ? 'border-amber-500 ring-2 ring-amber-500/25 shadow-sm'
                        : 'border-[var(--border-hairline)] hover:border-stone-400 dark:hover:border-stone-600'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border shadow-inner flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: t.bgPreview,
                            borderColor: t.borderPreview,
                          }}
                        />
                        <Icon size={14} className="text-[var(--text-secondary)] shrink-0" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {t.name}
                        </span>
                      </div>

                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center">
                          <Check size={10} className="stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                      {t.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Tactile Sound Profiles */}
          <div className="pt-2 border-t border-[var(--border-hairline)]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Tactile Audio Engine
              </div>

              <button
                onClick={toggleSound}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                  soundEnabled
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-stone-200/50 dark:bg-white/[0.04] text-[var(--text-muted)] border-transparent'
                }`}
              >
                {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                <span>{soundEnabled ? 'Audio Enabled' : 'Muted'}</span>
              </button>
            </div>

            <div className="space-y-2">
              {soundProfiles.map((sp) => {
                const isSelected = soundProfile === sp.id;

                return (
                  <div
                    key={sp.id}
                    onClick={() => setSoundProfile(sp.id)}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer card-surface ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500/20'
                        : 'border-[var(--border-hairline)] hover:bg-stone-200/40 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {sp.name}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-bold font-mono px-1.5 py-0.2 rounded bg-indigo-500 text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        {sp.description}
                      </p>
                    </div>

                    {sp.id !== 'mute' && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestSound(sp.id, 'pop');
                          }}
                          title={`Preview ${sp.name} click/pop sound`}
                          className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-white/10 text-[var(--text-primary)] hover:bg-stone-200 dark:hover:bg-white/15 transition-colors flex items-center gap-1 text-[10px] font-semibold"
                        >
                          <Play size={8} className="fill-current text-sky-500" />
                          <span>Pop</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestSound(sp.id, 'toggle');
                          }}
                          title={`Preview ${sp.name} toggle tone`}
                          className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-white/10 text-[var(--text-primary)] hover:bg-stone-200 dark:hover:bg-white/15 transition-colors flex items-center gap-1 text-[10px] font-semibold"
                        >
                          <Play size={8} className="fill-current text-amber-500" />
                          <span>Toggle</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestSound(sp.id, 'chime');
                          }}
                          title={`Preview ${sp.name} completion chime`}
                          className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-white/10 text-[var(--text-primary)] hover:bg-stone-200 dark:hover:bg-white/15 transition-colors flex items-center gap-1 text-[10px] font-semibold"
                        >
                          <Play size={8} className="fill-current text-emerald-500" />
                          <span>Chime</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Diurnal Circadian Ambient Shift */}
          <div className="pt-2 border-t border-[var(--border-hairline)]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={12} className="text-amber-500" />
                <span>Diurnal Ambient Atmosphere</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {diurnalOverride === 'auto' ? 'Dynamic Time-of-Day' : 'Locked'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  id: 'auto' as const,
                  label: 'Auto (Circadian)',
                  desc: 'Follows local clock automatically',
                  preview: 'from-amber-400/20 via-sky-400/20 to-violet-600/20',
                },
                {
                  id: 'morning' as const,
                  label: 'Morning Dawn',
                  desc: 'Warm amber & rose luminescence',
                  preview: 'from-amber-400/30 to-rose-400/20',
                },
                {
                  id: 'midday' as const,
                  label: 'Midday Zenith',
                  desc: 'Electric indigo & sky clarity',
                  preview: 'from-indigo-500/30 to-sky-400/20',
                },
                {
                  id: 'evening' as const,
                  label: 'Evening Cosmic',
                  desc: 'Deep cosmic obsidian & violet',
                  preview: 'from-violet-700/30 to-slate-900/30',
                },
              ].map((item) => {
                const isSelected = diurnalOverride === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleDiurnalSelect(item.id)}
                    className={`p-2.5 rounded-2xl border text-left transition-all relative overflow-hidden card-surface ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/25'
                        : 'border-[var(--border-hairline)] hover:bg-stone-200/40 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        {item.label}
                      </span>
                      {isSelected && <Check size={12} className="text-amber-500 stroke-[3]" />}
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] leading-tight mb-2">
                      {item.desc}
                    </p>
                    <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${item.preview}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
