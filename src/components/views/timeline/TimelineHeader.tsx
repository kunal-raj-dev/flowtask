import React from 'react';
import { CalendarDays, RefreshCw, BookOpen } from 'lucide-react';
interface TimelineHeaderProps {
  scheduledCount:number; calendarEventCount:number; calendarIcsUrl:string; combinedPlannedHours:string; targetWorkCapacityHours:number;
  cognitiveTopology:{deepWorkHours:string;adminHours:string;hasHighCognitiveStrain:boolean;strainWarning?:string};
  meetingMinutes:number; totalMeetingHours:string; taskMinutes:number; combinedCapacityPercent:number; isRefreshingFeed:boolean;
  onOpenStudySession?:()=>void; onOpenCalendarModal:()=>void; onRefreshCalendar:()=>void;
}
export const TimelineHeader:React.FC<TimelineHeaderProps> = p => <header className="desk-plan-header">
  <div className="desk-page-header"><div><p className="desk-eyebrow">A realistic rhythm</p><h1>Plan<span className="desk-title-dot">.</span></h1><p className="desk-page-description">Make space for your priorities, one block at a time.</p></div><div className="desk-header-actions">{p.onOpenStudySession&&<button className="desk-button" onClick={p.onOpenStudySession}><BookOpen size={15}/>Study session</button>}<button className="desk-button" onClick={p.onOpenCalendarModal}><CalendarDays size={15}/>{p.calendarIcsUrl?'Calendar settings':'Calendar overlay (.ics)'}</button>{p.calendarIcsUrl&&<button className="desk-icon-button" aria-label="Refresh calendar events" onClick={p.onRefreshCalendar} disabled={p.isRefreshingFeed}><RefreshCw size={16}/></button>}</div></div>
  <div className="desk-plan-budget"><div><strong>{p.combinedPlannedHours}h</strong><span>planned / {p.targetWorkCapacityHours}h capacity</span></div><p>{p.scheduledCount} scheduled tasks{p.meetingMinutes>0?' · '+p.totalMeetingHours+'h calendar events':''}</p><span className={p.combinedCapacityPercent>100?'desk-plan-over':''}>{p.combinedCapacityPercent>100?'Overbooked by '+Math.round((p.taskMinutes+p.meetingMinutes)-p.targetWorkCapacityHours*60)+' minutes':'Room to adjust your day'}</span></div>
</header>;
