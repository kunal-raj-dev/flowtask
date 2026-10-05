import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: 'rect' | 'circle' | 'text';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rect',
  width,
  height,
  style,
  ...props
}) => {
  const variantClass =
    variant === 'circle'
      ? 'rounded-full'
      : variant === 'text'
      ? 'rounded-md h-3.5 my-1'
      : 'rounded-xl';

  return (
    <div
      role="status"
      aria-label="Loading..."
      className={`animate-pulse bg-[var(--bg-surface-l1)]/80 dark:bg-white/[0.04] border border-[var(--border-subtle)] ${variantClass} ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
      {...props}
    />
  );
};

export const ViewSkeleton: React.FC<{ title?: string }> = ({ title = 'Loading View' }) => {
  return (
    <div className="max-w-4xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8 space-y-6" role="status" aria-label={title}>
      {/* View Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="w-32 h-6 rounded-lg" />
              <Skeleton className="w-16 h-5 rounded-full" />
            </div>
            <Skeleton className="w-48 h-3 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-24 h-7 rounded-lg" />
          <Skeleton className="w-10 h-10 rounded-full" />
        </div>
      </div>

      {/* Omnibar Skeleton */}
      <Skeleton className="w-full h-14 rounded-2xl" />

      {/* Task List Skeletons */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="w-28 h-4 rounded-md" />
          <Skeleton className="w-12 h-4 rounded-md" />
        </div>
        <Skeleton className="w-full h-16 rounded-xl" />
        <Skeleton className="w-full h-16 rounded-xl" />
        <Skeleton className="w-full h-16 rounded-xl" />
        <Skeleton className="w-full h-16 rounded-xl" />
      </div>
    </div>
  );
};

export const ModalSkeleton: React.FC<{ label?: string }> = ({ label = 'Opening dialog...' }) => {
  return (
    <div
      role="status"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-xs animate-fade-in"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-modal p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <div className="space-y-1">
              <Skeleton className="w-36 h-5 rounded-md" />
              <Skeleton className="w-52 h-3 rounded-md" />
            </div>
          </div>
          <Skeleton className="w-6 h-6 rounded-lg" />
        </div>
        <div className="space-y-3 py-2">
          <Skeleton className="w-full h-10 rounded-xl" />
          <Skeleton className="w-full h-24 rounded-xl" />
          <Skeleton className="w-3/4 h-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
};
