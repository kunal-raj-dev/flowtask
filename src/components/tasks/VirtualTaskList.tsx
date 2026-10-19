import React, { useEffect, useLayoutEffect, useRef } from 'react';
import type { Task } from '../../types/task';
import { useVirtualList } from '../../hooks/useVirtualList';

interface VirtualTaskListProps {
  tasks: Task[];
  renderTask: (task: Task, index: number) => React.ReactNode;
  estimatedItemHeight?: number;
  className?: string;
}

export const VirtualTaskList: React.FC<VirtualTaskListProps> = ({
  tasks,
  renderTask,
  estimatedItemHeight = 72,
  className = 'space-y-2',
}) => {
  const pendingReveal = useRef<string | null>(null);
  const {
    containerRef,
    virtualItems,
    topSpacerHeight,
    bottomSpacerHeight,
    isVirtual,
    scrollToIndex,
  } = useVirtualList({
    items: tasks,
    estimatedItemHeight,
    threshold: 25,
  });

  useEffect(() => {
    if (!isVirtual) return;
    const reveal = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      const index = tasks.findIndex(task => task.id === id);
      if (index >= 0) { pendingReveal.current = id; scrollToIndex(index); }
    };
    window.addEventListener('flowtask:reveal-task', reveal);
    return () => window.removeEventListener('flowtask:reveal-task', reveal);
  }, [tasks, isVirtual, scrollToIndex]);

  // A newly revealed row must be positioned after its DOM has mounted.
  useLayoutEffect(() => {
    if (!pendingReveal.current) return;
    const row = [...(containerRef.current?.querySelectorAll<HTMLElement>('[data-task-id]') || [])].find(element => element.dataset.taskId === pendingReveal.current);
    if (row) {
      pendingReveal.current = null;
      row.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    }
  }, [virtualItems, containerRef]);

  if (!isVirtual) {
    return (
      <div className={className}>
        {tasks.map((task, idx) => <React.Fragment key={task.id}>{renderTask(task, idx)}</React.Fragment>)}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      {topSpacerHeight > 0 && (
        <div style={{ height: `${topSpacerHeight}px` }} aria-hidden="true" />
      )}
      {virtualItems.map(({ item, index }) => renderTask(item, index))}
      {bottomSpacerHeight > 0 && (
        <div style={{ height: `${bottomSpacerHeight}px` }} aria-hidden="true" />
      )}
    </div>
  );
};
