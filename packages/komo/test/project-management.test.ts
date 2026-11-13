// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import type { CommentsApi } from "../src/api";
import { projectManagement } from "../src/project-management";

const webhook = {
  url: "",
  events: ["comment.created"],
  enabled: false,
  secretConfigured: false,
  deliveryAvailable: true,
  supportedEvents: ["comment.created", "comment.resolved"],
};
const mount = async (hosted: boolean) => {
  const request = vi.fn((path: string) =>
    Promise.resolve(
      path.startsWith("project/webhook")
        ? webhook
        : { project: "fixture", access: "public", hosted, members: [], invites: [] }
    )
  );
  const panel = projectManagement({ request } as unknown as CommentsApi);
  document.body.append(panel);
  await vi.waitFor(() => expect(panel.textContent).toContain("Download comments"));
  return panel;
};
afterEach(() => document.body.replaceChildren());

it("offers the move to self-hosting only for a hosted project", async () => {
  expect((await mount(true)).textContent).toContain("Move to self-hosting");
  document.body.replaceChildren();
  expect((await mount(false)).textContent).not.toContain("Move to self-hosting");
});

it("lays each webhook checkbox out beside its own label", async () => {
  const panel = await mount(false);
  const rows = [...panel.querySelectorAll("label")].filter((label) =>
    label.querySelector('input[type="checkbox"]')
  );
  expect(rows.map((row) => [row.className, row.textContent])).toEqual([
    ["account-share", "comment.created"],
    ["account-share", "comment.resolved"],
    ["account-share", "Enable delivery"],
  ]);
});
