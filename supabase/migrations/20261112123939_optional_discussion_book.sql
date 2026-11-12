-- General discussions may have no attached book. Existing foreign keys and ownership policies remain in force.
alter table public.discussion_posts alter column book_id drop not null;
