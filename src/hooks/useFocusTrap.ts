import { useEffect, useRef, type RefObject } from "react";

export function useFocusTrap(
  root: RefObject<HTMLElement | null>,
  onEscape: () => void,
  enabled = true,
) {
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  }, [onEscape]);
  useEffect(() => {
    if (!enabled || !root.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const items = () =>
      [
        ...(root.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,a[href],[tabindex="0"]',
        ) || []),
      ].filter(
        (el) =>
          el.getClientRects().length > 0 &&
          getComputedStyle(el).visibility !== "hidden",
      );
    (items()[0] || root.current)?.focus();
    const handle = (event: KeyboardEvent) => {
      if (
        [...document.querySelectorAll('[aria-modal="true"]')].at(-1) !==
        root.current
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        escape.current();
      }
      if (event.key === "Tab") {
        const list = items();
        const first = list[0],
          last = list.at(-1);
        if (!first) {
          event.preventDefault();
          root.current?.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === root.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle, true);
    return () => {
      document.removeEventListener("keydown", handle, true);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [root, enabled]);
}
