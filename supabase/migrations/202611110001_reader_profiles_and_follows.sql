begin;

-- Only community-facing fields belong here. Never copy email addresses,
-- authentication tokens, Want to Read, or other private account data.
create table public.reader_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 24),
  bio text not null default '' check (char_length(bio) <= 160),
  is_public boolean not null default true,
  show_activity boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reader_follows (
  follower_id uuid not null references public.reader_profiles(user_id) on delete cascade,
  following_id uuid not null references public.reader_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint reader_follows_not_self check (follower_id <> following_id)
);

create index reader_follows_following_created_idx on public.reader_follows (following_id, created_at desc);
create index reader_follows_follower_created_idx on public.reader_follows (follower_id, created_at desc);

alter table public.reader_profiles enable row level security;
alter table public.reader_follows enable row level security;

create policy reader_profiles_read on public.reader_profiles for select to anon, authenticated
  using (is_public or user_id = (select auth.uid()));
create policy reader_profiles_insert_own on public.reader_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
create policy reader_profiles_update_own on public.reader_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));

create policy reader_follows_read on public.reader_follows for select to anon, authenticated
  using (
    follower_id = (select auth.uid()) or following_id = (select auth.uid()) or (
      exists (select 1 from public.reader_profiles p where p.user_id = follower_id and p.is_public)
      and exists (select 1 from public.reader_profiles p where p.user_id = following_id and p.is_public)
    )
  );
create policy reader_follows_insert_own on public.reader_follows for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false)
    and exists (select 1 from public.reader_profiles p where p.user_id = follower_id and p.is_public)
    and exists (select 1 from public.reader_profiles p where p.user_id = following_id and p.is_public)
  );
create policy reader_follows_delete_own on public.reader_follows for delete to authenticated
  using (follower_id = (select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));

-- The view uses the caller's permissions and RLS, not its owner's privileges.
create view public.reader_cards with (security_invoker = true) as
  select p.user_id, p.display_name, p.bio, p.is_public, p.show_activity, p.created_at,
    (select count(*) from public.reader_follows f where f.following_id = p.user_id) as follower_count,
    (select count(*) from public.reader_follows f where f.follower_id = p.user_id) as following_count
  from public.reader_profiles p;

-- Override Supabase's default grants for these new objects explicitly.
revoke all on public.reader_profiles, public.reader_follows, public.reader_cards from public, anon, authenticated;
grant select on public.reader_profiles, public.reader_follows, public.reader_cards to anon, authenticated;
grant insert (user_id, display_name, bio, is_public, show_activity) on public.reader_profiles to authenticated;
grant update (is_public, show_activity) on public.reader_profiles to authenticated;
grant insert (follower_id, following_id) on public.reader_follows to authenticated;
grant delete on public.reader_follows to authenticated;

-- Keep the existing account editor as the source of truth for display name/bio.
-- A user's privacy choices are retained when account metadata changes.
create function public.aepilog_sync_reader_profile() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
  insert into public.reader_profiles (user_id, display_name, bio)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'username'), ''), 'Reader'), 24),
    left(coalesce(new.raw_user_meta_data->>'bio', ''), 160)
  )
  on conflict (user_id) do update
    set display_name = excluded.display_name, bio = excluded.bio, updated_at = now();
  return new;
end;
$$;
revoke all on function public.aepilog_sync_reader_profile() from public, anon, authenticated;

create trigger aepilog_reader_profile_sync
after insert or update of raw_user_meta_data, is_anonymous on auth.users
for each row execute function public.aepilog_sync_reader_profile();

insert into public.reader_profiles (user_id, display_name, bio, created_at)
select id,
  left(coalesce(nullif(btrim(raw_user_meta_data->>'username'), ''), 'Reader'), 24),
  left(coalesce(raw_user_meta_data->>'bio', ''), 160),
  coalesce(created_at, now())
from auth.users where not coalesce(is_anonymous, false)
on conflict (user_id) do nothing;

notify pgrst, 'reload schema';
commit;
