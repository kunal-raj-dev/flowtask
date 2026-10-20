import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, X, Sun, Moon, ArrowRight, Sparkles } from 'lucide-react';
import { formatLocalDate } from '../../../utils/nlpParser';
import { useTodayStr } from '../../../hooks/useCurrentDate';
import { SPRING_TACTILE } from '../../../utils/springPhysics';
import { audioEngine } from '../../../utils/audioEngine';
import { useMotionPreference } from '../../../hooks/useMotionPreference';

export interface DatePickerPopoverProps {
  taskId: string;
  currentDate?: string;
  onSelectDate: (date: string | undefined, isSomeday?: boolean) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}

export const DatePickerPopover: React.FC<DatePickerPopoverProps> = ({
  currentDate,
  onSelectDate,
  onClose,
  anchorRect,
}) => {
  const reduced = useMotionPreference();
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const todayStr = useTodayStr();

  const { todayFormatted, tomorrowStr, tomorrowFormatted, nextWeekStr, nextWeekFormatted } = useMemo(() => {
    const t = new Date(todayStr + 'T12:00:00');
    const tom = new Date(t);
    tom.setDate(tom.getDate() + 1);
    const nw = new Date(t);
    nw.setDate(nw.getDate() + 7);
    return {
      todayFormatted: t.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      tomorrowStr: formatLocalDate(tom),
      tomorrowFormatted: tom.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      nextWeekStr: formatLocalDate(nw),
      nextWeekFormatted: nw.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    };
  }, [todayStr]);

  const [customDate, setCustomDate] = useState(currentDate || '');

  // Focus trap initialization and restoration
  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    const firstOption = popoverRef.current?.querySelector<HTMLElement>('button[role="menuitem"]');
    if (firstOption) {
      firstOption.focus();
    } else {
      const focusable = popoverRef.current?.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])');
      if (focusable && focusable.length > 0) {
        focusable[0]?.focus();
      }
    }
    return () => {
      prevActive?.focus?.();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = popoverRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
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
        const focusable = popoverRef.current?.querySelectorAll<HTMLElement>('button[role="menuitem"], input[type="date"]');
        if (focusable && focusable.length > 0) {
          const itemsArray = Array.from(focusable);
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

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        e.stopPropagation();
        audioEngine.playClickSound();
        onSelectDate(todayStr, false);
        onClose();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        e.stopPropagation();
        audioEngine.playClickSound();
        onSelectDate(tomorrowStr, false);
        onClose();
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        e.stopPropagation();
        audioEngine.playClickSound();
        onSelectDate(nextWeekStr, false);
        onClose();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        e.stopPropagation();
        audioEngine.playClickSound();
        onSelectDate(undefined, true);
        onClose();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        e.stopPropagation();
        audioEngine.playClickSound();
        inputRef.current?.focus();
        try {
          inputRef.current?.showPicker?.();
        } catch {
          // showPicker may not be supported in some environments
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [todayStr, tomorrowStr, nextWeekStr, onSelectDate, onClose]);

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
            anchorRect.bottom + 300 > window.innerHeight && anchorRect.top > 300
              ? `${Math.max(16, anchorRect.top - 300 - 6)}px`
              : `${Math.max(16, Math.min(window.innerHeight - 300, anchorRect.bottom + 6))}px`,
          left: `${Math.max(16, Math.min(window.innerWidth - 240, anchorRect.left))}px`,
          zIndex: 9999,
        }
      : {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
        };

  const QUICK_OPTIONS = [
    {
      key: 't',
      label: 'Today',
      sub: todayFormatted,
      icon: Sun,
      action: () => onSelectDate(todayStr, false),
      color: 'text-amber-500',
    },
    {
      key: 'm',
      label: 'Tomorrow',
      sub: tomorrowFormatted,
      icon: Moon,
      action: () => onSelectDate(tomorrowStr, false),
      color: 'text-sky-500',
    },
    {
      key: 'w',
      label: 'Next Week',
      sub: nextWeekFormatted,
      icon: ArrowRight,
      action: () => onSelectDate(nextWeekStr, false),
      color: 'text-violet-500',
    },
    {
      key: 'n',
      label: 'Someday',
      sub: 'No scheduled date',
      icon: Sparkles,
      action: () => onSelectDate(undefined, true),
      color: 'text-stone-400',
    },
  ];

  return (
    <AnimatePresence>
      <div key="date-backdrop" className="fixed inset-0 z-[9998] bg-black/10 backdrop-blur-[1px]" onClick={onClose} />
      <motion.div
        key="date-modal"
        ref={popoverRef}
        role="dialog"
        aria-label="Schedule Date"
        initial={reduced ? undefined : { opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduced ? undefined : { opacity: 0, scale: 0.95, y: -4 }}
        transition={reduced ? { duration: 0 } : SPRING_TACTILE}
        style={style}
        className="w-56 rounded-xl bg-surface border border-border shadow-cute-modal p-2 select-none"
      >
        <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-border/40 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar size={13} className="text-amber-500" />
            Schedule Date
          </span>
          <button
            onClick={onClose}
            aria-label="Close date picker"
            className="p-0.5 rounded hover:bg-surface-hover text-muted-foreground hover:text-foreground"
          >
            <X size={13} />
          </button>
        </div>

        <div className="flex flex-col gap-0.5" role="menu">
          {QUICK_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              role="menuitem"
              onClick={() => {
                audioEngine.playClickSound();
                opt.action();
                onClose();
              }}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-surface-hover transition-colors"
            >
              <div className="flex items-center gap-2">
                <opt.icon size={13} className={opt.color} />
                <div className="flex flex-col text-left">
                  <span>{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">{opt.sub}</span>
                </div>
              </div>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-l1 border border-border/60 text-muted-foreground">
                {opt.key}
              </kbd>
            </button>
          ))}
        </div>

        <div className="mt-2 pt-2 border-t border-border/40 px-1">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-semibold text-muted-foreground block">Pick specific date</label>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface-l1 border border-border/60 text-muted-foreground">
              s
            </kbd>
          </div>
          <input
            ref={inputRef}
            type="date"
            aria-label="Pick specific date"
            value={customDate}
            onChange={(e) => {
              setCustomDate(e.target.value);
              if (e.target.value) {
                audioEngine.playClickSound();
                onSelectDate(e.target.value, false);
                onClose();
              }
            }}
            className="w-full text-xs px-2 py-1 rounded bg-surface-l1 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
