import React, { useState } from 'react';
import { WIDGET_REGISTRY } from '../../services/widgetRegistry';
import { Dialog } from '../ui/Dialog';
import type { WidgetType } from '../../types/dashboard';
interface Props { isOpen: boolean; onClose: () => void; onAddWidget: (type: WidgetType) => void; currentWidgetCount: number; existingWidgetTypes: WidgetType[]; }
export const WidgetCatalogModal: React.FC<Props> = props => {
  const [search, setSearch] = useState('');
  const entries = Object.values(WIDGET_REGISTRY).filter(w => (w.name + ' ' + w.description).toLowerCase().includes(search.toLowerCase()));
  return <Dialog isOpen={props.isOpen} onClose={props.onClose} title="Add Widget to Workspace" description="Choose what deserves a place on your desk." size="lg">
    <input className="desk-search-input" aria-label="Search widgets" placeholder="Search widgets…" value={search} onChange={e => setSearch(e.target.value)}/>
    <div className="desk-widget-catalog">{entries.map(def => { const Icon = def.icon; return <article key={def.type}><Icon size={20}/><div><h3>{def.name}</h3><p>{def.description}</p></div><button className="desk-button" disabled={props.currentWidgetCount >= 24} onClick={() => { props.onAddWidget(def.type); props.onClose(); }}>Add</button></article>; })}</div>
    {!entries.length && <p className="desk-muted">No matching widgets. Try “tasks”, “notes”, or “focus”.</p>}
    {props.currentWidgetCount >= 24 && <p className="desk-muted">Your desk has 24 widgets. Remove one before adding another.</p>}
  </Dialog>;
};
