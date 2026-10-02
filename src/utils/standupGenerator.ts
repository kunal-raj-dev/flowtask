import type { Task, Project } from '../types/task';
import { formatLocalDate } from './nlpParser';
import { classifyTaskCognitiveIntensity } from './timelineUtils';

export interface StandupOptions {
  format?: 'markdown' | 'slack' | 'plain';
  dateStr?: string;
  includeEstimates?: boolean;
}

/**
 * Generates an executive daily standup & workday digest from tasks state
 */
export function generateDailyStandup(
  tasks: Task[],
  projects: Project[],
  options?: StandupOptions
): string {
  const format = options?.format || 'markdown';
  const targetDateStr = options?.dateStr || formatLocalDate(new Date());

  const projectMap = new Map<string, string>();
  projects.forEach((p) => projectMap.set(p.id, p.name));

  // 1. Completed today
  const completedToday = tasks.filter((t) => {
    if (t.status !== 'done') return false;
    if (t.completedAt) {
      const completedDate = formatLocalDate(new Date(t.completedAt));
      if (completedDate === targetDateStr) return true;
    }
    return t.dueDate === targetDateStr;
  });

  // 2. In flight / planned today
  const activeToday = tasks.filter((t) => {
    if (t.status === 'done') return false;
    return t.dueDate === targetDateStr || t.isPinnedToday || t.status === 'in_progress';
  });

  // Calculate focus metrics
  const totalMinutesLogged = completedToday.reduce(
    (acc, t) => acc + (t.timeSpentMinutes || t.estimatedMinutes || 0),
    0
  );
  const hoursLogged = (totalMinutesLogged / 60).toFixed(1);

  const deepWorkCount = completedToday.filter(
    (t) => classifyTaskCognitiveIntensity(t) === 'deep'
  ).length;

  if (format === 'slack') {
    let out = `*📅 Daily Standup — ${targetDateStr}*\n\n`;

    out += `*☀️ Completed Today:*\n`;
    if (completedToday.length === 0) {
      out += `• _None yet_\n`;
    } else {
      completedToday.forEach((t) => {
        const proj = projectMap.get(t.projectId || '') || '';
        const projBadge = proj ? ` [${proj}]` : '';
        const timeBadge = t.timeSpentMinutes
          ? ` (${t.timeSpentMinutes}m)`
          : t.estimatedMinutes
          ? ` (~${t.estimatedMinutes}m)`
          : '';
        out += `• ~${t.title}~${projBadge}${timeBadge}\n`;
      });
    }

    out += `\n*🎯 Next Up / In Flight:*\n`;
    if (activeToday.length === 0) {
      out += `• _No pending tasks scheduled for today_\n`;
    } else {
      activeToday.forEach((t) => {
        const proj = projectMap.get(t.projectId || '') || '';
        const projBadge = proj ? ` [${proj}]` : '';
        const priorityBadge = t.priority === 'p1' ? ' `[P1 Urgent]`' : t.priority === 'p2' ? ' `[P2]`' : '';
        out += `• *${t.title}*${priorityBadge}${projBadge}\n`;
      });
    }

    out += `\n*⏱️ Focus Velocity:*\n`;
    out += `• *${hoursLogged} hrs* focus logged (${totalMinutesLogged} mins)\n`;
    if (completedToday.length > 0) {
      out += `• ${deepWorkCount} deep-work task${deepWorkCount === 1 ? '' : 's'} executed\n`;
    }

    out += `\n*🚧 Blockers:* None\n`;
    return out;
  }

  if (format === 'plain') {
    let out = `DAILY STANDUP (${targetDateStr})\n\n`;

    out += `COMPLETED TODAY:\n`;
    if (completedToday.length === 0) {
      out += `- None yet\n`;
    } else {
      completedToday.forEach((t) => {
        const proj = projectMap.get(t.projectId || '') || '';
        const projBadge = proj ? ` [${proj}]` : '';
        const timeBadge = t.timeSpentMinutes ? ` (${t.timeSpentMinutes}m)` : '';
        out += `- ${t.title}${projBadge}${timeBadge}\n`;
      });
    }

    out += `\nNEXT UP / IN FLIGHT:\n`;
    if (activeToday.length === 0) {
      out += `- None scheduled\n`;
    } else {
      activeToday.forEach((t) => {
        const proj = projectMap.get(t.projectId || '') || '';
        const projBadge = proj ? ` [${proj}]` : '';
        out += `- [${t.priority.toUpperCase()}] ${t.title}${projBadge}\n`;
      });
    }

    out += `\nFOCUS LOGGED:\n`;
    out += `- ${hoursLogged} hrs (${totalMinutesLogged} mins)\n`;
    out += `\nBLOCKERS: None\n`;
    return out;
  }

  // Default: GitHub / Notion Markdown
  let out = `### 📅 Daily Standup — ${targetDateStr}\n\n`;

  out += `#### ☀️ Completed Today\n`;
  if (completedToday.length === 0) {
    out += `_None yet_\n`;
  } else {
    completedToday.forEach((t) => {
      const proj = projectMap.get(t.projectId || '') || '';
      const projBadge = proj ? ` \`#${proj}\`` : '';
      const timeBadge = t.timeSpentMinutes
        ? ` *(⏱️ ${t.timeSpentMinutes}m)*`
        : t.estimatedMinutes
        ? ` *(~${t.estimatedMinutes}m)*`
        : '';
      out += `- [x] ~${t.title}~${projBadge}${timeBadge}\n`;
    });
  }

  out += `\n#### 🎯 Next Up & Priorities\n`;
  if (activeToday.length === 0) {
    out += `_No pending tasks scheduled for today_\n`;
  } else {
    activeToday.forEach((t) => {
      const proj = projectMap.get(t.projectId || '') || '';
      const projBadge = proj ? ` \`#${proj}\`` : '';
      const priorityBadge =
        t.priority === 'p1' ? ' **[P1 Urgent]**' : t.priority === 'p2' ? ' **[P2]**' : '';
      const durationBadge = t.estimatedMinutes ? ` *(~${t.estimatedMinutes}m)*` : '';
      out += `- [ ] **${t.title}**${priorityBadge}${projBadge}${durationBadge}\n`;
    });
  }

  out += `\n#### ⏱️ Focus Metrics\n`;
  out += `- **Total Focus Logged:** ${hoursLogged} hrs (${totalMinutesLogged} mins)\n`;
  if (completedToday.length > 0) {
    out += `- **Deep Work Output:** ${deepWorkCount} high-leverage task${
      deepWorkCount === 1 ? '' : 's'
    }\n`;
  }

  out += `\n#### 🚧 Blockers & Notes\n- None\n`;
  return out;
}
