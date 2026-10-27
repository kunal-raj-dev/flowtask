import type { UserWorkflowSettings } from '../types/settings';
export type ShortcutCategory = 'navigation' | 'tasks' | 'studio' | 'dashboard' | 'contextual';

export interface ShortcutItem {
  id: string;
  category: ShortcutCategory;
  categoryLabel: string;
  action: string;
  context: string;
  displayKey: string;
  description: string;
  searchTokens: string[];
}

export const isMac =
  typeof navigator !== 'undefined' &&
  Boolean(navigator.userAgent && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent));

export const MOD_KEY = isMac ? '⌘' : 'Ctrl';
export const ALT_KEY = isMac ? '⌥' : 'Alt';

export const SHORTCUT_REGISTRY: ShortcutItem[] = [
  // Navigation & Global
  {
    id: 'nav-command-palette',
    category: 'navigation',
    categoryLabel: 'Navigation & Global',
    action: 'Open Command Palette',
    context: 'Global',
    displayKey: `${MOD_KEY} + K`,
    description: 'Search commands, views, and actions across FlowTask',
    searchTokens: ['command', 'palette', 'search', 'global', 'k'],
  },
  {
    id: 'nav-copilot',
    category: 'navigation',
    categoryLabel: 'Navigation & Global',
    action: 'Open AI Copilot Omnibar',
    context: 'Global',
    displayKey: `${MOD_KEY} + J`,
    description: 'Instant natural language task queries and actions',
    searchTokens: ['copilot', 'ai', 'omnibar', 'j'],
  },
  {
    id: 'nav-quick-add',
    category: 'navigation',
    categoryLabel: 'Navigation & Global',
    action: 'Quick Add Task',
    context: 'Global',
    displayKey: 'C or N',
    description: 'Open quick task capture composer from anywhere',
    searchTokens: ['create', 'new', 'add', 'composer', 'c', 'n'],
  },
  {
    id: 'nav-capture-hud',
    category: 'navigation',
    categoryLabel: 'Navigation & Global',
    action: 'Open Quick-Capture HUD',
    context: 'Global',
    displayKey: `${ALT_KEY} + Space`,
    description: 'Instant multi-token quick-capture HUD with live parsing chips',
    searchTokens: ['capture', 'hud', 'quick', 'tokens', 'space'],
  },
  {
    id: 'nav-calendar-companion',
    category: 'navigation',
    categoryLabel: 'Navigation & Global',
    action: 'Toggle Calendar Time-Block Drawer',
    context: 'Global',
    displayKey: 'Alt + C',
    description: 'Toggle interactive calendar time-block companion drawer',
    searchTokens: ['calendar', 'timeblock', 'grid', 'companion', 'c'],
  },
  {
    id: 'nav-sidebar',
    category: 'navigation',
    categoryLabel: 'Navigation & Global',
    action: 'Toggle Sidebar',
    context: 'Global',
    displayKey: `[ or ${MOD_KEY} + \\`,
    description: 'Expand or collapse sidebar for zen focus view',
    searchTokens: ['sidebar', 'zen', 'toggle', '['],
  },
  {
    id: 'nav-settings',
    category: 'navigation',
    categoryLabel: 'Navigation & Global',
    action: 'Open Settings',
    context: 'Global',
    displayKey: `${MOD_KEY} + ,`,
    description: 'Open workflow preferences and application settings',
    searchTokens: ['settings', 'preferences', 'config', ','],
  },
  {
    id: 'nav-undo',
    category: 'navigation',
    categoryLabel: 'Navigation & Global',
    action: 'Undo Last Action',
    context: 'Global',
    displayKey: `${MOD_KEY} + Z`,
    description: 'Undo recent task updates, moves, completes, or deletes',
    searchTokens: ['undo', 'revert', 'z'],
  },
  {
    id: 'nav-redo',
    category: 'navigation',
    categoryLabel: 'Navigation & Global',
    action: 'Redo Action',
    context: 'Global',
    displayKey: `${MOD_KEY} + Shift + Z`,
    description: 'Redo the most recently undone action',
    searchTokens: ['redo', 'y', 'z'],
  },
  {
    id: 'nav-evening-shutdown',
    category: 'navigation',
    categoryLabel: 'Navigation & Global',
    action: 'Evening Shutdown Ritual',
    context: 'Global',
    displayKey: `${MOD_KEY} + Shift + D`,
    description: 'Daily review, sweep incomplete tasks, celebrate wins',
    searchTokens: ['evening', 'shutdown', 'ritual', 'sweep', 'd'],
  },
  {
    id: 'nav-weekly-review',
    category: 'navigation',
    categoryLabel: 'Navigation & Global',
    action: 'Weekly Review Wizard',
    context: 'Global',
    displayKey: `${MOD_KEY} + Shift + W`,
    description: 'Reflect on weekly velocity, clear backlogs, plan ahead',
    searchTokens: ['weekly', 'review', 'wizard', 'w'],
  },
  {
    id: 'nav-scratchpad',
    category: 'navigation',
    categoryLabel: 'Navigation & Global',
    action: 'Toggle Scratchpad & Notes',
    context: 'Global',
    displayKey: `${ALT_KEY} + N`,
    description: 'Quick persistent notes and braindump floating pad',
    searchTokens: ['scratchpad', 'notes', 'pad', 'memo'],
  },
  {
    id: 'nav-shortcuts-help',
    category: 'navigation',
    categoryLabel: 'Navigation & Global',
    action: 'Shortcuts Reference',
    context: 'Global',
    displayKey: '?',
    description: 'Open keyboard shortcuts cheatsheet modal',
    searchTokens: ['help', 'shortcuts', 'cheatsheet', '?'],
  },
  {
    id: 'nav-esc',
    category: 'navigation',
    categoryLabel: 'Navigation & Global',
    action: 'Dismiss / Close',
    context: 'Global',
    displayKey: 'Esc',
    description: 'Close open dialogs, drawers, popovers, or selections',
    searchTokens: ['esc', 'escape', 'close', 'dismiss'],
  },

  // Tasks & Lists
  {
    id: 'tasks-nav',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Navigate Tasks',
    context: 'Task List',
    displayKey: 'J / K (or ↓ / ↑)',
    description: 'Highlight next or previous task row',
    searchTokens: ['navigate', 'down', 'up', 'j', 'k', 'arrow'],
  },
  {
    id: 'tasks-toggle-status',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Toggle Complete / Incomplete',
    context: 'Task List',
    displayKey: 'Space',
    description: 'Mark highlighted task as done or todo',
    searchTokens: ['complete', 'done', 'todo', 'check', 'space'],
  },
  {
    id: 'tasks-open-detail',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Open Task Drawer',
    context: 'Task List',
    displayKey: 'Enter',
    description: 'Open full inspection drawer for highlighted task',
    searchTokens: ['drawer', 'open', 'inspect', 'enter'],
  },
  {
    id: 'triage-done',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Inbox Triage: Mark Complete',
    context: 'Inbox Triage',
    displayKey: 'E',
    description: 'Instant one-key completion and advance to next inbox task',
    searchTokens: ['inbox', 'triage', 'done', 'complete', 'e'],
  },
  {
    id: 'triage-snooze',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Inbox Triage: Snooze & Schedule',
    context: 'Inbox Triage',
    displayKey: 'S',
    description: 'Quick snooze menu (Today, Tomorrow, Weekend, Next Week)',
    searchTokens: ['inbox', 'snooze', 'schedule', 'defer', 's'],
  },
  {
    id: 'triage-breakdown',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Inbox Triage: AI Breakdown',
    context: 'Inbox Triage',
    displayKey: 'B',
    description: 'Decompose active inbox task into micro-steps using AI',
    searchTokens: ['inbox', 'breakdown', 'steps', 'ai', 'b'],
  },
  {
    id: 'tasks-multi-select',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Toggle Selection',
    context: 'Task List',
    displayKey: 'X',
    description: 'Select highlighted task for batch actions',
    searchTokens: ['select', 'batch', 'bulk', 'multi', 'x'],
  },
  {
    id: 'tasks-multi-range',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Expand Range Selection',
    context: 'Task List',
    displayKey: 'Shift + J / K',
    description: 'Select contiguous range of tasks',
    searchTokens: ['range', 'shift', 'multi', 'select'],
  },
  {
    id: 'tasks-priority-popover',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Priority Picker',
    context: 'Task List',
    displayKey: 'P',
    description: 'Open quick priority selection menu',
    searchTokens: ['priority', 'picker', 'p'],
  },
  {
    id: 'tasks-set-priority',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Set Priority 1 – 4',
    context: 'Task List',
    displayKey: '1, 2, 3, 4',
    description: 'Directly set task priority to P1 (Urgent), P2, P3, or P4',
    searchTokens: ['priority', '1', '2', '3', '4', 'urgent'],
  },
  {
    id: 'tasks-date-popover',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Date Schedule Picker',
    context: 'Task List',
    displayKey: 'D',
    description: 'Open date rescheduling popover',
    searchTokens: ['date', 'schedule', 'reschedule', 'd'],
  },
  {
    id: 'tasks-move-today',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Schedule for Today',
    context: 'Task List',
    displayKey: 'T',
    description: 'Schedule highlighted task for today and toggle its Top 3 pin',
    searchTokens: ['today', 'reschedule', 't'],
  },
  {
    id: 'tasks-move-tomorrow',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Schedule for Tomorrow',
    context: 'Task List',
    displayKey: 'M',
    description: 'Reschedule highlighted task to tomorrow',
    searchTokens: ['tomorrow', 'reschedule', 'm'],
  },
  {
    id: 'tasks-move-someday',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Move to Someday',
    context: 'Task List',
    displayKey: 'S',
    description: 'Park highlighted task in Someday backlog',
    searchTokens: ['someday', 'backlog', 'park', 's'],
  },
  {
    id: 'tasks-start-focus',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Start Focus Timer',
    context: 'Task List',
    displayKey: 'F',
    description: 'Launch deep focus studio on highlighted task',
    searchTokens: ['focus', 'timer', 'studio', 'f'],
  },
  {
    id: 'tasks-archive',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Archive Task',
    context: 'Task List',
    displayKey: 'E',
    description: 'Archive highlighted task or batch selection',
    searchTokens: ['archive', 'e'],
  },
  {
    id: 'tasks-delete',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Delete Task',
    context: 'Task List',
    displayKey: 'Del / Backspace',
    description: 'Move highlighted task or batch selection to Trash',
    searchTokens: ['delete', 'trash', 'remove', 'del', 'backspace'],
  },
  {
    id: 'tasks-rename',
    category: 'tasks',
    categoryLabel: 'Tasks & Lists',
    action: 'Rename Title Inline',
    context: 'Task List',
    displayKey: 'F2 (or double-click)',
    description: 'Inline text edit of task title',
    searchTokens: ['rename', 'title', 'edit', 'f2'],
  },

  // Focus Studio
  {
    id: 'studio-toggle-timer',
    category: 'studio',
    categoryLabel: 'Focus Studio',
    action: 'Start / Pause / Resume',
    context: 'Focus Studio',
    displayKey: 'Space',
    description: 'Toggle timer ticking state',
    searchTokens: ['studio', 'timer', 'pause', 'resume', 'start', 'space'],
  },
  {
    id: 'studio-fullscreen',
    category: 'studio',
    categoryLabel: 'Focus Studio',
    action: 'Toggle Fullscreen',
    context: 'Focus Studio',
    displayKey: 'F',
    description: 'Enter or exit immersive fullscreen view',
    searchTokens: ['fullscreen', 'immersive', 'f'],
  },
  {
    id: 'studio-clear-mode',
    category: 'studio',
    categoryLabel: 'Focus Studio',
    action: 'Toggle Clear / Zen Mode',
    context: 'Focus Studio',
    displayKey: 'Z / C',
    description: 'Hide distracting UI controls for clean ambient view (Z, C alias)',
    searchTokens: ['clear', 'ambient', 'minimal', 'zen', 'z', 'c'],
  },
  {
    id: 'studio-pip',
    category: 'studio',
    categoryLabel: 'Focus Studio',
    action: 'Picture-in-Picture Mini Timer',
    context: 'Focus Studio',
    displayKey: 'P',
    description: 'Float mini focus timer over other desktop apps',
    searchTokens: ['pip', 'picture in picture', 'mini', 'float', 'p'],
  },
  {
    id: 'studio-interruption-shield',
    category: 'studio',
    categoryLabel: 'Focus Studio',
    action: 'Interruption Shield',
    context: 'Focus Studio',
    displayKey: 'I',
    description: 'Instantly log a sudden distraction or task without breaking focus',
    searchTokens: ['interruption', 'shield', 'stash', 'distraction', 'i'],
  },
  {
    id: 'studio-exit',
    category: 'studio',
    categoryLabel: 'Focus Studio',
    action: 'Exit Studio',
    context: 'Focus Studio',
    displayKey: 'Esc',
    description: 'Return to planner view',
    searchTokens: ['exit', 'studio', 'leave', 'esc'],
  },

  // Dashboard Canvas
  {
    id: 'dashboard-edit',
    category: 'dashboard',
    categoryLabel: 'Dashboard Canvas',
    action: 'Edit Layout / Desks',
    context: 'Dashboard (no task highlighted)',
    displayKey: 'E',
    description: 'Enter dashboard edit mode to rearrange widgets',
    searchTokens: ['dashboard', 'layout', 'edit', 'rearrange', 'e'],
  },
  {
    id: 'dashboard-save',
    category: 'dashboard',
    categoryLabel: 'Dashboard Canvas',
    action: 'Save Layout',
    context: 'Dashboard Edit',
    displayKey: `${MOD_KEY} + S`,
    description: 'Commit dashboard modifications',
    searchTokens: ['save', 'commit', 'layout', 's'],
  },
  {
    id: 'dashboard-cancel',
    category: 'dashboard',
    categoryLabel: 'Dashboard Canvas',
    action: 'Cancel Changes',
    context: 'Dashboard Edit',
    displayKey: 'Esc',
    description: 'Discard layout changes and exit edit mode',
    searchTokens: ['cancel', 'discard', 'esc'],
  },

  // Contextual
  {
    id: 'contextual-kanban',
    category: 'contextual',
    categoryLabel: 'Contextual Views',
    action: 'Switch Kanban Column',
    context: 'Kanban View',
    displayKey: '1 – 3 or ← / →',
    description: 'Navigate the board columns; task status stays unchanged',
    searchTokens: ['kanban', 'column', 'stage', 'arrow'],
  },
  {
    id: 'contextual-matrix',
    category: 'contextual',
    categoryLabel: 'Contextual Views',
    action: 'Switch Eisenhower Quadrant',
    context: 'Eisenhower View',
    displayKey: '1 – 4 or ← / →',
    description: 'Navigate the matrix quadrants; task importance stays unchanged',
    searchTokens: ['matrix', 'eisenhower', 'quadrant'],
  },

];

