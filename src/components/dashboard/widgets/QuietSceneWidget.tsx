import React, { useEffect, useState } from 'react';
import type { WidgetComponentProps } from '../../../types/dashboard';
import { useBuiltInScenes } from '../../../hooks/useBuiltInScenes';
export const QuietSceneWidget: React.FC<WidgetComponentProps> = ({ widget }) => {
  const scenes = useBuiltInScenes(), scene = scenes.find(s => s.id === widget.config.sceneId) || scenes.find(s => s.id === 'misty-pines');
  const [now,setNow] = useState(() => new Date());
  useEffect(() => { const timer=setInterval(() => setNow(new Date()),60000); return () => clearInterval(timer); },[]);
  return <div className="desk-quiet-scene"><img src={scene?.variants?.[0]?.src || '/media/backgrounds/v1/misty-pines-960.webp'} alt="" loading="lazy" onError={e => { e.currentTarget.style.display='none'; }}/><div className="desk-quiet-content">{widget.config.showClock !== false && <time>{now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:widget.config.clockFormat!=='24h'})}</time>}<p>{now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</p><p>A little space. A fresh start.</p></div></div>;
};
