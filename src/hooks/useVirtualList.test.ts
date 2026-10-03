// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVirtualList } from './useVirtualList';

describe('useVirtualList', () => {
  it('bypasses virtualization when items length is below threshold', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ id: `task-${i}`, title: `Task ${i}` }));

    const { result } = renderHook(() =>
      useVirtualList({
        items,
        threshold: 30,
        estimatedItemHeight: 70,
      })
    );

    expect(result.current.isVirtual).toBe(false);
    expect(result.current.virtualItems.length).toBe(15);
    expect(result.current.topSpacerHeight).toBe(0);
    expect(result.current.bottomSpacerHeight).toBe(0);
    expect(result.current.totalHeight).toBe(15 * 70);
  });

  it('enables virtualization and calculates slices when items exceed threshold', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: `task-${i}`, title: `Task ${i}` }));

    const { result } = renderHook(() =>
      useVirtualList({
        items,
        threshold: 30,
        estimatedItemHeight: 70,
        overscan: 5,
      })
    );

    expect(result.current.isVirtual).toBe(true);
    expect(result.current.virtualItems.length).toBeLessThan(100);
    expect(result.current.totalHeight).toBe(100 * 70);
    expect(result.current.topSpacerHeight).toBe(0);
    expect(result.current.bottomSpacerHeight).toBeGreaterThan(0);
  });

  it('handles empty item list correctly', () => {
    const { result } = renderHook(() =>
      useVirtualList({
        items: [],
        threshold: 30,
      })
    );

    expect(result.current.isVirtual).toBe(false);
    expect(result.current.virtualItems).toEqual([]);
    expect(result.current.totalHeight).toBe(0);
    expect(result.current.topSpacerHeight).toBe(0);
    expect(result.current.bottomSpacerHeight).toBe(0);
  });
});
