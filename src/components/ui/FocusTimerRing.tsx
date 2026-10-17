import React from 'react';
import { motion } from 'framer-motion';

export interface FocusTimerRingProps {
  progressPercent: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  color?: string;
  trailColor?: string;
  children?: React.ReactNode;
  className?: string;
}

export const FocusTimerRing: React.FC<FocusTimerRingProps> = ({
  progressPercent,
  size = 120,
  strokeWidth = 6,
  color = '#F59E0B',
  trailColor,
  children,
  className = '',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.max(0, Math.min(100, progressPercent));
  const strokeDashoffset = circumference - (clampedPercent / 100) * circumference;

  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`relative inline-flex items-center justify-center ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 overflow-visible"
      >
        {/* Background Trail Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={trailColor ? '' : 'stroke-stone-200/80 dark:stroke-white/10'}
          style={trailColor ? { stroke: trailColor } : undefined}
          fill="none"
        />

        {/* Animated Progress Circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset }}
          transition={{
            type: 'spring',
            stiffness: 120,
            damping: 20,
          }}
        />
      </svg>

      {/* Centered Children (Clock, labels, icons) */}
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
          {children}
        </div>
      )}
    </div>
  );
};
