import { useState } from 'react';
import { Image, LayoutGrid, Palette } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { useModalStore } from '../../store/useModalStore';
import { WorkspaceImagePicker } from './WorkspaceImagePicker';

export function TodayAppearance({ customizeOpen, onClose, onEditWidgets }: {
  customizeOpen: boolean; onClose: () => void; onEditWidgets: () => void;
}) {
  const [picker, setPicker] = useState(false);
  return <>
    <Dialog isOpen={customizeOpen} onClose={onClose} title="Customize Today" description="Make this space work for you." size="sm">
      <div className="today-customize-actions">
        <button className="desk-button" onClick={() => { onClose(); onEditWidgets(); }}><LayoutGrid size={18} />Desks & layouts</button>
        <button className="desk-button" onClick={() => { onClose(); setPicker(true); }}><Image size={18} />Background</button>
        <button className="desk-button" onClick={() => { onClose(); useModalStore.getState().openModal('settings', { initialTab: 'aesthetics' }); }}><Palette size={18} />Appearance</button>
      </div>
    </Dialog>
    {picker && <WorkspaceImagePicker onClose={() => setPicker(false)} />}
  </>;
}
