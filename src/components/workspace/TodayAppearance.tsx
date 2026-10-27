import { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Image, ImageOff, LayoutGrid, Palette, RotateCcw } from 'lucide-react';
import { useWorkspaceBackgroundChoice } from '../../hooks/useWorkspaceBackgroundChoice';
import { Dialog } from '../ui/Dialog';
import { useModalStore } from '../../store/useModalStore';
import { WorkspaceImagePicker } from './WorkspaceImagePicker';
import type { TodayLayoutPreferences, TodaySectionId } from '../../types/dashboard';
import { defaultTodayLayout, moveTodaySection, TODAY_SECTIONS } from '../../utils/todayLayout';

export function TodayAppearance({ customizeOpen, onClose, onEditWidgets, layout, onPreview, onApply }: {
  customizeOpen: boolean; onClose: () => void; onEditWidgets: () => void;
  layout: TodayLayoutPreferences; onPreview: (layout: TodayLayoutPreferences) => void; onApply: () => void;
}) {
  const [picker, setPicker] = useState(false);
  const [dragging, setDragging] = useState<TodaySectionId | null>(null);
  const { hasBackground, setBackground } = useWorkspaceBackgroundChoice();
  return <>
    <Dialog isOpen={customizeOpen} onClose={onClose} title="Customize Today" description="Preview your changes, then apply when this feels right." size="md"
      footer={<><button type="button" className="desk-button" onClick={onClose}>Cancel</button><button type="button" className="desk-button primary" onClick={onApply}>Apply layout</button></>}>
      <div className="today-layout-editor">
        <p className="today-layout-intro">Show what helps. Move sections with the arrows or drag handle. Hidden groups return their tasks to the main list.</p>
        <ol className="today-layout-sections" aria-label="Today sections">
          {layout.sections.map((section, index) => {
            const definition = TODAY_SECTIONS.find(item => item.id === section.id)!;
            return <li key={section.id} className="today-layout-item" draggable onDragStart={event => { setDragging(section.id); event.dataTransfer.setData('text/plain', section.id); }} onDragEnd={() => setDragging(null)}
              onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={event => { event.preventDefault(); if (dragging) onPreview(moveTodaySection(layout, dragging, index)); setDragging(null); }}>
              <GripVertical size={17} className="today-layout-grip" aria-hidden="true" />
              <label htmlFor={`today-show-${section.id}`}><span>{definition.label}{definition.required && <small>Required</small>}</span><span className="today-layout-description">{definition.description}</span></label>
              <input id={`today-show-${section.id}`} type="checkbox" checked={section.visible} disabled={definition.required} aria-label={`Show ${definition.label}`} onChange={event => onPreview({ ...layout, sections: layout.sections.map(item => item.id === section.id ? { ...item, visible: event.target.checked } : item) })} />
              <button type="button" className="today-layout-move" aria-label={`Move ${definition.label} up`} disabled={index === 0} onClick={() => onPreview(moveTodaySection(layout, section.id, index - 1))}><ArrowUp size={15} /></button>
              <button type="button" className="today-layout-move" aria-label={`Move ${definition.label} down`} disabled={index === layout.sections.length - 1} onClick={() => onPreview(moveTodaySection(layout, section.id, index + 1))}><ArrowDown size={15} /></button>
            </li>;
          })}
        </ol>
        <label className="today-layout-context">Context panel<select aria-label="Today context panel" value={layout.contextPanel} onChange={event => onPreview({ ...layout, contextPanel: event.target.value as TodayLayoutPreferences['contextPanel'] })}><option value="none">None — keep the desk clear</option><option value="schedule">Today's schedule</option></select></label>
        <button type="button" className="desk-button" onClick={() => onPreview(defaultTodayLayout())}><RotateCcw size={15} />Reset layout</button>
        <div className="today-layout-appearance">
          <button type="button" className="desk-button" onClick={() => { onClose(); onEditWidgets(); }}><LayoutGrid size={16} />Advanced dashboards</button>
          <button type="button" className="desk-button" onClick={() => setPicker(true)}><Image size={16} />Background</button>
          {hasBackground && <button type="button" className="desk-button" onClick={() => setBackground('none')}><ImageOff size={16} />Remove background</button>}
          <button type="button" className="desk-button" onClick={() => { onClose(); useModalStore.getState().openModal('settings', { initialTab: 'aesthetics' }); }}><Palette size={16} />Appearance</button>
        </div>
      </div>
    </Dialog>
    {picker && <WorkspaceImagePicker onClose={() => setPicker(false)} />}
  </>;
}
