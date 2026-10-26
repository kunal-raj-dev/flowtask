import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useMotionPreference } from '../../hooks/useMotionPreference';
import React, { useId, useRef, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { SPRING_TACTILE } from '../../utils/springPhysics';

const emptySubscribe = () => () => {};

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
  const reducedMotion = useMotionPreference();
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const titleId = useId();
  const descId = useId();

  useFocusTrap(rootRef, onClose, isOpen && isClient);

  const content = (
    <AnimatePresence>
      {isOpen && (
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm"
            onClick={() => {
              if (closeOnBackdropClick) onClose();
            }}
          />

          {/* Dialog Surface */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99, y: 3 }}
            transition={reducedMotion ? { duration: 0 } : { ...SPRING_TACTILE, duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className={`flow-dialog-surface relative w-full rounded-2xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-cute-modal card-surface z-10 overflow-hidden ${sizeStyles[size]} ${className}`}
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
            <div className="flow-dialog-body p-4 sm:p-5 overflow-y-auto">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex flex-wrap items-center justify-end gap-2 p-3 sm:p-4 bg-[var(--bg-surface-l1)]/50 border-t border-[var(--border-hairline)]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
  return isClient ? createPortal(content, document.body) : content;
};
