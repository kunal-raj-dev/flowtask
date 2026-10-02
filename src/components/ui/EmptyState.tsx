import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  compact = false,
  className = '',
}) => {
  return (
    <div
      className={`w-full flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 bg-[var(--bg-surface-l1)]/30 ${
        compact ? 'py-8 px-4' : 'py-14 px-6'
      } ${className}`}
    >
      {icon && (
        <div className="w-11 h-11 mb-3 rounded-2xl bg-stone-200/50 dark:bg-white/[0.05] border border-[var(--border-hairline)] text-[var(--text-secondary)] flex items-center justify-center shadow-xs">
          {icon}
        </div>
      )}

      <h3 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
        {title}
      </h3>

      {description && (
        <p className="text-xs text-[var(--text-muted)] max-w-sm mt-1 leading-relaxed">
          {description}
        </p>
      )}

      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
