CREATE TABLE comment_images (
  comment_id text PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
  project text NOT NULL,
  mime text NOT NULL,
  bytes bytea NOT NULL,
  size integer NOT NULL,
  created_at bigint NOT NULL
);
CREATE INDEX comment_images_by_project ON comment_images(project);
CREATE FUNCTION komo_comment_image_quota() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM komo_quota(NEW.project,0,NEW.size+256);
  ELSIF TG_OP='UPDATE' THEN
    PERFORM komo_quota(NEW.project,0,NEW.size-OLD.size);
  ELSE
    PERFORM komo_quota(OLD.project,0,-(OLD.size+256));
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER comment_image_quota AFTER INSERT OR UPDATE OR DELETE ON comment_images FOR EACH ROW EXECUTE FUNCTION komo_comment_image_quota();
