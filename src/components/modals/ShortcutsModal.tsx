import React from 'react';
import { ShortcutsGuide } from '../common/ShortcutsGuide';
import { Dialog } from '../ui/Dialog';
import { useTaskContext } from '../../context/TaskContext';
export const ShortcutsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { settings } = useTaskContext();
  return <Dialog isOpen onClose={onClose} title="Keyboard Shortcuts & Smart Syntax" size="lg">
    <ShortcutsGuide keyboardShortcutsEnabled={settings?.keyboardShortcutsEnabled !== false} />
  </Dialog>;
};
