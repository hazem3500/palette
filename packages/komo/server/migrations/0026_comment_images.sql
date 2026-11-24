CREATE TABLE comment_images (
  comment_id TEXT PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
  project TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes BLOB NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX comment_images_by_project ON comment_images(project);
CREATE TRIGGER comment_image_quota_insert AFTER INSERT ON comment_images BEGIN
  UPDATE project_quotas SET bytes=bytes+NEW.size+256 WHERE project=NEW.project;
  SELECT RAISE(ABORT, 'komo_quota_exceeded') WHERE EXISTS(SELECT 1 FROM project_quotas WHERE project=NEW.project AND bytes>max_bytes);
  UPDATE threads SET updated_at=MAX(updated_at,NEW.created_at) WHERE id=(SELECT thread_id FROM comments WHERE id=NEW.comment_id);
END;
CREATE TRIGGER comment_image_quota_update AFTER UPDATE OF size ON comment_images BEGIN
  UPDATE project_quotas SET bytes=MAX(0,bytes+NEW.size-OLD.size) WHERE project=NEW.project;
  SELECT RAISE(ABORT, 'komo_quota_exceeded') WHERE EXISTS(SELECT 1 FROM project_quotas WHERE project=NEW.project AND bytes>max_bytes);
  UPDATE threads SET updated_at=MAX(updated_at,NEW.created_at) WHERE id=(SELECT thread_id FROM comments WHERE id=NEW.comment_id);
END;
CREATE TRIGGER comment_image_quota_delete AFTER DELETE ON comment_images BEGIN
  UPDATE project_quotas SET bytes=MAX(0,bytes-OLD.size-256) WHERE project=OLD.project;
END;
