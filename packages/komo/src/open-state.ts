import { forget } from "./storage-keys.js";
import type { CommentsOptions } from "./types.js";

export type ReviewView = { scope: string; thread: string | null; design: boolean };

/** Remembers whether the sidebar was open, per `restoreOpen`. */
export function openState(
  key: string,
  mode: CommentsOptions["restoreOpen"] = "session",
) {
  let store: Storage | undefined;
  try {
    // Drop the old localStorage key so it can't reopen the sidebar.
    if (mode !== "always") forget(localStorage, key);
  } catch {
    /* Storage is blocked. */
  }
  try {
    store =
      mode === "always" ? localStorage : mode ? sessionStorage : undefined;
  } catch {
    /* Start closed when storage is blocked. */
  }
  const viewKey = `${key}:view`;
  return {
    view(scope: string): ReviewView | null {
      try {
        const view = JSON.parse(store?.getItem(viewKey) ?? "null");
        if (view?.scope === scope && typeof view.design === "boolean" &&
          (view.thread === null || typeof view.thread === "string")) return view;
      } catch {
        /* A remembered view is optional. */
      }
      return null;
    },
    setView(view: ReviewView | null) {
      try {
        if (view) store?.setItem(viewKey, JSON.stringify(view));
        else store?.removeItem(viewKey);
      } catch {
        /* Keep the view in memory when storage is blocked. */
      }
    },
    get() {
      try {
        return store?.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    set(open: boolean) {
      try {
        if (open) store?.setItem(key, "1");
        else if (store) forget(store, key);
      } catch {
        /* The sidebar starts closed next time. */
      }
    },
  };
}
