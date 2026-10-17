import React, { useState } from 'react';
import { Volume2, VolumeX, Headphones, Check, Upload } from 'lucide-react';
import { SYNTHETIC_SOUNDS, resolveAsset } from '../../services/studioCatalog';
import { studioAudio } from '../../services/studioAudio';
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
