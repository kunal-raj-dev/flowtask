import React from 'react';

export interface BrandLogoProps {
  size?: number;
  className?: string;
  showWordmark?: boolean;
  subtitle?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 32,
  className = '',
  showWordmark = false,
  subtitle = 'Local-First OS',
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Precision Geometric Brand Mark */}
      <div
        style={{ width: size, height: size }}
        className="relative shrink-0 rounded-xl bg-gradient-to-b from-stone-900 via-stone-950 to-stone-900 dark:from-stone-850 dark:via-stone-900 dark:to-stone-950 border border-white/10 dark:border-white/15 shadow-sm flex items-center justify-center p-1.5 overflow-hidden group select-none transition-transform group-hover:scale-105"
      >
        <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
          <defs>
            <linearGradient id="ft-brand-flow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#EA580C" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id="ft-brand-glow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#EA580C" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Dynamic Flow Aura Arc */}
          <path
            d="M6.5 16.5C6.5 11.5 10.5 8.5 16 8.5C21.5 8.5 25.5 11.5 25.5 16.5C25.5 21.5 21.5 23.5 16 23.5"
            stroke="rgba(245, 158, 11, 0.22)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Aerodynamic Flow Checkmark */}
          <path
            d="M8.5 16L13.5 21L24 9.5"
            stroke="url(#ft-brand-flow)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Luminous Apex Momentum Spark */}
          <circle cx="24" cy="9.5" r="1.5" fill="#FEF3C7" className="animate-pulse" />
        </svg>
      </div>

      {showWordmark && (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-[13px] tracking-tight text-[var(--text-primary)] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              FlowTask
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/25 tracking-wide uppercase">
              Zen
            </span>
          </div>
          {subtitle && (
            <div className="flex items-center gap-1.2 text-[10px] text-[var(--text-muted)] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0 ring-2 ring-emerald-500/20" />
              <span className="truncate">{subtitle}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
