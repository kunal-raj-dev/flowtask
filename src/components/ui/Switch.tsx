import React, { useId } from 'react';
import { audioEngine } from '../../utils/audioEngine';

export type SwitchSize = 'sm' | 'md' | 'lg';

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  size?: SwitchSize;
  enableSound?: boolean;
}

const trackSizeStyles: Record<SwitchSize, string> = {
  sm: 'w-7 h-4 p-0.5',
  md: 'w-9 h-5 p-0.5',
  lg: 'w-11 h-6 p-0.5',
};

const thumbSizeStyles: Record<SwitchSize, { size: string; translate: string }> = {
  sm: { size: 'w-3 h-3', translate: 'translate-x-3' },
  md: { size: 'w-4 h-4', translate: 'translate-x-4' },
  lg: { size: 'w-5 h-5', translate: 'translate-x-5' },
};

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked,
      onChange,
      disabled = false,
      label,
      description,
      size = 'md',
      enableSound = true,
      className = '',
      id: customId,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const switchId = customId || generatedId;
    const labelId = label ? `${switchId}-label` : undefined;
    const descId = description ? `${switchId}-desc` : undefined;

    const handleToggle = () => {
      if (disabled) return;
      const next = !checked;
      if (enableSound) {
        audioEngine.playToggleSound(next);
      }
      onChange(next);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleToggle();
      }
    };

    const thumb = thumbSizeStyles[size];

    const switchElement = (
      <button
        ref={ref}
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descId}
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-200 ease-in-out cursor-pointer focus-ring select-none disabled:opacity-40 disabled:cursor-not-allowed ${
          checked
            ? 'bg-[var(--color-brand)] border-[var(--color-brand)]'
            : 'bg-[var(--bg-surface-l3)] border-[var(--border-subtle)]'
        } ${trackSizeStyles[size]} ${className}`}
        {...props}
      >
        <span
          className={`pointer-events-none inline-block rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${
            thumb.size
          } ${checked ? thumb.translate : 'translate-x-0'}`}
        />
      </button>
    );

    if (!label && !description) {
      return switchElement;
    }

    return (
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 select-none" onClick={handleToggle}>
          {label && (
            <label
              id={labelId}
              htmlFor={switchId}
              className={`text-xs font-semibold text-[var(--text-primary)] cursor-pointer ${
                disabled ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              {label}
            </label>
          )}
          {description && (
            <p
              id={descId}
              className={`text-[11px] text-[var(--text-secondary)] leading-relaxed ${
                disabled ? 'opacity-40' : ''
              }`}
            >
              {description}
            </p>
          )}
        </div>
        {switchElement}
      </div>
    );
  }
);

Switch.displayName = 'Switch';
