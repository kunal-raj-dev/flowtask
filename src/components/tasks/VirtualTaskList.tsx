import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  const {
    containerRef,
    virtualItems,
    topSpacerHeight,
    bottomSpacerHeight,
    isVirtual,
  } = useVirtualList({
    items: tasks,
    estimatedItemHeight,
    threshold: 25,
  });

  if (!isVirtual) {
    return (
      <div className={className}>
        <AnimatePresence initial={false} mode="popLayout">
          {tasks.map((task, idx) => (
            <motion.div
              key={task.id}
              layout="position"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
              }}
            >
              {renderTask(task, idx)}
            </motion.div>
          ))}
        </AnimatePresence>
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
