import { timingSafeEqual } from "node:crypto";
import { check, string } from "./validation";
import type { PatAccess } from "./tokens";

const PREFIX = "palette_bot_";
const hash = async (value: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (b) => b.toString(16).padStart(2, "0")).join("");
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
export const isBotToken = (value: string) => value.startsWith(PREFIX);

/** Owner-only issuance. Bot grants never confer project administration. */
export async function createBotToken(env: Env, project: string, owner: string, data: Record<string, unknown>) {
  const name = string(data.name, 80, "bot name");
  const id = crypto.randomUUID();
  const secret = random();
  const userId = `bot:${id}`;
  const now = Date.now();
  const count = await env.DB.prepare("SELECT COUNT(*) AS used FROM project_bot_tokens WHERE project=? AND revoked_at IS NULL").bind(project).first<{ used: number }>();
  check((count?.used ?? 0) < 10, 409, "Revoke a bot token before adding another.");
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users(id,name,verified) VALUES(?,?,1)").bind(userId, name),
    env.DB.prepare("INSERT INTO project_bot_tokens(id,project,user_id,token_hash,created_by,created_at,revoked_at) VALUES(?,?,?,?,?,?,NULL)").bind(id, project, userId, await hash(secret), owner, now),
  ]);
  return { id, userId, name, token: `${PREFIX}${id}_${secret}` };
}

export async function authenticateBotToken(env: Env, bearer: string, project: string, access: PatAccess | undefined, request: Request) {
  const parts = /^palette_bot_([a-f0-9-]{36})_([a-f0-9]{64})$/.exec(bearer);
  const row = parts ? await env.DB.prepare("SELECT b.project,b.token_hash,b.revoked_at,u.id,u.name,u.verified,u.avatar_url FROM project_bot_tokens b JOIN users u ON u.id=b.user_id WHERE b.id=?").bind(parts[1]).first<{project:string;token_hash:string;revoked_at:number|null;id:string;name:string;verified:number;avatar_url?:string}>() : null;
  const given = await hash(parts?.[2] ?? "");
  const stored = row?.token_hash ?? "0".repeat(64);
  check(row && stored.length === given.length && timingSafeEqual(new TextEncoder().encode(stored), new TextEncoder().encode(given)) && row.revoked_at === null && row.project === project, 401, "Invalid or revoked bot token.");
  const path = new URL(request.url).pathname;
  const comments = /^\/threads\/[^/]+\/comments(?:\/[^/]+\/(image|reactions))?$/;
  const action = comments.exec(path);
  const read = request.method === "GET" && (path === "/threads" || path === "/me" || path === "/config" ||
    /^\/threads\/[^/]+\/snapshot(?:\/image)?$/.test(path) || action?.[1] === "image");
  const write = (request.method === "POST" && action && action[1] !== "image") ||
    (request.method === "PUT" && action?.[1] === "image");
  check(access && (read || write), 403, "Bot tokens may read threads, reply, attach reply images and react.");
  return row;
}
