begin;

-- Preserve public reading and legacy records. Restrictive policies add an
-- ownership requirement even when older permissive "Anyone can ..." rules exist.
create policy aepilog_ratings_insert_owner on public.ratings as restrictive for insert to public
  with check ((select auth.uid()) is not null and user_id::text = (select auth.uid())::text and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
create policy aepilog_ratings_update_owner on public.ratings as restrictive for update to public
  using ((select auth.uid()) is not null and user_id::text = (select auth.uid())::text)
  with check (user_id::text = (select auth.uid())::text and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
create policy aepilog_ratings_delete_owner on public.ratings as restrictive for delete to public
  using ((select auth.uid()) is not null and user_id::text = (select auth.uid())::text and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));

create policy aepilog_posts_insert_owner on public.discussion_posts as restrictive for insert to public
  with check ((select auth.uid()) is not null and user_id::text = (select auth.uid())::text and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
create policy aepilog_posts_update_guard on public.discussion_posts as restrictive for update to public
  using ((select auth.uid()) is not null and user_id::text = (select auth.uid())::text)
  with check (user_id::text = (select auth.uid())::text and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
create policy aepilog_posts_delete_guard on public.discussion_posts as restrictive for delete to public
  using ((select auth.uid()) is not null and user_id::text = (select auth.uid())::text and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
create policy aepilog_posts_update_owner on public.discussion_posts for update to authenticated
  using (user_id::text = (select auth.uid())::text) with check (user_id::text = (select auth.uid())::text);
create policy aepilog_posts_delete_owner on public.discussion_posts for delete to authenticated
  using (user_id::text = (select auth.uid())::text);

create policy aepilog_comments_insert_owner on public.comments as restrictive for insert to public
  with check ((select auth.uid()) is not null and user_id::text = (select auth.uid())::text and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
create policy aepilog_comments_update_owner on public.comments as restrictive for update to public
  using ((select auth.uid()) is not null and user_id::text = (select auth.uid())::text)
  with check (user_id::text = (select auth.uid())::text and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
create policy aepilog_comments_delete_owner on public.comments as restrictive for delete to public
  using ((select auth.uid()) is not null and user_id::text = (select auth.uid())::text and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));

create policy aepilog_likes_insert_owner on public.discussion_likes as restrictive for insert to public
  with check ((select auth.uid()) is not null and user_id::text = (select auth.uid())::text and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
create policy aepilog_likes_delete_owner on public.discussion_likes as restrictive for delete to public
  using ((select auth.uid()) is not null and user_id::text = (select auth.uid())::text and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));

notify pgrst, 'reload schema';
commit;
