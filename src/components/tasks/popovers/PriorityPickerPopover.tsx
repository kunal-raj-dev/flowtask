import { appShortcutAllowed } from '../../../services/shortcutRuntime';
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, X } from 'lucide-react';
import type { Priority } from '../../../types/task';
import { SPRING_TACTILE } from '../../../utils/springPhysics';
import { audioEngine } from '../../../utils/audioEngine';
import { useMotionPreference } from '../../../hooks/useMotionPreference';

export interface PriorityPickerPopoverProps {
  taskId: string;
  currentPriority: Priority;
  onSelect: (priority: Priority) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}

const PRIORITIES: Array<{
  id: Priority;
  key: string;
  label: string;
  color: string;
  textColor: string;
  bgLight: string;
}> = [
  { id: 'p1', key: '1', label: 'Urgent', color: '#F43F5E', textColor: 'text-rose-500', bgLight: 'bg-rose-500/10' },
  { id: 'p2', key: '2', label: 'High', color: '#0EA5E9', textColor: 'text-sky-500', bgLight: 'bg-sky-500/10' },
  { id: 'p3', key: '3', label: 'Medium', color: '#8B5CF6', textColor: 'text-violet-500', bgLight: 'bg-violet-500/10' },
  { id: 'p4', key: '4', label: 'Low / None', color: '#64748B', textColor: 'text-stone-400', bgLight: 'bg-stone-500/10' },
];

export const PriorityPickerPopover: React.FC<PriorityPickerPopoverProps> = ({
  currentPriority,
  onSelect,
  onClose,
  anchorRect,
}) => {
  const reduced = useMotionPreference();
  const popoverRef = useRef<HTMLDivElement>(null);

  // Focus trap initialization, auto-focus active/first option, and focus restoration
  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    const activeItem = popoverRef.current?.querySelector<HTMLElement>(`button[data-priority="${currentPriority}"]`);
    const firstOption = popoverRef.current?.querySelector<HTMLElement>('button[data-priority]');
    const targetFocus = activeItem || firstOption;
    if (targetFocus) {
      targetFocus.focus();
    } else {
      const focusable = popoverRef.current?.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])');
      if (focusable && focusable.length > 0) {
        focusable[0]?.focus();
      }
    }
    return () => {
      prevActive?.focus?.();
    };
  }, [currentPriority]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = popoverRef.current?.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])');
        if (focusable && focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && (document.activeElement === first || !popoverRef.current?.contains(document.activeElement))) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const menuItems = popoverRef.current?.querySelectorAll<HTMLElement>('button[data-priority]');
        if (menuItems && menuItems.length > 0) {
          const itemsArray = Array.from(menuItems);
          const currentIndex = itemsArray.indexOf(document.activeElement as HTMLElement);
          let nextIndex: number;
          if (currentIndex === -1) {
            nextIndex = e.key === 'ArrowDown' ? 0 : itemsArray.length - 1;
          } else if (e.key === 'ArrowDown') {
            nextIndex = (currentIndex + 1) % itemsArray.length;
          } else {
            nextIndex = (currentIndex - 1 + itemsArray.length) % itemsArray.length;
          }
          itemsArray[nextIndex]?.focus();
        }
        return;
      }
      if (!appShortcutAllowed(e)) return;
      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        const pMap: Record<string, Priority> = { '1': 'p1', '2': 'p2', '3': 'p3', '4': 'p4' };
        const selected = pMap[e.key];
        if (selected) {
          if (typeof audioEngine.playPopSound === 'function') audioEngine.playPopSound();
          else audioEngine.playClickSound();
          onSelect(selected);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onSelect, onClose]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const isZeroAnchor =
    !anchorRect ||
    (anchorRect.width === 0 &&
      anchorRect.height === 0 &&
      anchorRect.top === 0 &&
      anchorRect.left === 0);

  const style: React.CSSProperties =
    !isZeroAnchor && anchorRect && typeof window !== 'undefined' && window.innerHeight > 0
      ? {
          position: 'fixed',
          top:
            anchorRect.bottom + 240 > window.innerHeight && anchorRect.top > 240
              ? `${Math.max(16, anchorRect.top - 240 - 6)}px`
              : `${Math.max(16, Math.min(window.innerHeight - 240, anchorRect.bottom + 6))}px`,
          left: `${Math.max(16, Math.min(window.innerWidth - 220, anchorRect.left))}px`,
          zIndex: 9999,
        }
      : {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
        };

  return (
    <AnimatePresence>
      <div key="priority-backdrop" className="fixed inset-0 z-[9998] bg-black/10 backdrop-blur-[1px]" onClick={onClose} />
      <motion.div
        key="priority-modal"
        ref={popoverRef}
        role="dialog"
        aria-label="Set Priority"
        initial={reduced ? undefined : { opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduced ? undefined : { opacity: 0, scale: 0.95, y: -4 }}
        transition={reduced ? { duration: 0 } : SPRING_TACTILE}
        style={style}
        className="w-52 rounded-xl bg-surface border border-border shadow-cute-modal p-2 select-none"
      >
        <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-border/40 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Flag size={13} className="text-amber-500" />
            Set Priority
          </span>
          <button
            onClick={onClose}
            aria-label="Close priority picker"
            className="p-0.5 rounded hover:bg-surface-hover text-muted-foreground hover:text-foreground"
          >
            <X size={13} />
          </button>
        </div>

        <div className="flex flex-col gap-0.5" role="menu">
          {PRIORITIES.map((p) => {
            const isCurrent = currentPriority === p.id;
            return (
              <button
                key={p.id}
                role="menuitem"
                data-priority={p.id}
                onClick={() => {
                  if (typeof audioEngine.playPopSound === 'function') audioEngine.playPopSound();
                  else audioEngine.playClickSound();
                  onSelect(p.id);
                  onClose();
                }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isCurrent
                    ? `${p.bgLight} ${p.textColor} font-semibold ring-1 ring-inset ring-current/20`
                    : 'text-foreground hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span>{p.label}</span>
                </div>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-muted/60 text-muted-foreground">
                  {p.key}
                </kbd>
              </button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
