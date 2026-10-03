import type { Task } from '../types/task';
import { classifyTaskCognitiveIntensity } from './timelineUtils';

export interface VelocityMetric {
  ratio: number; // e.g. 1.35 means tasks take 35% longer than estimated
  sampleCount: number;
  recommendedEstimate?: number;
  direction: 'underestimated' | 'overestimated' | 'accurate';
  scope?: 'tag' | 'project' | 'global';
}

export interface EstimationAccuracyMetrics {
  accuracyPercent: number; // 0 - 100
  avgRatio: number;
  completedSampleCount: number;
  deepWorkPercent: number;
  adminPercent: number;
}

/**
 * Computes historical estimation velocity comparing actual time spent to estimated duration
 */
export function computeHistoricalVelocity(
  tasks: Task[],
  projectId?: string,
  tag?: string
): VelocityMetric | null {
  // 1. If tag provided, attempt tag-specific calibration first
  if (tag) {
    const cleanTag = tag.replace(/^#/, '').toLowerCase();
    const tagSample = tasks.filter((t) => {
      if (t.status !== 'done') return false;
      if (!t.estimatedMinutes || t.estimatedMinutes <= 0) return false;
      if (!t.timeSpentMinutes || t.timeSpentMinutes <= 0) return false;
      return t.contextTags?.some((ct) => ct.replace(/^#/, '').toLowerCase() === cleanTag);
    });

    if (tagSample.length >= 2) {
      const totalEstimated = tagSample.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);
      const totalActual = tagSample.reduce((acc, t) => acc + (t.timeSpentMinutes || 0), 0);
      if (totalEstimated > 0) {
        const ratio = Math.round((totalActual / totalEstimated) * 100) / 100;
        let direction: VelocityMetric['direction'] = 'accurate';
        if (ratio >= 1.15) direction = 'underestimated';
        else if (ratio <= 0.85) direction = 'overestimated';

        return {
          ratio,
          sampleCount: tagSample.length,
          direction,
          scope: 'tag',
        };
      }
    }
  }

  // 2. Filter completed tasks by project
  const sample = tasks.filter((t) => {
    if (t.status !== 'done') return false;
    if (!t.estimatedMinutes || t.estimatedMinutes <= 0) return false;
    if (!t.timeSpentMinutes || t.timeSpentMinutes <= 0) return false;
    if (projectId && projectId !== 'inbox' && t.projectId !== projectId) return false;
    return true;
  });

  if (sample.length < 2) {
    // If not enough project-specific samples, fallback to global completed tasks
    if (projectId) {
      return computeHistoricalVelocity(tasks, undefined, undefined);
    }
    return null;
  }

  const totalEstimated = sample.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);
  const totalActual = sample.reduce((acc, t) => acc + (t.timeSpentMinutes || 0), 0);

  if (totalEstimated === 0) return null;

  const ratio = Math.round((totalActual / totalEstimated) * 100) / 100;
  let direction: VelocityMetric['direction'] = 'accurate';
  if (ratio >= 1.15) direction = 'underestimated';
  else if (ratio <= 0.85) direction = 'overestimated';

  return {
    ratio,
    sampleCount: sample.length,
    direction,
    scope: projectId && projectId !== 'inbox' ? 'project' : 'global',
  };
}

/**
 * Recommends an anti-planning-fallacy calibrated duration for a proposed estimate
 */
export function getVelocityCalibration(
  tasks: Task[],
  proposedMinutes?: number,
  projectId?: string,
  tag?: string
): { recommendedMinutes: number; ratio: number; sampleCount: number; scope: 'tag' | 'project' | 'global' } | null {
  if (!proposedMinutes || proposedMinutes <= 0) return null;

  const velocity = computeHistoricalVelocity(tasks, projectId, tag);
  if (!velocity || velocity.direction === 'accurate') return null;

  const rawRecommended = proposedMinutes * velocity.ratio;
  // Round to nearest 5 minutes
  const rounded = Math.max(5, Math.round(rawRecommended / 5) * 5);

  if (rounded === proposedMinutes) return null;

  return {
    recommendedMinutes: rounded,
    ratio: velocity.ratio,
    sampleCount: velocity.sampleCount,
    scope: velocity.scope || 'global',
  };
}

/**
 * Calculates aggregate estimation accuracy and cognitive intensity distribution
 */
export function calculateEstimationAccuracy(tasks: Task[]): EstimationAccuracyMetrics {
  const completedTasks = tasks.filter((t) => !t.deletedAt && !t.archivedAt && t.status === 'done');

  // Velocity accuracy sample
  const sample = completedTasks.filter(
    (t) => (t.estimatedMinutes || 0) > 0 && (t.timeSpentMinutes || 0) > 0
  );

  let avgRatio = 1.0;
  let accuracyPercent = 0;

  if (sample.length > 0) {
    const totalEst = sample.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);
    const totalAct = sample.reduce((acc, t) => acc + (t.timeSpentMinutes || 0), 0);
    avgRatio = Math.round((totalAct / totalEst) * 100) / 100;

    // Accuracy formula: 100 - |1 - ratio| * 50 bounded between 20 and 100
    const variance = Math.abs(1 - avgRatio);
    accuracyPercent = Math.max(20, Math.min(100, Math.round((1 - Math.min(1, variance)) * 100)));
  }

  // Cognitive distribution across completed tasks
  let deepMinutes = 0;
  let adminMinutes = 0;
  let mediumMinutes = 0;

  completedTasks.forEach((t) => {
    const mins = t.timeSpentMinutes || 0;
    const intensity = classifyTaskCognitiveIntensity(t);
    if (intensity === 'deep') deepMinutes += mins;
    else if (intensity === 'admin') adminMinutes += mins;
    else mediumMinutes += mins;
  });

  const totalCognitive = deepMinutes + adminMinutes + mediumMinutes;
  const deepWorkPercent = totalCognitive > 0 ? Math.round((deepMinutes / totalCognitive) * 100) : 0;
  const adminPercent = totalCognitive > 0 ? Math.round((adminMinutes / totalCognitive) * 100) : 0;

  return {
    accuracyPercent,
    avgRatio,
    completedSampleCount: sample.length,
    deepWorkPercent,
    adminPercent,
  };
}
