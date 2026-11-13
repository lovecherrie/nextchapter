begin;

-- Curated catalogue corrections are public to read; clients cannot overwrite them.
create table public.book_genres (
  book_id uuid primary key references public.books(id) on delete cascade,
  genres text[] not null default '{}'::text[]
);
alter table public.book_genres enable row level security;
revoke all on public.book_genres from anon, authenticated;
grant select on public.book_genres to anon, authenticated;
grant all on public.book_genres to service_role;
create policy book_genres_public_read on public.book_genres for select to anon, authenticated using (true);

-- NULL preserves the default whole-book behaviour of every existing post.
alter table public.discussion_posts add column section_label text
  check (section_label is null or section_label = 'epilogue' or section_label ~ '^chapter:([1-9][0-9]{0,2}|1000)$');
notify pgrst, 'reload schema';
commit;
