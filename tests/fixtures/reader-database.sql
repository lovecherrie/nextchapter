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
