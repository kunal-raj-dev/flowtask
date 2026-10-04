import React, { useState, useEffect } from 'react';
import { useTaskContext, type AppTheme } from '../../context/TaskContext';
import { type SoundProfile, type AmbientSoundType, audioEngine } from '../../utils/audioEngine';
import {
  loadDiurnalOverride,
  saveDiurnalOverride,
  type DiurnalOverride,
} from '../../utils/diurnalAura';
import {
  Palette,
  Volume2,
  VolumeX,
  Volume1,
  X,
  Check,
  Play,
  Pause,
  Sun,
  Moon,
  Sparkles,
  Compass,
  Leaf,
  BookOpen,
  Flame,
  Waves,
  Clock,
  RotateCcw,
  Headphones,
  Radio,
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
  const [tactileVolume, setTactileVolume] = useState<number>(() => audioEngine.getVolume());
  const [ambientType, setAmbientType] = useState<AmbientSoundType>(() => audioEngine.getCurrentAmbientType());
  const [ambientVolume, setAmbientVolume] = useState<number>(() => audioEngine.getAmbientVolume());
  const [auditioningKey, setAuditioningKey] = useState<string | null>(null);

  // Synchronize ambient state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmbientType(audioEngine.getCurrentAmbientType());
      setAmbientVolume(audioEngine.getAmbientVolume());
      setTactileVolume(audioEngine.getVolume());
    }
  }, [isOpen]);

  const handleDiurnalSelect = (override: DiurnalOverride) => {
    setDiurnalOverride(override);
    saveDiurnalOverride(override);
  };

  const handleTactileVolumeChange = (newVol: number) => {
    setTactileVolume(newVol);
    audioEngine.setVolume(newVol);
    audioEngine.playClickSound(undefined, true);
  };

  const handleAmbientVolumeChange = (newVol: number) => {
    setAmbientVolume(newVol);
    audioEngine.setAmbientVolume(newVol);
  };

  const handleToggleAmbient = (type: AmbientSoundType) => {
    if (ambientType === type) {
      audioEngine.stopAmbientSound();
      setAmbientType('none');
    } else {
      audioEngine.startAmbientSound(type, ambientVolume);
      setAmbientType(type);
    }
  };

  const handleTestSound = (profile: SoundProfile, type: 'chime' | 'pop' | 'toggle' = 'chime') => {
    const key = `${profile}-${type}`;
    setAuditioningKey(key);
    audioEngine.auditionSound(profile, type);
    setTimeout(() => {
      setAuditioningKey((current) => (current === key ? null : current));
    }, 450);
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
    surfacePreview: string;
    badge: 'Light' | 'Dark';
  }[] = [
    {
      id: 'light',
      name: 'Alabaster Dawn',
      description: 'Things 3 warm paper daylight with gentle daylight aura',
      icon: Sun,
      accentColor: '#F59E0B',
      bgPreview: '#FAF9F6',
      borderPreview: '#E4E2DC',
      surfacePreview: '#FFFFFF',
      badge: 'Light',
    },
    {
      id: 'dark',
      name: 'Obsidian Night',
      description: 'Linear deep cosmic obsidian space with moonlight borders',
      icon: Moon,
      accentColor: '#F59E0B',
      bgPreview: '#090B0F',
      borderPreview: '#1E232F',
      surfacePreview: '#14171F',
      badge: 'Dark',
    },
    {
      id: 'tokyo',
      name: 'Tokyo Dusk',
      description: 'Cyberpunk midnight navy with glowing indigo & cyan accents',
      icon: Sparkles,
      accentColor: '#6366F1',
      bgPreview: '#0B0F19',
      borderPreview: '#252F47',
      surfacePreview: '#182032',
      badge: 'Dark',
    },
    {
      id: 'nord',
      name: 'Nordic Slate',
      description: 'Arctic mountain slate with cool frost & ice-blue calmness',
      icon: Compass,
      accentColor: '#88C0D0',
      bgPreview: '#242933',
      borderPreview: '#3B4252',
      surfacePreview: '#3B4252',
      badge: 'Dark',
    },
    {
      id: 'matcha',
      name: 'Forest Matcha',
      description: 'Organic sage & calming tea green with warm earthy tranquility',
      icon: Leaf,
      accentColor: '#65A30D',
      bgPreview: '#F4F6F0',
      borderPreview: '#DFE8D5',
      surfacePreview: '#FFFFFF',
      badge: 'Light',
    },
    {
      id: 'sepia',
      name: 'Solarized Sepia',
      description: 'Warm editorial parchment papyrus with soothing terracotta tones',
      icon: BookOpen,
      accentColor: '#C26D28',
      bgPreview: '#FBF7EE',
      borderPreview: '#EDE5D0',
      surfacePreview: '#FFFDF8',
      badge: 'Light',
    },
    {
      id: 'crimson',
      name: 'Cyber Crimson',
      description: 'Deep velvet obsidian with vivid electric ruby & neon cherry aura',
      icon: Flame,
      accentColor: '#F43F5E',
      bgPreview: '#0D080B',
      borderPreview: '#291824',
      surfacePreview: '#1E121A',
      badge: 'Dark',
    },
    {
      id: 'cobalt',
      name: 'Deep Cobalt',
      description: 'Oceanic midnight abyss with bioluminescent cyan & sapphire borders',
      icon: Waves,
      accentColor: '#06B6D4',
      bgPreview: '#060B14',
      borderPreview: '#182846',
      surfacePreview: '#101D33',
      badge: 'Dark',
    },
  ];

  const soundProfiles: {
    id: SoundProfile;
    name: string;
    description: string;
    tag: string;
  }[] = [
    {
      id: 'zen',
      name: 'Zen Singing Bowl',
      description: 'Resonant harmonic Tibetan chime for mindful completion',
      tag: 'Harmonic',
    },
    {
      id: 'mechanical',
      name: 'Mechanical Switch',
      description: 'Crisp tactile keystroke snap for high-speed velocity',
      tag: 'Clicky',
    },
    {
      id: 'bubble',
      name: 'Minimal Pop',
      description: 'Soft organic water bubble pop for gentle feedback',
      tag: 'Organic',
    },
    {
      id: 'marimba',
      name: 'Marimba Teak',
      description: 'Warm acoustic wooden percussion bar with resonant decay',
      tag: 'Wooden',
    },
    {
      id: 'typewriter',
      name: 'Retro Typewriter',
      description: 'Vintage typebar strike with metallic carriage bell ping',
      tag: 'Vintage',
    },
    {
      id: 'synth',
      name: 'Cosmic Synth',
      description: '80s analog FM synthesizer blip with polyphonic shimmer',
      tag: 'Retro 80s',
    },
    {
      id: 'velvet',
      name: 'Velvet Thud',
      description: 'Ultra-soft low-frequency felt thud for quiet library focus',
      tag: 'Whisper',
    },
    {
      id: 'mute',
      name: 'Completely Silent',
      description: 'Zero sound effects for total distraction-free silence',
      tag: 'Mute',
    },
  ];

  const ambientSoundscapes: {
    id: AmbientSoundType;
    label: string;
    description: string;
    color: string;
  }[] = [
    {
      id: 'brown',
      label: 'Deep Brown Noise',
      description: 'Low-frequency rumble that masks voices & wandering thoughts',
      color: 'from-amber-700/20 to-orange-950/20',
    },
    {
      id: 'pink',
      label: 'Pink Noise',
      description: '1/f natural waterfall frequency curve for balanced attention',
      color: 'from-pink-500/20 to-rose-900/20',
    },
    {
      id: 'rain',
      label: 'Gentle Rain',
      description: 'Dynamic rainfall acoustics for calming environmental focus',
      color: 'from-sky-500/20 to-indigo-900/20',
    },
    {
      id: 'binaural',
      label: 'Binaural 40Hz Focus',
      description: 'Gamma brainwave entrainment beat for intense mental clarity',
      color: 'from-purple-500/20 to-violet-900/20',
    },
    {
      id: 'white',
      label: 'Soft White Noise',
      description: 'High-frequency steady hiss for blocking erratic background noise',
      color: 'from-stone-400/20 to-slate-800/20',
    },
  ];

  const diurnalOptions: {
    id: DiurnalOverride;
    label: string;
    desc: string;
    preview: string;
    timeTag: string;
  }[] = [
    {
      id: 'auto',
      label: 'Auto (Circadian)',
      desc: 'Synchronizes dynamically with your local time of day',
      preview: 'from-amber-400/30 via-indigo-500/30 via-rose-500/30 to-violet-700/30',
      timeTag: 'Live Clock',
    },
    {
      id: 'morning',
      label: 'Morning Dawn',
      desc: 'Warm amber & rose luminescence for intention',
      preview: 'from-amber-400/30 to-rose-400/20',
      timeTag: '06:00 – 12:00',
    },
    {
      id: 'midday',
      label: 'Midday Zenith',
      desc: 'Electric indigo & sky clarity for high-output deep work',
      preview: 'from-indigo-500/30 to-sky-400/20',
      timeTag: '12:00 – 17:00',
    },
    {
      id: 'dusk',
      label: 'Golden Dusk',
      desc: 'Warm terracotta & copper sunset horizon for relaxed flow',
      preview: 'from-amber-500/30 via-orange-500/20 to-purple-900/30',
      timeTag: '17:00 – 20:00',
    },
    {
      id: 'evening',
      label: 'Evening Cosmic',
      desc: 'Deep cosmic obsidian & violet calm for wrap-up',
      preview: 'from-violet-700/30 to-slate-900/30',
      timeTag: '20:00 – 00:00',
    },
    {
      id: 'midnight',
      label: 'Midnight Starlight',
      desc: 'Deep celestial obsidian & starlight shimmer for hyperfocus',
      preview: 'from-indigo-900/30 via-cyan-600/20 to-slate-950/40',
      timeTag: '00:00 – 06:00',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xl animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] rounded-2xl shadow-modal overflow-hidden card-surface animate-scale-up flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between shrink-0 bg-[var(--bg-surface-l2)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
              <Palette size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Aesthetics & Tactile Sound Profiles
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Pro Suite
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Tailor your workspace atmosphere, tactile feedback, and acoustic focus
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Close aesthetics modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-7 overflow-y-auto flex-1">
          {/* SECTION 1: Curated Pro Themes (Balanced 8-Grid) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                <span>Color Atmosphere & Themes</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-200/60 dark:bg-white/10 text-[var(--text-secondary)]">
                  8 Presets
                </span>
              </div>
              <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                Active:{' '}
                <strong className="text-[var(--text-primary)] font-semibold">
                  {themes.find((t) => t.id === theme)?.name || theme}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {themes.map((t) => {
                const Icon = t.icon;
                const isSelected = theme === t.id;

                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`relative p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between gap-3 group card-surface ${
                      isSelected
                        ? 'border-amber-500 ring-2 ring-amber-500/25 shadow-sm bg-amber-500/[0.03]'
                        : 'border-[var(--border-hairline)] hover:border-stone-400 dark:hover:border-stone-600 hover:bg-stone-100/40 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-center gap-2.5">
                        {/* Miniature Preview Chip */}
                        <div
                          className="w-5 h-5 rounded-md border shadow-inner flex items-center justify-center shrink-0 relative overflow-hidden"
                          style={{
                            backgroundColor: t.bgPreview,
                            borderColor: t.borderPreview,
                          }}
                        >
                          <div
                            className="w-2 h-2 rounded-full shadow-xs"
                            style={{ backgroundColor: t.accentColor }}
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[var(--text-primary)]">
                              {t.name}
                            </span>
                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${
                                t.badge === 'Dark'
                                  ? 'bg-stone-800 text-stone-200 dark:bg-white/10 dark:text-stone-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                              }`}
                            >
                              {t.badge}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Selected Checkmark or Theme Icon */}
                      <div className="flex items-center gap-1.5">
                        {isSelected ? (
                          <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                            <Check size={11} className="stroke-[3]" />
                          </div>
                        ) : (
                          <Icon size={14} className="text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors" />
                        )}
                      </div>
                    </div>

                    {/* Miniature UI Card Mockup */}
                    <div
                      className="w-full h-8 rounded-lg border p-1.5 flex items-center justify-between text-[10px] select-none transition-transform group-hover:scale-[1.01]"
                      style={{
                        backgroundColor: t.surfacePreview,
                        borderColor: t.borderPreview,
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-xs border"
                          style={{
                            borderColor: t.accentColor,
                            backgroundColor: `${t.accentColor}33`,
                          }}
                        />
                        <div
                          className="h-1.5 w-16 rounded-full opacity-60"
                          style={{ backgroundColor: t.accentColor }}
                        />
                      </div>
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: t.accentColor }}
                      />
                    </div>

                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                      {t.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Tactile Audio Engine & Volume Control */}
          <div className="pt-4 border-t border-[var(--border-hairline)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                  <span>Tactile Audio Engine</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-200/60 dark:bg-white/10 text-[var(--text-secondary)]">
                    8 Profiles
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Handcrafted Web Audio micro-feedback on task completion, pops, and toggles
                </p>
              </div>

              {/* Master Audio Toggle */}
              <button
                onClick={toggleSound}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all self-start sm:self-auto ${
                  soundEnabled
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-xs'
                    : 'bg-stone-200/50 dark:bg-white/[0.04] text-[var(--text-muted)] border-stone-300 dark:border-white/10'
                }`}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span>{soundEnabled ? 'Audio Enabled' : 'Master Muted'}</span>
              </button>
            </div>

            {/* Tactile Volume Slider */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] shrink-0">
                <Volume1 size={15} className="text-amber-500" />
                <span>Tactile Feedback Volume</span>
              </div>
              <div className="flex items-center gap-3 w-48 sm:w-64">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={tactileVolume}
                  onChange={(e) => handleTactileVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                  title="Adjust tactile feedback volume"
                />
                <span className="text-xs font-mono font-bold text-[var(--text-secondary)] w-9 text-right">
                  {Math.round(tactileVolume * 100)}%
                </span>
              </div>
            </div>

            {/* Sound Profiles List */}
            <div className="space-y-2">
              {soundProfiles.map((sp) => {
                const isSelected = soundProfile === sp.id;

                return (
                  <div
                    key={sp.id}
                    onClick={() => setSoundProfile(sp.id)}
                    className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer card-surface ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/20'
                        : 'border-[var(--border-hairline)] hover:bg-stone-200/40 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {sp.name}
                        </span>
                        <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-stone-200/60 dark:bg-white/10 text-[var(--text-muted)]">
                          {sp.tag}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded-full bg-[var(--color-brand)] text-white shadow-xs">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        {sp.description}
                      </p>
                    </div>

                    {sp.id !== 'mute' && (
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        {/* Pop Audition */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestSound(sp.id, 'pop');
                          }}
                          title={`Audition ${sp.name} pop sound`}
                          className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 transition-all ${
                            auditioningKey === `${sp.id}-pop`
                              ? 'bg-sky-500 text-white border-sky-400 ring-2 ring-sky-500/30'
                              : 'bg-stone-100 dark:bg-white/10 border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-stone-200 dark:hover:bg-white/15'
                          }`}
                        >
                          <Play size={8} className={auditioningKey === `${sp.id}-pop` ? 'fill-current' : 'fill-current text-sky-500'} />
                          <span>Pop</span>
                        </button>

                        {/* Toggle Audition */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestSound(sp.id, 'toggle');
                          }}
                          title={`Audition ${sp.name} toggle tone`}
                          className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 transition-all ${
                            auditioningKey === `${sp.id}-toggle`
                              ? 'bg-amber-500 text-white border-amber-400 ring-2 ring-amber-500/30'
                              : 'bg-stone-100 dark:bg-white/10 border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-stone-200 dark:hover:bg-white/15'
                          }`}
                        >
                          <Play size={8} className={auditioningKey === `${sp.id}-toggle` ? 'fill-current' : 'fill-current text-amber-500'} />
                          <span>Toggle</span>
                        </button>

                        {/* Chime Audition */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestSound(sp.id, 'chime');
                          }}
                          title={`Audition ${sp.name} completion chime`}
                          className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 transition-all ${
                            auditioningKey === `${sp.id}-chime`
                              ? 'bg-emerald-500 text-white border-emerald-400 ring-2 ring-emerald-500/30'
                              : 'bg-stone-100 dark:bg-white/10 border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-stone-200 dark:hover:bg-white/15'
                          }`}
                        >
                          <Play size={8} className={auditioningKey === `${sp.id}-chime` ? 'fill-current' : 'fill-current text-emerald-500'} />
                          <span>Chime</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: Ambient Focus Soundscape Generator */}
          <div className="pt-4 border-t border-[var(--border-hairline)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                  <Headphones size={13} className="text-indigo-500" />
                  <span>Ambient Focus Soundscapes</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    Offline Synthesis
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Low-latency continuous white/brown noise and 40Hz binaural beats for deep hyperfocus
                </p>
              </div>

              {/* Active Soundscape Badge */}
              {ambientType !== 'none' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-semibold self-start sm:self-auto">
                  <div className="flex items-center gap-0.5 h-3">
                    <span className="w-1 bg-indigo-500 rounded-full animate-audio-wave-1" />
                    <span className="w-1 bg-indigo-500 rounded-full animate-audio-wave-2" />
                    <span className="w-1 bg-indigo-500 rounded-full animate-audio-wave-3" />
                    <span className="w-1 bg-indigo-500 rounded-full animate-audio-wave-4" />
                  </div>
                  <span>Now Playing</span>
                </div>
              )}
            </div>

            {/* Ambient Soundscapes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ambientSoundscapes.map((amb) => {
                const isPlaying = ambientType === amb.id;

                return (
                  <button
                    key={amb.id}
                    type="button"
                    onClick={() => handleToggleAmbient(amb.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between gap-2 card-surface ${
                      isPlaying
                        ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30'
                        : 'border-[var(--border-hairline)] hover:bg-stone-200/40 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div className="flex items-center gap-2">
                        <Radio size={13} className={isPlaying ? 'text-indigo-500' : 'text-[var(--text-muted)]'} />
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {amb.label}
                        </span>
                      </div>

                      <div className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                        isPlaying
                          ? 'bg-indigo-500 text-white shadow-xs'
                          : 'bg-stone-200/60 dark:bg-white/10 text-[var(--text-secondary)]'
                      }`}>
                        {isPlaying ? <Pause size={10} className="fill-current" /> : <Play size={10} className="fill-current" />}
                        <span className="text-[10px]">{isPlaying ? 'Playing' : 'Play'}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                      {amb.description}
                    </p>

                    <div className={`h-1 w-full rounded-full bg-gradient-to-r ${amb.color}`} />
                  </button>
                );
              })}
            </div>

            {/* Ambient Volume Slider */}
            {ambientType !== 'none' && (
              <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex items-center justify-between gap-4 animate-fade-in">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] shrink-0">
                  <Headphones size={15} className="text-indigo-500" />
                  <span>Ambient Soundscape Volume</span>
                </div>
                <div className="flex items-center gap-3 w-48 sm:w-64">
                  <input
                    type="range"
                    min="0"
                    max="0.25"
                    step="0.01"
                    value={ambientVolume}
                    onChange={(e) => handleAmbientVolumeChange(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                    title="Adjust ambient soundscape volume"
                  />
                  <span className="text-xs font-mono font-bold text-[var(--text-secondary)] w-9 text-right">
                    {Math.round((ambientVolume / 0.25) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: Diurnal Circadian Ambient Shift */}
          <div className="pt-4 border-t border-[var(--border-hairline)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                  <Clock size={13} className="text-amber-500" />
                  <span>Diurnal Ambient Atmosphere</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    Circadian Glow
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Organic background aurora mesh that shifts atmospheric tones throughout your workday
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-stone-200/50 dark:bg-white/[0.04] text-[var(--text-secondary)] border border-[var(--border-hairline)]">
                  {diurnalOverride === 'auto'
                    ? 'Circadian Clock (Auto)'
                    : `Manual Preset: ${diurnalOptions.find((d) => d.id === diurnalOverride)?.label}`}
                </span>

                {diurnalOverride !== 'auto' && (
                  <button
                    type="button"
                    onClick={() => handleDiurnalSelect('auto')}
                    className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors"
                    title="Reset to local circadian auto clock"
                  >
                    <RotateCcw size={12} />
                    <span>Reset to Auto</span>
                  </button>
                )}
              </div>
            </div>

            {/* Diurnal Grid (6 Balanced Presets: Auto + 5 Phases) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {diurnalOptions.map((item) => {
                const isSelected = diurnalOverride === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleDiurnalSelect(item.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between gap-2.5 card-surface ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/25'
                        : 'border-[var(--border-hairline)] hover:bg-stone-200/40 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {item.label}
                        </span>
                        {isSelected && <Check size={12} className="text-amber-500 stroke-[3]" />}
                      </div>
                      <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-stone-200/60 dark:bg-white/10 text-[var(--text-muted)]">
                        {item.timeTag}
                      </span>
                    </div>

                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
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
