// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initComments } from "../src/index";
import type { CommentsController, CommentsOptions } from "../src/types";

let controller: CommentsController | undefined;
let requests: { path: string; method: string; body?: string }[];
let server: Record<string, unknown>;
let shareComments: boolean;
const measureRect = HTMLElement.prototype.getBoundingClientRect;
const options: CommentsOptions = {
  endpoint: "https://example.test",
  project: "fixture",
  repo: "fixture",
  branch: "main",
  share: { label: "Post to the GitHub PR" },
};

beforeEach(async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
  Object.defineProperty(document, "elementsFromPoint", { configurable: true, value: () => [] });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  requests = [];
  shareComments = false;
  server = { github: false, guests: true, guestResolve: false, share: true };
  const user = { id: "reviewer", name: "Reviewer", verified: true };
  vi.stubGlobal("fetch", vi.fn(async (url: URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const { pathname } = new URL(url);
    requests.push({ path: pathname, method, body: init?.body as string | undefined });
    if (pathname === "/config") return Response.json(server);
    if (pathname === "/me") return Response.json({ user, settings: { shareComments } });
    if (pathname === "/me/settings") return Response.json({ settings: JSON.parse(init!.body as string) });
    return method === "GET" ? new Promise<Response>(() => {}) : Response.json({ id: "thread-1", commentId: "comment-1" });
  }));
  const { CommentsApi } = await import("../src/api");
  new CommentsApi(options).save({ token: "session", user });
});
afterEach(() => {
  controller?.destroy();
  controller = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  localStorage.clear();
});

async function compose(config: CommentsOptions = options) {
  const target = document.createElement("article");
  target.id = "target";
  document.body.append(target);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this === target ? new DOMRect(10, 10, 400, 300) : measureRect.call(this);
  });
  controller = initComments(config);
  await vi.waitFor(() => expect(requests.some((request) => request.path === "/config")).toBe(true));
  await new Promise((resolve) => setTimeout(resolve, 10));
  const shadow = [...document.body.children].find((node) => node.shadowRoot)!.shadowRoot!;
  controller.comment(target);
  const toggle = () => shadow.querySelector<HTMLInputElement>('[data-focus-key="draft-share"]');
  const send = async () => {
    const input = shadow.querySelector<HTMLTextAreaElement>('[data-focus-key="body"]')!;
    input.value = "Tighten the heading";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await vi.waitFor(() => expect(requests.some((request) => request.path === "/threads" && request.method === "POST")).toBe(true));
    return JSON.parse(requests.find((request) => request.path === "/threads" && request.method === "POST")!.body!);
  };
  return { shadow, toggle, send };
}

it("starts each comment from the account default and posts the reviewer's choice", async () => {
  const { toggle, send } = await compose();
  expect(toggle()?.checked).toBe(false);
  expect(toggle()?.closest("label")?.textContent).toBe("Post to the GitHub PR");
  toggle()!.click();
  expect(await send()).toMatchObject({ share: true });
});

it("sends the account default when the comment's toggle is untouched", async () => {
  const { send } = await compose();
  expect(await send()).toMatchObject({ share: false });
});

it("saves the account default from the Account panel", async () => {
  shareComments = true;
  const { shadow } = await compose();
  shadow.querySelector<HTMLButtonElement>('[aria-label="Reviewer · Account"]')!.click();
  const setting = await vi.waitFor(() => {
    const input = shadow.querySelector<HTMLInputElement>('[data-focus-key="account-share"]');
    expect(input).not.toBeNull();
    return input!;
  });
  expect(setting.checked).toBe(true);
  setting.click();
  await vi.waitFor(() =>
    expect(requests.find((request) => request.path === "/me/settings")).toEqual({
      path: "/me/settings",
      method: "PATCH",
      body: JSON.stringify({ shareComments: false }),
    }),
  );
});

it.each([
  ["the host did not opt in", { ...options, share: undefined }, true],
  ["the server predates sharing", options, false],
])("leaves the comment box and request unchanged when %s", async (_, config, supported) => {
  if (!supported) delete server.share;
  const { toggle, send } = await compose(config);
  expect(toggle()).toBeNull();
  expect(await send()).not.toHaveProperty("share");
});
