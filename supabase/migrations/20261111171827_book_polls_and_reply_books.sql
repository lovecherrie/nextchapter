begin;

alter table public.comments add column recommended_book_id uuid references public.books(id) on delete set null;
create index comments_recommended_book_idx on public.comments(recommended_book_id) where recommended_book_id is not null;

create table public.book_polls (
  post_id uuid primary key references public.discussion_posts(id) on delete cascade,
  left_book_id uuid not null references public.books(id),
  right_book_id uuid not null references public.books(id),
  left_votes integer not null default 0 check (left_votes >= 0),
  right_votes integer not null default 0 check (right_votes >= 0),
  check (left_book_id <> right_book_id)
);
create index book_polls_left_book_idx on public.book_polls(left_book_id);
create index book_polls_right_book_idx on public.book_polls(right_book_id);

create table public.book_poll_votes (
  poll_id uuid not null references public.book_polls(post_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  choice text not null check (choice in ('left','right')),
  primary key (poll_id,user_id)
);
create index book_poll_votes_user_idx on public.book_poll_votes(user_id);
alter table public.book_polls enable row level security;
alter table public.book_poll_votes enable row level security;
create policy book_polls_read on public.book_polls for select to anon,authenticated using (true);
create policy book_polls_create_own on public.book_polls for insert to authenticated with check (
  not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
  and exists(select 1 from public.discussion_posts p where p.id=post_id and p.user_id=(select auth.uid())::text and p.book_id=left_book_id)
);
create policy book_poll_votes_read_own on public.book_poll_votes for select to authenticated using (user_id=(select auth.uid()));
create policy book_poll_votes_insert_own on public.book_poll_votes for insert to authenticated with check (user_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy book_poll_votes_update_own on public.book_poll_votes for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy book_poll_votes_delete_own on public.book_poll_votes for delete to authenticated using (user_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
revoke all on public.book_polls,public.book_poll_votes from public,anon,authenticated;
grant select on public.book_polls to anon,authenticated;
grant insert(post_id,left_book_id,right_book_id) on public.book_polls to authenticated;
grant select,delete on public.book_poll_votes to authenticated;
grant insert(poll_id,user_id,choice) on public.book_poll_votes to authenticated;
grant update(choice) on public.book_poll_votes to authenticated;

-- Only aggregate counts are public. Ballots remain visible to their owner.
-- This internal trigger is the only writer of the counts; it is not an RPC.
create schema if not exists aepilog_private;
create function aepilog_private.update_book_poll_counts() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_poll uuid; v_old text; v_new text;
begin
  if tg_op='UPDATE' and (new.poll_id<>old.poll_id or new.user_id<>old.user_id) then
    raise exception 'Vote identity cannot change' using errcode='42501';
  end if;
  if tg_op <> 'DELETE' then
    if auth.uid() is null or new.user_id <> auth.uid() or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
      raise exception 'A signed-in reader must own the vote' using errcode='42501';
    end if;
    v_poll := new.poll_id; v_new := new.choice;
  end if;
  if tg_op <> 'INSERT' then
    v_poll := old.poll_id; v_old := old.choice;
  end if;
  -- DELETE also runs for account/poll cascades, after the owning row may be gone.
  update public.book_polls set
    left_votes=left_votes+(case when v_new='left' then 1 else 0 end)-(case when v_old='left' then 1 else 0 end),
    right_votes=right_votes+(case when v_new='right' then 1 else 0 end)-(case when v_old='right' then 1 else 0 end)
  where post_id=v_poll;
  return null;
end;
$$;
revoke all on function aepilog_private.update_book_poll_counts() from public,anon,authenticated;
create trigger book_poll_count_sync after insert or update or delete on public.book_poll_votes
for each row execute function aepilog_private.update_book_poll_counts();

create function aepilog_private.protect_book_poll_question() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if (new.content is distinct from old.content or new.book_id is distinct from old.book_id)
    and exists(select 1 from public.book_polls where post_id=old.id) then
    raise exception 'Poll questions and books are fixed after posting' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function aepilog_private.protect_book_poll_question() from public,anon,authenticated;
create trigger book_poll_question_guard before update on public.discussion_posts
for each row execute function aepilog_private.protect_book_poll_question();

create function public.create_book_poll(p_left_book uuid,p_right_book uuid,p_question text,p_spoilers boolean default false,p_request_id uuid default gen_random_uuid()) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_post uuid; v_name text;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in to post' using errcode='42501'; end if;
  if exists(select 1 from public.discussion_posts p join public.book_polls b on b.post_id=p.id where p.id=p_request_id and p.user_id=auth.uid()::text) then return p_request_id; end if;
  if p_question is null or char_length(btrim(p_question)) not between 1 and 280 then raise exception 'Write a question of up to 280 characters'; end if;
  if p_left_book=p_right_book or exists(
    select 1 from public.books l,public.books r where l.id=p_left_book and r.id=p_right_book
      and lower(btrim(l.title))=lower(btrim(r.title)) and lower(btrim(coalesce(l.author,'')))=lower(btrim(coalesce(r.author,'')))
  ) then raise exception 'Choose two different books'; end if;
  select display_name into strict v_name from public.reader_profiles where user_id=auth.uid();
  insert into public.discussion_posts(id,book_id,user_id,username,content,contains_spoilers)
  values(p_request_id,p_left_book,auth.uid()::text,v_name,btrim(p_question),coalesce(p_spoilers,false)) returning id into v_post;
  insert into public.book_polls(post_id,left_book_id,right_book_id) values(v_post,p_left_book,p_right_book);
  return v_post;
end;
$$;
create function public.cast_book_vote(p_poll uuid,p_choice text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in to vote' using errcode='42501'; end if;
  insert into public.book_poll_votes(poll_id,user_id,choice) values(p_poll,auth.uid(),p_choice)
  on conflict(poll_id,user_id) do update set choice=excluded.choice;
end;
$$;
revoke all on function public.create_book_poll(uuid,uuid,text,boolean,uuid),public.cast_book_vote(uuid,text) from public,anon,authenticated;
grant execute on function public.create_book_poll(uuid,uuid,text,boolean,uuid),public.cast_book_vote(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
