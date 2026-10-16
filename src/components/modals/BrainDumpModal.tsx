import React from 'react';
import { ScratchpadModal } from './ScratchpadModal';

export interface BrainDumpModalProps {
  onClose: () => void;
}

/**
 * BrainDumpModal adapter component.
 * Delegates directly to the consolidated ScratchpadModal opened to the 'staging' tab.
 */
export const BrainDumpModal: React.FC<BrainDumpModalProps> = ({ onClose }) => {
  return <ScratchpadModal isOpen={true} onClose={onClose} initialTab="staging" />;
};
