/**
 * Web Audio API multi-operator FM synthesizer & tactile earcon engine for FlowTask Workstation 2.0.
 * Re-exports the unified canonical singleton from src/utils/audioEngine to prevent state drift.
 */

export * from '../utils/audioEngine';
export { audioEngine, AudioEngine, type SoundProfile, type AmbientSoundType } from '../utils/audioEngine';
