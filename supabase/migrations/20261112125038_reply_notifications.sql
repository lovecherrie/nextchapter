begin;
create table public.reply_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.reader_profiles(user_id) on delete cascade,
  actor_id uuid not null references public.reader_profiles(user_id) on delete cascade,
  actor_name text not null,
  post_id uuid not null references public.discussion_posts(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  kind text not null check (kind in ('comment','reply')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique(recipient_id,comment_id),
  check(recipient_id <> actor_id)
);
create index reply_notifications_recipient_created_idx on public.reply_notifications(recipient_id,created_at desc,id);
create index reply_notifications_unread_idx on public.reply_notifications(recipient_id) where read_at is null;
create index reply_notifications_actor_idx on public.reply_notifications(actor_id);
create index reply_notifications_post_idx on public.reply_notifications(post_id);
create index reply_notifications_comment_idx on public.reply_notifications(comment_id);
alter table public.reply_notifications enable row level security;
revoke all on public.reply_notifications from public,anon,authenticated;
grant select on public.reply_notifications to authenticated;
grant update(read_at) on public.reply_notifications to authenticated;
create policy notifications_read_own on public.reply_notifications for select to authenticated
  using (recipient_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy notifications_mark_own on public.reply_notifications for update to authenticated
  using (recipient_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false))
  with check (recipient_id=(select auth.uid()));

-- Cross-reader delivery is performed only by this private trigger. Clients cannot
-- insert alerts or choose recipients. No post/reply text is copied into alerts.
create function aepilog_private.notify_comment_recipients() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor_name text; owner_text text; parent_text text; owner_uuid uuid; parent_uuid uuid;
begin
  if auth.uid() is null or new.user_id <> auth.uid()::text or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then return new; end if;
  select p.display_name into actor_name from public.reader_profiles p where p.user_id=auth.uid();
  if actor_name is null then return new; end if;
  select post.user_id,parent.user_id into owner_text,parent_text
  from public.discussion_posts post
  left join public.comments parent on parent.id=new.parent_comment_id and parent.post_id=new.post_id
  where post.id=new.post_id;
  if owner_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then owner_uuid:=owner_text::uuid; end if;
  if parent_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then parent_uuid:=parent_text::uuid; end if;
  insert into public.reply_notifications(recipient_id,actor_id,actor_name,post_id,comment_id,kind)
  select p.user_id,auth.uid(),actor_name,new.post_id,new.id,
    case when p.user_id=parent_uuid then 'reply' else 'comment' end
  from public.reader_profiles p
  where p.user_id in (owner_uuid,parent_uuid) and p.user_id<>auth.uid()
  on conflict(recipient_id,comment_id) do nothing;
  return new;
end;
$$;
revoke all on function aepilog_private.notify_comment_recipients() from public,anon,authenticated;
create trigger aepilog_comment_notification after insert on public.comments
for each row execute function aepilog_private.notify_comment_recipients();
notify pgrst,'reload schema';
commit;
