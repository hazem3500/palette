// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initComments } from "../src/index";
import type { CommentsController } from "../src/types";

const endpoint = "https://example.test";
const options = { endpoint, project: "fixture", repo: "fixture", branch: "main" };
const user = { id: "google:1", name: "reviewer", verified: true };
let controller: CommentsController | undefined;
let starts = 0;

beforeEach(() => {
  starts = 0;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
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
  localStorage.clear();
  sessionStorage.clear();
});

function serve(silentSignIn: boolean) {
  const fetch = vi.fn((url: URL, init?: RequestInit) => {
    if (url.pathname.endsWith("/config"))
      return Promise.resolve(Response.json({ google: true, github: false, guests: false, guestResolve: false, silentSignIn }));
    if (url.pathname.endsWith("/auth/google/start")) {
      starts++;
      return Promise.resolve(Response.json({ url: `${endpoint}/backoffice/auth/google/authorize?state=s` }));
    }
    const signedIn = new Headers(init?.headers).get("Authorization") === "Bearer session";
    if (url.pathname.endsWith("/threads") && signedIn)
      return Promise.resolve(Response.json({ threads: [] }));
    return Promise.resolve(Response.json({ error: "Sign in to see comments." }, { status: 401 }));
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
const signInFrame = () =>
  vi.waitFor(() => {
    const frame = document.querySelector<HTMLIFrameElement>("iframe[hidden]");
    expect(frame).not.toBeNull();
    return frame!;
  });
const post = (source: Window | null, origin = endpoint) =>
  window.dispatchEvent(
    new MessageEvent("message", {
      origin,
      source,
      data: { type: "branch-comments:auth", token: "session", user },
    }),
  );

it("signs in from a hidden frame without a click when the server allows it", async () => {
  const fetch = serve(true);
  controller = initComments(options);
  const frame = await signInFrame();
  expect(new URL(frame.src).searchParams.get("frame")).toBe("1");
  expect(frame.getAttribute("aria-hidden")).toBe("true");

  // Only the frame the client opened, on the sign-in origin, can sign in.
  post(window);
  post(frame.contentWindow, "https://elsewhere.test");
  expect(document.contains(frame)).toBe(true);
  post(frame.contentWindow);

  await vi.waitFor(() => expect(document.contains(frame)).toBe(false));
  expect(localStorage.getItem(`palette:${endpoint}:fixture`)).toBe("session");
  await vi.waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url, init]) =>
          url.pathname.endsWith("/threads") &&
          new Headers(init?.headers).get("Authorization") === "Bearer session",
      ),
    ).toBe(true),
  );
});

it("shows no sign-in notice while the silent sign-in is under way", async () => {
  serve(true);
  controller = initComments(options);
  const frame = await signInFrame();
  await new Promise((resolve) => setTimeout(resolve, 50));
  post(frame.contentWindow);
  await vi.waitFor(() => expect(document.contains(frame)).toBe(false));

  const notices = [...document.querySelectorAll("*")].flatMap((node) => [
    ...(node.shadowRoot?.querySelectorAll(".floating-notice") ?? []),
  ]);
  expect(notices.map((notice) => notice.textContent)).toEqual([]);
});

it("tries once per tab, so a reviewer the proxy has not signed in is not retried on reload", async () => {
  serve(true);
  controller = initComments(options);
  await signInFrame();
  controller.destroy();
  expect(document.querySelector("iframe[hidden]")).toBeNull();

  controller = initComments(options);
  await vi.waitFor(() => expect(document.body.children.length).toBeGreaterThan(0));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(starts).toBe(1);
  expect(document.querySelector("iframe[hidden]")).toBeNull();
});

it("leaves sign-in to the button when the server does not offer silent sign-in", async () => {
  const fetch = serve(false);
  controller = initComments(options);
  await vi.waitFor(() => expect(fetch.mock.calls.some(([url]) => url.pathname.endsWith("/config"))).toBe(true));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(starts).toBe(0);
  expect(document.querySelector("iframe")).toBeNull();
});
