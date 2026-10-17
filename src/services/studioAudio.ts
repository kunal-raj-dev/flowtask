import type { MediaAsset, MixerLayer } from "../types/studio";
import { useFocusStore } from "../store/useFocusStore";

export interface MediaSessionTrackMetadata {
  title: string;
  artist?: string;
  album?: string;
  artwork?: Array<{ src: string; sizes?: string; type?: string }>;
}

export interface MediaSessionActionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onNextTrack?: () => void;
}

export function updateMediaSessionMetadata(
  track: MediaSessionTrackMetadata,
): void {
  if (
    typeof navigator === "undefined" ||
    !("mediaSession" in navigator) ||
    typeof MediaMetadata === "undefined"
  ) {
    return;
  }

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist || "FlowTask Studio",
      album: track.album || "FlowTask Focus Audio",
      artwork: track.artwork || [
        { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
  } catch (err) {
    console.debug("[MediaSession] Failed to set metadata:", err);
  }
}

export function registerMediaSessionHandlers(
  handlers: MediaSessionActionHandlers,
): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
    return;
  }

  const actions: Array<{ action: MediaSessionAction; handler?: () => void }> = [
    { action: "play", handler: handlers.onPlay },
    { action: "pause", handler: handlers.onPause },
    { action: "stop", handler: handlers.onStop },
    { action: "nexttrack", handler: handlers.onNextTrack },
  ];

  for (const { action, handler } of actions) {
    try {
      if (handler) {
        navigator.mediaSession.setActionHandler(action, handler);
      } else {
        navigator.mediaSession.setActionHandler(action, null);
      }
    } catch (err) {
      console.debug(
        `[MediaSession] Action handler ${action} not supported:`,
        err,
      );
    }
  }
}

interface Channel {
  node: AudioNode;
  gain: GainNode;
  element?: HTMLAudioElement;
  source?: AudioBufferSourceNode;
}

