-- Disposable local PostgreSQL fixture only. Never run this on a live project.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}', is_anonymous boolean default false, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
grant usage on schema auth,public to anon,authenticated;
grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
insert into auth.users(id,raw_user_meta_data,is_anonymous) values
 ('11111111-1111-4111-8111-111111111111','{"username":"Alice","bio":"Alice reads"}',false),
 ('22222222-2222-4222-8222-222222222222','{"username":"Bob","bio":"Bob reads"}',false),
 ('33333333-3333-4333-8333-333333333333','{"username":"Private Reader","bio":"Hidden bio"}',false),
 ('44444444-4444-4444-8444-444444444444','{"username":"Bookworm"}',true);

create table public.ratings(id uuid primary key default gen_random_uuid(),user_id text not null,content text);
create table public.discussion_posts(id uuid primary key default gen_random_uuid(),user_id text not null,content text);
create table public.comments(id uuid primary key default gen_random_uuid(),user_id text not null,content text);
create table public.discussion_likes(id uuid primary key default gen_random_uuid(),user_id text not null);
create table public.books(id uuid primary key default gen_random_uuid(),external_id text unique,title text not null,author text,cover_url text);
alter table public.discussion_posts add column book_id uuid references public.books(id),add column username text,add column contains_spoilers boolean default false,add column created_at timestamptz default now();
alter table public.comments add column post_id uuid references public.discussion_posts(id) on delete cascade;
alter table public.ratings enable row level security;
alter table public.discussion_posts enable row level security;
alter table public.comments enable row level security;
alter table public.discussion_likes enable row level security;
grant all on all tables in schema public to anon,authenticated;
create policy legacy_all on public.ratings for all to public using(true) with check(true);
create policy legacy_insert on public.discussion_posts for insert to public with check(true);
create policy legacy_read on public.discussion_posts for select to public using(true);
create policy legacy_all on public.comments for all to public using(true) with check(true);
create policy legacy_all on public.discussion_likes for all to public using(true) with check(true);

-- Minimal local Storage schema for exercising the actual avatar RLS migration.
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null);
create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated;
grant select,insert,update,delete on storage.objects to anon,authenticated;

-- Original Top 4 table/policies, present before the public-shelf migration.
create table public.profile_top_books (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 book_id uuid not null references public.books(id) on delete cascade,position smallint not null check(position between 1 and 4),
 created_at timestamptz default now(),updated_at timestamptz default now(),unique(user_id,position),unique(user_id,book_id)
);
alter table public.profile_top_books enable row level security;
grant all on public.profile_top_books to anon,authenticated;
create policy "Top books are viewable by everyone" on public.profile_top_books for select using(true);
create policy "Users can add their own top books" on public.profile_top_books for insert with check(auth.uid()=user_id);
create policy "Users can delete their own top books" on public.profile_top_books for delete using(auth.uid()=user_id);
create policy "Users can update their own top books" on public.profile_top_books for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
