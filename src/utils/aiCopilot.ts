export interface SuggestedSubtask {
  title: string;
  estimatedMinutes?: number;
}

/**
 * Knowledge-base dictionary of intent patterns mapped to actionable decomposition templates.
 */
interface DomainRule {
  patterns: RegExp[];
  subtasks: (title: string) => SuggestedSubtask[];
}

const DOMAIN_RULES: DomainRule[] = [
  // 1. Coding & Bug Fixes
  {
    patterns: [/bug/i, /fix/i, /issue/i, /crash/i, /error/i, /defect/i],
    subtasks: (title) => [
      { title: `Reproduce defect locally and capture error trace for "${title}"`, estimatedMinutes: 15 },
      { title: 'Inspect root-cause code and affected dependencies', estimatedMinutes: 20 },
      { title: 'Implement minimal surgical fix with test case', estimatedMinutes: 25 },
      { title: 'Verify regression tests pass and commit clean diff', estimatedMinutes: 10 },
    ],
  },
  // 2. Feature Implementation & Development
  {
    patterns: [/implement/i, /build/i, /develop/i, /create feature/i, /add feature/i, /code/i],
    subtasks: (title) => [
      { title: `Draft technical specification & data model for "${title}"`, estimatedMinutes: 20 },
      { title: 'Scaffold core components and state management', estimatedMinutes: 35 },
      { title: 'Integrate UI interactions and error boundaries', estimatedMinutes: 25 },
      { title: 'Write unit tests and verify edge-cases', estimatedMinutes: 20 },
    ],
  },
  // 3. Taxes & Financial Management
  {
    patterns: [/tax/i, /irs/i, /filing/i, /invoice/i, /expense/i, /audit/i, /budget/i],
    subtasks: () => [
      { title: 'Gather all relevant receipts, 1099s, bank statements & invoices', estimatedMinutes: 30 },
      { title: 'Reconcile income and deductible business expenses in spreadsheet', estimatedMinutes: 40 },
      { title: 'Complete filing software entries or submit package to accountant', estimatedMinutes: 30 },
      { title: 'Archive digital copies and record confirmation receipt', estimatedMinutes: 10 },
    ],
  },
  // 4. Presentations & Pitch Decks
  {
    patterns: [/presentation/i, /pitch deck/i, /slides/i, /keynote/i, /deck/i],
    subtasks: (title) => [
      { title: `Outline core narrative and key takeaways for "${title}"`, estimatedMinutes: 25 },
      { title: 'Draft slide contents, metrics, and supporting visuals', estimatedMinutes: 45 },
      { title: 'Review visual layout, typography & contrast consistency', estimatedMinutes: 20 },
      { title: 'Rehearse spoken delivery and timing', estimatedMinutes: 20 },
    ],
  },
  // 5. Research & Documentation
  {
    patterns: [/research/i, /doc/i, /spec/i, /article/i, /write blog/i, /documentation/i, /rfc/i],
    subtasks: (title) => [
      { title: `Collect reference material, benchmarks & links for "${title}"`, estimatedMinutes: 25 },
      { title: 'Draft rough outline with key headings', estimatedMinutes: 15 },
      { title: 'Write initial draft focusing on substance without self-editing', estimatedMinutes: 45 },
      { title: 'Proofread, tighten prose and format code snippets/diagrams', estimatedMinutes: 20 },
    ],
  },
  // 6. Travel & Event Planning
  {
    patterns: [/trip/i, /travel/i, /vacation/i, /flight/i, /hotel/i, /itinerary/i, /pack/i],
    subtasks: (title) => [
      { title: `Confirm dates, transport options and accommodations for "${title}"`, estimatedMinutes: 30 },
      { title: 'Draft daily activity itinerary and make necessary reservations', estimatedMinutes: 30 },
      { title: 'Assemble essential packing checklist (documents, gear, chargers)', estimatedMinutes: 20 },
      { title: 'Set up out-of-office message and finalize home arrangements', estimatedMinutes: 15 },
    ],
  },
  // 7. Meetings & Workshops
  {
    patterns: [/meeting/i, /sync/i, /workshop/i, /1:1/i, /interview/i],
    subtasks: (title) => [
      { title: `Draft agenda items and desired outcomes for "${title}"`, estimatedMinutes: 15 },
      { title: 'Distribute pre-read materials and invite attendees', estimatedMinutes: 10 },
      { title: 'Conduct meeting and record action items', estimatedMinutes: 30 },
      { title: 'Send follow-up notes with assigned owners and deadlines', estimatedMinutes: 15 },
    ],
  },
  // 8. Marketing, Launch & Social
  {
    patterns: [/launch/i, /marketing/i, /campaign/i, /newsletter/i, /product hunt/i, /announcement/i],
    subtasks: (title) => [
      { title: `Define target audience, value prop and core message for "${title}"`, estimatedMinutes: 25 },
      { title: 'Prepare copy, assets, banners and tracking links', estimatedMinutes: 40 },
      { title: 'Set up distribution schedule across email, social & community channels', estimatedMinutes: 20 },
      { title: 'Monitor engagement, reply to questions, and record launch metrics', estimatedMinutes: 30 },
    ],
  },
  // 9. Health, Fitness & Routine
  {
    patterns: [/workout/i, /gym/i, /doctor/i, /dentist/i, /meditat/i, /run/i, /meal prep/i],
    subtasks: (title) => [
      { title: `Prepare gear, schedule, or appointment details for "${title}"`, estimatedMinutes: 10 },
      { title: 'Execute session with mindful focus', estimatedMinutes: 45 },
      { title: 'Hydrate, log stats, and note next session target', estimatedMinutes: 10 },
    ],
  },
  // 10. Organization & Decluttering
  {
    patterns: [/clean/i, /organize/i, /declutter/i, /tidy/i, /backup/i, /archive/i],
    subtasks: (title) => [
      { title: `Sort and categorize items into keep, donate, and discard for "${title}"`, estimatedMinutes: 25 },
      { title: 'Clean and reset surfaces or digital folders', estimatedMinutes: 25 },
      { title: 'Establish designated home for remaining items', estimatedMinutes: 15 },
    ],
  },
];

