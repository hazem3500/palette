// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initComments } from "../src/index";
import type { CommentsController, CommentsOptions } from "../src/types";

let controller: CommentsController | undefined;
const options: CommentsOptions = { endpoint: "https://example.test", project: "fixture", repo: "fixture", branch: "main" };
const dismissKey = "palette:toolbar-dismissed:fixture:fixture";
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  Object.defineProperty(document, "elementsFromPoint", { configurable: true, value: () => [] });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  controller?.destroy();
  controller = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  sessionStorage.clear();
  localStorage.clear();
});

const toolbar = () => document.querySelector("[data-branch-comments]")!.shadowRoot!.querySelector<HTMLElement>(".toolbar")!;

it("restore() brings back a dismissed toolbar without opening the sidebar", () => {
  sessionStorage.setItem(dismissKey, "1");
  controller = initComments(options);
  expect(toolbar().style.display).toBe("none");
  controller.restore();
  expect(toolbar().style.display).toBe("");
  expect(sessionStorage.getItem(dismissKey)).toBeNull();
  expect(sessionStorage.getItem("palette:open:fixture:fixture")).toBeNull();
});

it("publishes the controller for a framed app until it is destroyed", () => {
  const slot = window as unknown as Record<symbol, CommentsController | undefined>;
  const key = Symbol.for("palette.controller");
  controller = initComments(options);
  expect(slot[key]).toBe(controller);
  controller.destroy();
  expect(slot[key]).toBeUndefined();
});