export const SHORTCUT_CATEGORIES: Array<{ key: ShortcutCategory; label: string }> = [
  { key: 'navigation', label: 'Navigation & Global' },
  { key: 'tasks', label: 'Tasks & Lists' },
  { key: 'studio', label: 'Focus Studio' },
  { key: 'dashboard', label: 'Dashboard Canvas' },
  { key: 'contextual', label: 'Contextual Views' },
];

export function searchShortcuts(query: string): ShortcutItem[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return SHORTCUT_REGISTRY;
  return SHORTCUT_REGISTRY.filter((s) => {
    return (
      s.action.toLowerCase().includes(clean) ||
      s.context.toLowerCase().includes(clean) ||
      s.categoryLabel.toLowerCase().includes(clean) ||
      s.displayKey.toLowerCase().includes(clean) ||
      s.description.toLowerCase().includes(clean) ||
      s.searchTokens.some((t) => t.toLowerCase().includes(clean))
    );
  });
}

export interface SmartSyntaxItem {
  token: string;
  desc: string;
  example: string;
}

export const SMART_SYNTAX_ITEMS: SmartSyntaxItem[] = [
  { token: '#project', desc: 'Assigns task to specific project', example: '#work, #reading, #inbox' },
  { token: '@context', desc: 'Assigns context or location tag', example: '@calls, @computer, @home' },
  { token: 'today / tomorrow', desc: 'Schedules planned date & relative time', example: 'today, tomorrow morning, tomorrow at 3pm' },
  { token: 'next friday / in 3 days', desc: 'Natural language date parsing', example: 'next friday, in 3 days at 10am' },
  { token: 'every weekday', desc: 'Sets recurrence frequency', example: 'every weekday, daily, weekly, monthly' },
  { token: 'p1 – p4 or !urgent', desc: 'Sets priority level directly', example: 'p1, !urgent, p2, p3, p4' },
  { token: '~25m or ~1h', desc: 'Sets estimated time duration', example: '~25m, ~45m, ~1h 30m, ~220m' },
];

