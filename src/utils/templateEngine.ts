import type { TaskTemplate, Task } from '../types/task';

export const BUILT_IN_TEMPLATES: TaskTemplate[] = [
  {
    id: 'tpl_feature_launch',
    name: '🚀 Feature Release & Deployment',
    description: 'Comprehensive release pipeline checklist from staging to production metrics.',
    defaultPriority: 'p1',
    defaultEstimatedMinutes: 60,
    subtaskTitles: [
      'Run automated test suite and verify 0 failures',
      'Review PR diff and bump semantic version in package.json',
      'Deploy to staging environment & run smoke tests',
      'Deploy to production & monitor real-time error logs',
      'Publish changelog and notify team in Slack',
    ],
    contextTags: ['computer'],
  },
  {
    id: 'tpl_bug_hotfix',
    name: '🐞 Bug Investigation & Hotfix',
    description: 'Fast-track investigation, regression test, and deployment for urgent defects.',
    defaultPriority: 'p1',
    defaultEstimatedMinutes: 45,
    subtaskTitles: [
      'Reproduce issue locally and capture reproduction steps',
      'Inspect server logs and stack trace',
      'Write automated failing regression test',
      'Implement surgical root-cause fix',
      'Verify test passes & deploy hotfix patch',
    ],
    contextTags: ['computer'],
  },
  {
    id: 'tpl_one_on_one',
    name: '👥 Weekly 1:1 Sync Prep',
    description: 'Structured check-in template covering accomplishments, blockers, and goals.',
    defaultPriority: 'p2',
    defaultEstimatedMinutes: 30,
    subtaskTitles: [
      'Review commitments from last week',
      'Surface top 2 operational blockers or friction points',
      'Align on Top 3 Focus priorities for coming week',
      'Share feedback & personal development goals',
    ],
    contextTags: ['calls'],
  },
  {
    id: 'tpl_weekly_reset',
    name: '🧹 Weekly Review & Mental Reset',
    description: 'Weekly hygiene ritual to clear inboxes, triage backlogs, and plan the horizon.',
    defaultPriority: 'p2',
    defaultEstimatedMinutes: 30,
    subtaskTitles: [
      'Process Inbox to zero (triage or file every task)',
      'Review Someday/Maybe backlog and prune dead ideas',
      'Archive or clean completed project workspaces',
      'Plan top 3 high-leverage outcomes for upcoming week',
    ],
    contextTags: ['computer'],
  },
  {
    id: 'tpl_morning_kickstart',
    name: '🌅 Morning Planning & Prioritization',
    description: 'Quick 10-minute ritual to calibrate calendar and select Top 3 priorities.',
    defaultPriority: 'p1',
    defaultEstimatedMinutes: 15,
    subtaskTitles: [
      'Review calendar meetings and protect 2 focus blocks',
      'Pin Top 3 Focus for today',
      'Triage any overdue items without shame',
    ],
    contextTags: ['focus'],
  },
  {
    id: 'tpl_client_onboarding',
    name: '🤝 Client Onboarding Checklist',
    description: 'Standard operational steps to welcome a new client and kick off projects.',
    defaultPriority: 'p2',
    defaultEstimatedMinutes: 45,
    subtaskTitles: [
      'Send welcome email and onboarding questionnaire',
      'Provision shared drive and communication channel',
      'Schedule kickoff call and set agenda',
      'Document deliverables and timeline milestones',
    ],
    contextTags: ['calls', 'computer'],
  },
];

export const TEMPLATES_STORAGE_KEY = 'flowtask_custom_templates';

export function loadTemplates(): TaskTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!raw) return BUILT_IN_TEMPLATES;
    const custom: TaskTemplate[] = JSON.parse(raw);
    return [...BUILT_IN_TEMPLATES, ...(Array.isArray(custom) ? custom : [])];
  } catch {
    return BUILT_IN_TEMPLATES;
  }
}

export function saveCustomTemplate(
  template: Omit<TaskTemplate, 'id' | 'isCustom'>
): TaskTemplate {
  const newTemplate: TaskTemplate = {
    ...template,
    id: `tpl_custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    isCustom: true,
  };

  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    const custom: TaskTemplate[] = raw ? JSON.parse(raw) : [];
    custom.push(newTemplate);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(custom));
  } catch (e) {
    console.error('Failed to save custom template:', e);
  }

  return newTemplate;
}

export function deleteCustomTemplate(templateId: string): void {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!raw) return;
    const custom: TaskTemplate[] = JSON.parse(raw);
    const updated = custom.filter((t) => t.id !== templateId);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to delete custom template:', e);
  }
}

export function instantiateTemplate(
  template: TaskTemplate,
  targetProjectId: string = 'inbox',
  dueDate?: string
): Partial<Task> {
  return {
    title: template.name,
    priority: template.defaultPriority,
    estimatedMinutes: template.defaultEstimatedMinutes,
    projectId: targetProjectId,
    dueDate,
    contextTags: template.contextTags ? [...template.contextTags] : [],
    subtasks: template.subtaskTitles.map((title) => ({
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title,
      completed: false,
    })),
  };
}
