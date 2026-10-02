import { describe, it, expect, beforeEach } from 'vitest';
import {
  BUILT_IN_TEMPLATES,
  loadTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  instantiateTemplate,
} from './templateEngine';

let store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    store = {};
  },
};
(globalThis as any).localStorage = localStorageMock;

describe('templateEngine', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('loads default built-in templates when storage is empty', () => {
    const templates = loadTemplates();
    expect(templates.length).toBe(BUILT_IN_TEMPLATES.length);
    expect(templates[0].id).toBe('tpl_feature_launch');
    expect(templates[0].subtaskTitles.length).toBeGreaterThan(0);
  });

  it('saves a custom template to localStorage and loads it', () => {
    const custom = saveCustomTemplate({
      name: '🎨 Design System Audit',
      description: 'Review contrast, tokens, and responsive typography',
      defaultPriority: 'p2',
      defaultEstimatedMinutes: 40,
      subtaskTitles: ['Check color contrast', 'Verify dark mode token mapping'],
      contextTags: ['computer'],
    });

    expect(custom.id).toContain('tpl_custom_');
    expect(custom.isCustom).toBe(true);

    const loaded = loadTemplates();
    expect(loaded.length).toBe(BUILT_IN_TEMPLATES.length + 1);
    const found = loaded.find((t) => t.id === custom.id);
    expect(found?.name).toBe('🎨 Design System Audit');
    expect(found?.subtaskTitles).toEqual([
      'Check color contrast',
      'Verify dark mode token mapping',
    ]);
  });

  it('deletes a custom template from localStorage', () => {
    const custom = saveCustomTemplate({
      name: 'Temp Template',
      defaultPriority: 'p3',
      subtaskTitles: ['Step 1'],
    });

    let loaded = loadTemplates();
    expect(loaded.some((t) => t.id === custom.id)).toBe(true);

    deleteCustomTemplate(custom.id);
    loaded = loadTemplates();
    expect(loaded.some((t) => t.id === custom.id)).toBe(false);
  });

  it('instantiates a template into a task payload with unique subtask IDs', () => {
    const tpl = BUILT_IN_TEMPLATES[0];
    const instantiated = instantiateTemplate(tpl, 'work', '2026-10-15');

    expect(instantiated.title).toBe(tpl.name);
    expect(instantiated.priority).toBe(tpl.defaultPriority);
    expect(instantiated.estimatedMinutes).toBe(tpl.defaultEstimatedMinutes);
    expect(instantiated.projectId).toBe('work');
    expect(instantiated.dueDate).toBe('2026-10-15');
    expect(instantiated.subtasks?.length).toBe(tpl.subtaskTitles.length);
    expect(instantiated.subtasks?.[0].title).toBe(tpl.subtaskTitles[0]);
    expect(instantiated.subtasks?.[0].completed).toBe(false);
    expect(instantiated.subtasks?.[0].id).toBeDefined();
  });
});
