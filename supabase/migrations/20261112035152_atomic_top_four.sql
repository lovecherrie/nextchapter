begin;

-- Every statement runs in the caller's transaction and under existing RLS.
-- Lock only this account's profile to serialize simultaneous shelf saves.
create function public.save_top_four(p_books uuid[], p_positions smallint[]) returns void
language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := (select auth.uid());
begin
  if owner_id is null or coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) then
    raise exception 'Sign in to save your shelf' using errcode = '42501';
  end if;
  if p_books is null or p_positions is null or cardinality(p_books) <> cardinality(p_positions)
    or cardinality(p_books) > 4 then raise exception 'Choose up to four books'; end if;
  if exists(select 1 from unnest(p_books,p_positions) as b(book_id,position) where book_id is null or position is null or position not between 1 and 4)
    or (select count(distinct b) from unnest(p_books) as b) <> cardinality(p_books)
    or (select count(distinct p) from unnest(p_positions) as p) <> cardinality(p_positions)
    then raise exception 'Each shelf position and book must be unique'; end if;
  perform 1 from public.reader_profiles where user_id = owner_id for update;
  if not found then raise exception 'Reader profile unavailable' using errcode = '42501'; end if;
  delete from public.profile_top_books where user_id = owner_id;
  insert into public.profile_top_books(user_id,book_id,position)
    select owner_id,b.book_id,b.position from unnest(p_books,p_positions) as b(book_id,position);
end;
$$;
revoke all on function public.save_top_four(uuid[],smallint[]) from public, anon;
grant execute on function public.save_top_four(uuid[],smallint[]) to authenticated;
notify pgrst, 'reload schema';
commit;
