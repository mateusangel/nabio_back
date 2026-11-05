ALTER TABLE "bio_site_leads"
  ADD COLUMN "message" TEXT,
  ADD COLUMN "referral_code" TEXT,
  ADD COLUMN "lead_type" TEXT NOT NULL DEFAULT 'quote',
  ADD COLUMN "requested_service" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "bio_site_leads_bio_site_id_phone_key"
  ON "bio_site_leads"("bio_site_id", "phone");

INSERT INTO "bio_site_leads" (
  "id", "bio_site_id", "name", "email", "phone", "message", "referral_code",
  "lead_type", "requested_service", "created_at", "updated_at"
)
SELECT
  COALESCE(lead->>'id', gen_random_uuid()::text),
  site."id",
  lead->>'name',
  lead->>'email',
  NULLIF(regexp_replace(COALESCE(lead->>'whatsapp', lead->>'phone', ''), '\D', '', 'g'), ''),
  lead->>'message',
  lead->>'referralCode',
  COALESCE(lead->>'leadType', 'booking'),
  COALESCE(lead->>'requestedService', lead->>'lastService'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "bio_sites" AS site
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(site."content"->'leads') = 'array' THEN site."content"->'leads'
    ELSE '[]'::jsonb
  END
) AS lead
ON CONFLICT ("bio_site_id", "phone") DO NOTHING;

CREATE TABLE "bio_site_referrals" (
  "id" TEXT NOT NULL,
  "bio_site_id" TEXT NOT NULL,
  "referral_code" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "referred_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bio_site_referrals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bio_site_referrals_event_type_check" CHECK ("event_type" IN ('visit', 'signup')),
  CONSTRAINT "bio_site_referrals_bio_site_id_fkey"
    FOREIGN KEY ("bio_site_id") REFERENCES "bio_sites"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "bio_site_referrals_bio_site_id_event_type_created_at_idx"
  ON "bio_site_referrals"("bio_site_id", "event_type", "created_at");
CREATE INDEX "bio_site_referrals_bio_site_id_referral_code_idx"
  ON "bio_site_referrals"("bio_site_id", "referral_code");
CREATE UNIQUE INDEX "bio_site_referrals_bio_site_id_event_type_referred_user_id_key"
  ON "bio_site_referrals"("bio_site_id", "event_type", "referred_user_id");
