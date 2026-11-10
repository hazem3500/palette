// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import type { CommentsController } from "../src/types";

const framed = vi.hoisted(() => ({ value: true }));
vi.mock("../src/frame-target", async (load) => ({
  ...(await load<typeof import("../src/frame-target")>()),
  framedByPalette: () => framed.value,
}));
const { initComments } = await import("../src/index");

const key = Symbol.for("palette.controller");
const slot = window as unknown as Record<symbol, CommentsController | undefined>;
afterEach(() => {
  delete slot[key];
});

// In the viewport iframe `window.parent` is the shell; in this test it is `window` itself.
it("forwards restore() and open() from the framed app to the shell's controller", () => {
  const outer = { restore: vi.fn(), open: vi.fn() } as unknown as CommentsController;
  slot[key] = outer;
  const framedController = initComments({ endpoint: "https://example.test", project: "fixture", repo: "fixture", branch: "main" });
  framedController.restore();
  framedController.open();
  expect(outer.restore).toHaveBeenCalledOnce();
  expect(outer.open).toHaveBeenCalledOnce();
  expect(document.querySelector("[data-branch-comments]")).toBeNull();
});

it("does nothing in the frame when the shell published no controller", () => {
  const framedController = initComments({ endpoint: "https://example.test", project: "fixture", repo: "fixture", branch: "main" });
  expect(() => framedController.restore()).not.toThrow();
});
