-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('FULL', 'OPERATIONAL', 'READ_ONLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AccessPermission" AS ENUM ('PROFILE', 'APPEARANCE', 'LINKS', 'WHATSAPP', 'SOCIALS', 'CATALOG', 'PRODUCTS', 'PRICES', 'SERVICES', 'PIX', 'WIFI', 'LOCATION', 'ANALYTICS', 'DOMAIN', 'PUBLISH', 'SETTINGS', 'DELETE_BIOSITE');

-- CreateEnum
CREATE TYPE "BioSiteMediaType" AS ENUM ('PHOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "BioSiteMediaUsage" AS ENUM ('GALLERY', 'AVATAR', 'LOGO', 'COVER', 'BACKGROUND', 'INTRO');

-- CreateTable
CREATE TABLE "bio_sites" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "avatar_url" TEXT,
    "logo_url" TEXT,
    "cover_image_url" TEXT,
    "intro_video_url" TEXT,
    "background_type" TEXT NOT NULL DEFAULT 'solid',
    "background_color" TEXT,
    "background_gradient" TEXT,
    "background_image_url" TEXT,
    "background_video_url" TEXT,
    "theme" JSONB,
    "content" JSONB,
    "photo_limit" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bio_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bio_site_media" (
    "id" TEXT NOT NULL,
    "bio_site_id" TEXT NOT NULL,
    "type" "BioSiteMediaType" NOT NULL,
    "usage" "BioSiteMediaUsage" NOT NULL DEFAULT 'GALLERY',
    "url" TEXT NOT NULL,
    "storage_key" TEXT,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bio_site_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bio_site_access_keys" (
    "id" TEXT NOT NULL,
    "bio_site_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "level" "AccessLevel" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bio_site_access_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bio_site_access_permissions" (
    "access_key_id" TEXT NOT NULL,
    "permission" "AccessPermission" NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bio_site_access_permissions_pkey" PRIMARY KEY ("access_key_id","permission")
);

-- CreateIndex
CREATE UNIQUE INDEX "bio_sites_slug_key" ON "bio_sites"("slug");

-- CreateIndex
CREATE INDEX "bio_site_media_bio_site_id_type_usage_idx" ON "bio_site_media"("bio_site_id", "type", "usage");

-- CreateIndex
CREATE INDEX "bio_site_media_bio_site_id_sort_order_idx" ON "bio_site_media"("bio_site_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "bio_site_access_keys_key_hash_key" ON "bio_site_access_keys"("key_hash");

-- CreateIndex
CREATE INDEX "bio_site_access_keys_bio_site_id_is_active_idx" ON "bio_site_access_keys"("bio_site_id", "is_active");

-- CreateIndex
CREATE INDEX "bio_site_access_keys_key_prefix_idx" ON "bio_site_access_keys"("key_prefix");

-- AddForeignKey
ALTER TABLE "bio_site_media" ADD CONSTRAINT "bio_site_media_bio_site_id_fkey" FOREIGN KEY ("bio_site_id") REFERENCES "bio_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bio_site_access_keys" ADD CONSTRAINT "bio_site_access_keys_bio_site_id_fkey" FOREIGN KEY ("bio_site_id") REFERENCES "bio_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bio_site_access_permissions" ADD CONSTRAINT "bio_site_access_permissions_access_key_id_fkey" FOREIGN KEY ("access_key_id") REFERENCES "bio_site_access_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "bio_site_bookings" (
    "id" TEXT NOT NULL,
    "bio_site_id" TEXT NOT NULL,
    "service_id" TEXT,
    "service_name" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT,
    "customer_phone" TEXT,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bio_site_bookings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bio_site_bookings_bio_site_id_status_idx" ON "bio_site_bookings"("bio_site_id", "status");
ALTER TABLE "bio_site_bookings" ADD CONSTRAINT "bio_site_bookings_bio_site_id_fkey" FOREIGN KEY ("bio_site_id") REFERENCES "bio_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "bio_site_leads" (
    "id" TEXT NOT NULL,
    "bio_site_id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bio_site_leads_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bio_site_leads_bio_site_id_created_at_idx" ON "bio_site_leads"("bio_site_id", "created_at");
ALTER TABLE "bio_site_leads" ADD CONSTRAINT "bio_site_leads_bio_site_id_fkey" FOREIGN KEY ("bio_site_id") REFERENCES "bio_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
