import React, { useState } from 'react';
import { Volume2, VolumeX, Headphones, Check, Upload } from 'lucide-react';
import { SYNTHETIC_SOUNDS, resolveAsset } from '../../services/studioCatalog';
import { studioAudio } from '../../services/studioAudio';
import { audioEngine } from '../../utils/audioEngine';
import type { StudioPreferences, FocusStudioPreferences, MediaCatalog, MediaAsset, MixerLayer } from '../../types/studio';

export interface FocusAudioPanelProps {
  preferences: StudioPreferences | FocusStudioPreferences;
  media: MediaCatalog;
  musicMissing?: boolean;
  onUpdate: (updates: Partial<StudioPreferences>) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void> | void;
  onMessage?: (message: string) => void;
  Range: React.ComponentType<{
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (v: number) => void;
    onPreview?: (v: number) => void;
  }>;
}

export const FocusAudioPanel: React.FC<FocusAudioPanelProps> = ({
  preferences: p,
  media,
  musicMissing,
  onUpdate: update,
  onUpload: upload,
  onMessage,
  Range,
}) => {
  const [genre, setGenre] = useState<string>('all');

  const [rainVol, setRainVol] = useState(() => audioEngine.getTrackVolume('rain') || 0.1);
  const [noiseType, setNoiseType] = useState<'brown' | 'pink'>('brown');
  const [noiseVol, setNoiseVol] = useState(() => audioEngine.getTrackVolume('brown') || 0.12);
  const [binauralVol, setBinauralVol] = useState(() => audioEngine.getTrackVolume('binaural') || 0.08);

  const [rainPlaying, setRainPlaying] = useState(() => audioEngine.isTrackPlaying('rain'));
  const [noisePlaying, setNoisePlaying] = useState(
    () => audioEngine.isTrackPlaying('brown') || audioEngine.isTrackPlaying('pink')
  );
  const [binauralPlaying, setBinauralPlaying] = useState(() => audioEngine.isTrackPlaying('binaural'));

  const toggleTrack = (type: 'rain' | 'brown' | 'pink' | 'binaural', vol: number) => {
    if (audioEngine.isTrackPlaying(type)) {
      audioEngine.stopTrack(type, 0.4);
      if (type === 'rain') setRainPlaying(false);
      else if (type === 'brown' || type === 'pink') setNoisePlaying(false);
      else if (type === 'binaural') setBinauralPlaying(false);
    } else {
      audioEngine.startTrack(type, vol);
      if (type === 'rain') setRainPlaying(true);
      else if (type === 'brown' || type === 'pink') setNoisePlaying(true);
      else if (type === 'binaural') setBinauralPlaying(true);
    }
  };

  const toggleLayer = (asset: MediaAsset) => {
    void studioAudio.unlock().catch(() => {});
    const exists = p.layers.some((l: MixerLayer) => l.id === asset.id);
    if (exists) {
      update({ layers: p.layers.filter((l: MixerLayer) => l.id !== asset.id) });
    } else if (p.layers.length >= 4) {
      onMessage?.(
        'You can mix up to four ambient layers. Remove a layer to add this one.'
      );
    } else {
      update({
        layers: [...p.layers, { id: asset.id, volume: 0.35, muted: false }],
      });
    }
  };

  return (
    <>
      <p className="studio-panel-intro">
        A little rain, a little rhythm. Or the beauty of silence.
      </p>
      {musicMissing && (
        <p className="studio-help">
          Your personal music is only available on the device where it
          was uploaded. Choose a built-in track here.
        </p>
      )}
      <Range
        onPreview={(v) => studioAudio.setVolume('master', v)}
        label="Master volume"
        value={p.masterVolume}
        onChange={(v) => update({ masterVolume: v })}
      />
      <button
        type="button"
        className="studio-secondary"
        onClick={() => update({ layers: [], musicId: null })}
      >
        <VolumeX size={15} />
        Choose silence
      </button>
      <h3>
        Ambient layers <small>{p.layers.length}/4</small>
      </h3>
      <div className="studio-sound-grid">
        {[
          ...SYNTHETIC_SOUNDS,
          ...media.audio.filter((a: MediaAsset) => a.category === 'ambient'),
        ].map((a: MediaAsset) => (
          <button
            type="button"
            key={a.id}
            aria-pressed={p.layers.some((l: MixerLayer) => l.id === a.id)}
            onClick={() => toggleLayer(a)}
          >
            <Volume2 size={15} />
            {a.title}
            {p.layers.some((l: MixerLayer) => l.id === a.id) && <Check size={14} />}
          </button>
        ))}
      </div>
      {p.layers.map((layer: MixerLayer) => (
        <div className="studio-layer" key={layer.id}>
          <Range
            onPreview={(v) => studioAudio.setVolume(layer.id, v)}
            label={
              SYNTHETIC_SOUNDS.find((s: MediaAsset) => s.id === layer.id)?.title ||
              media.audio.find((a: MediaAsset) => a.id === layer.id)?.title ||
              `${layer.id} noise`
            }
            value={layer.volume}
            onChange={(v) =>
              update({
                layers: p.layers.map((l: MixerLayer) =>
                  l.id === layer.id ? { ...l, volume: v } : l
                ),
              })
            }
          />
          <div>
            <button
              type="button"
              aria-label={`Mute ${layer.id}`}
              aria-pressed={Boolean(layer.muted)}
              onClick={() =>
                update({
                  layers: p.layers.map((l: MixerLayer) =>
                    l.id === layer.id ? { ...l, muted: !l.muted } : l
                  ),
                })
              }
            >
              <VolumeX size={14} />
            </button>
            <button
              type="button"
              aria-label={`Solo ${layer.id}`}
              onClick={() =>
                update({
                  layers: p.layers.map((l: MixerLayer) => ({
                    ...l,
                    muted: l.id !== layer.id,
                  })),
                })
              }
            >
              Solo
            </button>
          </div>
        </div>
      ))}
      <div className="studio-concurrent-mixer space-y-3 mt-4 pt-4 border-t border-white/10">
        <h3>Synthesized Soundscapes <small>Concurrent Mixer</small></h3>

        {/* Rain Track */}
        <div className="studio-layer flex flex-col gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                rainPlaying
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/[0.04] border-white/10 text-[var(--text-secondary)]'
              }`}
              onClick={() => toggleTrack('rain', rainVol)}
            >
              <Volume2 size={13} />
              <span>Rain Sound</span>
              {rainPlaying && <Check size={12} />}
            </button>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {Math.round(rainVol * 100)}%
            </span>
          </div>
          {rainPlaying && (
            <Range
              label="Rain Volume"
              value={rainVol}
              onChange={(v) => {
                setRainVol(v);
                audioEngine.setTrackVolume('rain', v);
              }}
              onPreview={(v) => audioEngine.setTrackVolume('rain', v)}
            />
          )}
        </div>

        {/* Brown / Pink Noise Track */}
        <div className="studio-layer flex flex-col gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                  noisePlaying
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-white/[0.04] border-white/10 text-[var(--text-secondary)]'
                }`}
                onClick={() => toggleTrack(noiseType, noiseVol)}
              >
                <Volume2 size={13} />
                <span>{noiseType === 'brown' ? 'Brown Noise' : 'Pink Noise'}</span>
                {noisePlaying && <Check size={12} />}
              </button>
              <div className="flex items-center gap-1 text-[11px] font-mono">
                <button
                  type="button"
                  className={`px-1.5 py-0.5 rounded cursor-pointer ${noiseType === 'brown' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-[var(--text-muted)] hover:text-white'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (noiseType === 'brown') return;
                    setNoiseType('brown');
                    if (noisePlaying) {
                      audioEngine.stopTrack('pink', 0.2);
                      audioEngine.startTrack('brown', noiseVol);
                    }
                  }}
                >
                  Brown
                </button>
                <span className="text-[var(--text-muted)]">/</span>
                <button
                  type="button"
                  className={`px-1.5 py-0.5 rounded cursor-pointer ${noiseType === 'pink' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-[var(--text-muted)] hover:text-white'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (noiseType === 'pink') return;
                    setNoiseType('pink');
                    if (noisePlaying) {
                      audioEngine.stopTrack('brown', 0.2);
                      audioEngine.startTrack('pink', noiseVol);
                    }
                  }}
                >
                  Pink
                </button>
              </div>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {Math.round(noiseVol * 100)}%
            </span>
          </div>
          {noisePlaying && (
            <Range
              label={`${noiseType === 'brown' ? 'Brown' : 'Pink'} Noise Volume`}
              value={noiseVol}
              onChange={(v) => {
                setNoiseVol(v);
                audioEngine.setTrackVolume(noiseType, v);
              }}
              onPreview={(v) => audioEngine.setTrackVolume(noiseType, v)}
            />
          )}
        </div>

        {/* Binaural Beats Track */}
        <div className="studio-layer flex flex-col gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                binauralPlaying
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/[0.04] border-white/10 text-[var(--text-secondary)]'
              }`}
              onClick={() => toggleTrack('binaural', binauralVol)}
            >
              <Volume2 size={13} />
              <span>Binaural Beats (40Hz)</span>
              {binauralPlaying && <Check size={12} />}
            </button>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {Math.round(binauralVol * 100)}%
            </span>
          </div>
          {binauralPlaying && (
            <Range
              label="Binaural Beats Volume"
              value={binauralVol}
              onChange={(v) => {
                setBinauralVol(v);
                audioEngine.setTrackVolume('binaural', v);
              }}
              onPreview={(v) => audioEngine.setTrackVolume('binaural', v)}
            />
          )}
        </div>
      </div>

      <h3>Music for your moment</h3>
      <select
        aria-label="Music genre"
        value={genre}
        onChange={(e) => setGenre(e.target.value)}
      >
        <option value="all">All genres</option>
        {[
          ...new Set<string>(
            media.audio
              .filter((a: MediaAsset) => a.category === 'music')
              .map((a: MediaAsset) => a.genre || 'Instrumental')
          ),
        ].map((g: string) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      <div className="studio-track-list">
        {media.audio
          .filter(
            (a: MediaAsset) =>
              a.category === 'music' &&
              (genre === 'all' || a.genre === genre)
          )
          .map((a: MediaAsset) => (
            <div
              key={a.id}
              className={
                resolveAsset(p.musicId, media.audio)?.id === a.id
                  ? 'selected'
                  : ''
              }
            >
              <button
                type="button"
                onClick={() =>
                  update({
                    musicId: p.musicId === a.id ? null : a.id,
                  })
                }
                aria-pressed={
                  resolveAsset(p.musicId, media.audio)?.id === a.id
                }
              >
                <span className="studio-track-icon">
                  <Headphones size={17} />
                </span>
                <span>
                  {a.title}
                  <small>
                    {a.genre} · {a.creator}
                  </small>
                </span>
                {resolveAsset(p.musicId, media.audio)?.id === a.id && (
                  <Check size={16} />
                )}
              </button>
              <small className="studio-credit">
                {a.license}{' '}
                {a.sourceUrl && (
                  <a
                    href={a.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source & license
                  </a>
                )}
              </small>
            </div>
          ))}
      </div>
      <Range
        onPreview={(v) => {
          const asset = resolveAsset(p.musicId, media.audio);
          if (asset) studioAudio.setVolume(asset.id, v);
        }}
        label="Music volume"
        value={p.musicVolume}
        onChange={(v) => update({ musicVolume: v })}
      />
      <label className="studio-upload">
        <Upload size={16} />
        Add personal music
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => void upload(e)}
          hidden
        />
      </label>
      <p className="studio-help">
        Personal audio up to 50 MB. Playback begins with your session.
      </p>
      <label className="studio-check">
        <input
          type="checkbox"
          checked={p.continueAudioOnFinish}
          onChange={(e) =>
            update({ continueAudioOnFinish: e.target.checked })
          }
        />
        Keep audio playing after a completed session
      </label>
      <div className="studio-external">
        <a
          href="https://open.spotify.com/"
          target="_blank"
          rel="noreferrer"
        >
          Open Spotify ↗
        </a>
        <a
          href="https://www.youtube.com/"
          target="_blank"
          rel="noreferrer"
        >
          Open YouTube ↗
        </a>
      </div>
      <details className="studio-details">
        <summary>Sound credits</summary>
        {media.audio
          .filter((a: MediaAsset) => a.category === 'ambient' && a.sourceUrl)
          .map((a: MediaAsset) => (
            <p className="studio-credit" key={a.id}>
              {a.title} · {a.creator} · {a.license}{' '}
              <a href={a.sourceUrl} target="_blank" rel="noreferrer">
                Source
              </a>
            </p>
          ))}
      </details>
    </>
  );
};
