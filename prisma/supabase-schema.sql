do $$ begin
  create type public."AccessLevel" as enum ('FULL', 'OPERATIONAL', 'READ_ONLY', 'CUSTOM');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public."AccessPermission" as enum (
    'PROFILE', 'APPEARANCE', 'LINKS', 'WHATSAPP', 'SOCIALS', 'CATALOG',
    'PRODUCTS', 'PRICES', 'SERVICES', 'PIX', 'WIFI', 'LOCATION',
    'ANALYTICS', 'DOMAIN', 'PUBLISH', 'SETTINGS', 'DELETE_BIOSITE'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public."BioSiteMediaType" as enum ('PHOTO', 'VIDEO');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public."BioSiteMediaUsage" as enum (
    'GALLERY', 'AVATAR', 'LOGO', 'COVER', 'BACKGROUND', 'INTRO'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.bio_sites (
  id text primary key,
  slug text not null unique,
  name text not null,
  status text not null default 'draft',
  avatar_url text,
  logo_url text,
  cover_image_url text,
  intro_video_url text,
  background_type text not null default 'solid',
  background_color text,
  background_gradient text,
  background_image_url text,
  background_video_url text,
  theme jsonb,
  content jsonb,
  photo_limit integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bio_site_media (
  id text primary key default gen_random_uuid()::text,
  bio_site_id text not null references public.bio_sites(id) on delete cascade,
  type public."BioSiteMediaType" not null,
  usage public."BioSiteMediaUsage" not null default 'GALLERY',
  url text not null,
  storage_key text,
  mime_type text,
  file_size integer,
  width integer,
  height integer,
  duration_seconds integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bio_site_access_keys (
  id text primary key default gen_random_uuid()::text,
  bio_site_id text not null references public.bio_sites(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  level public."AccessLevel" not null,
  is_active boolean not null default true,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bio_site_access_permissions (
  access_key_id text not null references public.bio_site_access_keys(id) on delete cascade,
  permission public."AccessPermission" not null,
  allowed boolean not null default true,
  primary key (access_key_id, permission)
);

create index if not exists bio_site_media_site_type_usage_idx
  on public.bio_site_media (bio_site_id, type, usage);
create index if not exists bio_site_media_site_order_idx
  on public.bio_site_media (bio_site_id, sort_order);
create index if not exists bio_site_access_keys_site_active_idx
  on public.bio_site_access_keys (bio_site_id, is_active);
create index if not exists bio_site_access_keys_prefix_idx
  on public.bio_site_access_keys (key_prefix);
