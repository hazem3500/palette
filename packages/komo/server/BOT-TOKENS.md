# Project bot tokens

Project owners can create a dedicated comment identity without a Google account:

- `POST /project/bots` with `{"name":"Toki"}` returns the token once, its grant ID and its stable `bot:` user ID.
- `GET /project/bots` lists grant metadata, never hashes or secrets.
- `DELETE /project/bots/{id}` revokes a grant immediately.

Use the token as `Authorization: Bearer …` on the usual project/repo/branch-scoped API. It can read thread context and snapshots and post replies. It cannot create threads, change settings or membership, edit/delete comments, or resolve threads. Private projects check the active project-specific grant. Bot tokens are independent of personal-token proxy policy; only an authenticated Google project owner can issue or revoke them.

Tokens are randomly generated and stored as SHA-256 hashes. Store the returned value in the integration's secret store, never in screenshots, comments or checked-in configuration. Revoke and replace a token to rotate it. There is no expiration in this first API; revocation and the project boundary are the controls.

Webhook bodies now include `authorId` and `commentId`. Consumers should deduplicate by project and comment ID, not author display name or webhook delivery. Ignore `bot:` authors to prevent reply loops. Comment edits do not emit a new-comment event.

Apply the SQLite or PostgreSQL migration before enabling issuance. This is an additive schema change; retain the deployment's database restore point when rolling back to a release that refuses newer schema versions.
