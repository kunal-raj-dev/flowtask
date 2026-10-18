import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useStudioPreferences } from './useStudio';
const state=vi.hoisted(()=>({studio:undefined as {sceneId:string}|undefined}));
vi.mock('../context/TaskContext',()=>({useTaskContext:()=>({workspacePreferences:{studio:state.studio},setWorkspacePreference:vi.fn()})}));
afterEach(()=>{cleanup();state.studio=undefined;});
it('opens a new Studio in a still library with silence and manual 25/5 intervals',()=>{
  const {result}=renderHook(useStudioPreferences);
  expect(result.current.preferences).toMatchObject({sceneId:'old-library',layers:[],musicId:null,motionEnabled:false,timer:{focusMinutes:25,shortBreakMinutes:5,autoStart:false}});
});
it('preserves a saved plain background and custom scenes',()=>{
  state.studio={sceneId:''};
  const {result,rerender}=renderHook(useStudioPreferences);
  expect(result.current.preferences.sceneId).toBe('');
  state.studio={sceneId:'local:my-image'};rerender();
  expect(result.current.preferences.sceneId).toBe('local:my-image');
});
