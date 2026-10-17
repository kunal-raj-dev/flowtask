import { getDatabase } from "./dbService";
import type { MediaAsset } from "../types/studio";

export interface PersonalMedia {
  id: string;
  workspaceId: string;
  title: string;
  category: "personal";
  kind: "image" | "audio";
  blob: Blob;
  thumbnail?: Blob;
  createdAt: number;
}
const MEDIA_CACHE = "flowtask-media-v2";
const CACHE_LIMIT = 150 * 1024 * 1024;
export const mediaService = {
  async list(workspaceId: string): Promise<PersonalMedia[]> {
    return (
      (await (await getDatabase()).getAll("media")) as PersonalMedia[]
    ).filter((x) => x.workspaceId === workspaceId);
  },
  async importFile(file: File, workspaceId: string): Promise<PersonalMedia> {
    const image = /^image\/(jpeg|png|webp|avif)$/.test(file.type);
    const audio = /^(audio\/(mpeg|mp3|mp4|aac|x-m4a|ogg|wav|x-wav|webm))$/.test(
      file.type,
    );
    if (!image && !audio)
      throw new Error(
        "Choose a JPG, PNG, WebP, AVIF, MP3, M4A, OGG or WAV file.",
      );
    if (file.size > (image ? 20 : 50) * 1024 * 1024)
      throw new Error(
        `The ${image ? "image" : "audio file"} limit is ${image ? 20 : 50} MB.`,
      );
    const existing = await this.list(workspaceId);
    if (
      existing.reduce(
        (sum, x) => sum + x.blob.size + (x.thumbnail?.size || 0),
        0,
      ) +
        file.size >
      250 * 1024 * 1024
    )
      throw new Error(
        "Your personal library has reached 250 MB. Export or remove a file to make room.",
      );
    let blob: Blob = file,
      thumbnail: Blob | undefined;
    if (image) {
      const bitmap = await createImageBitmap(file).catch(() => {
        throw new Error("This image could not be decoded.");
      });
      const encode = (max: number, quality: number) =>
        new Promise<Blob>((resolve, reject) => {
          const scale = Math.min(
            1,
            max / Math.max(bitmap.width, bitmap.height),
          );
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(bitmap.width * scale);
          canvas.height = Math.round(bitmap.height * scale);
          canvas
            .getContext("2d")!
            .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (result) =>
              result
                ? resolve(result)
                : reject(new Error("Could not optimize this image.")),
            "image/webp",
            quality,
          );
        });
      try {
        blob = await encode(2560, 0.9);
        thumbnail = await encode(400, 0.8);
      } finally {
        bitmap.close();
      }
    } else {
      await new Promise<void>((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const el = new Audio();
        let settled = false;
        const timeout = setTimeout(() => done(false), 10000);
        const done = (valid: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          el.onloadedmetadata = null;
          el.onerror = null;
          el.removeAttribute("src");
          el.load();
          URL.revokeObjectURL(url);
          if (valid) {
            resolve();
          } else {
            reject(
              new Error("This audio file is not playable in this browser."),
            );
          }
        };
        el.onloadedmetadata = () =>
          done(Number.isFinite(el.duration) && el.duration > 0);
        el.onerror = () => done(false);
        el.preload = "metadata";
        el.src = url;
      });
    }
    const record: PersonalMedia = {
      id: `local:${crypto.randomUUID()}`,
      workspaceId,
      title: file.name.replace(/\.[^.]+$/, ""),
      category: "personal",
      kind: image ? "image" : "audio",
      blob,
      thumbnail,
      createdAt: Date.now(),
    };
    try {
      await (await getDatabase()).put("media", record);
    } catch (error) {
      if ((error as Error).name === "QuotaExceededError")
        throw new Error(
          "Device storage is full. Your tasks are safe. Export personal files or clear downloaded media.",
        );
      throw error;
    }
    return record;
  },
  async remove(id: string, workspaceId: string) {
    const db = await getDatabase();
    const asset = (await db.get("media", id)) as PersonalMedia | undefined;
    if (asset?.workspaceId === workspaceId) await db.delete("media", id);
  },
  async downloadPack(
    assets: MediaAsset[],
    progress: (done: number, total: number) => void,
    signal?: AbortSignal,
  ) {
    if (typeof caches === "undefined")
      throw new Error("Offline media is unavailable in this browser.");
    const cache = await caches.open(MEDIA_CACHE);
    let done = 0;
    const urls = [
      ...new Set(
        assets.flatMap(
          (a) => [a.src, a.thumbnail, a.poster].filter(Boolean) as string[],
        ),
      ),
    ];
    let size = 0;
    for (const request of await cache.keys())
      size += (await (await cache.match(request))!.blob()).size;
    for (const url of urls) {
      if (signal?.aborted)
        throw new DOMException("Download cancelled", "AbortError");
      if (!url.startsWith("/media/")) continue;
      if (!(await cache.match(url))) {
        const response = await fetch(url, { signal });
        if (!response.ok)
          throw new Error(
            "A media download failed. Your completed downloads are preserved; try again.",
          );
        const blob = await response.clone().blob();
        if (size + blob.size > CACHE_LIMIT)
          throw new Error(
            "Offline media has reached 150 MB. Clear downloaded media and retry.",
          );
        await cache.put(url, response);
        size += blob.size;
      }
      progress(++done, urls.length);
    }
    await navigator.storage?.persist?.().catch(() => false);
  },
  async clearDownloads() {
    if (typeof caches !== "undefined") await caches.delete(MEDIA_CACHE);
  },
  async usage() {
    const estimate = await navigator.storage?.estimate?.();
    return { usage: estimate?.usage || 0, quota: estimate?.quota || 0 };
  },
};
