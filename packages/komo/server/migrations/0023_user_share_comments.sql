-- 0 when the reviewer keeps new comments in Palette (webhooks get share: false).
-- NULL or 1 shares them, as before this migration.
ALTER TABLE users ADD COLUMN share_comments INTEGER;
