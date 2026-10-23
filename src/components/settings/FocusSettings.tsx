import { useStudioPreferences } from "../../hooks/useStudio";
import { useModal } from "../../context/ModalContext";
import { Timer, Sparkles, ExternalLink } from "lucide-react";

export function FocusSettings({ sound = false }: { sound?: boolean }) {
  const { preferences: p, update } = useStudioPreferences();
  const { openModal, closeModal } = useModal();

  return (
    <div className="space-y-6 animate-fade-in" data-testid={sound ? "sound-settings-pane" : "focus-settings-pane"}>
      <section className="v2-settings-section p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {sound ? <Sparkles size={18} /> : <Timer size={18} />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                {sound ? "Your atmosphere" : "Your focus rhythm"}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {sound
                  ? "Interface effects, ambient layers and music have independent controls. Studio keeps your mix playing when minimized."
                  : "Choose a default rhythm. Paused time and breaks are recorded separately from work."}
              </p>
            </div>
          </div>
        </div>

        {sound ? (
          <div className="space-y-4 pt-2">
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] flex items-center justify-between gap-4">
              <label htmlFor="atmosphere-volume-input" className="text-xs font-semibold text-[var(--text-primary)]">
                Master atmosphere volume
              </label>
              <div className="flex items-center gap-3 w-48 sm:w-64">
                <input
                  id="atmosphere-volume-input"
                  aria-label="Atmosphere volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={p.masterVolume}
                  onChange={(e) => update({ masterVolume: Number(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-[var(--text-secondary)] w-9 text-right">
                  {Math.round(p.masterVolume * 100)}%
                </span>
              </div>
            </div>

            <label className="v2-check flex items-center gap-2.5 text-xs text-[var(--text-secondary)] p-1 cursor-pointer">
              <input
                type="checkbox"
                checked={p.continueAudioOnFinish}
                onChange={(e) => update({ continueAudioOnFinish: e.target.checked })}
                className="w-4 h-4 rounded text-amber-500 accent-amber-500 cursor-pointer"
              />
              <span>Continue audio after a completed session</span>
            </label>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Mode selection */}
            <div id="s-pom" className="p-3.5 rounded-xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] flex items-center justify-between gap-4">
              <label htmlFor="timer-mode-select" className="text-xs font-semibold text-[var(--text-primary)]">
                Timer mode
              </label>
              <select
                id="timer-mode-select"
                value={p.timer.mode}
                onChange={(e) =>
                  update({
                    timer: {
                      ...p.timer,
                      mode: e.target.value as typeof p.timer.mode,
                    },
                  })
                }
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:border-amber-500 outline-none cursor-pointer"
              >
                <option value="pomodoro">Pomodoro (Intervals)</option>
                <option value="countdown">Countdown Target</option>
                <option value="stopwatch">Open-ended Stopwatch</option>
                <option value="sprint">Study sprint</option>
              </select>
            </div>

            {/* Durations grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  { key: "focusMinutes", name: "Focus minutes", max: 240, defaultUnit: "m" },
                  { key: "shortBreakMinutes", name: "Short break", max: 60, defaultUnit: "m" },
                  { key: "longBreakMinutes", name: "Long break", max: 60, defaultUnit: "m" },
                ] as const
              ).map((f) => (
                <div
                  key={f.key}
                  className="p-3 rounded-xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] space-y-1.5"
                >
                  <label htmlFor={`timer-${f.key}-input`} className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                    {f.name}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id={`timer-${f.key}-input`}
                      aria-label={f.name}
                      type="number"
                      min="1"
                      max={f.max}
                      value={p.timer[f.key]}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (n >= 1 && n <= f.max)
                          update({ timer: { ...p.timer, [f.key]: n } });
                      }}
                      className="w-16 px-2.5 py-1 text-sm font-mono font-bold rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:border-amber-500 outline-none"
                    />
                    <span className="text-xs text-[var(--text-secondary)] font-semibold">mins</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Cycles before long break */}
            <div id="s-cycles" className="p-3.5 rounded-xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-[var(--text-primary)] block">
                  Pomodoro Long Break Interval
                </span>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Number of completed focus sprints before triggering a long break.
                </p>
              </div>
              <div className="flex items-center gap-1">
                {[2, 3, 4, 5, 6].map((num) => {
                  const isSelected = (p.timer.cyclesBeforeLongBreak || 4) === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() =>
                        update({
                          timer: { ...p.timer, cyclesBeforeLongBreak: num },
                        })
                      }
                      className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all ${
                        isSelected
                          ? "border-amber-500 bg-amber-500/20 text-amber-800 dark:text-amber-200 shadow-xs"
                          : "border-[var(--border-hairline)] bg-[var(--bg-surface-l2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timer Visual Style */}
            <div id="s-tstyle" className="p-3.5 rounded-xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-[var(--text-primary)] block">
                  Timer Display Presentation
                </span>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Choose between a bold digital readout or a minimal circular progress ring.
                </p>
              </div>
              <div className="flex items-center gap-1 p-0.5 bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] rounded-xl">
                <button
                  type="button"
                  onClick={() => update({ timerStyle: "digital" })}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    p.timerStyle !== "ring"
                      ? "bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Digital
                </button>
                <button
                  type="button"
                  onClick={() => update({ timerStyle: "ring" })}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    p.timerStyle === "ring"
                      ? "bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Progress Ring
                </button>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2 pt-1">
              <label className="v2-check flex items-center gap-2.5 text-xs text-[var(--text-secondary)] p-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={p.timer.autoStart}
                  onChange={(e) =>
                    update({ timer: { ...p.timer, autoStart: e.target.checked } })
                  }
                  className="w-4 h-4 rounded text-amber-500 accent-amber-500 cursor-pointer"
                />
                <span>Automatically start the next Pomodoro phase</span>
              </label>

              <label className="v2-check flex items-center gap-2.5 text-xs text-[var(--text-secondary)] p-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={p.breakPrompts !== false}
                  onChange={(e) => update({ breakPrompts: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 accent-amber-500 cursor-pointer"
                />
                <span>Show mindful stretch & reflection prompts during breaks</span>
              </label>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-[var(--border-hairline)]">
          <button
            type="button"
            onClick={() => {
              closeModal("settings");
              openModal("pomodoro", { initialPanel: sound ? "sound" : "timer" });
            }}
            className="w-full py-2 px-4 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Open {sound ? "sound mixer" : "Focus Studio"}</span>
            <ExternalLink size={13} />
          </button>
        </div>
      </section>
    </div>
  );
}
