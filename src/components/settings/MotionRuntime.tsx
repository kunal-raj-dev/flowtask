import type { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { useMotionPreference } from '../../hooks/useMotionPreference';

export function MotionRuntime({ children }: { children: ReactNode }) {
  const reduced = useMotionPreference();
  return <MotionConfig reducedMotion={reduced ? 'always' : 'never'} transition={{ type: 'spring', duration: 0.28, bounce: 0.08 }}>{children}</MotionConfig>;
}
