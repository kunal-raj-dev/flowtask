import type { Task } from '../types/task';
import type { TodayLayoutPreferences, TodaySectionId } from '../types/dashboard';
import { parseTimeToMinutes } from './timelineUtils';

export const TODAY_SECTIONS: Array<{ id: TodaySectionId; label: string; description: string; required?: boolean }> = [
  { id: 'capture', label: 'Capture', description: 'Add tasks and notes without leaving Today.', required: true },
  { id: 'capacity', label: 'Capacity', description: 'A compact view of your daily budget.' },
  { id: 'priorities', label: 'Priorities', description: 'Give your top three a place of their own.' },
  { id: 'morning', label: 'Morning', description: 'Group work scheduled before noon.' },
  { id: 'tasks', label: 'Tasks', description: 'All today’s work that is not in another visible group.', required: true },
  { id: 'evening', label: 'Evening', description: 'Group evening work and scheduled tasks after 6 pm.' },
  { id: 'goals', label: 'Goal alignment', description: 'See how today’s work connects to your goals.' },
  { id: 'dailyNote', label: 'Daily note', description: 'Open today’s reflection and notes.' },
  { id: 'focusCard', label: 'Focus card', description: 'A quiet visual entrance to Focus Studio.' },
];
const defaultVisible = new Set<TodaySectionId>(['capture', 'capacity', 'tasks']);
export function defaultTodayLayout(): TodayLayoutPreferences {
  return { version: 1, sections: TODAY_SECTIONS.map(section => ({ id: section.id, visible: defaultVisible.has(section.id) })), contextPanel: 'none' };
}
export function normalizeTodayLayout(value: unknown): TodayLayoutPreferences {
  if (!value || typeof value !== 'object') return defaultTodayLayout();
  const raw = value as Partial<TodayLayoutPreferences>;
  if (raw.version !== 1 || !Array.isArray(raw.sections)) return defaultTodayLayout();
  const seen = new Set<TodaySectionId>();
  const sections: TodayLayoutPreferences['sections'] = [];
  for (const item of raw.sections) {
    const definition = TODAY_SECTIONS.find(section => section.id === item?.id);
    if (!definition || seen.has(definition.id)) continue;
    seen.add(definition.id);
    sections.push({ id: definition.id, visible: Boolean(definition.required || item.visible) });
  }
  for (const section of TODAY_SECTIONS) if (!seen.has(section.id)) sections.push({ id: section.id, visible: Boolean(section.required || defaultVisible.has(section.id)) });
  return { version: 1, sections, contextPanel: raw.contextPanel === 'schedule' ? 'schedule' : 'none' };
}
export function moveTodaySection(layout: TodayLayoutPreferences, id: TodaySectionId, destination: number): TodayLayoutPreferences {
  const sections = layout.sections.map(section => ({ ...section }));
  const index = sections.findIndex(section => section.id === id);
  if (index < 0) return layout;
  const [section] = sections.splice(index, 1);
  sections.splice(Math.max(0, Math.min(sections.length, destination)), 0, section);
  return { ...layout, sections };
}
/** Only visible groups claim tasks. Hiding a section always returns its work to Tasks. */
export function partitionTodayTasks(tasks: Task[], layout: TodayLayoutPreferences, priorityIds: string[]) {
  const unique = [...new Map(tasks.map(task => [task.id, task])).values()];
  const visible = new Set(layout.sections.filter(section => section.visible).map(section => section.id));
  const priorities = visible.has('priorities') ? priorityIds.map(id => unique.find(task => task.id === id)).filter((task): task is Task => Boolean(task)) : [];
  const claimed = new Set(priorities.map(task => task.id));
  const morning = visible.has('morning') ? unique.filter(task => {
    const start = parseTimeToMinutes(task.scheduledStart);
    return !claimed.has(task.id) && !task.isEvening && start !== null && start < 12 * 60;
  }) : [];
  morning.forEach(task => claimed.add(task.id));
  const evening = visible.has('evening') ? unique.filter(task => {
    const start = parseTimeToMinutes(task.scheduledStart);
    return !claimed.has(task.id) && (task.isEvening || (start !== null && start >= 18 * 60));
  }) : [];
  evening.forEach(task => claimed.add(task.id));
  return { priorities, morning, evening, tasks: unique.filter(task => !claimed.has(task.id)) };
}
