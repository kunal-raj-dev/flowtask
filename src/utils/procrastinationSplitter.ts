/**
 * Cognitive De-escalation & Anti-Procrastination Splitter
 * Transforms daunting, ambiguous, or frequently postponed tasks into a 5-minute physical starter action.
 * Based on Section 6.4 of the FlowTask Product Strategy & Blueprint.
 */

export type ProcrastinationDomain =
  | 'writing'
  | 'coding'
  | 'communication'
  | 'research'
  | 'design'
  | 'finance_admin'
  | 'planning'
  | 'general';

export interface StarterStepResult {
  starterAction: string;
  domain: ProcrastinationDomain;
  suggestedMinutes: number;
  rationale: string;
}

const DOMAIN_PATTERNS: {
  domain: ProcrastinationDomain;
  regex: RegExp;
  templates: string[];
  rationale: string;
}[] = [
  {
    domain: 'research',
    regex: /\b(research|investigate|study|learn|benchmark|survey|audit)\b/i,
    templates: [
      'Open the target article or documentation and read only the executive summary',
      'Skim the table of contents and bookmark the single most relevant subsection',
      'Write down the one specific question you need this research to answer',
    ],
    rationale: 'Boundless reading leads to procrastination; framing a single target question anchors attention.',
  },
  {
    domain: 'coding',
    regex: /\b(code|bug|fix|refactor|feature|endpoint|api|database|query|pr|pull request|git|test|ci|cd|deploy|pipeline|migration|service|auth|backend|frontend)\b/i,
    templates: [
      'Open repository and reproduce the issue or error log locally',
      'Create a git branch and write a single failing test or dummy stub',
      'Inspect the target file and add a TODO comment with expected input/output',
    ],
    rationale: 'Starting a coding task requires zero lines of code—just opening the workspace and isolating the entry point.',
  },
  {
    domain: 'writing',
    regex: /\b(write|draft|article|blog|rfc|spec|proposal|document|doc|essay|copy|content|guide|summary|script)\b/i,
    templates: [
      'Open blank document and write 3 rough bullet points of core takeaways',
      'Draft a single sentence answering: "What problem does this document solve?"',
      'Write down the section headings without writing any paragraph prose',
    ],
    rationale: 'Writer\'s block is solved by eliminating the blank page through microscopic bullet outlines.',
  },
  {
    domain: 'communication',
    regex: /\b(email|reply|call|slack|message|sync|reach out|follow up|contact|inquire|meeting|schedule|invite)\b/i,
    templates: [
      'Write a 2-sentence draft in your scratchpad before opening the inbox',
      'Find recipient address and bullet the single core question you need answered',
      'Open email thread and read only the latest message to identify the blocker',
    ],
    rationale: 'Drafting communications in a detached scratchpad prevents inbox distraction spirals.',
  },
  {
    domain: 'design',
    regex: /\b(design|ui|ux|mockup|wireframe|figma|prototype|sketch|layout|icon|component|palette|style)\b/i,
    templates: [
      'Open Figma or notebook and sketch a rough 3-box wireframe layout',
      'Gather 2 visual reference screenshots that capture the desired vibe',
      'List the 4 required UI elements on this screen before opening design tools',
    ],
    rationale: 'Visual perfectionism halts momentum; a 60-second napkin wireframe de-escalates pressure.',
  },
  {
    domain: 'finance_admin',
    regex: /\b(tax|invoice|bill|receipt|expense|accounting|bank|statement|payroll|contract|legal|compliance|forms?)\b/i,
    templates: [
      'Log into the dashboard and download the latest monthly PDF statement',
      'Create a folder named with today\'s date and gather all relevant receipt files',
      'Check the deadline and write down the single document needed first',
    ],
    rationale: 'Administrative dread dissolves the moment the required files are located in one local folder.',
  },
  {
    domain: 'planning',
    regex: /\b(plan|strategy|roadmap|quarterly|okr|goals?|prioritize|sprint planning)\b/i,
    templates: [
      'Write down the Top 1 most critical deliverable for this initiative',
      'List 3 potential obstacles that could derail this timeline',
      'Brain-dump the unorganized thoughts into a rough 5-line scratchpad list',
    ],
    rationale: 'Strategic planning becomes actionable when constrained to identifying just the primary deliverable.',
  },
];

/**
 * Generates a tailored 5-minute starter action to de-escalate task avoidance.
 */
export function generateStarterAction(
  title: string,
  description?: string
): StarterStepResult {
  const combined = `${title} ${description || ''}`.trim();

  for (const entry of DOMAIN_PATTERNS) {
    if (entry.regex.test(combined)) {
      // Pick the first template as primary starter
      const template = entry.templates[0];
      return {
        starterAction: `${template} (5m)`,
        domain: entry.domain,
        suggestedMinutes: 5,
        rationale: entry.rationale,
      };
    }
  }

  // General fallback for unknown domains
  return {
    starterAction: `Write the single immediate physical action and set a 5-minute timer (5m)`,
    domain: 'general',
    suggestedMinutes: 5,
    rationale: 'Breaking inertia on ambiguous tasks requires committing to just 300 seconds of low-stakes physical action.',
  };
}

/**
 * Returns all alternative starter prompts for a domain to give user choices.
 */
export function getAlternativeStarterActions(
  title: string,
  description?: string
): string[] {
  const combined = `${title} ${description || ''}`.trim();
  for (const entry of DOMAIN_PATTERNS) {
    if (entry.regex.test(combined)) {
      return entry.templates.map((t) => `${t} (5m)`);
    }
  }
  return [
    'Write the single immediate physical action and set a 5-minute timer (5m)',
    'Open your scratchpad and brain-dump 3 bullet thoughts (5m)',
    'Clarify what "done" looks like in 1 plain sentence (5m)',
  ];
}
