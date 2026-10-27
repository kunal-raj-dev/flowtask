import { AppearanceControls } from "./AppearanceControls";
import React, { useState } from "react";
import { useTaskContext } from "../../context/TaskContext";
import {
  type SoundProfile,
  type AmbientSoundType,
  audioEngine,
} from "../../utils/audioEngine";
import {
  Volume2,
  VolumeX,
  Volume1,
  Play,
  Pause,
  Headphones,
  Radio,
} from "lucide-react";

export interface AestheticsSettingsContentProps {
  section?: "all" | "appearance" | "sound";
  onSaveToast?: () => void;
  intensitySliderTitle?: string;
}

export const AestheticsSettingsContent: React.FC<
  AestheticsSettingsContentProps
> = ({
  section = "all",
  onSaveToast,
}) => {
  const {
    focusSession,
    showToast,
    soundEnabled,
    toggleSound,
    soundProfile,
    setSoundProfile,
  } = useTaskContext();

  const [tactileVolume, setTactileVolume] = useState<number>(() =>
    typeof audioEngine?.getVolume === "function"
      ? audioEngine.getVolume()
      : 0.5,
  );
  const [ambientType, setAmbientType] = useState<AmbientSoundType>(() =>
    typeof audioEngine?.getCurrentAmbientType === "function"
      ? audioEngine.getCurrentAmbientType()
      : "none",
  );
  const [ambientVolume, setAmbientVolume] = useState<number>(() =>
    typeof audioEngine?.getAmbientVolume === "function"
      ? audioEngine.getAmbientVolume()
      : 0.1,
  );
  const [auditioningKey, setAuditioningKey] = useState<string | null>(null);

  const handleTactileVolumeChange = (newVol: number) => {
    setTactileVolume(newVol);
    audioEngine?.setVolume?.(newVol);
    audioEngine?.playClickSound?.(undefined, true);
    onSaveToast?.();
  };

  const handleAmbientVolumeChange = (newVol: number) => {
    setAmbientVolume(newVol);
    audioEngine?.setAmbientVolume?.(newVol);
    onSaveToast?.();
  };

  const handleToggleAmbient = (type: AmbientSoundType) => {
    if (focusSession?.state === "running") {
      showToast?.("Use the Studio sound mixer to change an active session.");
      return;
    }
    if (ambientType === type) {
      audioEngine?.stopAmbientSound?.();
      setAmbientType("none");
    } else {
      audioEngine?.startAmbientSound?.(type, ambientVolume);
      setAmbientType(type);
    }
    onSaveToast?.();
  };

  const handleTestSound = (
    profile: SoundProfile,
    type: "chime" | "pop" | "toggle" = "chime",
  ) => {
    const key = `${profile}-${type}`;
    setAuditioningKey(key);
    audioEngine?.auditionSound?.(profile, type);
    setTimeout(() => {
      setAuditioningKey((current) => (current === key ? null : current));
    }, 450);
  };

  const soundProfiles: {
    id: SoundProfile;
    name: string;
    description: string;
    tag: string;
  }[] = [
    {
      id: "zen",
      name: "Zen Singing Bowl",
      description: "Resonant harmonic Tibetan chime for mindful completion",
      tag: "Harmonic",
    },
    {
      id: "mechanical",
      name: "Mechanical Switch",
      description: "Crisp tactile keystroke snap for high-speed velocity",
      tag: "Clicky",
    },
    {
      id: "bubble",
      name: "Minimal Pop",
      description: "Soft organic water bubble pop for gentle feedback",
      tag: "Organic",
    },
    {
      id: "marimba",
      name: "Marimba Teak",
      description: "Warm acoustic wooden percussion bar with resonant decay",
      tag: "Wooden",
    },
    {
      id: "typewriter",
      name: "Retro Typewriter",
      description: "Vintage typebar strike with metallic carriage bell ping",
      tag: "Vintage",
    },
    {
      id: "synth",
      name: "Cosmic Synth",
      description: "80s analog FM synthesizer blip with polyphonic shimmer",
      tag: "Retro 80s",
    },
    {
      id: "velvet",
      name: "Velvet Thud",
      description: "Ultra-soft low-frequency felt thud for quiet library focus",
      tag: "Whisper",
    },
    {
      id: "mute",
      name: "Completely Silent",
      description: "Zero sound effects for total distraction-free silence",
      tag: "Mute",
    },
  ];

  const ambientSoundscapes: {
    id: AmbientSoundType;
    label: string;
    description: string;
    color: string;
  }[] = [
    {
      id: "brown",
      label: "Deep Brown Noise",
      description:
        "Low-frequency rumble that masks voices & wandering thoughts",
      color: "from-amber-700/20 to-orange-950/20",
    },
    {
      id: "pink",
      label: "Pink Noise",
      description:
        "1/f natural waterfall frequency curve for balanced attention",
      color: "from-pink-500/20 to-rose-900/20",
    },
    {
      id: "rain",
      label: "Gentle Rain",
      description: "Dynamic rainfall acoustics for calming environmental focus",
      color: "from-sky-500/20 to-indigo-900/20",
    },
    {
      id: "binaural",
      label: "Binaural 40Hz Focus",
      description:
        "Experimental 40Hz stereo tones. Use headphones; choose what feels comfortable.",
      color: "from-purple-500/20 to-violet-900/20",
    },
    {
      id: "white",
      label: "Soft White Noise",
      description:
        "High-frequency steady hiss for blocking erratic background noise",
      color: "from-stone-400/20 to-slate-800/20",
    },
  ];

  return (
    <div className="space-y-7 animate-fade-in">
      {section !== "sound" && <AppearanceControls onSaveToast={onSaveToast} />}
      {section !== "appearance" && (
        <>
          {/* SECTION 2: Tactile Audio Engine & Volume Control */}
          <div id="s-audio-fx" className="pt-4 border-t border-[var(--border-hairline)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                  <span>Interface sounds</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-200/60 dark:bg-white/10 text-[var(--text-secondary)]">
                    8 Profiles
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Choose subtle feedback for task completion and controls.
                </p>
              </div>

              {/* Master Audio Toggle */}
              <button
                type="button"
                onClick={toggleSound}
                aria-label="Toggle interface sounds"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all self-start sm:self-auto active:scale-95 cursor-pointer ${
                  soundEnabled
                    ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20 shadow-xs"
                    : "bg-stone-200/50 dark:bg-white/[0.04] text-[var(--text-muted)] border-stone-300 dark:border-white/10"
                }`}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span>{soundEnabled ? "Effects on" : "Effects off"}</span>
              </button>
            </div>

            {/* Tactile Volume Slider */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] shrink-0">
                <Volume1 size={15} className="text-[var(--color-brand)]" />
                <span>Interface volume</span>
              </div>
              <div className="flex items-center gap-3 w-48 sm:w-64">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={tactileVolume}
                  onChange={(e) =>
                    handleTactileVolumeChange(parseFloat(e.target.value))
                  }
                  className="w-full accent-[var(--color-brand)] cursor-pointer"
                  title="Adjust tactile feedback volume"
                  aria-label="Tactile feedback volume"
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
                    className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer card-surface ${
                      isSelected
                        ? "border-[var(--color-brand)] bg-[var(--color-brand-subtle)] ring-1 ring-[var(--color-brand-subtle)]"
                        : "border-[var(--border-hairline)] hover:bg-stone-200/40 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          aria-label={"Select " + sp.name + " sound profile"}
                          onClick={() => {
                            setSoundProfile(sp.id);
                            onSaveToast?.();
                          }}
                          className="text-xs font-bold text-[var(--text-primary)] text-left rounded focus-visible:outline-2 focus-visible:outline-offset-4"
                        >
                          {sp.name}
                        </button>
                        <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-stone-200/60 dark:bg-white/10 text-[var(--text-muted)]">
                          {sp.tag}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded-full bg-[var(--color-brand)] text-[var(--desk-on-accent,#fff)] shadow-xs">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        {sp.description}
                      </p>
                    </div>

                    {sp.id !== "mute" && (
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        {/* Pop Audition */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestSound(sp.id, "pop");
                          }}
                          title={`Audition ${sp.name} pop sound`}
                          aria-label={`Audition ${sp.name} pop sound`}
                          className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                            auditioningKey === `${sp.id}-pop`
                              ? "bg-sky-700 text-white border-sky-400 ring-2 ring-sky-500/30"
                              : "bg-stone-100 dark:bg-white/10 border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-stone-200 dark:hover:bg-white/15"
                          }`}
                        >
                          <Play
                            size={8}
                            className={
                              auditioningKey === `${sp.id}-pop`
                                ? "fill-current"
                                : "fill-current text-sky-500"
                            }
                          />
                          <span>Pop</span>
                        </button>

                        {/* Toggle Audition */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestSound(sp.id, "toggle");
                          }}
                          title={`Audition ${sp.name} toggle tone`}
                          aria-label={`Audition ${sp.name} toggle tone`}
                          className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                            auditioningKey === `${sp.id}-toggle`
                              ? "bg-[var(--color-brand)] text-[var(--text-on-brand)] border-[var(--color-brand)] ring-2 ring-[var(--color-brand-border)]"
                              : "bg-stone-100 dark:bg-white/10 border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-stone-200 dark:hover:bg-white/15"
                          }`}
                        >
                          <Play
                            size={8}
                            className={
                              auditioningKey === `${sp.id}-toggle`
                                ? "fill-current"
                                : "fill-current text-[var(--color-brand)]"
                            }
                          />
                          <span>Toggle</span>
                        </button>

                        {/* Chime Audition */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestSound(sp.id, "chime");
                          }}
                          title={`Audition ${sp.name} completion chime`}
                          aria-label={`Audition ${sp.name} completion chime`}
                          className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                            auditioningKey === `${sp.id}-chime`
                              ? "bg-emerald-700 text-white border-emerald-400 ring-2 ring-emerald-500/30"
                              : "bg-stone-100 dark:bg-white/10 border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-stone-200 dark:hover:bg-white/15"
                          }`}
                        >
                          <Play
                            size={8}
                            className={
                              auditioningKey === `${sp.id}-chime`
                                ? "fill-current"
                                : "fill-current text-emerald-500"
                            }
                          />
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
          <div id="s-ambient" className="pt-4 border-t border-[var(--border-hairline)] space-y-4">
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
                  Offline noise and experimental stereo tones. Choose what feels
                  comfortable; no performance benefit is promised.
                </p>
              </div>

              {/* Active Soundscape Badge */}
              {ambientType !== "none" && (
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
                    className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between gap-2 card-surface active:scale-[0.99] cursor-pointer ${
                      isPlaying
                        ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30"
                        : "border-[var(--border-hairline)] hover:bg-stone-200/40 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div className="flex items-center gap-2">
                        <Radio
                          size={13}
                          className={
                            isPlaying
                              ? "text-indigo-500"
                              : "text-[var(--text-muted)]"
                          }
                        />
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {amb.label}
                        </span>
                      </div>

                      <div
                        className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                          isPlaying
                            ? "bg-indigo-500 text-white shadow-xs"
                            : "bg-stone-200/60 dark:bg-white/10 text-[var(--text-secondary)]"
                        }`}
                      >
                        {isPlaying ? (
                          <Pause size={10} className="fill-current" />
                        ) : (
                          <Play size={10} className="fill-current" />
                        )}
                        <span className="text-[10px]">
                          {isPlaying ? "Playing" : "Play"}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                      {amb.description}
                    </p>

                    <div
                      className={`h-1 w-full rounded-full bg-gradient-to-r ${amb.color}`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Ambient Volume Slider */}
            {ambientType !== "none" && (
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
                    onChange={(e) =>
                      handleAmbientVolumeChange(parseFloat(e.target.value))
                    }
                    className="w-full accent-indigo-500 cursor-pointer"
                    title="Adjust ambient soundscape volume"
                    aria-label="Ambient soundscape volume"
                  />
                  <span className="text-xs font-mono font-bold text-[var(--text-secondary)] w-9 text-right">
                    {Math.round((ambientVolume / 0.25) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
