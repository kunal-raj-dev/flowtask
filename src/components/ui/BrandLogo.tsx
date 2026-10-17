import React, { useId } from 'react';

export interface BrandLogoProps {
  size?: number;
  className?: string;
  showWordmark?: boolean;
  subtitle?: string;
}

/** Flow Ribbon F: one continuous silhouette, with a gently rising terminal. */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 32,
  className = '',
  showWordmark = false,
  subtitle = 'Plan your day. Enter your flow.',
}) => {
  const gradientId = `ft-ribbon-${useId().replace(/:/g, '')}`;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 select-none"
        role={showWordmark ? undefined : 'img'}
        aria-label={showWordmark ? undefined : 'FlowTask'}
        aria-hidden={showWordmark ? true : undefined}
        focusable="false"
      >
        <defs>
          <linearGradient id={gradientId} x1="26" y1="11" x2="41" y2="54" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F9CC72" />
            <stop offset="0.52" stopColor="#F5A623" />
            <stop offset="1" stopColor="#E18A16" />
          </linearGradient>
        </defs>
        <rect x="0.5" y="0.5" width="63" height="63" rx="17.5" fill="#23211E" stroke="#FFFFFF" strokeOpacity="0.1" />
        <path
          d="M17 51L22.5 18.5C23.2 14.2 26.1 12 30.3 12H43.5L51 7L47.8 18.4C47.1 21 45 22.5 42.1 22.5H31.7L30.2 31H43.5L38.3 40H28.7L26.8 51H17Z"
          fill={`url(#${gradientId})`}
        />
        <path d="M22.5 18.5L31.7 22.5L30.2 31H20.4L22.5 18.5Z" fill="#B96B10" fillOpacity="0.22" />
      </svg>

      {showWordmark && (
        <div className="min-w-0">
          <div className="font-extrabold text-[13px] tracking-tight text-[var(--text-primary)]">
            FlowTask
          </div>
          {subtitle && (
            <div className="truncate text-[10px] leading-relaxed text-[var(--text-muted)]">
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
