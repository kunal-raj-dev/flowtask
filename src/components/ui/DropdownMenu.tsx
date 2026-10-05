import React, { useEffect, useRef, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { audioEngine } from '../../utils/audioEngine';
import { Kbd } from './Kbd';

export interface DropdownMenuProps {
  isOpen: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  children?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  kbd?: string;
  destructive?: boolean;
  enableSound?: boolean;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  isOpen,
  onClose,
  trigger,
  children,
  align = 'left',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;

    // Focus first actionable item when menu opens
    const timer = setTimeout(() => {
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
      if (items && items.length > 0) {
        items[0].focus();
      }
    }, 10);

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') || []
      );
      if (items.length === 0) return;

      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        const triggerBtn = triggerRef.current?.querySelector<HTMLElement>('button, [tabindex="0"]');
        triggerBtn?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = currentIndex === -1 || currentIndex === items.length - 1 ? 0 : currentIndex + 1;
        items[nextIndex].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        items[prevIndex].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1].focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const alignClass = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <div
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        className="inline-flex"
      >
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={menuId}
            ref={menuRef}
            role="menu"
            aria-orientation="vertical"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className={`absolute z-50 mt-1.5 min-w-[180px] p-1 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-elevated card-surface ${alignClass} ${className}`}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const DropdownMenuItem = React.forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  (
    {
      icon,
      kbd,
      destructive = false,
      enableSound = true,
      children,
      className = '',
      onClick,
      disabled,
      ...props
    },
    ref
  ) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (enableSound) {
        audioEngine.playClickSound();
      }
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        tabIndex={-1}
        disabled={disabled}
        onClick={handleClick}
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-medium rounded-lg select-none transition-colors outline-hidden focus:bg-[var(--bg-surface-hover)] focus:text-[var(--text-primary)] disabled:opacity-40 disabled:pointer-events-none ${
          destructive
            ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 focus:bg-rose-500/10'
            : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
        } ${className}`}
        {...props}
      >
        <span className="flex items-center gap-2 truncate">
          {icon && <span className="shrink-0 text-[var(--text-secondary)]">{icon}</span>}
          <span className="truncate">{children}</span>
        </span>
        {kbd && <Kbd size="xs">{kbd}</Kbd>}
      </button>
    );
  }
);

DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuSeparator: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div role="separator" className={`my-1 h-px bg-[var(--border-hairline)] ${className}`} />
);

export const DropdownMenuLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    role="presentation"
    className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] select-none ${className}`}
  >
    {children}
  </div>
);
