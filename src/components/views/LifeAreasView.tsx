import React, { useState, useMemo } from 'react';
import type { Area } from '../../types/area';
import { useTaskContext } from '../../context/TaskContext';
import {
  Compass,
  Plus,
  Folder,
  CheckCircle2,
  ListTodo,
} from 'lucide-react';
import { audioEngine } from '../../services/audioEngine';

export const DEFAULT_LIFE_AREAS: Area[] = [
  { id: 'area-career', name: 'Career & Work', icon: '💼', color: '#3B82F6', sortOrder: 1 },
  { id: 'area-health', name: 'Health & Vitality', icon: '🏃', color: '#10B981', sortOrder: 2 },
  { id: 'area-finance', name: 'Wealth & Finance', icon: '💰', color: '#F59E0B', sortOrder: 3 },
  { id: 'area-home', name: 'Home & Family', icon: '🏡', color: '#8B5CF6', sortOrder: 4 },
  { id: 'area-learning', name: 'Learning & Growth', icon: '🎨', color: '#EC4899', sortOrder: 5 },
];

export interface LifeAreasViewProps {
  onSelectProject?: (projectId: string) => void;
  onSelectTask?: (taskId: string) => void;
}

export const LifeAreasView: React.FC<LifeAreasViewProps> = ({ onSelectProject, onSelectTask: _onSelectTask }) => {
  const { projects, tasks } = useTaskContext();
  const [areas, setAreas] = useState<Area[]>(DEFAULT_LIFE_AREAS);
  const [isCreatingArea, setIsCreatingArea] = useState<boolean>(false);
  const [newAreaName, setNewAreaName] = useState<string>('');
  const [newAreaIcon, setNewAreaIcon] = useState<string>('⭐');
  const [newAreaColor] = useState<string>('#3B82F6');

  // Compute metrics per area
  const areaMetrics = useMemo(() => {
    return areas.map((area) => {
      const connectedProjects = projects.filter(
        (p) => !p.isArchived && (p.areaId === area.id || p.id.toLowerCase().includes(area.id.replace('area-', '')))
      );

      const projectIds = new Set(connectedProjects.map((p) => p.id));
      const areaTasks = tasks.filter(
        (t) => !t.deletedAt && !t.archivedAt && (projectIds.has(t.projectId) || (t as any).areaId === area.id)
      );

      const completedTasks = areaTasks.filter((t) => t.status === 'done');
      const progressPercent =
        areaTasks.length > 0 ? Math.round((completedTasks.length / areaTasks.length) * 100) : 0;

      return {
        area,
        projects: connectedProjects,
        totalTasks: areaTasks.length,
        completedTasks: completedTasks.length,
        progressPercent,
      };
    });
  }, [areas, projects, tasks]);

  const handleCreateArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;

    const created: Area = {
      id: `area-${Date.now()}`,
      name: newAreaName.trim(),
      icon: newAreaIcon,
      color: newAreaColor,
      sortOrder: areas.length + 1,
    };

    setAreas((prev) => [...prev, created]);
    setNewAreaName('');
    setIsCreatingArea(false);
    audioEngine.playTaskComplete();
  };

  return (
    <div className="desk-view p-6 max-w-5xl mx-auto space-y-8 animate-fadeIn" data-testid="life-areas-view">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-color)] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-brand)] uppercase tracking-wider">
            <Compass size={14} />
            <span>Whole-Life Architecture</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">Life Areas</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-lg">
            High-level horizons of focus. Balance projects, habits, and commitments across the
            dimensions of a flourishing life.
          </p>
        </div>

        <button
          onClick={() => setIsCreatingArea(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] shadow transition-transform active:scale-95"
          data-testid="create-area-button"
        >
          <Plus size={15} />
          <span>New Life Area</span>
        </button>
      </div>

      {/* New Area Creation Modal */}
      {isCreatingArea && (
        <form
          onSubmit={handleCreateArea}
          className="p-5 rounded-2xl border border-[var(--color-brand)] bg-[var(--bg-surface-l1)] space-y-4 animate-fadeIn"
          data-testid="new-area-form"
        >
          <h3 className="text-sm font-bold">Create New Life Area</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Area Name
              </label>
              <input
                type="text"
                placeholder="e.g. Creative Projects, Spirituality..."
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)]"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Icon (Emoji)
              </label>
              <input
                type="text"
                value={newAreaIcon}
                onChange={(e) => setNewAreaIcon(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)] text-center"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreatingArea(false)}
              className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)]"
            >
              Save Area
            </button>
          </div>
        </form>
      )}

      {/* Life Areas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {areaMetrics.map(({ area, projects: areaProjects, totalTasks, completedTasks, progressPercent }) => (
          <div
            key={area.id}
            className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-l1)] shadow-sm hover:shadow transition-all space-y-4 flex flex-col justify-between"
            data-testid={`area-card-${area.id}`}
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-2xl">{area.icon || '📁'}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: area.color || 'var(--color-brand)' }}
                />
              </div>

              <h2 className="text-base font-bold tracking-tight mt-3">{area.name}</h2>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
                  <span>Velocity</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-[var(--border-color)]/30 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progressPercent}%`,
                      backgroundColor: area.color || 'var(--color-brand)',
                    }}
                  />
                </div>
              </div>

              {/* Connected Projects */}
              <div className="mt-4 space-y-1.5">
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block">
                  Active Projects ({areaProjects.length})
                </span>
                {areaProjects.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-muted)] italic">
                    No active projects assigned.
                  </p>
                ) : (
                  areaProjects.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onSelectProject?.(p.id)}
                      className="w-full flex items-center justify-between p-1.5 rounded-lg text-xs hover:bg-[var(--bg-surface-l2)] text-left truncate group"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Folder size={12} className="text-[var(--text-muted)] flex-shrink-0" />
                        <span className="truncate group-hover:text-[var(--color-brand)] font-medium">
                          {p.name}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Meta */}
            <div className="pt-3 border-t border-[var(--border-color)]/60 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
              <span className="flex items-center gap-1">
                <ListTodo size={12} />
                <span>{totalTasks} total tasks</span>
              </span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 size={12} />
                <span>{completedTasks} done</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
