/**
 * Tactile Spring Physics and Animation Curves
 * Matching FlowTask Masterplan Section 5
 */

export const SPRING_TACTILE = {
  type: 'spring',
  stiffness: 450,
  damping: 32,
} as const;

export const SPRING_SNAPPY = {
  type: 'spring',
  stiffness: 550,
  damping: 28,
} as const;

export const SPRING_GENTLE = {
  type: 'spring',
  stiffness: 320,
  damping: 30,
} as const;

export const SPRING_BOUNCE = {
  type: 'spring',
  stiffness: 500,
  damping: 22,
} as const;

export const TRANSITION_SMOOTH = {
  duration: 0.22,
  ease: [0.16, 1, 0.3, 1],
} as const;
