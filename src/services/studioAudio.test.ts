import { afterEach, expect, it, vi } from 'vitest';
import type { MediaAsset } from '../types/studio';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('changes mixer gain without restarting a source, and resumes music at its paused position',async()=>{
  vi.resetModules();vi.useFakeTimers();const elements:FakeAudio[]=[];const gains:any[]=[];
  class FakeAudio {src='';currentTime=42;paused=true;loop=false;preload='';crossOrigin='';onended:any;play=vi.fn(async()=>{this.paused=false;});pause=vi.fn(()=>{this.paused=true;});removeAttribute(){}constructor(){elements.push(this);}}
  class Context {state='running';currentTime=1;destination={};createGain(){const gain={gain:{value:0,setTargetAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()};gains.push(gain);return gain;}createDynamicsCompressor(){return{threshold:{value:0},connect:vi.fn()};}createMediaElementSource(){return{connect:vi.fn(),disconnect:vi.fn()};}resume=vi.fn(async()=>{this.state='running';});suspend=vi.fn(async()=>{this.state='suspended';});}
  vi.stubGlobal('Audio',FakeAudio);vi.stubGlobal('AudioContext',Context);const {studioAudio}=await import('./studioAudio');
  const rain:MediaAsset={id:'rain',title:'Rain',category:'ambient',src:'/rain.mp3',license:'CC0',creator:'Test',loop:true};
  const music:MediaAsset={...rain,id:'piano',category:'music',loop:false,src:'/music.mp3'};
  await studioAudio.unlock();await studioAudio.mix([{id:'rain',volume:.3}],{asset:music,volume:.2},[rain,music],.5);
  await studioAudio.mix([{id:'rain',volume:.8}],{asset:music,volume:.4},[rain,music],.7);
  expect(elements).toHaveLength(2);expect(elements[0].play).toHaveBeenCalledTimes(1);expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.8,1,.12);
  studioAudio.pause();await vi.advanceTimersByTimeAsync(450);expect(elements[1].paused).toBe(true);await studioAudio.unlock();await studioAudio.mix([{id:'rain',volume:.8}],{asset:music,volume:.4},[rain,music],.7);
  expect(elements).toHaveLength(2);expect(elements[1].currentTime).toBe(42);expect(elements[1].play).toHaveBeenCalledTimes(2);
  studioAudio.pause();await vi.advanceTimersByTimeAsync(450);await studioAudio.resume();
  expect(elements[1].paused).toBe(false);expect(elements[1].currentTime).toBe(42);expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(.7,1,.08);
  studioAudio.stop();await vi.advanceTimersByTimeAsync(450);
});
