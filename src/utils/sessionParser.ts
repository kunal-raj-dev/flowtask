import type { TargetDifficulty, SubTask, Task, SessionMetadata } from '../types/task';

export interface ParsedSessionTarget {
  id: string;
  problemNumber?: number | string;
  difficulty?: TargetDifficulty;
  title: string;
  url?: string;
  tags?: string[];
  estimatedMinutes?: number;
}

export interface ParsedSession {
  id: string;
  sessionNumber?: number;
  sessionTopic: string;
  rawHeader?: string;
  startTime?: string; // HH:mm (24h)
  endTime?: string;   // HH:mm (24h)
  durationMinutes?: number;
  targets: ParsedSessionTarget[];
  targetPacingMinutes?: number;
  targetUnit?: string;
  secondaryMilestone?: string;
  contingencyGoal?: string;
  rawText: string;
}

/**
 * Normalizes strings like "8:30 am", "11:30 am", "2:30 pm", "14:00", "9am", "12pm" to "HH:mm" (24h)
 */
export function normalizeTimeTo24h(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();

  // Match e.g. "8:30 am", "11:30am", "2:30 pm", "12 pm", "8 am", "9am"
  const ampmMatch = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const isPm = ampmMatch[3] === 'pm';

    if (isPm && hour < 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // Match e.g. "08:30", "14:30", "8:30"
  const standardMatch = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (standardMatch) {
    const hour = parseInt(standardMatch[1], 10);
    const minute = parseInt(standardMatch[2], 10);
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Calculate duration in minutes between "HH:mm" and "HH:mm"
 */
export function calculateDurationMinutes(startHHmm: string, endHHmm: string): number {
  const [sH, sM] = startHHmm.split(':').map(Number);
  const [eH, eM] = endHHmm.split(':').map(Number);

  let startTotal = sH * 60 + sM;
  let endTotal = eH * 60 + eM;

  if (endTotal < startTotal) {
    // Crosses midnight
    endTotal += 24 * 60;
  }

  return Math.max(0, endTotal - startTotal);
}

/**
 * Extracts a start/end time range from a string.
 * Supports:
 * - "8:30 am to 11:30 am"
 * - "8:30am - 11:30am"
 * - "9am - 12pm"
 * - "1:00pm - 3:30pm"
 * - "14:00 - 17:00"
 * - "(8:30am - 11:30am)"
 * - "8:30 - 11:30 am"
 */
export function extractTimeRange(text: string): { start?: string; end?: string; duration?: number } | null {
  if (!text) return null;

  const rangeRegex = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|–|—|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  const match = text.match(rangeRegex);
  if (!match) return null;

  let rawStart = match[1].trim();
  let rawEnd = match[2].trim();

  // If end has am/pm but start omitted it (e.g. "8:30 - 11:30 am" or "1 - 3:30 pm")
  const endAmPmMatch = rawEnd.match(/(am|pm)$/i);
  const startAmPmMatch = rawStart.match(/(am|pm)$/i);
  if (endAmPmMatch && !startAmPmMatch) {
    const endAmPm = endAmPmMatch[1].toLowerCase();
    const startHour = parseInt(rawStart.split(':')[0], 10);
    if (endAmPm === 'pm') {
      if (startHour >= 7 && startHour <= 11) {
        rawStart += ' am';
      } else {
        rawStart += ' pm';
      }
    } else {
      rawStart += ' ' + endAmPm;
    }
  }

  const startNorm = normalizeTimeTo24h(rawStart);
  const endNorm = normalizeTimeTo24h(rawEnd);

  if (startNorm && endNorm) {
    const duration = calculateDurationMinutes(startNorm, endNorm);
    return { start: startNorm, end: endNorm, duration };
  }

  return null;
}

/**
 * Parses a single line representing a target question, module, or task.
 * Supports:
 * - Simple Markdown bullet: "- Two Sum (Easy, 15m)"
 * - Time estimates: "(30m)", "(45 mins)", "(1 hr)", "~20m"
 * - Difficulties: "Easy", "Medium", "Med", "Hard"
 * - Numbered lists: "1. 3Sum (Medium, 30m) - https://..."
 * - Checkboxes: "- [ ] Trapping Rain Water (Hard)"
 * - Compact LeetCode copy-pastes: "7 HARDMedian of Two Sorted Arrays..."
 */
export function parseTargetLine(line: string, index = 0): ParsedSessionTarget | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Ignore Markdown fences, dividers, greetings, dates, Discord timestamps, headers
  if (
    /^```/i.test(trimmed) ||
    /^[-=_*~]{3,}$/.test(trimmed) ||
    /^(?:start|end)\s+(?:study|work|session|day)/i.test(trimmed) ||
    /^(?:today|daily)\s*(?:plan|schedule|goals)/i.test(trimmed) ||
    /^(?:[a-zA-Z0-9_]+\s+\d{1,2}\/\d{1,2}\/\d{2,4}|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2})/i.test(
      trimmed
    ) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(trimmed) ||
    /^(?:session|study\s+session|focus\s+session)\s*\d*/i.test(trimmed)
  ) {
    return null;
  }

  // Strip leading bullets, numbers, checkboxes, "target questions ->", "target ->"
  const cleanLine = trimmed
    .replace(/^target\s*(?:questions?)?\s*->\s*/i, '')
    .replace(/^target\s*:\s*/i, '')
    .replace(/^[-*•]\s*(?:\[[ xX]\]\s*)?/, '')
    .replace(/^\[[ xX]\]\s*/, '')
    .trim();

  if (!cleanLine) return null;

  // 1. Check for URL anywhere in the line
  const urlMatch = cleanLine.match(/(https?:\/\/[^\s\)]+)/i);
  let rawUrl = urlMatch ? urlMatch[1] : undefined;
  if (rawUrl) {
    rawUrl = rawUrl.replace(/[,.)]+$/, '');
  }

  let difficulty: TargetDifficulty | undefined;
  let problemNumber: number | string | undefined;
  let estimatedMinutes: number | undefined;
  let title = '';
  let tags: string[] = [];

  // 2. LeetCode / Question pattern detection
  // Case A: Compact LeetCode copy: "7 HARDMedian of Two Sorted Arrays69.40.00...https://... Two Pointers"
  // Case B: "15 MEDIUM Container With Most Water..."
  const leetcodeCompactRegex = /^(\d+)?\s*(HARD|MEDIUM|EASY)\s*(.+)$/i;
  const match = cleanLine.match(leetcodeCompactRegex);

  if (match) {
    problemNumber = match[1] ? match[1] : undefined;
    difficulty = match[2].toUpperCase() as TargetDifficulty;
    let rest = match[3];

    // If there is a URL, split text before URL and after URL
    if (rawUrl) {
      const urlIdx = rest.indexOf(rawUrl);
      const beforeUrl = rest.substring(0, urlIdx).trim();
      const afterUrl = rest.substring(urlIdx + rawUrl.length).trim();

      // Clean LeetCode acceptance rate number glued to title: e.g. "Median of Two Sorted Arrays69.40.004736972853624943"
      const titleCleaned = beforeUrl.replace(/\d{2,}\.?\d*.*$/, '').trim();
      title = titleCleaned || beforeUrl;

      // The part after URL often contains topic tags: "Divide and Conquer", "Array, Two Pointers, Sorting"
      if (afterUrl) {
        tags = afterUrl
          .split(/[,•|]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0 && !t.startsWith('http'));
      }
    } else {
      title = rest.trim();
    }
  } else {
    // Standard / Simple Format detection:
    // e.g. "Two Sum (Easy, 15m)", "1. 3Sum (Medium, 30m)", "Build Quiz Game UI (60m)"
    let workingText = cleanLine;

    // Check for difficulty in parentheses/brackets/words: e.g. (Easy), [Med], (Hard, 15m)
    const diffMatch = workingText.match(/\b(EASY|MEDIUM|MED|HARD)\b/i);
    if (diffMatch) {
      const dUpper = diffMatch[1].toUpperCase();
      difficulty = (dUpper === 'MED' ? 'MEDIUM' : dUpper) as TargetDifficulty;
    }

    // Check for estimated duration: e.g. (15m), (30 mins), 45m, ~20m, 1 hr, 1.5h
    const timeEstMatch = workingText.match(/(?:~|\b)(\d+(?:\.\d+)?)\s*(mins?|minutes|m|hours?|hrs?|h)\b/i);
    if (timeEstMatch) {
      const val = parseFloat(timeEstMatch[1]);
      const unit = timeEstMatch[2].toLowerCase();
      if (unit.startsWith('h')) {
        estimatedMinutes = Math.round(val * 60);
      } else {
        estimatedMinutes = Math.round(val);
      }
    }

    // Check for leading problem number: e.g. "1. Two Sum" or "#42 Trapping Rain Water" or "42 Trapping Rain Water"
    const probNumMatch = workingText.match(/^(?:#\s*(\d+)|\b(\d+)[\.\)]\s*|\b(\d+)\s+)/);
    if (probNumMatch) {
      problemNumber = probNumMatch[1] || probNumMatch[2] || probNumMatch[3];
      workingText = workingText.replace(/^(?:#\s*\d+\s*|\b\d+[\.\)]\s*|\b\d+\s+)/, '');
    }

    // Remove URL from title
    if (rawUrl) {
      const urlIdx = workingText.indexOf(rawUrl);
      const afterUrl = workingText.substring(urlIdx + rawUrl.length).trim();
      workingText = workingText.substring(0, urlIdx).trim();

      if (afterUrl) {
        tags = afterUrl
          .split(/[,•|]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0 && !t.startsWith('http'));
      }
    }

    // Strip out the metadata parenthetical parts: e.g. "(Easy, 15m)", "(Medium)", "(30m)", "[Hard]"
    workingText = workingText
      .replace(/\s*[\(\[]\s*(?:(?:EASY|MEDIUM|MED|HARD)[,\s]*)?(?:~?\s*\d+(?:\.\d+)?\s*(?:mins?|minutes|m|hours?|hrs?|h))?[,\s]*(?:(?:EASY|MEDIUM|MED|HARD))?\s*[\)\]]/gi, '')
      .replace(/\s*-\s*$/, '')
      .trim();

    title = workingText || cleanLine;
  }

  // Fallback title if empty
  if (!title.trim()) {
    title = cleanLine;
  }

  // Format clean problem display if problem number exists
  const finalTitle = problemNumber && !title.startsWith('#')
    ? `#${problemNumber} ${title.trim()}`
    : title.trim();

  return {
    id: `target-${index}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    problemNumber,
    difficulty,
    title: finalTitle,
    url: rawUrl,
    estimatedMinutes,
    tags: tags.length > 0 ? tags : undefined,
  };
}

/**
 * Parses raw text into one or more structured Study/Focus Sessions.
 * Handles both rich session headers and simple bullet-list tasks.
 */
export function parseStudySessions(rawText: string): ParsedSession[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split('\n').map((l) => l.trim());
  const sessions: ParsedSession[] = [];

  let currentSession: Partial<ParsedSession> | null = null;
  let currentSessionRawLines: string[] = [];
  let sessionCounter = 0;

  const flushCurrentSession = () => {
    if (
      currentSession &&
      currentSession.targets &&
      currentSession.targets.length > 0
    ) {
      const targets = currentSession.targets;
      let duration = currentSession.durationMinutes || 0;

      // If duration was not defined via header, compute sum of estimated target minutes
      const sumTargetMins = targets.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
      if (duration === 0 && sumTargetMins > 0) {
        duration = sumTargetMins;
      }

      // Auto-calculate pacing if not explicitly defined
      let pacing = currentSession.targetPacingMinutes;
      if (!pacing && targets.length > 0) {
        if (duration > 0) {
          pacing = Math.round(duration / targets.length);
        } else {
          pacing = 30; // Sensible default pacing
        }
      }

      // Assign estimates to targets if pacing is known and target has none
      if (pacing && pacing > 0) {
        targets.forEach((t) => {
          if (!t.estimatedMinutes) t.estimatedMinutes = pacing;
        });
      }

      // If duration is still 0, default to target count * pacing
      if (duration === 0 && targets.length > 0) {
        duration = targets.length * (pacing || 30);
      }

      sessions.push({
        id: `session-${currentSession.sessionNumber || ++sessionCounter}-${Date.now().toString(36)}`,
        sessionNumber: currentSession.sessionNumber || sessionCounter,
        sessionTopic: currentSession.sessionTopic || 'Focus & Study Session',
        rawHeader: currentSession.rawHeader,
        startTime: currentSession.startTime,
        endTime: currentSession.endTime,
        durationMinutes: duration,
        targets,
        targetPacingMinutes: pacing,
        targetUnit: currentSession.targetUnit || 'Q',
        secondaryMilestone: currentSession.secondaryMilestone,
        contingencyGoal: currentSession.contingencyGoal,
        rawText: currentSessionRawLines.join('\n'),
      });
    }
    currentSession = null;
    currentSessionRawLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Detect Session Header:
    // 1. "Session 1: DSA Practice (8:30am - 11:30am)"
    // 2. "Session 01 - Time => 8:30 am to 11:30 am"
    // 3. "## DSA Practice (8:30am - 11:30am)" or "## Session 2: Web Dev"
    // 4. "Session 1: Web Dev"
    const isMarkdownHeader = /^#{1,3}\s+(.+)$/i.test(line);
    const isSessionKeyword = /^Session\s*(\d+)?\b/i.test(line);
    const isStudyKeyword = /^(?:Study|Focus)\s+Session\s*(\d+)?\b/i.test(line);
    const hasTimeRange = extractTimeRange(line) !== null;
    const isBulletItem = /^[-*•\d+]/.test(line);

    // Header candidate: explicit session keyword, markdown header, or line with time range (not a bullet/list item)
    const isExplicitHeader =
      isSessionKeyword ||
      isStudyKeyword ||
      isMarkdownHeader ||
      (hasTimeRange && !isBulletItem && !line.includes('http'));

    const isDivider = /^[-=_]{3,}$/.test(line);

    if (isExplicitHeader) {
      flushCurrentSession();

      // Extract session number if present
      const numMatch = line.match(/(?:Session|Sprint|#)\s*(\d+)/i);
      const sNum = numMatch ? parseInt(numMatch[1], 10) : ++sessionCounter;
      sessionCounter = sNum;

      // Extract time range
      const timeInfo = extractTimeRange(line);
      let startTime = timeInfo?.start;
      let endTime = timeInfo?.end;
      let duration = timeInfo?.duration;

      // Extract session topic
      let topic = '';
      let cleanHeader = line
        .replace(/^#{1,3}\s*/, '')
        .replace(/^(?:Session|Study\s+Session|Focus\s+Session)\s*(\d+)?[:\s–-]*/i, '')
        .replace(/^Time\s*=>\s*/i, '');

      if (timeInfo) {
        cleanHeader = cleanHeader
          .replace(/\(?\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|–|—|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\)?/i, '')
          .trim();
      }

      cleanHeader = cleanHeader.replace(/^[-–:,\s]+|[-–:,\s]+$/g, '').trim();
      if (cleanHeader && cleanHeader.toLowerCase() !== 'time') {
        topic = cleanHeader;
      }

      currentSession = {
        sessionNumber: sNum,
        sessionTopic: topic || 'Focus & Study Session',
        rawHeader: line,
        startTime,
        endTime,
        durationMinutes: duration,
        targets: [],
      };
      currentSessionRawLines.push(line);
      continue;
    }

    if (isDivider) {
      if (currentSession) currentSessionRawLines.push(line);
      continue;
    }

    // 1. Task/Subject Line: "task -> DSA question practise" or "task: Web development"
    const taskMatch = line.match(/^(?:task|topic|subject)\s*(?:->|:)\s*(.+)$/i);
    if (taskMatch) {
      if (!currentSession) {
        sessionCounter++;
        currentSession = {
          sessionNumber: sessionCounter,
          targets: [],
        };
      }
      currentSession.sessionTopic = taskMatch[1].trim();
      currentSessionRawLines.push(line);
      continue;
    }

    // 2. Pacing calculation line: "180 minutes / 6 questions => 30 mins/Q" or "Pacing: 30 mins/Q"
    const pacingMatch = line.match(
      /(?:(\d+)\s*(?:minutes|mins|m)?\s*\/\s*(\d+)\s*(?:questions|items|tasks|q)?\s*=>\s*|pacing[:\s]+)(\d+(?:\.\d+)?)\s*(?:mins?|m)?(?:\/([a-zA-Z]+))?/i
    );
    if (pacingMatch) {
      const paceVal = pacingMatch[3] ? parseFloat(pacingMatch[3]) : undefined;
      if (paceVal && currentSession) {
        currentSession.targetPacingMinutes = Math.round(paceVal);
        if (pacingMatch[4]) {
          currentSession.targetUnit = pacingMatch[4].trim();
        }
        currentSessionRawLines.push(line);
      }
      continue;
    }

    // 3. Secondary Milestone: "finishing it then move to game activity"
    if (/^(?:finishing\s+it\s+)?(?:then\s+move\s+to|secondary(?:\s*milestone)?[:\s])\s*(.+)$/i.test(line)) {
      if (currentSession) {
        currentSession.secondaryMilestone = line
          .replace(/^(?:finishing\s+it\s+)?(?:then\s+move\s+to|secondary(?:\s*milestone)?[:\s])\s*/i, '')
          .trim();
        currentSessionRawLines.push(line);
      }
      continue;
    }

    // 4. Contingency Goal: "revision if possible starting from js after both done"
    if (/^revision\s+if\s+possible/i.test(line) || /^(?:stretch\s*goal|contingency(?:\s*goal)?)[:\s]/i.test(line)) {
      if (currentSession) {
        currentSession.contingencyGoal = line.trim();
        currentSessionRawLines.push(line);
      }
      continue;
    }

    // 5. Target item or LeetCode question
    const target = parseTargetLine(line, currentSession?.targets?.length || 0);
    if (target) {
      // If no session exists yet, automatically initialize one so plain task lists work out-of-the-box!
      if (!currentSession) {
        sessionCounter++;
        currentSession = {
          sessionNumber: sessionCounter,
          sessionTopic: 'Focus & Study Sprint',
          targets: [],
        };
      }
      currentSession.targets = currentSession.targets || [];
      currentSession.targets.push(target);
      currentSessionRawLines.push(line);
    }
  }

  flushCurrentSession();
  return sessions;
}

/**
 * Converts a ParsedSession into a fully compliant FlowTask Task object ready to be stored in TaskContext.
 */
export function convertSessionToTask(
  session: ParsedSession,
  dueDateStr?: string,
  projectId = 'work'
): Task {
  const subtasks: SubTask[] = session.targets.map((t, idx) => ({
    id: `sub-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: t.title,
    completed: false,
    estimatedMinutes: t.estimatedMinutes || session.targetPacingMinutes || 30,
    url: t.url,
    difficulty: t.difficulty,
    tags: t.tags,
    problemNumber: t.problemNumber,
  }));

  const sessionMetadata: SessionMetadata = {
    isSession: true,
    sessionNumber: session.sessionNumber,
    sessionTopic: session.sessionTopic,
    focusArea: session.sessionTopic,
    targetCount: session.targets.length,
    targetPacingMinutes: session.targetPacingMinutes,
    pacingMinutesPerQuestion: session.targetPacingMinutes,
    targetUnit: session.targetUnit || 'Q',
    secondaryMilestone: session.secondaryMilestone,
    contingencyGoal: session.contingencyGoal,
  };

  const title = `Session ${String(session.sessionNumber || 1).padStart(2, '0')}: ${session.sessionTopic}`;

  let description = '';
  if (session.secondaryMilestone) {
    description += `**Secondary Milestone**: ${session.secondaryMilestone}\n\n`;
  }
  if (session.contingencyGoal) {
    description += `**Contingency Goal**: ${session.contingencyGoal}\n\n`;
  }
  if (session.targetPacingMinutes) {
    description += `**Pacing**: ${session.targetPacingMinutes} mins/${session.targetUnit || 'Q'}\n`;
  }

  return {
    id: `task-session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title,
    description: description.trim() || undefined,
    status: 'todo',
    priority: 'p1', // Study sessions are prime daily focus
    projectId,
    plannedDate: dueDateStr,
    dueDate: dueDateStr,
    dueTime: session.endTime,
    scheduledStart: session.startTime,
    scheduledEnd: session.endTime,
    estimatedMinutes: session.durationMinutes || (subtasks.length * (session.targetPacingMinutes || 30)),
    timeSpentMinutes: 0,
    subtasks,
    isPinnedToday: true,
    sessionMetadata,
    createdAt: Date.now(),
  };
}