/**
 * Decomposes a task title into 3-4 structured, actionable subtasks with realistic estimates.
 * Works 100% locally and offline without external API dependencies.
 */
export function suggestSubtasks(taskTitle: string, description?: string): SuggestedSubtask[] {
  const combined = `${taskTitle} ${description || ''}`.trim();
  if (!combined) return [];

  for (const rule of DOMAIN_RULES) {
    if (rule.patterns.some((p) => p.test(combined))) {
      return rule.subtasks(taskTitle.trim());
    }
  }

  // Universal cognitive fallback: Preparation -> Core Execution -> Verification -> Delivery
  const cleanTitle = taskTitle.trim();
  return [
    { title: `Define requirements and outline steps for "${cleanTitle}"`, estimatedMinutes: 15 },
    { title: `Perform primary execution and draft work`, estimatedMinutes: 45 },
    { title: `Review quality, refine details, and resolve edge cases`, estimatedMinutes: 20 },
    { title: `Finalize output and mark task milestone complete`, estimatedMinutes: 10 },
  ];
}

/**
 * Predicts estimated completion duration in minutes based on task title linguistics.
 */
export function suggestDuration(taskTitle: string): number {
  const text = taskTitle.toLowerCase();
  if (/quick|brief|check|ping|reply|call/i.test(text)) return 15;
  if (/deep|architect|strategy|quarterly|annual|plan/i.test(text)) return 60;
  if (/write|draft|code|implement|fix|design|build/i.test(text)) return 45;
  if (/review|sync|clean|organize|triage|read/i.test(text)) return 30;
  return 30;
}
