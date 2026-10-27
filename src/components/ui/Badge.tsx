import React from 'react';
import { X } from 'lucide-react';

export type BadgeVariant =
  | 'neutral'
  | 'brand'
  | 'focus'
  | 'success'
  | 'danger'
  | 'blue'
  | 'teal'
  | 'purple'
  | 'p1'
  | 'p2'
  | 'p3'
  | 'p4'
  | 'todo'
  | 'in_progress'
  | 'done';

export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  count?: number | string;
  icon?: React.ReactNode;
  onDismiss?: (e: React.MouseEvent) => void;
  dismissAriaLabel?: string;
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  neutral: {
    container: 'bg-[var(--bg-surface-l3)] text-[var(--text-secondary)] border-[var(--border-color)]',
    dot: 'bg-[var(--text-muted)]',
  },
  brand: {
    container: 'bg-[var(--color-brand-subtle)] text-[var(--color-brand)] border-[var(--color-brand-border)]',
    dot: 'bg-[var(--color-brand)]',
  },
  focus: {
    container: 'bg-[var(--color-brand-subtle)] text-[var(--color-brand)] border-[var(--color-brand-border)] shadow-xs',
    dot: 'bg-[var(--color-brand)]',
  },
  success: {
    container: 'bg-[var(--pastel-sage-subtle)] text-[var(--pastel-sage)] border-[var(--border-color)]',
    dot: 'bg-[var(--pastel-sage)]',
  },
  danger: {
    container: 'bg-[var(--pastel-coral-subtle)] text-[var(--pastel-coral)] border-[var(--border-color)]',
    dot: 'bg-[var(--pastel-coral)]',
  },
  blue: {
    container: 'bg-[var(--pastel-sky-subtle)] text-[var(--pastel-sky)] border-[var(--border-color)]',
    dot: 'bg-[var(--pastel-sky)]',
  },
  teal: {
    container: 'bg-[var(--pastel-sage-subtle)] text-[var(--pastel-sage)] border-[var(--border-color)]',
    dot: 'bg-[var(--pastel-sage)]',
  },
  purple: {
    container: 'bg-[var(--pastel-lavender-subtle)] text-[var(--pastel-lavender)] border-[var(--border-color)]',
    dot: 'bg-[var(--pastel-lavender)]',
  },
  p1: {
    container: 'bg-[var(--pastel-coral-subtle)] text-[var(--pastel-coral)] border-[var(--border-color)]',
    dot: 'bg-[var(--pastel-coral)]',
  },
  p2: {
    container: 'bg-[var(--pastel-amber-subtle)] text-[var(--pastel-amber)] border-[var(--border-color)]',
    dot: 'bg-[var(--pastel-amber)]',
  },
  p3: {
    container: 'bg-[var(--pastel-sky-subtle)] text-[var(--pastel-sky)] border-[var(--border-color)]',
    dot: 'bg-[var(--pastel-sky)]',
  },
  p4: {
    container: 'bg-[var(--bg-surface-l3)] text-[var(--text-secondary)] border-[var(--border-color)]',
    dot: 'bg-[var(--text-muted)]',
  },
  todo: {
    container: 'bg-[var(--bg-surface-l3)] text-[var(--text-secondary)] border-[var(--border-color)]',
    dot: 'bg-[var(--text-muted)]',
  },
  in_progress: {
    container: 'bg-[var(--pastel-sky-subtle)] text-[var(--pastel-sky)] border-[var(--border-color)]',
    dot: 'bg-[var(--pastel-sky)]',
  },
  done: {
    container: 'bg-[var(--pastel-sage-subtle)] text-[var(--pastel-sage)] border-[var(--border-color)]',
    dot: 'bg-[var(--pastel-sage)]',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  xs: 'text-[10px] px-1.5 py-0.5 rounded-sm gap-1 font-mono',
  sm: 'text-[11px] px-2 py-0.5 rounded-sm gap-1 font-medium',
  md: 'text-xs px-2.5 py-1 rounded-sm gap-1.5 font-medium',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'sm',
  dot = false,
  count,
  icon,
  onDismiss,
  dismissAriaLabel = 'Dismiss badge',
  children,
  className = '',
  ...props
}) => {
  const { container, dot: dotColor } = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center border select-none transition-colors ${container} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />}
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
      {count !== undefined && (
        <span className="font-mono text-[10px] opacity-75 font-semibold">
          ({count})
        </span>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissAriaLabel}
          className="ml-0.5 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-current transition-colors"
        >
          <X size={10} className="stroke-[2.5]" />
        </button>
      )}
    </span>
  );
};
