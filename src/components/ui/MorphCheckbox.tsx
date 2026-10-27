import { useMotionPreference } from '../../hooks/useMotionPreference';
import React from 'react';
import { motion } from 'framer-motion';
import { audioEngine } from '../../utils/audioEngine';
import { SPRING_TACTILE } from '../../utils/springPhysics';
import type { Priority } from '../../types/task';
import { onAccent } from '../../utils/themeRegistry';

export interface MorphCheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  size?: number;
  priority?: Priority;
  color?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  soundEnabled?: boolean;
}

export const MorphCheckbox: React.FC<MorphCheckboxProps> = ({
  checked,
  onChange,
  size = 18,
  priority,
  color,
  disabled = false,
  ariaLabel = 'Mark task status',
  className = '',
  soundEnabled = true,
}) => {
  const reduced = useMotionPreference();
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !onChange) return;
    if (soundEnabled && !checked) {
      if (typeof audioEngine.playPopSound === 'function') audioEngine.playPopSound();
      audioEngine.playCompletionChime();
    } else if (soundEnabled) {
      audioEngine.playClickSound();
    }
    onChange(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || !onChange) return;
      if (soundEnabled && !checked) {
        if (typeof audioEngine.playPopSound === 'function') audioEngine.playPopSound();
        audioEngine.playCompletionChime();
      } else if (soundEnabled) {
        audioEngine.playClickSound();
      }
      onChange(!checked);
    }
  };

  const priorityColor = priority === 'p1' ? 'var(--pastel-coral)'
    : priority === 'p2' ? 'var(--pastel-amber)'
    : priority === 'p3' ? 'var(--pastel-sky)'
    : priority === 'p4' ? 'var(--text-muted)' : 'var(--pastel-sage)';
  const fill = color || priorityColor;
  const checkColor = color && /^#[0-9a-f]{6}$/i.test(color) ? onAccent(color) : 'var(--bg-main)';

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-priority={priority}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderColor: color || (priority ? priorityColor : 'var(--border-strong)'),
        ...(checked ? { backgroundColor: fill, color: checkColor } : {}),
      }}
      className={`rounded-[6px] shrink-0 flex items-center justify-center border transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${reduced ? '' : 'active:scale-90'} ${
        reduced ? 'transition-none' : ''
      } ${className}`}
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        className="w-[70%] h-[70%]"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.path
          d="M3 8.5L6.5 12L13 4"
          initial={false}
          animate={{
            pathLength: checked ? 1 : 0,
            opacity: checked ? 1 : 0,
          }}
          transition={reduced ? { duration: 0 } : SPRING_TACTILE}
        />
      </svg>
    </button>
  );
};
