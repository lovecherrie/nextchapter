begin;
create table public.buddy_reads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.reader_profiles(user_id) on delete cascade,
  book_id uuid not null references public.books(id),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  created_at timestamptz not null default now()
);
create table public.buddy_read_members (
  read_id uuid not null references public.buddy_reads(id) on delete cascade,
  user_id uuid not null references public.reader_profiles(user_id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key(read_id,user_id)
);
create table public.buddy_read_invites (
  read_id uuid primary key references public.buddy_reads(id) on delete cascade,
  token uuid not null unique default gen_random_uuid()
);
create table public.buddy_read_messages (
  id uuid primary key default gen_random_uuid(),
  read_id uuid not null references public.buddy_reads(id) on delete cascade,
  user_id uuid not null references public.reader_profiles(user_id) on delete cascade,
  display_name text not null,
  chapter smallint not null default 0 check(chapter between 0 and 1000),
  content text not null check(char_length(btrim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index buddy_reads_owner_idx on public.buddy_reads(owner_id);
create index buddy_reads_book_idx on public.buddy_reads(book_id);
create index buddy_members_user_idx on public.buddy_read_members(user_id,joined_at desc);
create index buddy_messages_read_created_idx on public.buddy_read_messages(read_id,created_at desc,id);
create index buddy_messages_user_idx on public.buddy_read_messages(user_id);

-- Private helpers avoid recursive membership policies. They check the caller's
-- verified ID; no caller-supplied reader ID is used as an authorization claim.
create function aepilog_private.is_buddy_member(p_read uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    and exists(select 1 from public.buddy_read_members m where m.read_id=p_read and m.user_id=auth.uid());
$$;
revoke all on function aepilog_private.is_buddy_member(uuid) from public,anon,authenticated;
grant usage on schema aepilog_private to authenticated;
grant execute on function aepilog_private.is_buddy_member(uuid) to authenticated;

alter table public.buddy_reads enable row level security;
alter table public.buddy_read_members enable row level security;
alter table public.buddy_read_invites enable row level security;
alter table public.buddy_read_messages enable row level security;
revoke all on public.buddy_reads,public.buddy_read_members,public.buddy_read_invites,public.buddy_read_messages from public,anon,authenticated;
grant select,delete on public.buddy_reads,public.buddy_read_members,public.buddy_read_messages to authenticated;
grant insert(id,owner_id,book_id,title) on public.buddy_reads to authenticated;
grant insert(read_id,user_id,display_name) on public.buddy_read_members to authenticated;
grant insert(read_id) on public.buddy_read_invites to authenticated;
grant select on public.buddy_read_invites to authenticated;
grant update(token) on public.buddy_read_invites to authenticated;
grant insert(id,read_id,user_id,display_name,chapter,content) on public.buddy_read_messages to authenticated;

create policy buddy_reads_read on public.buddy_reads for select to authenticated
  using ((owner_id=(select auth.uid()) or aepilog_private.is_buddy_member(id)) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy buddy_reads_create on public.buddy_reads for insert to authenticated
  with check (owner_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy buddy_reads_delete on public.buddy_reads for delete to authenticated
  using (owner_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy buddy_members_read on public.buddy_read_members for select to authenticated
  using (aepilog_private.is_buddy_member(read_id));
create policy buddy_members_create_owner on public.buddy_read_members for insert to authenticated
  with check(user_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
    and exists(select 1 from public.buddy_reads r where r.id=read_id and r.owner_id=(select auth.uid()))
    and display_name=(select display_name from public.reader_profiles where user_id=(select auth.uid())));
create policy buddy_members_leave on public.buddy_read_members for delete to authenticated
  using(aepilog_private.is_buddy_member(read_id)
    and exists(select 1 from public.buddy_reads r where r.id=read_id and r.owner_id<>user_id
      and (public.buddy_read_members.user_id=(select auth.uid()) or r.owner_id=(select auth.uid()))));
create policy buddy_invites_read_owner on public.buddy_read_invites for select to authenticated
  using(exists(select 1 from public.buddy_reads r where r.id=read_id and r.owner_id=(select auth.uid())));
create policy buddy_invites_create_owner on public.buddy_read_invites for insert to authenticated
  with check(not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
    and exists(select 1 from public.buddy_reads r where r.id=read_id and r.owner_id=(select auth.uid())));
create policy buddy_invites_rotate_owner on public.buddy_read_invites for update to authenticated
  using(exists(select 1 from public.buddy_reads r where r.id=read_id and r.owner_id=(select auth.uid())))
  with check(exists(select 1 from public.buddy_reads r where r.id=read_id and r.owner_id=(select auth.uid())));
create policy buddy_messages_read on public.buddy_read_messages for select to authenticated
  using(aepilog_private.is_buddy_member(read_id));
create policy buddy_messages_create on public.buddy_read_messages for insert to authenticated
  with check(aepilog_private.is_buddy_member(read_id) and user_id=(select auth.uid())
    and display_name=(select m.display_name from public.buddy_read_members m where m.read_id=public.buddy_read_messages.read_id and m.user_id=(select auth.uid())));
create policy buddy_messages_delete on public.buddy_read_messages for delete to authenticated
  using(aepilog_private.is_buddy_member(read_id) and (user_id=(select auth.uid())
    or exists(select 1 from public.buddy_reads r where r.id=read_id and r.owner_id=(select auth.uid()))));

create function public.create_buddy_read(p_book uuid,p_title text,p_id uuid default gen_random_uuid()) returns uuid
language plpgsql security invoker set search_path='' as $$
declare reader_name text;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in to start a buddy read' using errcode='42501'; end if;
  if exists(select 1 from public.buddy_reads where id=p_id and owner_id=auth.uid()) then return p_id; end if;
  select display_name into strict reader_name from public.reader_profiles where user_id=auth.uid();
  insert into public.buddy_reads(id,owner_id,book_id,title) values(p_id,auth.uid(),p_book,btrim(p_title));
  insert into public.buddy_read_members(read_id,user_id,display_name) values(p_id,auth.uid(),reader_name);
  insert into public.buddy_read_invites(read_id) values(p_id);
  return p_id;
end;
$$;
revoke all on function public.create_buddy_read(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.create_buddy_read(uuid,text,uuid) to authenticated;

-- Knowing the unguessable invite token permits joining, never reading beforehand.
-- The lock makes capacity checks and concurrent joins consistent.
create function aepilog_private.join_buddy_with_token(p_token uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare target uuid; reader_name text;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in to join' using errcode='42501'; end if;
  select r.id into target from public.buddy_reads r join public.buddy_read_invites i on i.read_id=r.id where i.token=p_token for update of r;
  if target is null then raise exception 'This invite is no longer available' using errcode='22023'; end if;
  select display_name into strict reader_name from public.reader_profiles where user_id=auth.uid();
  if exists(select 1 from public.buddy_read_members where read_id=target and user_id=auth.uid()) then return target; end if;
  if (select count(*) from public.buddy_read_members where read_id=target)>=50 then raise exception 'This buddy read is full' using errcode='22023'; end if;
  insert into public.buddy_read_members(read_id,user_id,display_name) values(target,auth.uid(),reader_name);
  return target;
end;
$$;
revoke all on function aepilog_private.join_buddy_with_token(uuid) from public,anon,authenticated;
grant execute on function aepilog_private.join_buddy_with_token(uuid) to authenticated;
create function public.join_buddy_read(p_token uuid) returns uuid
language sql security invoker set search_path='' as $$ select aepilog_private.join_buddy_with_token(p_token); $$;
revoke all on function public.join_buddy_read(uuid) from public,anon,authenticated;
grant execute on function public.join_buddy_read(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
