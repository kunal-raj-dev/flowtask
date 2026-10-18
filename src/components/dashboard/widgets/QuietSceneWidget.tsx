import React, { useEffect, useState } from 'react';
import type { WidgetComponentProps } from '../../../types/dashboard';
import { useMediaCatalog } from '../../../hooks/useStudio';
export const QuietSceneWidget: React.FC<WidgetComponentProps> = ({ widget }) => {
  const { visuals } = useMediaCatalog();
  const scene = visuals.find(s => s.id === widget.config.sceneId) || visuals.find(s => s.id === 'misty-pines');
  const point = widget.config.focalPoint && typeof widget.config.focalPoint === 'object' ? widget.config.focalPoint as {x?:number;y?:number} : undefined;
  const [now,setNow] = useState(() => new Date());
  useEffect(() => { const timer=setInterval(() => setNow(new Date()),60000); return () => clearInterval(timer); },[]);
  return <div className="desk-quiet-scene"><img src={scene?.variants?.[0]?.src || '/media/backgrounds/v1/misty-pines-960.webp'} alt="" loading="lazy" width={scene?.width || 960} height={scene?.height || 540} style={{objectPosition:`${point?.x??scene?.focalPoint?.x??50}% ${point?.y??scene?.focalPoint?.y??50}%`}} onError={e => { e.currentTarget.style.display='none'; }}/><div className="desk-quiet-content">{widget.config.showClock !== false && <time>{now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:widget.config.clockFormat!=='24h'})}</time>}<p>{now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</p><p>{String(widget.config.sceneId||'').startsWith('local:')&&!visuals.some(a=>a.id===widget.config.sceneId)?'Personal scene unavailable on this device. Choose a replacement in widget settings.':'A little space. A fresh start.'}</p></div></div>;
};
