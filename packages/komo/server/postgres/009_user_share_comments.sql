-- 0 when the reviewer keeps new comments in Palette; NULL or 1 shares them.
ALTER TABLE users ADD COLUMN share_comments integer;
