import { useMotionPreference } from '../../hooks/useMotionPreference';
import React from 'react';
import { audioEngine } from '../../utils/audioEngine';
import type { Priority } from '../../types/task';

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

  const getBorderColor = () => {
    if (checked) {
      if (color) return color;
      if (priority === 'p1') return '#F43F5E';
      if (priority === 'p2') return '#0EA5E9';
      if (priority === 'p3') return '#8B5CF6';
      return '#10B981';
    }
    if (priority === 'p1') return 'border-rose-400 dark:border-rose-500';
    if (priority === 'p2') return 'border-sky-400 dark:border-sky-500';
    if (priority === 'p3') return 'border-violet-400 dark:border-violet-500';
    return 'border-stone-300 dark:border-stone-600 hover:border-amber-500';
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        ...(checked ? { backgroundColor: color || (priority === 'p1' ? '#F43F5E' : priority === 'p2' ? '#0EA5E9' : priority === 'p3' ? '#8B5CF6' : '#10B981'), borderColor: color || 'transparent' } : {}),
      }}
      className={`rounded-[6px] shrink-0 flex items-center justify-center border transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
        !checked ? getBorderColor() : ''
      } ${reduced ? '' : 'active:scale-90'} ${
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
        <path
          d="M3 8.5L6.5 12L13 4"
          pathLength={1}
          style={{ strokeDasharray: 1, strokeDashoffset: checked ? 0 : 1, opacity: checked ? 1 : 0,
            transition: reduced ? 'none' : 'stroke-dashoffset 140ms ease-out, opacity 140ms ease-out' }}
          className="text-white"
        />
      </svg>
    </button>
  );
};
