import { Check, Moon, Sun } from 'lucide-react';
import { THEMES } from '../../utils/themeRegistry';
import { STUDIO_THEME_IDS, type StudioThemeId } from '../../utils/studioAppearance';

export function StudioThemePicker({ value, onChange }: { value: StudioThemeId; onChange: (theme: StudioThemeId) => void }) {
  return <div className="studio-theme-grid" role="group" aria-label="Studio themes">
    {STUDIO_THEME_IDS.map(id => {
      const theme = THEMES[id];
      return <button type="button" key={id} className="studio-theme-card" aria-label={`Use ${theme.label} Studio theme`} aria-pressed={value === id} onClick={() => onChange(id)}>
        <span className="studio-theme-preview" aria-hidden="true" style={{ background: theme.tokens['--bg-main'], color: theme.tokens['--text-primary'], borderColor: theme.tokens['--border-color'] }}>
          <span style={{ background: theme.tokens['--bg-surface-l2'] }}><b>25:00</b><i style={{ background: theme.tokens['--color-brand'] }} /></span>
        </span>
        <span>{theme.label}{value === id ? <Check size={14} /> : theme.scheme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}</span>
      </button>;
    })}
  </div>;
}
