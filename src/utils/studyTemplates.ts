import type { ParsedSession, ParsedSessionTarget } from './sessionParser';

export interface StudyTemplate { id: string; title: string; description: string; sessions: ParsedSession[]; }
export const MAX_STUDY_TEMPLATES = 40;
const text = (value: unknown, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
export const studyId = () => crypto.randomUUID();
export const newStudyTarget = (title = '', estimatedMinutes = 25): ParsedSessionTarget => ({ id: studyId(), title, estimatedMinutes });
export const newStudySession = (topic = ''): ParsedSession => ({ id: studyId(), sessionTopic: topic, targets: [newStudyTarget()], rawText: '' });
export function copyStudySessions(sessions: ParsedSession[]) {
  return sessions.map((session, index) => ({ ...structuredClone(session), id: studyId(), sessionNumber: session.sessionNumber || index + 1, targets: session.targets.map(target => ({ ...structuredClone(target), id: studyId() })) }));
}
export function safeStudyUrl(value: unknown) {
  const url = text(value, 2000);
  if (!url) return undefined;
  try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol) ? url : undefined; } catch { return undefined; }
}
export function normalizeStudyTemplates(value: unknown): StudyTemplate[] {
  if (!Array.isArray(value) || value.length > MAX_STUDY_TEMPLATES || JSON.stringify(value).length > 250_000) return [];
  const ids = new Set<string>();
  return value.flatMap((entry): StudyTemplate[] => {
    if (!entry || typeof entry !== 'object') return [];
    const id = text(entry.id, 100), title = text(entry.title, 200);
    if (!id || !title || ids.has(id) || !Array.isArray(entry.sessions) || !entry.sessions.length || entry.sessions.length > 10) return [];
    const sessions: ParsedSession[] = [];
    for (const [index, session] of entry.sessions.entries()) {
      if (!session || typeof session !== 'object' || !text(session.sessionTopic, 200) || !Array.isArray(session.targets) || !session.targets.length || session.targets.length > 100) return [];
      const targets: ParsedSessionTarget[] = [];
      for (const [targetIndex, target] of session.targets.entries()) {
        if (!target || typeof target !== 'object' || !text(target.title, 500)) return [];
        targets.push({ id: `target-${targetIndex}`, title: text(target.title, 500), estimatedMinutes: typeof target.estimatedMinutes === 'number' && Number.isFinite(target.estimatedMinutes) ? Math.max(1, Math.min(720, Math.round(target.estimatedMinutes))) : 25,
          ...(['EASY', 'MEDIUM', 'HARD'].includes(target.difficulty) ? { difficulty: target.difficulty } : {}),
          ...(safeStudyUrl(target.url) ? { url: safeStudyUrl(target.url) } : {}),
          ...(Array.isArray(target.tags) ? { tags: target.tags.slice(0, 12).map((tag: unknown) => text(tag, 60)).filter(Boolean) } : {}),
          ...(typeof target.problemNumber === 'string' || typeof target.problemNumber === 'number' ? { problemNumber: text(String(target.problemNumber), 20) } : {}),
        });
      }
      const validTime = (time: unknown) => typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
      sessions.push({ id: `session-${index}`, sessionNumber: index + 1, sessionTopic: text(session.sessionTopic, 200), targets, rawText: '',
        ...(validTime(session.startTime) && validTime(session.endTime) && session.startTime !== session.endTime ? { startTime: session.startTime, endTime: session.endTime } : {}),
      });
    }
    ids.add(id);
    return [{ id, title, description: text(entry.description, 500), sessions }];
  });
}

function starter(id: string, title: string, description: string, targets: Array<[string, number]>): StudyTemplate {
  return { id, title, description, sessions: [{ id: `${id}-session`, sessionTopic: title, rawText: '', targets: targets.map(([target, minutes], index) => ({ id: `${id}-${index}`, title: target, estimatedMinutes: minutes })) }] };
}
export const STARTER_STUDY_TEMPLATES: StudyTemplate[] = [
  starter('dsa', 'DSA Practice Sprint', 'Pick your problems, set a pace, and review your approach.', [['Warm up with one easy problem', 15], ['Solve a problem on your current topic', 30], ['Test edge cases and explain the complexity', 15]]),
  starter('exam', 'Exam Revision & Active Recall', 'Replace the examples with the topics you need to revise.', [['Recall the key ideas without notes', 20], ['Practice questions on a weak topic', 30], ['Review mistakes and update notes', 15]]),
  starter('reading', 'Deep Reading & Research', 'Read with a question in mind and keep a useful summary.', [['Choose a chapter or paper and a question', 10], ['Read and take focused notes', 30], ['Write a summary in your own words', 15]]),
  starter('dev', 'Development Sprint', 'Plan a small change, build it, and verify it works.', [['Define one small outcome', 10], ['Implement the change', 40], ['Test the result and note the next step', 20]]),
];

export interface StudyPacingPreset {
  id: string;
  name: string;
  description: string;
  timer: import('../types/studio').TimerConfiguration;
}

export const STUDY_PACING_PRESETS: StudyPacingPreset[] = [
  {
    id: 'pomodoro-classic',
    name: 'Pomodoro 25/5',
    description: 'Classic 25m focused interval with 5m short break and 15m restorative long break after 4 rounds.',
    timer: {
      mode: 'pomodoro',
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      cyclesBeforeLongBreak: 4,
      autoStart: false,
    },
  },
  {
    id: 'deep-study-50-10',
    name: 'Deep Study 50/10',
    description: 'Extended 50m academic immersion with 10m recharge and 20m long break after 3 rounds.',
    timer: {
      mode: 'pomodoro',
      focusMinutes: 50,
      shortBreakMinutes: 10,
      longBreakMinutes: 20,
      cyclesBeforeLongBreak: 3,
      autoStart: false,
    },
  },
  {
    id: 'sprint-90-20',
    name: 'Ultradian Sprint 90/20',
    description: 'Full 90m physiological attention peak followed by a 20m restorative break.',
    timer: {
      mode: 'pomodoro',
      focusMinutes: 90,
      shortBreakMinutes: 20,
      longBreakMinutes: 30,
      cyclesBeforeLongBreak: 2,
      autoStart: false,
    },
  },
];