/** One app-level audio graph. Updating gain never recreates a source. */
class StudioAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private channels = new Map<string, Channel>();
  private generation = 0;
  private pauseTimer: ReturnType<typeof setTimeout> | undefined;
  private currentMusicId: string | null = null;
  private lastVolume = 0.5;

  private initMediaSession() {
    registerMediaSessionHandlers({
      onPlay: () => {
        void this.resume().catch((error) =>
          window.dispatchEvent(
            new CustomEvent("flowtask:audio-error", {
              detail: (error as Error).message,
            }),
          ),
        );
        window.dispatchEvent(new Event("flowtask:media-play"));
      },
      onPause: () => {
        this.pause();
        window.dispatchEvent(new Event("flowtask:media-pause"));
      },
      onStop: () => {
        this.stop();
        window.dispatchEvent(new Event("flowtask:media-stop"));
      },
      onNextTrack: () => {
        if (this.currentMusicId) {
          window.dispatchEvent(
            new CustomEvent("flowtask:music-ended", {
              detail: this.currentMusicId,
            }),
          );
        }
      },
    });
  }

  private updateMediaSessionPlayback(
    musicAsset?: MediaAsset,
    hasActiveAudio = false,
  ) {
    this.initMediaSession();

    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    if (musicAsset) {
      this.currentMusicId = musicAsset.id;
      const focusSession = useFocusStore.getState().focusSession;
      const title =
        musicAsset.title ||
        (focusSession?.taskTitle
          ? `Focus: ${focusSession.taskTitle}`
          : "Deep Focus Session");
      const artist = musicAsset.creator || "FlowTask Studio";
      const album = musicAsset.genre
        ? `Focus Studio · ${musicAsset.genre}`
        : "FlowTask Focus Audio";
      const artwork = musicAsset.thumbnail
        ? [{ src: musicAsset.thumbnail, sizes: "512x512", type: "image/png" }]
        : [
            {
              src: "/brand/icon-512.png",
              sizes: "512x512",
              type: "image/png",
            },
          ];

      updateMediaSessionMetadata({ title, artist, album, artwork });
      navigator.mediaSession.playbackState = "playing";
    } else if (hasActiveAudio) {
      const focusSession = useFocusStore.getState().focusSession;
      const title = focusSession?.taskTitle
        ? `Focus: ${focusSession.taskTitle}`
        : "Deep Focus Soundscape";
      updateMediaSessionMetadata({
        title,
        artist: "FlowTask Studio",
        album: "Ambient Soundscape",
      });
      navigator.mediaSession.playbackState = "playing";
    }
  }

  private getContext() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -6;
      this.master.connect(limiter);
      limiter.connect(this.context.destination);
    }
    return this.context;
  }

  async unlock() {
    clearTimeout(this.pauseTimer);
    const context = this.getContext();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        context.resume(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(new Error("Press Play to enable audio in this browser.")),
            2000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }

  setVolume(id: string, level: number) {
    const gain = id === "master" ? this.master : this.channels.get(id)?.gain;
    if (gain && this.context)
      gain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, level)),
        this.context.currentTime,
        0.08,
      );
  }

  async mix(
    layers: MixerLayer[],
    music: { asset?: MediaAsset; volume: number },
    assets: MediaAsset[],
    volume: number,
  ) {
    const generation = ++this.generation;
    this.lastVolume = Math.max(0, Math.min(1, volume));
    clearTimeout(this.pauseTimer);
    const context = this.getContext();
    if (context.state !== "running") await this.unlock();
    const wanted = new Map(
      layers.slice(0, 4).map((l) => [l.id, l.muted ? 0 : l.volume]),
    );
    if (music.asset) wanted.set(music.asset.id, music.volume);
    this.master!.gain.setTargetAtTime(
      Math.max(0, Math.min(1, volume)),
      context.currentTime,
      0.08,
    );
    for (const [id, channel] of this.channels)
      if (!wanted.has(id)) this.remove(id, channel);
    for (const [id, level] of wanted) {
      let channel = this.channels.get(id);
      if (!channel) {
        const gain = context.createGain();
        gain.gain.value = 0;
        gain.connect(this.master!);
        if (["brown", "pink", "white"].includes(id)) {
          const buffer = context.createBuffer(
            1,
            context.sampleRate * 5,
            context.sampleRate,
          );
          const output = buffer.getChannelData(0);
          let last = 0,
            b0 = 0,
            b1 = 0,
            b2 = 0;
          for (let i = 0; i < output.length; i++) {
            const white = Math.random() * 2 - 1;
            if (id === "brown") {
              last = (last + 0.02 * white) / 1.02;
              output[i] = last * 3.5;
            } else if (id === "pink") {
              b0 = 0.99765 * b0 + white * 0.099046;
              b1 = 0.963 * b1 + white * 0.2965164;
              b2 = 0.57 * b2 + white * 1.0526913;
              output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
            } else output[i] = white * 0.25;
          }
          // Remove the loop-boundary step without a periodic fade in the body of the noise.
          const drift = output[output.length - 1] - output[0];
          for (let i = 0; i < output.length; i++)
            output[i] -= drift * (i / (output.length - 1));
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.connect(gain);
          source.start();
          channel = { gain, node: source, source };
        } else {
          const asset =
            assets.find((a) => a.id === id) ||
            (music.asset?.id === id ? music.asset : undefined);
          if (!asset?.src) {
            gain.disconnect();
            continue;
          }
          const element = new Audio();
          element.crossOrigin = "anonymous";
          element.preload = "none";
          element.loop = asset.loop !== false;
          element.src = asset.src;
          if (!element.loop)
            element.onended = () =>
              window.dispatchEvent(
                new CustomEvent("flowtask:music-ended", { detail: id }),
              );
          const node = context.createMediaElementSource(element);
          node.connect(gain);
          channel = { gain, node, element };
          this.channels.set(id, channel);
          try {
            await element.play();
          } catch {
            this.remove(id, channel);
            throw new Error(
              `Could not play ${asset.title}. Try Play again or choose another sound.`,
            );
          }
          if (generation !== this.generation) continue;
        }
        this.channels.set(id, channel);
      }
      if (channel.element?.paused) await channel.element.play();
      channel.gain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, level)),
        context.currentTime,
        0.12,
      );
    }

    const hasActiveAudio = wanted.size > 0;
    this.updateMediaSessionPlayback(music.asset, hasActiveAudio);
  }

  private remove(id: string, channel: Channel) {
    this.channels.delete(id);
    const context = this.context;
    if (!context) return;
    channel.gain.gain.setTargetAtTime(0, context.currentTime, 0.08);
    setTimeout(() => {
      channel.element?.pause();
      channel.element?.removeAttribute("src");
      try {
        channel.source?.stop();
      } catch {
        /* already stopped */
      }
      channel.node.disconnect();
      channel.gain.disconnect();
    }, 400);
  }

  pause() {
    clearTimeout(this.pauseTimer);
    const context = this.context;
    if (!context) return;
    this.master?.gain.setTargetAtTime(0, context.currentTime, 0.08);
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
    this.pauseTimer = setTimeout(() => {
      for (const channel of this.channels.values()) channel.element?.pause();
      void context.suspend();
    }, 400);
  }

  /** OS Play also resumes a soundscape that continued after its timer finished. */
  async resume() {
    if (!this.channels.size) return;
    const generation = this.generation;
    await this.unlock();
    if (generation !== this.generation) return;
    for (const channel of this.channels.values())
      if (channel.element?.paused) await channel.element.play();
    if (generation !== this.generation) return;
    this.master?.gain.setTargetAtTime(
      this.lastVolume,
      this.context!.currentTime,
      0.08,
    );
    if (typeof navigator !== "undefined" && "mediaSession" in navigator)
      navigator.mediaSession.playbackState = "playing";
  }

  stop() {
    clearTimeout(this.pauseTimer);
    this.generation++;
    this.currentMusicId = null;
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "none";
    }
    for (const [id, channel] of this.channels) this.remove(id, channel);
  }
}

export const studioAudio = new StudioAudio();
