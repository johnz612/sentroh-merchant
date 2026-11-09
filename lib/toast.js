import { create } from "zustand";

/** One short message at a time at the bottom of the screen, e.g. "Saved." It hides by itself. */
export const useToast = create(() => ({ toast: null }));

let timer = null;

/** Shows a short message. kind: "ok" (default) or "error". */
export function toast(text, kind = "ok") {
  if (!text) return;
  clearTimeout(timer);
  useToast.setState({ toast: { text: String(text), kind, id: Date.now() } });
  timer = setTimeout(() => useToast.setState({ toast: null }), kind === "error" ? 4000 : 2500);
}
