import React from 'react';
import { X } from 'lucide-react';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  inputSize?: InputSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  kbd?: string;
  error?: string;
  onClear?: () => void;
}

const sizeStyles: Record<InputSize, { container: string; input: string }> = {
  sm: { container: 'h-8 text-xs rounded-lg px-2.5', input: 'text-xs' },
  md: { container: 'h-9 text-xs rounded-lg px-3', input: 'text-xs' },
  lg: { container: 'h-10 text-sm rounded-xl px-3.5', input: 'text-sm' },
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      inputSize = 'md',
      leftIcon,
      rightIcon,
      kbd,
      error,
      onClear,
      className = '',
      disabled,
      value,
      ...props
    },
    ref
  ) => {
    const { container, input } = sizeStyles[inputSize];
    const hasValue = value !== undefined && value !== null && String(value).length > 0;

    return (
      <div className="w-full flex flex-col gap-1">
        <div
          className={`relative flex items-center bg-[var(--bg-surface-l2)] border transition-all card-surface ${
            error
              ? 'border-rose-500/80 focus-within:ring-2 focus-within:ring-rose-500/30'
              : 'border-[var(--border-hairline)] hover:border-stone-300 dark:hover:border-stone-600 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/25'
          } ${disabled ? 'opacity-50 pointer-events-none' : ''} ${container} ${className}`}
        >
          {leftIcon && (
            <span className="mr-2 text-[var(--text-muted)] shrink-0 flex items-center">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            disabled={disabled}
            value={value}
            className={`w-full bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none border-none p-0 ${input}`}
            {...props}
          />

          {onClear && hasValue && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear input"
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/10 ml-1 transition-colors"
            >
              <X size={12} />
            </button>
          )}

          {kbd && (
            <kbd className="ml-1.5 hidden sm:inline-flex text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-stone-800/80 text-[var(--text-muted)] uppercase border border-[var(--border-subtle)] shrink-0">
              {kbd}
            </kbd>
          )}

          {rightIcon && (
            <span className="ml-2 text-[var(--text-muted)] shrink-0 flex items-center">
              {rightIcon}
            </span>
          )}
        </div>

        {error && (
          <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium pl-0.5">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
