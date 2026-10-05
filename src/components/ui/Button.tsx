import React from 'react';
import { Loader2 } from 'lucide-react';
import { audioEngine } from '../../utils/audioEngine';
import { Kbd } from './Kbd';

export type ButtonVariant = 'primary' | 'brand' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'destructive-subtle';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon-xs' | 'icon-sm' | 'icon-md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  kbd?: string;
  enableSound?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--text-primary)] text-[var(--bg-main)] hover:opacity-90 shadow-xs active:scale-[0.98]',
  brand:
    'bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white shadow-xs active:scale-[0.98]',
  secondary:
    'bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] hover:bg-[var(--bg-surface-hover)] shadow-xs active:scale-[0.98]',
  outline:
    'border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] active:scale-[0.98]',
  ghost:
    'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] active:scale-[0.98]',
  destructive:
    'bg-rose-600 hover:bg-rose-700 text-white shadow-xs active:scale-[0.98]',
  'destructive-subtle':
    'text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 active:scale-[0.98]',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-[11px] rounded-md gap-1',
  sm: 'h-8 px-2.5 text-xs rounded-lg gap-1.5',
  md: 'h-9 px-3.5 text-xs font-semibold rounded-lg gap-2',
  lg: 'h-10 px-4 text-sm font-semibold rounded-lg gap-2',
  'icon-xs': 'w-6 h-6 p-0 rounded-md justify-center',
  'icon-sm': 'w-8 h-8 p-0 rounded-lg justify-center',
  'icon-md': 'w-9 h-9 p-0 rounded-lg justify-center',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'sm',
      isLoading = false,
      leftIcon,
      rightIcon,
      kbd,
      enableSound = true,
      children,
      className = '',
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || isLoading) return;
      if (enableSound) {
        audioEngine.playClickSound();
      }
      onClick?.(e);
    };

    const isIconOnly = size.startsWith('icon-');

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || isLoading}
        onClick={handleClick}
        className={`inline-flex items-center select-none font-medium transition-all focus-ring disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 ${
          variantStyles[variant]
        } ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 size={13} className="animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {!isIconOnly && children}
        {!isIconOnly && rightIcon && <span className="shrink-0">{rightIcon}</span>}
        {!isIconOnly && kbd && (
          <Kbd size="xs" className="ml-1 opacity-80">
            {kbd}
          </Kbd>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
