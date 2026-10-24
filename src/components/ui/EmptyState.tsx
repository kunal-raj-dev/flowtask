import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
  variant?: 'default' | 'zero-inbox' | 'day-complete' | 'no-analytics';
}

export const ZeroInboxIllustration: React.FC<{ size?: number; className?: string }> = ({
  size = 72,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`select-none ${className}`}
    aria-hidden="true"
  >
    <circle cx="40" cy="40" r="36" fill="rgba(245, 158, 11, 0.08)" />
    <path
      d="M20 48L28 32H52L60 48"
      stroke="currentColor"
      strokeOpacity="0.4"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M20 48H32L35 54H45L48 48H60V60C60 62.2091 58.2091 64 56 64H24C21.7909 64 20 62.2091 20 60V48Z"
      fill="rgba(245, 158, 11, 0.15)"
      stroke="currentColor"
      strokeOpacity="0.7"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path
      d="M34 26L39 31L48 20"
      stroke="#10B981"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="56" cy="22" r="2" fill="#F59E0B" />
    <circle cx="24" cy="24" r="1.5" fill="#8B5CF6" />
  </svg>
);

export const DayCompleteIllustration: React.FC<{ size?: number; className?: string }> = ({
  size = 72,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`select-none ${className}`}
    aria-hidden="true"
  >
    <circle cx="40" cy="40" r="36" fill="rgba(16, 185, 129, 0.08)" />
    {/* Horizon line */}
    <path d="M16 54H64" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
    {/* Setting sun / serene crescent */}
    <path
      d="M28 54C28 47.3726 33.3726 42 40 42C46.6274 42 52 47.3726 52 54"
      fill="rgba(245, 158, 11, 0.25)"
      stroke="#F59E0B"
      strokeWidth="2.5"
    />
    {/* Stars in dusk */}
    <circle cx="30" cy="28" r="2.5" fill="#10B981" />
    <circle cx="52" cy="26" r="2" fill="#8B5CF6" />
    <circle cx="40" cy="20" r="1.5" fill="#F59E0B" />
    {/* Celebration checkmark */}
    <path
      d="M36 34L39 37L46 30"
      stroke="#10B981"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const NoAnalyticsIllustration: React.FC<{ size?: number; className?: string }> = ({
  size = 72,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`select-none ${className}`}
    aria-hidden="true"
  >
    <circle cx="40" cy="40" r="36" fill="rgba(99, 102, 241, 0.08)" />
    {/* Chart axes */}
    <path d="M22 22V58H62" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" />
    {/* Trending dotted curve */}
    <path
      d="M26 52C32 50 36 38 42 40C48 42 52 28 58 24"
      stroke="#6366F1"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeDasharray="3 3"
    />
    {/* Key data nodes */}
    <circle cx="42" cy="40" r="3" fill="#6366F1" />
    <circle cx="58" cy="24" r="3.5" fill="#F59E0B" />
    <circle cx="30" cy="30" r="1.5" fill="#10B981" />
  </svg>
);

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  compact = false,
  className = '',
  variant = 'default',
}) => {
  const renderIllustration = () => {
    if (variant === 'zero-inbox') return <ZeroInboxIllustration />;
    if (variant === 'day-complete') return <DayCompleteIllustration />;
    if (variant === 'no-analytics') return <NoAnalyticsIllustration />;
    if (icon) {
      return (
        <div className="w-11 h-11 mb-3 rounded-2xl bg-stone-200/50 dark:bg-white/[0.05] border border-[var(--border-hairline)] text-[var(--text-secondary)] flex items-center justify-center shadow-xs">
          {icon}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      data-testid={`empty-state-${variant}`}
      className={`workspace-empty-state w-full flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 bg-[var(--bg-surface-l1)]/30 ${
        compact ? 'py-8 px-4' : 'py-12 px-6'
      } ${className}`}
    >
      <div className="mb-3">{renderIllustration()}</div>

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
