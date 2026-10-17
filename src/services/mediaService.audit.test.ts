import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { mediaService } from "./mediaService";
import { getDatabase } from "./dbService";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(["image/svg+xml", "text/html", "application/octet-stream"])(
  "rejects unsupported uploads (%s) before reading storage",
  async (type) => {
    await expect(
      mediaService.importFile(
        new File(["bad"], "unsupported", { type }),
        "upload-audit",
      ),
    ).rejects.toThrow(/Choose a JPG/);
  },
);
it.each([
  ["image/png", 20],
  ["audio/mpeg", 50],
] as const)(
  "enforces the %s upload limit before decoding",
  async (type, limit) => {
    const file = new File(["x"], "oversized", { type });
    Object.defineProperty(file, "size", { value: limit * 1024 * 1024 + 1 });
    await expect(mediaService.importFile(file, "upload-audit")).rejects.toThrow(
      new RegExp(limit + " MB"),
    );
  },
);
it("rejects corrupted image content without adding a personal media record", async () => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockRejectedValue(new Error("Decode failed")),
  );
  await expect(
    mediaService.importFile(
      new File(["bad"], "corrupted.png", { type: "image/png" }),
      "corrupt-upload",
    ),
  ).rejects.toThrow(/could not be decoded/);
  expect(await mediaService.list("corrupt-upload")).toEqual([]);
});
it("keeps account libraries isolated and refuses removal through a different account", async () => {
  const db = await getDatabase();
  const first = {
    id: "audit-media-a",
    workspaceId: "media-a",
    title: "Private image A",
    kind: "image",
    category: "personal",
    blob: new Blob(["a"]),
    createdAt: 1,
  };
  await db.put("media", first);
  await db.put("media", {
    ...first,
    id: "audit-media-b",
    workspaceId: "media-b",
    title: "Private image B",
  });
  expect((await mediaService.list("media-a")).map((file) => file.id)).toEqual([
    "audit-media-a",
  ]);
  await mediaService.remove(first.id, "media-b");
  expect(await db.get("media", first.id)).toBeTruthy();
  await mediaService.remove(first.id, "media-a");
  expect(await db.get("media", first.id)).toBeUndefined();
  expect((await mediaService.list("media-b")).map((file) => file.id)).toEqual([
    "audit-media-b",
  ]);
});
it("reports a full personal library before attempting to decode another file", async () => {
  vi.spyOn(mediaService, "list").mockResolvedValue([
    {
      id: "full",
      workspaceId: "full-library",
      title: "Stored audio",
      kind: "audio",
      category: "personal",
      blob: { size: 250 * 1024 * 1024 } as Blob,
      createdAt: 1,
    },
  ]);
  await expect(
    mediaService.importFile(
      new File(["x"], "another.png", { type: "image/png" }),
      "full-library",
    ),
  ).rejects.toThrow(/250 MB/);
});
