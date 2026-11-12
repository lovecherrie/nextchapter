begin;

alter table public.reader_profiles add column show_top_books boolean not null default true;
grant update (show_top_books) on public.reader_profiles to authenticated;
create or replace view public.reader_cards with (security_invoker = true) as
  select p.user_id, p.display_name, p.bio, p.is_public, p.show_activity, p.created_at,
    (select count(*) from public.reader_follows f where f.following_id = p.user_id) as follower_count,
    (select count(*) from public.reader_follows f where f.follower_id = p.user_id) as following_count,
    p.avatar_path, p.show_top_books
  from public.reader_profiles p;

-- These four legacy policies already exist on the original Top 4 table.
-- Public shelves obey both profile visibility and the independent shelf setting.
-- Owners retain access to their own shelf when either setting is off.
drop policy "Top books are viewable by everyone" on public.profile_top_books;
drop policy "Users can add their own top books" on public.profile_top_books;
drop policy "Users can delete their own top books" on public.profile_top_books;
drop policy "Users can update their own top books" on public.profile_top_books;
alter table public.profile_top_books enable row level security;
create policy top_books_read on public.profile_top_books for select to anon, authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from public.reader_profiles p where p.user_id = profile_top_books.user_id and p.is_public and p.show_top_books
  ));
create policy top_books_insert_own on public.profile_top_books for insert to authenticated
  with check (user_id = (select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
create policy top_books_update_own on public.profile_top_books for update to authenticated
  using (user_id = (select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false))
  with check (user_id = (select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
create policy top_books_delete_own on public.profile_top_books for delete to authenticated
  using (user_id = (select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
revoke all on public.profile_top_books from public, anon, authenticated;
grant select on public.profile_top_books to anon, authenticated;
grant insert (user_id, book_id, position) on public.profile_top_books to authenticated;
grant update (book_id, position) on public.profile_top_books to authenticated;
grant delete on public.profile_top_books to authenticated;

notify pgrst, 'reload schema';
commit;
