import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export type DrawerPosition = 'right' | 'left' | 'bottom';
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  position?: DrawerPosition;
  size?: DrawerSize;
  closeOnBackdropClick?: boolean;
  className?: string;
}

const sizeWidthStyles: Record<DrawerSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md sm:max-w-lg',
  lg: 'max-w-xl sm:max-w-2xl',
  xl: 'max-w-3xl sm:max-w-4xl',
  full: 'max-w-full',
};

const sizeHeightStyles: Record<DrawerSize, string> = {
  sm: 'max-h-[35vh]',
  md: 'max-h-[50vh]',
  lg: 'max-h-[70vh]',
  xl: 'max-h-[85vh]',
  full: 'max-h-[100dvh]',
};

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  position = 'right',
  size = 'md',
  closeOnBackdropClick = true,
  className = '',
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const previous = document.activeElement as HTMLElement | null;
    const root = rootRef.current;
    const getFocusables = () =>
      [
        ...(root?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]'
        ) || []),
      ].filter((el) => el.getClientRects().length > 0);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus first element or root
    (getFocusables()[0] || root)?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeDialogs = [...document.querySelectorAll('[aria-modal="true"]')];
      if (activeDialogs.at(-1) !== root) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeRef.current();
      }

      if (e.key === 'Tab') {
        const items = getFocusables();
        const first = items[0];
        const last = items.at(-1);

        if (!first) {
          e.preventDefault();
          root?.focus();
        } else if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = prevOverflow;
      if (previous?.isConnected) {
        previous.focus();
      }
    };
  }, [isOpen]);

  const getMotionConfig = () => {
    switch (position) {
      case 'left':
        return {
          initial: { x: '-100%' },
          animate: { x: 0 },
          exit: { x: '-100%' },
          containerClasses: 'left-0 top-0 bottom-0 h-full border-r',
          sizeClass: sizeWidthStyles[size],
        };
      case 'bottom':
        return {
          initial: { y: '100%' },
          animate: { y: 0 },
          exit: { y: '100%' },
          containerClasses: 'bottom-0 left-0 right-0 border-t rounded-t-2xl',
          sizeClass: sizeHeightStyles[size],
        };
      case 'right':
      default:
        return {
          initial: { x: '100%' },
          animate: { x: 0 },
          exit: { x: '100%' },
          containerClasses: 'right-0 top-0 bottom-0 h-full border-l',
          sizeClass: sizeWidthStyles[size],
        };
    }
  };

  const motionConfig = getMotionConfig();

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          ref={rootRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          className="fixed inset-0 z-50 overflow-hidden"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs"
            onClick={() => {
              if (closeOnBackdropClick) onClose();
            }}
          />

          {/* Drawer Surface */}
          <motion.div
            initial={motionConfig.initial}
            animate={motionConfig.animate}
            exit={motionConfig.exit}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className={`fixed ${motionConfig.containerClasses} w-full bg-[var(--bg-surface-l1)] border-[var(--border-hairline)] shadow-2xl flex flex-col z-10 card-surface ${motionConfig.sizeClass} ${className}`}
          >
            {/* Header */}
            {(title || description) && (
              <div className="flex items-start justify-between p-4 sm:p-5 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/95 backdrop-blur-sm sticky top-0 z-20">
                <div className="min-w-0 pr-4">
                  {title && (
                    <h2
                      id={titleId}
                      className="text-base font-semibold text-[var(--text-primary)] tracking-tight leading-snug"
                    >
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p id={descId} className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close drawer"
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>

            {/* Optional Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-2 p-3 sm:p-4 bg-[var(--bg-surface-l1)] border-t border-[var(--border-hairline)] sticky bottom-0 z-20">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
