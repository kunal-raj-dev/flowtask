import type { Task, Project } from '../types/task';
import { formatLocalDate } from './nlpParser';

export interface WorklogOptions {
  timeHorizon?: 'all' | 'today' | 'week' | 'month';
  exportDate?: Date;
}

export function generateWorklogMarkdown(
  tasks: Task[],
  projects: Project[],
  options: WorklogOptions = {}
): string {
  const horizon = options.timeHorizon || 'all';
  const exportDate = options.exportDate || new Date();

  const totalMinutes = tasks.reduce(
    (acc, t) => acc + (t.timeSpentMinutes || t.estimatedMinutes || 25),
    0
  );
  const totalHours = (totalMinutes / 60).toFixed(1);

  let md = `# 📋 FlowTask Accomplishment Worklog\n\n`;
  md += `> **Period**: ${horizon.toUpperCase()} • **Exported**: ${exportDate.toLocaleString()}\n`;
  md += `> **Summary**: ${tasks.length} tasks completed • ${totalHours} focus hours logged\n\n`;
  md += `---\n\n`;
  md += `## 🏆 Completed Deliverables\n\n`;

  if (tasks.length === 0) {
    md += `_No completed tasks in the selected range._\n`;
  } else {
    // Group by project
    const byProject = new Map<string, Task[]>();
    tasks.forEach((t) => {
      const pName = projects.find((p) => p.id === t.projectId)?.name || 'General';
      const list = byProject.get(pName) || [];
      list.push(t);
      byProject.set(pName, list);
    });

    byProject.forEach((taskList, projName) => {
      md += `### #${projName} (${taskList.length} tasks)\n`;
      taskList.forEach((t) => {
        const compDate = t.completedAt ? formatLocalDate(new Date(t.completedAt)) : 'Completed';
        const time = t.timeSpentMinutes ? ` *(⏱️ ${t.timeSpentMinutes}m)*` : '';
        md += `- [x] **${t.title}** — ${compDate}${time}\n`;
        if (t.description?.trim()) {
          md += `  > ${t.description.trim().replace(/\n/g, ' ')}\n`;
        }
      });
      md += `\n`;
    });
  }

  md += `---\n*Generated locally with FlowTask Executive Productivity OS*\n`;
  return md;
}
