ALTER TABLE "bio_sites" ADD COLUMN IF NOT EXISTS "owner_id" TEXT;

CREATE INDEX IF NOT EXISTS "bio_sites_owner_id_idx" ON "bio_sites"("owner_id");
