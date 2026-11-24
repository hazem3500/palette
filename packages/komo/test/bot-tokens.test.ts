import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import { authenticateBotToken } from "../server/bot-tokens";

const id = "12345678-1234-1234-1234-123456789abc";
const secret = "a".repeat(64);
const token = `palette_bot_${id}_${secret}`;
const row = {
  id: `bot:${id}`, project: "fixture", name: "Toki", verified: 1,
  token_hash: createHash("sha256").update(secret).digest("hex"), revoked_at: null,
};
const env = (overrides = {}) => ({
  DB: { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first: async () => ({ ...row, ...overrides }) })) })) },
}) as unknown as Env;
const request = (path: string, method = "GET") => new Request(`https://example.test${path}`, { method });

it("allows a project bot to read context, reply, attach and react as itself", async () => {
  for (const path of ["/threads", "/threads/t/snapshot", "/threads/t/snapshot/image", "/threads/t/comments/c/image", "/me", "/config"])
    expect((await authenticateBotToken(env(), token, "fixture", "read", request(path))).id).toBe(row.id);
  for (const [path, method] of [
    ["/threads/t/comments", "POST"],
    ["/threads/t/comments/c/reactions", "POST"],
    ["/threads/t/comments/c/image", "PUT"],
  ]) expect((await authenticateBotToken(env(), token, "fixture", "write", request(path, method))).name).toBe("Toki");
});
it("rejects administration, edits, new threads and missing route grants", async () => {
  for (const [path, method] of [["/project", "GET"], ["/threads", "POST"], ["/threads/t", "PATCH"], ["/threads/t/comments/c", "DELETE"], ["/threads/t/comments/c/image", "DELETE"]])
    await expect(authenticateBotToken(env(), token, "fixture", "write", request(path, method))).rejects.toThrow();
  await expect(authenticateBotToken(env(), token, "fixture", undefined, request("/threads"))).rejects.toThrow();
});
it("rejects wrong project, revoked tokens and wrong secrets", async () => {
  await expect(authenticateBotToken(env(), token, "other", "read", request("/threads"))).rejects.toThrow();
  await expect(authenticateBotToken(env({ revoked_at: 1 }), token, "fixture", "read", request("/threads"))).rejects.toThrow();
  await expect(authenticateBotToken(env(), token.slice(0, -1) + "b", "fixture", "read", request("/threads"))).rejects.toThrow();
});
