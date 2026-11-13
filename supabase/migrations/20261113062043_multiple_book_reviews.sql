begin;

-- Keep every existing review and its original date. Each ID is now one review.
alter table public.ratings drop constraint ratings_book_id_user_id_key;
create index ratings_book_date_idx on public.ratings(book_id, created_at desc, id desc);
create index ratings_reader_date_idx on public.ratings(user_id, created_at desc, id desc);

create function public.preserve_review_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.book_id is distinct from old.book_id or new.user_id is distinct from old.user_id then
      raise exception 'A review cannot be moved to another book or reader';
    end if;
    new.created_at := old.created_at;
  else
    new.created_at := clock_timestamp();
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.preserve_review_identity() from public, anon, authenticated;
create trigger ratings_preserve_review_identity before insert or update on public.ratings
for each row execute function public.preserve_review_identity();

notify pgrst, 'reload schema';
commit;
