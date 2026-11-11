begin;

alter table public.reader_profiles add column avatar_path text;
alter table public.reader_profiles add constraint reader_avatar_own_folder check (
  avatar_path is null or avatar_path ~ ('^' || user_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
);
grant update (avatar_path) on public.reader_profiles to authenticated;

create or replace view public.reader_cards with (security_invoker = true) as
  select p.user_id, p.display_name, p.bio, p.is_public, p.show_activity, p.created_at,
    (select count(*) from public.reader_follows f where f.following_id = p.user_id) as follower_count,
    (select count(*) from public.reader_follows f where f.follower_id = p.user_id) as following_count,
    p.avatar_path
  from public.reader_profiles p;

-- Profile photos are public assets. Writes are restricted to the owner's UUID
-- folder; anonymous guest sessions cannot upload. No upsert is used.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reader-avatars', 'reader-avatars', true, 1048576, array['image/jpeg']);

create policy reader_avatar_select_own on storage.objects for select to authenticated
  using (bucket_id = 'reader-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
    and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
create policy reader_avatar_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'reader-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
    and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
create policy reader_avatar_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'reader-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
    and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));

notify pgrst, 'reload schema';
commit;
