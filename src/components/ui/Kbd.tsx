import React from 'react';

export type KbdSize = 'xs' | 'sm' | 'md';

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  size?: KbdSize;
  children?: React.ReactNode;
}

const sizeStyles: Record<KbdSize, string> = {
  xs: 'text-[9px] px-1 py-0.5 min-w-[16px] h-4 rounded leading-none',
  sm: 'text-[10px] px-1.5 py-0.5 min-w-[20px] h-5 rounded-md leading-none',
  md: 'text-xs px-2 py-1 min-w-[24px] h-6 rounded-md leading-none',
};

export const Kbd = React.forwardRef<HTMLElement, KbdProps>(
  ({ size = 'sm', children, className = '', ...props }, ref) => {
    return (
      <kbd
        ref={ref}
        className={`inline-flex items-center justify-center font-mono font-semibold uppercase tracking-wider select-none bg-[var(--bg-surface-l2)] text-[var(--text-secondary)] border border-[var(--border-subtle)] shadow-xs transition-colors ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {children}
      </kbd>
    );
  }
);

Kbd.displayName = 'Kbd';
