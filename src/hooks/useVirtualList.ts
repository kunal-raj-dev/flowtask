import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseVirtualListOptions<T> {
  items: T[];
  estimatedItemHeight?: number;
  overscan?: number;
  threshold?: number;
}

export interface VirtualItem<T> {
  item: T;
  index: number;
}

export interface UseVirtualListReturn<T> {
  containerRef: React.RefObject<HTMLDivElement | null>;
  virtualItems: VirtualItem<T>[];
  totalHeight: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  isVirtual: boolean;
  scrollToIndex: (index: number) => void;
}

/**
 * High-performance lightweight virtual windowing hook.
 * Zero external runtime dependencies.
 * Bypasses virtualization when item count is below threshold (< 30) for zero overhead.
 * Automatically discovers the nearest scrollable ancestor container or falls back to window.
 */
export function useVirtualList<T>({
  items,
  estimatedItemHeight = 72,
  overscan = 5,
  threshold = 30,
}: UseVirtualListOptions<T>): UseVirtualListReturn<T> {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // If item count is small, bypass virtualization completely
  const isVirtual = items.length >= threshold;

  const [range, setRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: isVirtual ? Math.min(items.length, 30) : items.length,
  });

  const getScrollParent = useCallback((node: HTMLElement | null): HTMLElement | Window => {
    if (!node || typeof window === 'undefined') return window;
    let current: HTMLElement | null = node.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY || style.overflow;
      if ((overflowY === 'auto' || overflowY === 'scroll') && current.clientHeight <= window.innerHeight && current.scrollHeight > current.clientHeight) {
        return current;
      }
      current = current.parentElement;
    }
    return window;
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container || index < 0 || index >= items.length || !isVirtual) return;
    const parent = getScrollParent(container);
    const start = Math.max(0, index - overscan);
    setRange({ start, end: Math.min(items.length, index + overscan + 15) });
    if (parent === window) window.scrollTo({ top: container.getBoundingClientRect().top + window.scrollY + index * estimatedItemHeight - 80, behavior: 'auto' });
    else {
      const element = parent as HTMLElement;
      element.scrollTop += container.getBoundingClientRect().top - element.getBoundingClientRect().top + index * estimatedItemHeight - 40;
    }
  }, [items.length, isVirtual, overscan, estimatedItemHeight, getScrollParent]);

  const calculateRange = useCallback(() => {
    if (!isVirtual || typeof window === 'undefined') {
      return;
    }

    const container = containerRef.current;
    const scrollParent = container ? getScrollParent(container) : window;

    let scrollTop = 0;
    let viewportHeight = typeof window !== 'undefined' ? window.innerHeight || 800 : 800;
    let containerOffsetTop = 0;

    if (scrollParent === window) {
      scrollTop = window.scrollY || window.pageYOffset || 0;
      if (container) {
        const rect = container.getBoundingClientRect();
        containerOffsetTop = rect.top + scrollTop;
      }
    } else {
      const parentEl = scrollParent as HTMLElement;
      scrollTop = parentEl.scrollTop;
      viewportHeight = Math.min(parentEl.clientHeight || viewportHeight, viewportHeight);
      if (container) {
        const parentRect = parentEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        containerOffsetTop = containerRect.top - parentRect.top + scrollTop;
      }
    }

    const relativeScroll = Math.max(0, scrollTop - containerOffsetTop);
    const startIndex = Math.max(0, Math.floor(relativeScroll / estimatedItemHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / estimatedItemHeight);
    const endIndex = Math.min(items.length, startIndex + visibleCount + 2 * overscan);

    setRange((prev) => {
      if (prev.start === startIndex && prev.end === endIndex) return prev;
      return { start: startIndex, end: endIndex };
    });
  }, [items.length, isVirtual, estimatedItemHeight, overscan, getScrollParent]);

  useEffect(() => {
    if (!isVirtual) {
      return;
    }

    calculateRange();

    const container = containerRef.current;
    const scrollParent = getScrollParent(container);

    let rafId: number | null = null;
    const handleScrollOrResize = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        calculateRange();
        rafId = null;
      });
    };

    scrollParent.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(handleScrollOrResize);
    if (container) observer?.observe(container);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      scrollParent.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
      observer?.disconnect();
    };
  }, [isVirtual, calculateRange, getScrollParent, items.length]);

  if (!isVirtual) {
    return {
      containerRef,
      virtualItems: items.map((item, index) => ({ item, index })),
      totalHeight: items.length * estimatedItemHeight,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
      isVirtual: false,
      scrollToIndex,
    };
  }

  const safeStart = Math.min(range.start, items.length);
  const safeEnd = Math.min(Math.max(range.end, safeStart), items.length);

  const virtualItems: VirtualItem<T>[] = items
    .slice(safeStart, safeEnd)
    .map((item, i) => ({
      item,
      index: safeStart + i,
    }));

  const topSpacerHeight = safeStart * estimatedItemHeight;
  const bottomSpacerHeight = Math.max(0, (items.length - safeEnd) * estimatedItemHeight);
  const totalHeight = items.length * estimatedItemHeight;

  return {
    containerRef,
    virtualItems,
    totalHeight,
    topSpacerHeight,
    bottomSpacerHeight,
    isVirtual: true,
    scrollToIndex,
  };
}
