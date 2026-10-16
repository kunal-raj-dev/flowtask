import { describe, it, expect } from 'vitest';
import {
  SPRING_TACTILE,
  SPRING_SNAPPY,
  SPRING_GENTLE,
  SPRING_BOUNCE,
  TRANSITION_SMOOTH,
} from './springPhysics';

describe('Spring Physics & Animation Constants', () => {
  it('defines SPRING_TACTILE matching Masterplan spec', () => {
    expect(SPRING_TACTILE.type).toBe('spring');
    expect(SPRING_TACTILE.stiffness).toBe(450);
    expect(SPRING_TACTILE.damping).toBe(32);
  });

  it('defines SPRING_SNAPPY matching Masterplan spec', () => {
    expect(SPRING_SNAPPY.type).toBe('spring');
    expect(SPRING_SNAPPY.stiffness).toBe(550);
    expect(SPRING_SNAPPY.damping).toBe(28);
  });

  it('defines SPRING_GENTLE matching Masterplan spec', () => {
    expect(SPRING_GENTLE.type).toBe('spring');
    expect(SPRING_GENTLE.stiffness).toBe(320);
    expect(SPRING_GENTLE.damping).toBe(30);
  });

  it('defines SPRING_BOUNCE and TRANSITION_SMOOTH', () => {
    expect(SPRING_BOUNCE.stiffness).toBe(500);
    expect(SPRING_BOUNCE.damping).toBe(22);
    expect(TRANSITION_SMOOTH.duration).toBe(0.22);
    expect(TRANSITION_SMOOTH.ease).toEqual([0.16, 1, 0.3, 1]);
  });
});
