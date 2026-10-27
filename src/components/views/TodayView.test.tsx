import { act as flushRender } from '@testing-library/react';
// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TodayView } from './TodayView';
import type { Task } from '../../types/task';
const state = vi.hoisted(() => ({ seconds:0, estimate:30, updateDashboards:vi.fn(), setPreference:vi.fn() }));
const task:Task={id:'today-task',title:'Solve Priority Problem',status:'todo',priority:'p1',projectId:'inbox',createdAt:1,plannedDate:'2026-10-07',topThreeDate:'2026-10-07',isPinnedToday:true,estimatedMinutes:30,subtasks:[]};
vi.mock('../../context/TaskContext',()=>({useTaskContext:()=>({activeView:'today',tasks:[{...task,estimatedMinutes:state.estimate}],projects:[{id:'inbox',name:'Inbox',color:'#64748B'}],smartViews:[],workspacePreferences:{},workspaceId:'local',updateDashboards:state.updateDashboards,setWorkspacePreference:state.setPreference,focusLogs:[],focusSession:null,totalFocusedTodaySeconds:state.seconds,settings:{targetWorkCapacityHours:6},toggleTaskStatus:vi.fn(),toggleTaskPinToday:vi.fn(),updateTask:vi.fn(),deleteTask:vi.fn()})}));
vi.mock('../../hooks/useCurrentDate',()=>({useTodayStr:()=> '2026-10-07',getTodayStr:()=> '2026-10-07',getTomorrowStr:()=> '2026-10-08'}));
vi.mock('react-grid-layout',()=>({useContainerWidth:()=>({width:1200,mounted:true,containerRef:{current:null}}),ResponsiveGridLayout:({children}:{children:React.ReactNode})=><div>{children}</div>}));
describe('Today workspace composition',()=>{
  beforeEach(()=>{state.seconds=0;state.estimate=30;vi.clearAllMocks();});
  it('presents one day header, visible capture and a separate planning budget',async ()=>{
    await flushRender(async () => (render(<TodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()}/>)));
    expect(screen.getByRole('heading',{name:'Today.'})).toBeDefined();
    expect(screen.getByRole('textbox',{name:'Add a task to this list'})).toBeDefined();
    expect(screen.getByText('A DAY THAT FITS')).toBeDefined();
    expect(screen.getByLabelText('Day capacity details').textContent).toContain('0.5h planned·5.5h available');
    expect(screen.queryByText(/Focus Session in Progress/)).toBeNull();
  });
  it('reports recorded focus in the capacity widget without another timer banner',async ()=>{
    state.seconds=4500;
    await flushRender(async () => (render(<TodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()}/>)));
    expect(screen.getByText('1h 15m focused')).toBeDefined();
  });
  it('hands the selected priority to Focus Studio',async ()=>{
    const focus=vi.fn(); await flushRender(async () => (render(<TodayView onSelectTask={vi.fn()} onStartFocus={focus}/>)));
    fireEvent.click(screen.getByRole('button',{name:'Focus on Solve Priority Problem'}));
    expect(focus).toHaveBeenCalledWith('today-task');
  });
  it('opens guided day planning from the single header action',async ()=>{
    await flushRender(async () => (render(<TodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()}/>)));
    fireEvent.click(screen.getByRole('button',{name:'Plan my day'}));
    expect(screen.getByRole('dialog',{name:'Make room for today'})).toBeDefined();
  });
  it('shows a descriptive overload warning using the shared capacity projection',async ()=>{
    state.estimate=480;
    await flushRender(async () => (render(<TodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()}/>)));
    expect(screen.getByText(/Overbooked by 120 minutes/)).toBeDefined();
  });
  it('previews optional groups and restores the saved layout on Cancel',async ()=>{
    await flushRender(async () => (render(<TodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()}/>)));
    fireEvent.click(screen.getByRole('button',{name:'Layout'}));
    fireEvent.click(screen.getByRole('menuitem',{name:'Customize Today'}));
    const dialog=screen.getByRole('dialog',{name:'Customize Today'});
    expect((within(dialog).getByRole('checkbox',{name:'Show Capture'}) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole('checkbox',{name:'Show Priorities'}));
    expect(document.querySelector('[aria-label="Top 3 Priorities"]')).not.toBeNull();
    expect(state.setPreference).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button',{name:'Cancel'}));
    expect(document.querySelector('[aria-label="Top 3 Priorities"]')).toBeNull();
    expect(state.setPreference).not.toHaveBeenCalled();
  });
  it('applies section order and visibility together and resets only the draft',async ()=>{
    await flushRender(async () => (render(<TodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()}/>)));
    fireEvent.click(screen.getByRole('button',{name:'Layout'}));
    fireEvent.click(screen.getByRole('menuitem',{name:'Customize Today'}));
    const dialog=screen.getByRole('dialog',{name:'Customize Today'});
    fireEvent.click(within(dialog).getByRole('checkbox',{name:'Show Priorities'}));
    fireEvent.click(within(dialog).getByRole('button',{name:'Reset layout'}));
    expect((within(dialog).getByRole('checkbox',{name:'Show Priorities'}) as HTMLInputElement).checked).toBe(false);
    expect(state.setPreference).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('checkbox',{name:'Show Priorities'}));
    fireEvent.click(within(dialog).getByRole('button',{name:'Move Priorities up'}));
    fireEvent.click(within(dialog).getByRole('button',{name:'Apply layout'}));
    expect(state.setPreference).toHaveBeenCalledWith('workspace',expect.objectContaining({todayLayout:expect.objectContaining({version:1,sections:expect.arrayContaining([{id:'priorities',visible:true}])})}));
    const saved=state.setPreference.mock.calls[0][1].todayLayout;
    expect(saved.sections.map((section:{id:string})=>section.id).slice(0,3)).toEqual(['capture','priorities','capacity']);
  });
});
