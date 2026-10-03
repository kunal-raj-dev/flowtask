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
  | 'purple';

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
    container: 'bg-stone-500/10 text-stone-700 dark:text-stone-300 border-stone-500/20',
    dot: 'bg-stone-400 dark:bg-stone-500',
  },
  brand: {
    container: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25',
    dot: 'bg-amber-500',
  },
  focus: {
    container: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 shadow-xs',
    dot: 'bg-amber-500',
  },
  success: {
    container: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  danger: {
    container: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
    dot: 'bg-rose-500',
  },
  blue: {
    container: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25',
    dot: 'bg-sky-500',
  },
  teal: {
    container: 'bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/25',
    dot: 'bg-teal-500',
  },
  purple: {
    container: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25',
    dot: 'bg-purple-500',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  xs: 'text-[10px] px-1.5 py-0.5 rounded-[4px] gap-1 font-mono',
  sm: 'text-[11px] px-2 py-0.5 rounded-md gap-1 font-medium',
  md: 'text-xs px-2.5 py-1 rounded-lg gap-1.5 font-medium',
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
