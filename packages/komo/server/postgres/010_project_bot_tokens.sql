CREATE TABLE project_bot_tokens (
  id text PRIMARY KEY,
  project text NOT NULL,
  user_id text NOT NULL REFERENCES users(id),
  token_hash text NOT NULL,
  created_by text NOT NULL REFERENCES users(id),
  created_at bigint NOT NULL,
  revoked_at bigint
);
CREATE INDEX project_bot_tokens_project ON project_bot_tokens(project);