function isEditableElement(el: unknown): boolean {
  if (!el || typeof el !== 'object') return false;
  const element = el as HTMLElement;
  if (typeof element.closest === "function" && element.closest('input,textarea,select,[contenteditable="true"],[role="textbox"],[role="searchbox"],[role="combobox"]')) return true;
  const tag = (element.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (element.isContentEditable) return true;
  if (typeof element.getAttribute === 'function') {
    if (element.getAttribute('contenteditable') === 'true') return true;
    const role = element.getAttribute('role');
    if (role === 'textbox' || role === 'searchbox') return true;
  }
  return false;
}

/**
 * Standardized input guard for keyboard shortcuts across FlowTask.
 * Protects editable fields, active text selection, IME composition, and repeated held keys.
 */
export function shouldIgnoreShortcut(
  e: KeyboardEvent,
  options?: { allowRepeats?: boolean; allowSelection?: boolean }
): boolean {
  if (e.defaultPrevented) return true;
  if (e.isComposing || e.keyCode === 229) return true;
  if (!options?.allowRepeats && e.repeat) return true;

  if (isEditableElement(e.target)) return true;

  if (typeof document !== 'undefined' && isEditableElement(document.activeElement)) {
    return true;
  }

  if (!options?.allowSelection) {
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    if (selection && selection.toString().trim().length > 0 && !selection.isCollapsed) {
      return true;
    }
  }

  return false;
}


export function shortcutHintsEnabled(settings?: Partial<UserWorkflowSettings>): boolean {
  return settings?.keyboardShortcutsEnabled !== false &&
    (settings?.showShortcutHints ?? settings?.keyboardHaloEnabled ?? true) !== false;
}
