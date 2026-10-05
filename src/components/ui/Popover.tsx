import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type PopoverAlign = 'start' | 'center' | 'end';
export type PopoverSide = 'top' | 'bottom' | 'left' | 'right';

export interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  children?: React.ReactNode;
  align?: PopoverAlign;
  side?: PopoverSide;
  className?: string;
}

const alignStyles: Record<PopoverSide, Record<PopoverAlign, string>> = {
  bottom: {
    start: 'top-full mt-2 left-0',
    center: 'top-full mt-2 left-1/2 -translate-x-1/2',
    end: 'top-full mt-2 right-0',
  },
  top: {
    start: 'bottom-full mb-2 left-0',
    center: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    end: 'bottom-full mb-2 right-0',
  },
  left: {
    start: 'right-full mr-2 top-0',
    center: 'right-full mr-2 top-1/2 -translate-y-1/2',
    end: 'right-full mr-2 bottom-0',
  },
  right: {
    start: 'left-full ml-2 top-0',
    center: 'left-full ml-2 top-1/2 -translate-y-1/2',
    end: 'left-full ml-2 bottom-0',
  },
};

export const Popover: React.FC<PopoverProps> = ({
  isOpen,
  onClose,
  trigger,
  children,
  align = 'start',
  side = 'bottom',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const placementClass = alignStyles[side][align];

  return (
    <div ref={containerRef} className="relative inline-block">
      <div
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="inline-flex"
      >
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-modal="false"
            initial={{ opacity: 0, scale: 0.96, y: side === 'bottom' ? -4 : side === 'top' ? 4 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute z-50 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-elevated card-surface overflow-hidden ${placementClass} ${className}`}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
