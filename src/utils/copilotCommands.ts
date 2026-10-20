export type CopilotAction = 'add' | 'breakdown' | 'schedule' | 'focus' | 'summary';
export type CopilotCommand =
  | { action: 'add' | 'breakdown'; title: string }
  | { action: 'schedule'; date?: string }
  | { action: 'focus'; minutes: number; taskTitle?: string }
  | { action: 'summary' }
  | { action: 'unknown'; message: string };

/** Deliberately bounded commands: a task mentioning focus or progress is still a task. */
export function parseCopilotCommand(text: string): CopilotCommand {
  const input = text.trim();
  const add = input.match(/^(?:add(?: task)?|create task)\s*:?\s+(.+)$/i);
  if (add) return { action: 'add', title: add[1].trim() };
  const breakdown = input.match(/^(?:decompose|break down|split(?: task)?)\s*:?\s+(.+)$/i);
  if (breakdown) return { action: 'breakdown', title: breakdown[1].trim() };
  if (/^(?:(?:show(?: me)?|get)\s+)?(?:my\s+)?(?:daily\s+|today'?s\s+)?(?:summary|stats|progress)(?:\s+for today)?[.!?]?$/i.test(input)) return { action: 'summary' };
  const schedule = input.match(/^(?:plan|schedule|auto[ -]?slot)\s+(?:my\s+)?(?:day|tasks|today)(?:\s+(?:for\s+)?(\d{4}-\d{2}-\d{2}))?[.!?]?$/i);
  if (schedule) return { action: 'schedule', date: schedule[1] };
  const focus = input.match(/^(?:start\s+)?(?:focus|pomodoro)(?:\s+(\d+)\s*(?:m|min|minutes))?(?:\s+on\s+(.+))?$/i);
  if (focus) {
    const minutes = focus[1] ? Number(focus[1]) : 25;
    if (minutes < 1 || minutes > 240) return { action: 'unknown', message: 'Choose a focus duration from 1 to 240 minutes.' };
    return { action: 'focus', minutes, taskTitle: focus[2]?.trim() };
  }
  return { action: 'unknown', message: 'Choose an action below, or use a supported command such as “add Read chapter 3”, “decompose Prepare presentation”, “plan my day”, “focus 25m” or “daily summary”.' };
}
