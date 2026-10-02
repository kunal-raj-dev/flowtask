import type { Task } from '../types/task';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after'
]);

/**
 * Tokenize and normalize a string, stripping punctuation and stop words.
 */
export function tokenizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * Calculate Jaccard similarity between two token sets (0 to 1).
 */
export function calculateJaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersectionSize = 0;
  setA.forEach((token) => {
    if (setB.has(token)) {
      intersectionSize++;
    }
  });

  const unionSize = new Set([...tokensA, ...tokensB]).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Calculate character bigram Dice coefficient for typo tolerance (0 to 1).
 */
export function calculateBigramDice(strA: string, strB: string): number {
  const cleanA = strA.toLowerCase().replace(/\s+/g, '');
  const cleanB = strB.toLowerCase().replace(/\s+/g, '');

  if (cleanA === cleanB) return 1;
  if (cleanA.length < 2 || cleanB.length < 2) return 0;

  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bg = str.substring(i, i + 2);
      bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
    }
    return bigrams;
  };

  const bigramsA = getBigrams(cleanA);
  const bigramsB = getBigrams(cleanB);

  let intersection = 0;
  bigramsA.forEach((countA, bg) => {
    const countB = bigramsB.get(bg) || 0;
    intersection += Math.min(countA, countB);
  });

  const total = cleanA.length - 1 + (cleanB.length - 1);
  return (2 * intersection) / total;
}

/**
 * Composite similarity between two titles combining token overlap and character dice.
 */
export function calculateTitleSimilarity(titleA: string, titleB: string): number {
  if (titleA.trim().toLowerCase() === titleB.trim().toLowerCase()) return 1;

  const tokensA = tokenizeTitle(titleA);
  const tokensB = tokenizeTitle(titleB);

  const jaccard = calculateJaccardSimilarity(tokensA, tokensB);
  const dice = calculateBigramDice(titleA, titleB);

  // Weighted composite: tokens carry 65% weight, bigrams carry 35% weight
  return jaccard * 0.65 + dice * 0.35;
}

export interface DuplicateCandidate {
  task: Task;
  similarityScore: number;
}

/**
 * Scan all tasks to find near-duplicates of a target task.
 */
export function findPotentialDuplicates(
  targetTask: Task,
  allTasks: Task[],
  threshold = 0.6
): DuplicateCandidate[] {
  if (!targetTask.title.trim()) return [];

  const candidates: DuplicateCandidate[] = [];

  for (const task of allTasks) {
    if (task.id === targetTask.id) continue;
    // Don't compare active task against archived/completed tasks
    if (targetTask.status !== 'done' && task.status === 'done') continue;

    const score = calculateTitleSimilarity(targetTask.title, task.title);
    if (score >= threshold) {
      candidates.push({ task, similarityScore: Math.round(score * 100) / 100 });
    }
  }

  return candidates.sort((a, b) => b.similarityScore - a.similarityScore);
}
