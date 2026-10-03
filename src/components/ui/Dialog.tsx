import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: DialogSize;
  closeOnBackdropClick?: boolean;
  className?: string;
}

const sizeStyles: Record<DialogSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdropClick = true,
  className = '',
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = rootRef.current;
    const focusables = () => [...(root?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]') || [])].filter(el => el.getClientRects().length > 0);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    (focusables()[0] || root)?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      const dialogs = [...document.querySelectorAll('[aria-modal="true"]')];
      if (dialogs.at(-1) !== root) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeRef.current(); }
      if (e.key === 'Tab') {
        const items = focusables(), first = items[0], last = items.at(-1);
        if (!first) { e.preventDefault(); root?.focus(); }
        else if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => { document.removeEventListener('keydown', handleKeyDown, true); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={() => {
          if (closeOnBackdropClick) onClose();
        }}
      />

      {/* Dialog Surface */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-modal card-surface z-10 animate-slide-down overflow-hidden ${sizeStyles[size]} ${className}`}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between p-4 sm:p-5 border-b border-[var(--border-hairline)]">
            <div className="min-w-0 pr-4">
              {title && (
                <h3
                  id={titleId}
                  className="text-base font-semibold text-[var(--text-primary)] tracking-tight leading-snug"
                >
                  {title}
                </h3>
              )}
              {description && (
                <p id={descId} className="text-xs text-[var(--text-secondary)] mt-1">
                  {description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/10 transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 max-h-[75vh] overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 bg-[var(--bg-surface-l1)]/50 border-t border-[var(--border-hairline)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
