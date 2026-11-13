begin;
create table public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.reader_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(comment_id,user_id)
);
create index comment_likes_user_idx on public.comment_likes(user_id);
alter table public.comment_likes enable row level security;
revoke all on public.comment_likes from public,anon,authenticated;
grant select on public.comment_likes to anon,authenticated;
grant insert(comment_id,user_id),delete on public.comment_likes to authenticated;
create policy comment_likes_public_read on public.comment_likes for select to anon,authenticated using(true);
create policy comment_likes_insert_own on public.comment_likes for insert to authenticated
  with check(user_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy comment_likes_delete_own on public.comment_likes for delete to authenticated
  using(user_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
notify pgrst,'reload schema';
commit;
