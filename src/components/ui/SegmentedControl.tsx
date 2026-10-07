import React, { useRef } from 'react';
import { audioEngine } from '../../utils/audioEngine';

export interface SegmentedControlItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number | string;
  badge?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  items: SegmentedControlItem<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'xs' | 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function SegmentedControl<T extends string = string>({
  items,
  value,
  onChange,
  size = 'sm',
  fullWidth = false,
  className = '',
  ariaLabel = 'Segmented options',
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = (id: T, disabled?: boolean) => {
    if (disabled || id === value) return;
    audioEngine.playToggleSound(true);
    onChange(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let targetIndex = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      targetIndex = (index + 1) % items.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      targetIndex = (index - 1 + items.length) % items.length;
    } else if (e.key === 'Home') {
      targetIndex = 0;
    } else if (e.key === 'End') {
      targetIndex = items.length - 1;
    }

    if (targetIndex >= 0) {
      e.preventDefault();
      const targetItem = items[targetIndex];
      if (!targetItem.disabled) {
        handleSelect(targetItem.id);
        const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        buttons?.[targetIndex]?.focus();
      }
    }
  };

  const sizeStyles = {
    xs: 'p-0.5 text-[11px]',
    sm: 'p-1 text-xs',
    md: 'p-1.5 text-xs font-semibold',
  };

  const buttonSizeStyles = {
    xs: 'px-2 py-0.5 rounded-[5px] gap-1',
    sm: 'px-2.5 py-1 rounded-lg gap-1.5',
    md: 'px-3.5 py-1.5 rounded-lg gap-2',
  };

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center max-w-full overflow-x-auto no-scrollbar scroll-smooth bg-stone-200/70 dark:bg-white/[0.06] rounded-xl border border-[var(--border-hairline)] shadow-inner select-none ${
        sizeStyles[size]
      } ${fullWidth ? 'w-full flex' : ''} ${className}`}
    >
      {items.map((item, idx) => {
        const isSelected = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={isSelected}
            disabled={item.disabled}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => handleSelect(item.id, item.disabled)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`flex items-center justify-center font-medium transition-all focus-ring disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0 ${
              buttonSizeStyles[size]
            } ${fullWidth ? 'flex-1' : ''} ${
              isSelected
                ? 'bg-white dark:bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-sm card-surface font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
            }`}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  isSelected
                    ? 'bg-stone-100 dark:bg-white/10 text-[var(--text-primary)]'
                    : 'bg-stone-200/60 dark:bg-white/5 text-[var(--text-muted)]'
                }`}
              >
                {item.count}
              </span>
            )}
            {item.badge && (
              <span className="text-[9px] px-1 py-0.2 rounded font-semibold uppercase bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
