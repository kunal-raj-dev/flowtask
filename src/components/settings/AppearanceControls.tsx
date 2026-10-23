import { useEffect, useState, type CSSProperties } from 'react';
import { Check, ArrowUpRight, Sun, Moon, Undo2 } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import type { AppearancePreferences } from '../../types/studio';
import { normalizeAppearance, scheduleStatus, SCHEDULE_SLOTS } from '../../utils/appearance';
import { THEMES, THEME_IDS, isAppTheme, type AppTheme, type ThemeDefinition } from '../../utils/themeRegistry';
import { DIURNAL_CONFIGS, type DiurnalPeriod } from '../../utils/diurnalAura';

export function ThemePreview({ definition }: { definition: ThemeDefinition }) {
  return <div className="theme-preview" aria-hidden="true" style={definition.tokens as CSSProperties}>
    <div className="theme-preview-sidebar"><i /><span /><span /><span /></div>
    <div className="theme-preview-main">
      <div className="theme-preview-heading">Today<span>3 tasks</span></div>
      <div className="theme-preview-row"><i /><span>Make room for good work</span></div>
      <div className="theme-preview-row selected"><i /><span>A little more focus</span></div>
      <div className="theme-preview-bottom"><span>Next, one small step.</span><b>Focus <ArrowUpRight size={10} /></b></div>
    </div>
  </div>;
}
export function AppearanceControls({ onSaveToast }: { onSaveToast?: () => void }) {
  const { theme, workspacePreferences = {}, setWorkspacePreference } = useTaskContext();
  const prefs = normalizeAppearance(workspacePreferences.appearance || { theme });
  const [filter, setFilter] = useState<'Featured' | 'All' | 'Light' | 'Dark'>('Featured');
  const [undo, setUndo] = useState<AppearancePreferences | null>(null);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, prefs.mode === 'schedule' ? 1000 : 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [prefs.mode]);
  const update = (value: Partial<AppearancePreferences>) => {
    setWorkspacePreference('appearance', { ...prefs, ...value });
    setUndo(null); setMessage(''); onSaveToast?.();
  };
  const select = (id: AppTheme) => {
    setUndo(prefs);
    setWorkspacePreference('appearance', { ...prefs, theme: id, mode: 'manual', accent: '' });
    setMessage(`${THEMES[id].label} applied.`); onSaveToast?.();
  };
  const current = isAppTheme(theme) ? THEMES[theme] : THEMES[prefs.theme];
  const status = scheduleStatus(now);
  const visible = THEME_IDS.filter(id => filter === 'All' || (filter === 'Featured' ? THEMES[id].featured || id === theme : THEMES[id].scheme === filter.toLowerCase()));
  return <div className="appearance-panel">
    <section className="appearance-current" aria-label="Current appearance">
      <span className="appearance-eyebrow">YOUR WORKSPACE</span>
      <div className="appearance-current-title"><h3>{current.label}</h3><span className="appearance-scheme">{current.scheme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}{current.scheme}</span></div>
      <p>{prefs.mode === 'schedule' ? `Time schedule · ${status.slot.label} until ${status.next}` : prefs.mode === 'system' ? 'Following your device appearance' : 'Your selected theme, all day'}</p>
      <p className="appearance-caption">A calmer place to plan. Your Focus Studio keeps its own scene and sound.</p>
    </section>

    <section id="s-theme" aria-labelledby="theme-library-title">
      <div className="appearance-section-heading"><div><h3 id="theme-library-title">Theme library</h3><p>18 complete palettes. Choose the one that feels like you.</p></div></div>
      <div className="appearance-filters" role="group" aria-label="Filter themes">
        {(['Featured', 'All', 'Light', 'Dark'] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}
      </div>
      <div className="appearance-feedback" role="status">{message}{undo && <button type="button" onClick={() => { setWorkspacePreference('appearance', undo); setUndo(null); setMessage('Previous appearance restored.'); }}><Undo2 size={13} /> Undo</button>}</div>
      <div className="theme-library-grid">
        {visible.map(id => <button type="button" key={id} className="theme-card" data-theme-card={id} aria-label={`Apply ${THEMES[id].label} theme`} aria-pressed={theme === id} onClick={() => select(id)}>
          <ThemePreview definition={THEMES[id]} />
          <span className="theme-card-title">{THEMES[id].label}{theme === id ? <Check size={16} /> : <span>{THEMES[id].scheme}</span>}</span>
          <span className="theme-card-description">{THEMES[id].description}</span>
        </button>)}
      </div>
    </section>

    <section className="appearance-section" aria-labelledby="automatic-appearance-title">
      <h3 id="automatic-appearance-title">Automatic appearance</h3>
      <label className="appearance-field">Appearance behavior<select value={prefs.mode} onChange={e => update({ mode: e.target.value as AppearancePreferences['mode'] })}>
        <option value="manual">Use selected theme</option><option value="system">Follow system light / dark</option><option value="schedule">Time schedule</option>
      </select></label>
      {prefs.mode === 'schedule' && <div className="appearance-schedule">
        <p role="status">Now: {status.slot.label} · Next change at {status.next} · Local time</p>
        {SCHEDULE_SLOTS.map(slot => <label className="appearance-schedule-slot" key={slot.id}><span>{slot.label}<small>{slot.time}</small></span><select aria-label={`${slot.label} theme`} value={prefs.schedule[slot.id]} onChange={e => update({ schedule: { ...prefs.schedule, [slot.id]: e.target.value as AppTheme } })}>{THEME_IDS.map(id => <option key={id} value={id}>{THEMES[id].label}</option>)}</select></label>)}
      </div>}
      <p className="appearance-caption">Choosing a theme above switches back to manual appearance.</p>
    </section>

    <section id="s-glow" className="appearance-section" aria-labelledby="atmosphere-title">
      <h3 id="atmosphere-title">Optional atmosphere</h3><p>A soft, static glow at the workspace edges. Your theme stays the same.</p>
      <label className="appearance-field">Atmosphere color<select value={prefs.atmosphere.preset} onChange={e => update({ atmosphere: { ...prefs.atmosphere, preset: e.target.value as 'off' | DiurnalPeriod } })}>
        <option value="off">Off</option>{Object.entries(DIURNAL_CONFIGS).map(([id, config]) => <option key={id} value={id}>{config.label}</option>)}
      </select></label>
      <label className="appearance-field">Glow intensity <span>{Math.round(prefs.atmosphere.intensity * 100)}%</span><input aria-label="Glow intensity" type="range" min="0" max="1" step="0.01" value={prefs.atmosphere.intensity} disabled={prefs.atmosphere.preset === 'off' || prefs.highContrast} onChange={e => update({ atmosphere: { ...prefs.atmosphere, intensity: Number(e.target.value) } })} /></label>
      {prefs.highContrast && <p className="appearance-caption">Glow is hidden while increased contrast is on.</p>}
    </section>

    <section className="appearance-section" aria-labelledby="appearance-comfort-title">
      <h3 id="appearance-comfort-title">Comfort & details</h3>
      <div className="appearance-comfort-grid">
        <label className="appearance-field">Layout density<select value={prefs.density} onChange={e => update({ density: e.target.value as AppearancePreferences['density'] })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
        <div id="s-accent" className="appearance-field">
          <label htmlFor="workspace-accent">Accent color</label>
          <div className="appearance-accent">
            <input id="workspace-accent" type="color" value={prefs.accent || current.tokens['--color-brand']} onChange={e => update({ accent: e.target.value })} />
            <button type="button" onClick={() => update({ accent: '' })}>Use theme accent</button>
          </div>
          <div className="flex items-center gap-1.5 mt-2" aria-label="Curated accent colors">
            {[
              { label: 'Amber', hex: '#f59e0b' },
              { label: 'Indigo', hex: '#6366f1' },
              { label: 'Emerald', hex: '#10b981' },
              { label: 'Rose', hex: '#f43f5e' },
              { label: 'Violet', hex: '#8b5cf6' },
              { label: 'Cyan', hex: '#06b6d4' },
              { label: 'Coral', hex: '#fb923c' },
              { label: 'Slate', hex: '#64748b' },
            ].map(swatch => (
              <button
                key={swatch.hex}
                type="button"
                title={swatch.label}
                aria-label={`Select ${swatch.label} accent`}
                onClick={() => update({ accent: swatch.hex })}
                className="w-5 h-5 rounded-full border border-black/10 dark:border-white/20 transition-transform hover:scale-110 active:scale-95 cursor-pointer shrink-0"
                style={{ backgroundColor: swatch.hex }}
              />
            ))}
          </div>
        </div>
      </div>
      <p className="appearance-caption">Accent shades adjust for readable text, buttons and focus rings.</p>
      <div id="s-contrast">
        <label className="appearance-check"><input type="checkbox" checked={prefs.reducedMotion} onChange={e => update({ reducedMotion: e.target.checked })} />Reduce motion</label>
        <label className="appearance-check"><input type="checkbox" checked={prefs.highContrast} onChange={e => update({ highContrast: e.target.checked })} />Increase contrast</label>
      </div>
      <label id="s-typing" className="appearance-check"><input type="checkbox" checked={Boolean(prefs.keyboardSounds)} onChange={e => update({ keyboardSounds: e.target.checked })} />Typing sounds (opt in)</label>
    </section>
    <p className="appearance-credits">Pastel palettes adapted from <a href="https://catppuccin.com/palette/" target="_blank" rel="noreferrer">Catppuccin</a> · <a href="https://github.com/catppuccin/catppuccin/blob/main/LICENSE" target="_blank" rel="noreferrer">MIT license</a>. Adjusted for FlowTask surfaces and contrast.</p>
  </div>;
}
import '../../styles/appearance.css';
