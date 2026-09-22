CREATE TABLE "client_accounts" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_accounts_email_key" ON "client_accounts"("email");

CREATE TABLE "client_sessions" (
  "id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_sessions_token_hash_key" ON "client_sessions"("token_hash");
CREATE INDEX "client_sessions_account_id_expires_at_idx" ON "client_sessions"("account_id", "expires_at");
ALTER TABLE "client_sessions" ADD CONSTRAINT "client_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bio_sites" ADD COLUMN IF NOT EXISTS "client_account_id" TEXT;
CREATE INDEX IF NOT EXISTS "bio_sites_client_account_id_idx" ON "bio_sites"("client_account_id");
ALTER TABLE "bio_sites" ADD CONSTRAINT "bio_sites_client_account_id_fkey" FOREIGN KEY ("client_account_id") REFERENCES "client_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;