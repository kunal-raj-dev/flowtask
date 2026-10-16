import type { Task, Project } from '../types/task';
import { formatLocalDate } from './nlpParser';

/**
 * Downloads arbitrary text content as a file in the browser
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Downloads a Blob instance as a file in the browser with safe cleanup
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Downloads JSON data formatted as indented text
 */
export function downloadJson(data: unknown, filename: string): void {
  const content = JSON.stringify(data, null, 2);
  downloadFile(content, filename, 'application/json;charset=utf-8;');
}

/**
 * Downloads CSV text
 */
export function downloadCsv(csvContent: string, filename: string): void {
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * Downloads Markdown text
 */
export function downloadMarkdown(markdownContent: string, filename: string): void {
  downloadFile(markdownContent, filename, 'text/markdown;charset=utf-8;');
}

/**
 * Exports data to JSON (supports v1 and v2 versioned export)
 */
export function exportToJSON(
  tasks: Task[],
  projects: Project[],
  version: number = 1,
  options?: { customViews?: unknown[]; focusHistory?: unknown[] }
): string {
  return JSON.stringify(
    {
      version,
      exportedAt: new Date().toISOString(),
      tasks,
      projects,
      customViews: options?.customViews || [],
      focusHistory: options?.focusHistory || [],
    },
    null,
    2
  );
}

/**
 * Exports tasks to RFC-4180 compliant CSV with OWASP formula injection protection
 */
export function exportToCSV(tasks: Task[], projects: Project[]): string {
  const projectMap = new Map<string, string>();
  projects.forEach((p) => projectMap.set(p.id, p.name));

  const escapeCSV = (val: unknown) => {
    if (val === undefined || val === null) return '';
    let str = String(val);

    // Prevent CSV formula injection by prepending single quote if starting with formula triggers
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }

    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = [
    'ID',
    'Title',
    'Status',
    'Priority',
    'Project',
    'Planned Date',
    'Due Date',
    'Due Time',
    'Estimated (min)',
    'Time Spent (min)',
    'Tags',
    'Context Tags',
    'Subtasks Total',
    'Subtasks Done',
    'Created At',
    'Completed At',
  ];

  const rows = tasks.map((t) => {
    const projName = projectMap.get(t.projectId) || t.projectId;
    const subtasksTotal = t.subtasks?.length || 0;
    const subtasksDone = t.subtasks?.filter((s) => s.completed).length || 0;
    const tagsStr = t.tags ? t.tags.join(';') : '';
    const contextStr = t.contextTags ? t.contextTags.join(';') : '';
    const createdStr = new Date(t.createdAt).toISOString();
    const completedStr = t.completedAt ? new Date(t.completedAt).toISOString() : '';

    return [
      escapeCSV(t.id),
      escapeCSV(t.title),
      escapeCSV(t.status),
      escapeCSV(t.priority.toUpperCase()),
      escapeCSV(projName),
      escapeCSV(t.plannedDate || ''),
      escapeCSV(t.dueDate || ''),
      escapeCSV(t.dueTime || ''),
      escapeCSV(t.estimatedMinutes ?? ''),
      escapeCSV(t.timeSpentMinutes ?? ''),
      escapeCSV(tagsStr),
      escapeCSV(contextStr),
      escapeCSV(subtasksTotal),
      escapeCSV(subtasksDone),
      escapeCSV(createdStr),
      escapeCSV(completedStr),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Exports tasks to structured Markdown checklist grouped by project
 */
export function exportToMarkdown(tasks: Task[], projects: Project[]): string {
  const projectMap = new Map<string, string>();
  projects.forEach((p) => projectMap.set(p.id, p.name));

  const byProject = new Map<string, Task[]>();
  for (const t of tasks) {
    const pId = t.projectId || 'inbox';
    if (!byProject.has(pId)) byProject.set(pId, []);
    byProject.get(pId)!.push(t);
  }

  const lines: string[] = [
    `# FlowTask Export — ${formatLocalDate(new Date())}`,
    '',
    `Total Tasks: ${tasks.length}`,
    '',
  ];

  for (const [pId, pTasks] of byProject.entries()) {
    const pName = projectMap.get(pId) || (pId === 'inbox' ? 'Inbox' : pId);
    lines.push(`## ${pName}`);
    lines.push('');

    for (const task of pTasks) {
      const checkbox = task.status === 'done' ? '[x]' : '[ ]';
      const meta: string[] = [];
      if (task.priority !== 'p4') meta.push(`Priority: ${task.priority.toUpperCase()}`);
      if (task.dueDate) meta.push(`Due: ${task.dueDate}`);
      if (task.estimatedMinutes) meta.push(`~${task.estimatedMinutes}m`);

      const metaStr = meta.length > 0 ? ` *(${meta.join(', ')})*` : '';
      lines.push(`- ${checkbox} **${task.title}**${metaStr}`);

      if (task.description) {
        lines.push(`  > ${task.description.replace(/\n/g, '\n  > ')}`);
      }

      if (task.subtasks && task.subtasks.length > 0) {
        for (const sub of task.subtasks) {
          const subCheck = sub.completed ? '[x]' : '[ ]';
          lines.push(`  - ${subCheck} ${sub.title}`);
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
