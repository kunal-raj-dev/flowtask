import React from 'react';
import { TaskComposer } from './TaskComposer';

interface OmnibarProps {
  onOpenBrainDump?: () => void;
}

export const Omnibar: React.FC<OmnibarProps> = () => {
  return <TaskComposer />;
};
