import { useTaskContext } from '../../context/TaskContext';
import type { WorkspacePreferences } from '../../types/dashboard';
import { Layout, Eye, Bookmark, Sparkles, Compass, Check } from 'lucide-react';

interface WorkspaceSettingsProps {
  onClose: () => void;
  onSaveToast?: () => void;
}

export function WorkspaceSettings({ onClose, onSaveToast }: WorkspaceSettingsProps) {
  const ctx = useTaskContext();
  const prefs = (ctx.workspacePreferences.workspace || {}) as WorkspacePreferences;

  const update = (patch: Partial<WorkspacePreferences>) => {
    ctx.setWorkspacePreference('workspace', { ...prefs, ...patch });
    onSaveToast?.();
  };

  const pinned = Array.isArray(prefs.pinnedDestinations) ? prefs.pinnedDestinations : [];

  const availableChoices = [
    ...ctx.projects
      .filter((p) => p.id !== 'inbox' && !p.isArchived)
      .map((p) => ({
        id: `project:${p.id}`,
        label: p.name,
        color: p.color || 'var(--color-brand)',
        type: 'project' as const,
      })),
    ...ctx.smartViews.map((v) => ({
      id: `smart:${v.id}`,
      label: v.name,
      color: v.color || 'var(--color-brand)',
      type: 'smart' as const,
    })),
  ];

  const handleTogglePin = (id: string) => {
    const nextPinned = pinned.includes(id)
      ? pinned.filter((item) => item !== id)
      : [...pinned, id];
    update({ pinnedDestinations: nextPinned });
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="workspace-settings-pane">
      {/* Overview Intro Banner */}
      <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-2">
        <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
          <Compass size={18} />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            Workspace & Navigation Environment
          </h3>
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Configure how FlowTask launches, organizes your navigation rail, and renders project canvases.
          Dashboard layouts and pinned destinations sync with your account across devices.
        </p>
      </div>

      {/* Default Landing View */}
      <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Layout size={14} className="text-amber-500" />
              <span>Default Start View</span>
            </span>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              The primary workspace perspective loaded on startup.
            </p>
          </div>
          <select
            value={ctx.settings.defaultLandingView || 'today'}
            onChange={(e) => {
              ctx.updateSettings({ defaultLandingView: e.target.value as any });
              onSaveToast?.();
            }}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:border-amber-500 outline-none cursor-pointer"
          >
            <option value="today">Today (Recommended)</option>
            <option value="upcoming">Upcoming 7-Day Plan</option>
            <option value="timeline">Hourly Timeline Canvas</option>
            <option value="inbox">Inbox Zero Triage</option>
            <option value="dashboard">Custom Workspace Dashboard</option>
          </select>
        </div>
      </div>

      {/* Default Dashboard Selection (if multiple exist) */}
      {ctx.dashboards.length > 0 && (
        <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-[var(--text-primary)] block">
                Default Workspace Dashboard
              </span>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                The visual dashboard widget canvas assigned to your main desk.
              </p>
            </div>
            <select
              value={prefs.defaultDashboardId || ctx.dashboards[0]?.id || ''}
              onChange={(e) => update({ defaultDashboardId: e.target.value })}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:border-amber-500 outline-none cursor-pointer"
            >
              {ctx.dashboards.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye size={14} className="text-[var(--text-muted)]" />
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Display dashboard header covers
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.showCovers !== false}
              onClick={() => update({ showCovers: prefs.showCovers === false })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                prefs.showCovers !== false ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  prefs.showCovers !== false ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Pinned Projects & Smart Views */}
      <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Bookmark size={14} className="text-amber-500" />
              <span>Pinned Destinations</span>
            </span>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Pin your most active projects and filters for one-click access.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-200/60 dark:bg-white/10 text-[var(--text-muted)]">
            {pinned.length} pinned
          </span>
        </div>

        {availableChoices.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {availableChoices.map((choice) => {
              const isPinned = pinned.includes(choice.id);
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => handleTogglePin(choice.id)}
                  aria-pressed={isPinned}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer active:scale-95 ${
                    isPinned
                      ? 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-200 shadow-xs'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-stone-400'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: choice.color }}
                  />
                  <span>{choice.label}</span>
                  {isPinned && <Check size={12} className="ml-0.5 text-amber-600 dark:text-amber-400" />}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)] italic">
            Create custom projects or smart views to pin them here for fast switching.
          </p>
        )}
      </div>

      {/* Quick Launch CTA */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            ctx.setActiveView((ctx.settings.defaultLandingView as any) || 'today');
            onClose();
          }}
          className="w-full py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sparkles size={14} />
          <span>Launch Configured Workspace</span>
        </button>
      </div>
    </div>
  );
}
