import type { WorkspacePresentation } from "../types/dashboard";
/** Only bounded presentation metadata is portable; never copy task content here. */
export function normalizePresentation(
  raw: unknown,
): WorkspacePresentation | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const value = raw as Record<string, unknown>;
  if (value.version !== 1) return undefined;
  return {
    version: 1,
    ...(typeof value.offerDismissed === "boolean"
      ? { offerDismissed: value.offerDismissed }
      : {}),
    ...(typeof value.dailyDeskId === "string" &&
    /^[^/\s]{1,200}$/.test(value.dailyDeskId)
      ? { dailyDeskId: value.dailyDeskId }
      : {}),
  };
}
