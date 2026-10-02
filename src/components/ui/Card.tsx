import React from 'react';

export type CardVariant = 'default' | 'subtle' | 'focus' | 'ghost';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  as?: 'div' | 'article' | 'section';
}

const variantStyles: Record<CardVariant, string> = {
  default:
    'bg-white dark:bg-[var(--bg-surface-l2)] border border-stone-200/80 dark:border-[var(--border-hairline)] shadow-card card-surface',
  subtle:
    'bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)]',
  focus:
    'bg-white dark:bg-[var(--bg-surface-l2)] border border-amber-500/40 dark:border-amber-500/45 shadow-[0_4px_20px_-2px_rgba(245,158,11,0.15)] dark:shadow-glow-amber card-surface',
  ghost:
    'bg-transparent border border-[var(--border-hairline)]',
};

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-6 sm:p-7',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      interactive = false,
      as: Component = 'div',
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const interactiveClasses = interactive
      ? 'cursor-pointer hover:border-stone-300 dark:hover:border-stone-600 hover:shadow-elevated hover:-translate-y-[1px] active:scale-[0.99] transition-all duration-150'
      : '';

    return (
      <Component
        ref={ref}
        className={`rounded-2xl transition-colors ${variantStyles[variant]} ${paddingStyles[padding]} ${interactiveClasses} ${className}`}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Card.displayName = 'Card';
