-- BlackMusic 3.0.0 — Music Portable Sync (FEAT-12). METADATA ONLY: no audio is ever stored here.
-- Apply with `supabase db push`, or paste into the Supabase SQL editor.
-- Every table is user-scoped by Row Level Security. The app ships ONLY the anon key; never a service-role key.

create table if not exists public.sync_devices (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  platform text not null default 'unknown',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Logical tracks. `fingerprint` identifies the SAME song across devices (never a file path).
create table if not exists public.sync_tracks (
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null check (char_length(fingerprint) <= 128),
  title text not null,
  artist text not null default '',
  album text not null default '',
  duration_ms integer not null default 0,
  genre text, year integer, composer text, country text, mood text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, fingerprint)
);

-- Which devices hold which track (so another device can offer "available on <device>"). No paths.
create table if not exists public.sync_track_presence (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.sync_devices(id) on delete cascade,
  fingerprint text not null,
  folder_name text,
  size_bytes bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id, fingerprint)
);

-- Folder NAMES per device (IMP-08 replication by name only).
create table if not exists public.sync_folders (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.sync_devices(id) on delete cascade,
  name text not null,
  parent_name text,
  track_count integer not null default 0,
  total_bytes bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id, name)
);

create table if not exists public.sync_playlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  description text not null default '',
  mood text,
  pinned boolean not null default false,
  track_fingerprints jsonb not null default '[]'::jsonb,
  created_at_ms bigint not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,            -- tombstone: a deletion must sync, or an old device would resurrect it
  primary key (user_id, id)
);

create table if not exists public.sync_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, fingerprint)
);

-- Listening events. `op_id` makes retries idempotent (a retried upload can't duplicate an event).
create table if not exists public.sync_plays (
  user_id uuid not null references auth.users(id) on delete cascade,
  op_id text not null,
  fingerprint text not null,
  played_at timestamptz not null,
  primary key (user_id, op_id)
);

create index if not exists sync_tracks_updated on public.sync_tracks (user_id, updated_at);
create index if not exists sync_playlists_updated on public.sync_playlists (user_id, updated_at);
create index if not exists sync_favorites_updated on public.sync_favorites (user_id, updated_at);
create index if not exists sync_plays_time on public.sync_plays (user_id, played_at);

-- Row Level Security: each user sees and changes ONLY their own rows.
do $$
declare t text;
begin
  foreach t in array array['sync_devices','sync_tracks','sync_track_presence','sync_folders','sync_playlists','sync_favorites','sync_plays'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s own rows" on public.%1$I', t);
    execute format('create policy "%1$s own rows" on public.%1$I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;


-- "Disable sync and delete remote metadata" — callable by the signed-in user; never touches local music.
create or replace function public.sync_delete_my_data() returns void
language sql security invoker set search_path = public as $$
  delete from public.sync_plays where user_id = (select auth.uid());
  delete from public.sync_favorites where user_id = (select auth.uid());
  delete from public.sync_playlists where user_id = (select auth.uid());
  delete from public.sync_folders where user_id = (select auth.uid());
  delete from public.sync_track_presence where user_id = (select auth.uid());
  delete from public.sync_tracks where user_id = (select auth.uid());
  delete from public.sync_devices where user_id = (select auth.uid());
$$;

-- FEAT-14 — device-to-device audio. Songs travel DIRECTLY between your devices (WebRTC). Supabase Realtime only relays the tiny
-- connection set-up messages (offers / answers / network candidates), on a PRIVATE channel only you can read or write.
-- Nothing is stored; no audio ever touches Supabase, so it can't count against storage or egress limits.
drop policy if exists "bm p2p read" on realtime.messages;
create policy "bm p2p read" on realtime.messages for select to authenticated
  using ((select realtime.topic()) = 'p2p:' || (select auth.uid())::text and realtime.messages.extension = 'broadcast');
drop policy if exists "bm p2p write" on realtime.messages;
create policy "bm p2p write" on realtime.messages for insert to authenticated
  with check ((select realtime.topic()) = 'p2p:' || (select auth.uid())::text and realtime.messages.extension = 'broadcast');
