import { useState, useEffect, useCallback } from 'react';
import { audioEngine, type AmbientSoundType } from '../../utils/audioEngine';

export interface UseFocusAmbientSoundOptions {
  initialSound?: AmbientSoundType;
  initialVolume?: number;
  isActive?: boolean;
}

/**
 * Shared hook to manage ambient soundscape playback, volume, and lifecycle unmount cleanup.
 */
export function useFocusAmbientSound({
  initialSound = 'none',
  initialVolume = 0.5,
  isActive = true,
}: UseFocusAmbientSoundOptions = {}) {
  const [ambientSound, setAmbientSound] = useState<AmbientSoundType>(initialSound);
  const [volume, setVolume] = useState<number>(initialVolume);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      audioEngine.stopAmbientSound();
    };
  }, []);

  // Sync ambient sound playback
  useEffect(() => {
    if (!isActive || ambientSound === 'none') {
      audioEngine.stopAmbientSound();
    } else {
      audioEngine.startAmbientSound(ambientSound, volume);
    }
  }, [isActive, ambientSound, volume]);

  const selectAmbientSound = useCallback((sound: AmbientSoundType) => {
    setAmbientSound(sound);
  }, []);

  const changeVolume = useCallback((newVol: number) => {
    setVolume(newVol);
  }, []);

  return {
    ambientSound,
    setAmbientSound: selectAmbientSound,
    volume,
    setVolume: changeVolume,
  };
}
