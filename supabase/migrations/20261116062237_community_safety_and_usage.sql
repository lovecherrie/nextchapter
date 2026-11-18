begin;

create table aepilog_private.moderators(user_id uuid primary key references auth.users(id) on delete cascade);
create table aepilog_private.request_windows(subject text not null, action text not null, window_start timestamptz not null, hits integer not null, primary key(subject,action,window_start));
create index request_windows_expiry on aepilog_private.request_windows(window_start);
create table aepilog_private.active_reader_days(user_id uuid not null references auth.users(id) on delete cascade, day date not null default (current_timestamp at time zone 'UTC')::date, primary key(user_id,day));
create index active_reader_days_day on aepilog_private.active_reader_days(day);
create table aepilog_private.ai_usage_days(day date primary key,requests integer not null);
alter table aepilog_private.ai_usage_days enable row level security;
revoke all on aepilog_private.ai_usage_days from public,anon,authenticated;
alter table aepilog_private.moderators enable row level security;
alter table aepilog_private.request_windows enable row level security;
alter table aepilog_private.active_reader_days enable row level security;
revoke all on aepilog_private.moderators,aepilog_private.request_windows,aepilog_private.active_reader_days from public,anon,authenticated;

create function aepilog_private.is_moderator() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) and exists(select 1 from aepilog_private.moderators where user_id=auth.uid());
$$;
create function aepilog_private.require_reader() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not exists(select 1 from public.reader_profiles where user_id=auth.uid()) then raise insufficient_privilege using message='Please sign in to continue'; end if;
 return auth.uid();
end$$;

create table public.reader_blocks(
 blocker_id uuid not null references public.reader_profiles(user_id) on delete cascade,
 blocked_id uuid not null references public.reader_profiles(user_id) on delete cascade,
 created_at timestamptz not null default now(), primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
create index reader_blocks_reverse on public.reader_blocks(blocked_id,blocker_id);
alter table public.reader_blocks enable row level security;
revoke all on public.reader_blocks from public,anon,authenticated;
grant select,insert,delete on public.reader_blocks to authenticated;
create policy blocks_read_own on public.reader_blocks for select to authenticated using(blocker_id=(select auth.uid()));
create policy blocks_insert_own on public.reader_blocks for insert to authenticated with check(blocker_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
create policy blocks_delete_own on public.reader_blocks for delete to authenticated using(blocker_id=(select auth.uid()) and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));

create function aepilog_private.blocked_with(other_id text) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or other_id is null or other_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
 return exists(select 1 from public.reader_blocks b where (b.blocker_id=auth.uid() and b.blocked_id=other_id::uuid) or (b.blocked_id=auth.uid() and b.blocker_id=other_id::uuid));
end$$;

-- Atomic fixed-window limits also cover direct Data API writes, not just UI buttons.
create function aepilog_private.consume_window(p_subject text,p_action text,p_start timestamptz,p_limit integer) returns boolean language plpgsql security definer set search_path='' as $$
declare accepted integer;
begin
 insert into aepilog_private.request_windows(subject,action,window_start,hits) values(p_subject,p_action,p_start,1)
 on conflict(subject,action,window_start) do update set hits=request_windows.hits+1 where request_windows.hits<p_limit returning hits into accepted;
 return accepted is not null;
end$$;
create function aepilog_private.write_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid; body jsonb:=to_jsonb(new); old_body jsonb; target text; post_owner text; parent_post uuid; parent_hidden boolean; per_min integer; per_day integer;
begin
 -- Maintenance via the database connector has no reader JWT; existing RLS still rejects unauthenticated clients.
 if auth.uid() is null then return new; end if;
 actor:=aepilog_private.require_reader();
 if tg_op='UPDATE' then
  old_body:=to_jsonb(old);
  if body->>'user_id' is distinct from old_body->>'user_id' or body->>'book_id' is distinct from old_body->>'book_id' or body->>'post_id' is distinct from old_body->>'post_id' or body->>'parent_comment_id' is distinct from old_body->>'parent_comment_id' then raise insufficient_privilege using message='Content cannot be moved to another reader or thread'; end if;
  if body->'moderation_hidden' is distinct from old_body->'moderation_hidden' and not aepilog_private.is_moderator() then raise insufficient_privilege using message='Only a moderator can change moderation status'; end if;
  if body ? 'created_at' then new.created_at:=old.created_at; end if;
 end if;
 if body ? 'content' and (tg_op='INSERT' or body->>'content' is distinct from old_body->>'content') then
  if char_length(coalesce(body->>'content',''))>(case when tg_table_name='ratings' then 5000 else 1000 end) then raise check_violation using message='This message is too long'; end if;
 end if;
 if tg_table_name in ('ratings','discussion_posts','comments') and body->>'user_id'=actor::text then
  if tg_op='INSERT' or body->>'username' is distinct from old_body->>'username' then select display_name into new.username from public.reader_profiles where user_id=actor; end if;
 end if;
 if tg_op in ('INSERT','UPDATE') then
  per_min:=case tg_table_name when 'discussion_posts' then 10 when 'comments' then 30 when 'ratings' then 20 when 'reader_follows' then 30 when 'reader_blocks' then 20 when 'buddy_reads' then 5 else 90 end;
  per_day:=case tg_table_name when 'discussion_posts' then 100 when 'comments' then 500 when 'ratings' then 200 when 'reader_follows' then 300 when 'reader_blocks' then 100 when 'buddy_reads' then 50 else 2000 end;
  if not aepilog_private.consume_window(actor::text,tg_table_name||':minute',date_trunc('minute',now()),per_min) or not aepilog_private.consume_window(actor::text,tg_table_name||':day',date_trunc('day',now()),per_day) then raise exception using errcode='P0001',message='Too many actions. Please wait a little before trying again.'; end if;
  if tg_op='INSERT' then
   if body ? 'created_at' then new.created_at:=clock_timestamp(); end if;
   if body ? 'moderation_hidden' then new.moderation_hidden:=false; end if;
  end if;
 end if;
 if tg_table_name='comments' then
  select user_id,moderation_hidden into target,parent_hidden from public.discussion_posts where id=new.post_id;
  if parent_hidden then raise insufficient_privilege using message='This discussion is unavailable'; end if;
  if new.parent_comment_id is not null then
   select post_id,user_id into parent_post,post_owner from public.comments where id=new.parent_comment_id;
   if parent_post is distinct from new.post_id then raise check_violation using message='Reply must belong to the same discussion'; end if;
   if aepilog_private.blocked_with(post_owner) then raise insufficient_privilege using message='This interaction is unavailable'; end if;
  end if;
 elsif tg_table_name='discussion_likes' then select user_id,moderation_hidden into target,parent_hidden from public.discussion_posts where id=new.post_id;
 if parent_hidden then raise insufficient_privilege using message='This discussion is unavailable'; end if;
 elsif tg_table_name='comment_likes' then
  select c.user_id,p.user_id into target,post_owner from public.comments c join public.discussion_posts p on p.id=c.post_id where c.id=new.comment_id;
  if aepilog_private.blocked_with(post_owner) then raise insufficient_privilege using message='This interaction is unavailable'; end if;
 elsif tg_table_name='reader_follows' then target:=new.following_id::text;
 elsif tg_table_name='book_poll_votes' then select user_id into target from public.discussion_posts where id=new.poll_id;
 elsif tg_table_name='buddy_read_messages' then select owner_id::text into target from public.buddy_reads where id=new.read_id;
 elsif tg_table_name='buddy_read_members' then select owner_id::text into target from public.buddy_reads where id=new.read_id;
 end if;
 if aepilog_private.blocked_with(target) then raise insufficient_privilege using message='This interaction is unavailable'; end if;
 if tg_op='INSERT' then delete from aepilog_private.request_windows where window_start<now()-interval '2 days'; end if;
 return new;
end$$;

alter table public.discussion_posts add column moderation_hidden boolean not null default false;
alter table public.comments add column moderation_hidden boolean not null default false;
alter table public.ratings add column moderation_hidden boolean not null default false;
do $$declare t text; begin
 foreach t in array array['discussion_posts','comments','ratings'] loop
  execute format('create trigger safety_write_guard before insert or update on public.%I for each row execute function aepilog_private.write_guard()',t);
  execute format('create policy safety_visible on public.%I as restrictive for select to public using (not moderation_hidden and not aepilog_private.blocked_with(user_id::text))',t);
 end loop;
 foreach t in array array['reader_follows','reader_blocks','discussion_likes','comment_likes','book_poll_votes','buddy_read_messages','buddy_read_members','buddy_reads'] loop
  execute format('create trigger safety_write_guard before insert on public.%I for each row execute function aepilog_private.write_guard()',t);
 end loop;
end$$;
create policy visible_comment_thread on public.comments as restrictive for select to public using(exists(select 1 from public.discussion_posts p where p.id=comments.post_id));
create trigger safety_invite_guard before insert or update on public.buddy_read_invites for each row execute function aepilog_private.write_guard();
create trigger safety_vote_update_guard before update on public.book_poll_votes for each row execute function aepilog_private.write_guard();
create policy blocked_reader_visibility on public.reader_profiles as restrictive for select to public using(not aepilog_private.blocked_with(user_id::text));
create policy blocked_notifications on public.reply_notifications as restrictive for select to public using(not aepilog_private.blocked_with(actor_id::text));
create policy blocked_circle_messages on public.buddy_read_messages as restrictive for select to public using(not aepilog_private.blocked_with(user_id::text));

create function aepilog_private.cleanup_block() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.reader_follows where (follower_id=new.blocker_id and following_id=new.blocked_id) or (follower_id=new.blocked_id and following_id=new.blocker_id);
 delete from public.reply_notifications where (recipient_id=new.blocker_id and actor_id=new.blocked_id) or (recipient_id=new.blocked_id and actor_id=new.blocker_id);
 return new;
end$$;
create trigger cleanup_reader_block after insert on public.reader_blocks for each row execute function aepilog_private.cleanup_block();

create table public.content_reports(
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.reader_profiles(user_id) on delete cascade,
 target_kind text not null check(target_kind in ('post','comment','review','reader')), target_id uuid not null,
 reason text not null check(reason in ('spam','harassment','spoilers','other')), details text not null default '' check(char_length(details)<=1000),
 snapshot jsonb not null, status text not null default 'open' check(status in ('open','reviewed','hidden')),
 created_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references auth.users(id) on delete set null
);
create unique index content_reports_open_unique on public.content_reports(reporter_id,target_kind,target_id) where status='open';
create index content_reports_status_created on public.content_reports(status,created_at desc);
create index content_reports_reviewer on public.content_reports(reviewed_by);
alter table public.content_reports enable row level security;
revoke all on public.content_reports from public,anon,authenticated;
grant select on public.content_reports to authenticated;
create policy reports_read on public.content_reports for select to authenticated using(reporter_id=(select auth.uid()) or (select aepilog_private.is_moderator()));

create function aepilog_private.submit_report(p_kind text,p_target uuid,p_reason text,p_details text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=aepilog_private.require_reader(); record jsonb; owner_text text; report_id uuid;
begin
 if p_kind not in ('post','comment','review','reader') or p_reason not in ('spam','harassment','spoilers','other') or char_length(coalesce(p_details,''))>1000 then raise check_violation using message='Invalid report'; end if;
 if p_kind='post' then select jsonb_build_object('content',left(content,5000),'author',username,'user_id',user_id,'book_id',book_id,'post_id',id) into record from public.discussion_posts where id=p_target and not moderation_hidden;
 elsif p_kind='comment' then select jsonb_build_object('content',left(content,5000),'author',username,'user_id',user_id,'post_id',post_id) into record from public.comments where id=p_target and not moderation_hidden;
 elsif p_kind='review' then select jsonb_build_object('content',left(content,5000),'author',username,'user_id',user_id,'book_id',book_id) into record from public.ratings where id=p_target and not moderation_hidden;
 else select jsonb_build_object('content',bio,'author',display_name,'user_id',user_id) into record from public.reader_profiles where user_id=p_target and is_public;
 end if;
 if record is null or record->>'user_id'=actor::text then raise check_violation using message='This report target is unavailable'; end if;
 select id into report_id from public.content_reports where reporter_id=actor and target_kind=p_kind and target_id=p_target and status='open';
 if report_id is not null then return report_id; end if;
 if not aepilog_private.consume_window(actor::text,'reports:minute',date_trunc('minute',now()),5) or not aepilog_private.consume_window(actor::text,'reports:day',date_trunc('day',now()),20) then raise exception 'Please wait before sending another report'; end if;
 insert into public.content_reports(reporter_id,target_kind,target_id,reason,details,snapshot) values(actor,p_kind,p_target,p_reason,coalesce(p_details,''),record)
 on conflict(reporter_id,target_kind,target_id) where status='open' do update set details=content_reports.details returning id into report_id;
 return report_id;
end$$;
create function aepilog_private.review_report(p_report uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare report public.content_reports; hidden boolean;
begin
 if not aepilog_private.is_moderator() then raise insufficient_privilege using message='Moderator access required'; end if;
 if p_action not in ('reviewed','hide','restore') then raise check_violation using message='Invalid moderation action'; end if;
 select * into report from public.content_reports where id=p_report for update;
 if not found then raise check_violation using message='Report not found'; end if;
 if p_action in ('hide','restore') then
  hidden:=p_action='hide';
  if report.target_kind='post' then update public.discussion_posts set moderation_hidden=hidden where id=report.target_id;
  elsif report.target_kind='comment' then update public.comments set moderation_hidden=hidden where id=report.target_id;
  elsif report.target_kind='review' then update public.ratings set moderation_hidden=hidden where id=report.target_id;
  else raise check_violation using message='Reader reports can be marked reviewed; account action requires review'; end if;
 end if;
 update public.content_reports set status=case when p_action='hide' or (p_action='reviewed' and report.status='hidden') then 'hidden' else 'reviewed' end, reviewed_at=now(),reviewed_by=auth.uid() where id=p_report;
end$$;

create function aepilog_private.blocked_readers() returns table(user_id uuid,display_name text) language sql stable security definer set search_path='' as $$
 select p.user_id,p.display_name from public.reader_blocks b join public.reader_profiles p on p.user_id=b.blocked_id where b.blocker_id=auth.uid() and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) order by b.created_at desc;
$$;
create function aepilog_private.mark_active_reader() returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=aepilog_private.require_reader();
begin
 if aepilog_private.is_moderator() then return; end if;
 insert into aepilog_private.active_reader_days(user_id) values(actor) on conflict do nothing;
 delete from aepilog_private.active_reader_days where day<(now() at time zone 'UTC')::date-90;
end$$;
create function aepilog_private.consume_ai_budget() returns boolean language plpgsql security definer set search_path='' as $$
begin
 -- Global limits cannot be raised or bypassed by supplying a different client key.
 if not aepilog_private.consume_window('global','ai:minute',date_trunc('minute',now()),20) then return false; end if;
 if not aepilog_private.consume_window('global','ai:day',date_trunc('day',now()),300) then return false; end if;
 insert into aepilog_private.ai_usage_days(day,requests) values((now() at time zone 'UTC')::date,1) on conflict(day) do update set requests=ai_usage_days.requests+1;
 delete from aepilog_private.ai_usage_days where day<(now() at time zone 'UTC')::date-90;
 delete from aepilog_private.request_windows where window_start<now()-interval '2 days';
 return true;
end$$;
create function aepilog_private.usage_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not aepilog_private.is_moderator() then raise insufficient_privilege using message='Moderator access required'; end if;
 return (select jsonb_agg(jsonb_build_object('day',d.day,'active_readers',(select count(*) from aepilog_private.active_reader_days a where a.day=d.day),
 'returning_readers',(select count(*) from aepilog_private.active_reader_days a where a.day=d.day and exists(select 1 from aepilog_private.active_reader_days earlier where earlier.user_id=a.user_id and earlier.day<a.day)),
 'signups',(select count(*) from auth.users u where u.created_at>=d.day and u.created_at<d.day+interval '1 day' and not coalesce(u.is_anonymous,false)),
 'posts',(select count(*) from public.discussion_posts p where p.created_at>=d.day and p.created_at<d.day+interval '1 day'),
 'comments',(select count(*) from public.comments c where c.created_at>=d.day and c.created_at<d.day+interval '1 day'),
 'reviews',(select count(*) from public.ratings r where r.created_at>=d.day and r.created_at<d.day+interval '1 day'),
 'ai_requests',coalesce((select requests from aepilog_private.ai_usage_days w where w.day=d.day),0)) order by d.day desc)
 from (select generate_series((now() at time zone 'UTC')::date-13,(now() at time zone 'UTC')::date,interval '1 day')::date as day)d);
end$$;

create function aepilog_private.avatar_capacity() returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=aepilog_private.require_reader();
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('avatar:'||actor::text,0));
 return (select count(*) from storage.objects where bucket_id='reader-avatars' and name like actor::text||'/%')<10;
end$$;
revoke all on function aepilog_private.avatar_capacity() from public,anon,authenticated;
grant execute on function aepilog_private.avatar_capacity() to authenticated;
create policy avatar_account_capacity on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'reader-avatars' or aepilog_private.avatar_capacity());

create function aepilog_private.guard_catalogue_insert() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if auth.uid() is null then return new; end if;
 actor:=aepilog_private.require_reader();
 if char_length(btrim(coalesce(new.title,''))) not between 1 and 400 or char_length(coalesce(new.author,''))>200 or char_length(coalesce(new.external_id,''))>200 or char_length(coalesce(new.cover_url,''))>2000 then raise check_violation using message='Invalid book metadata'; end if;
 if new.cover_url is not null and new.cover_url !~ '^https://(covers\.openlibrary\.org/b/(id|isbn)/|books\.google\.com/books/content[?]|books\.googleusercontent\.com/books/content[?])' then raise check_violation using message='Unsupported book cover'; end if;
 if not aepilog_private.consume_window(actor::text,'books:minute',date_trunc('minute',now()),60) or not aepilog_private.consume_window(actor::text,'books:day',date_trunc('day',now()),1000) then raise exception 'Please wait before adding more books'; end if;
 return new;
end$$;
revoke all on function aepilog_private.guard_catalogue_insert() from public,anon,authenticated;
create trigger safety_catalogue_insert before insert on public.books for each row execute function aepilog_private.guard_catalogue_insert();

-- Thin invoker RPC wrappers; privileged implementations remain in the unexposed schema.
create function public.safety_is_moderator() returns boolean language sql stable set search_path='' as $$select aepilog_private.is_moderator()$$;
create function public.safety_submit_report(p_kind text,p_target uuid,p_reason text,p_details text default '') returns uuid language sql set search_path='' as $$select aepilog_private.submit_report(p_kind,p_target,p_reason,p_details)$$;
create function public.safety_review_report(p_report uuid,p_action text) returns void language sql set search_path='' as $$select aepilog_private.review_report(p_report,p_action)$$;
create function public.safety_blocked_readers() returns table(user_id uuid,display_name text) language sql stable set search_path='' as $$select * from aepilog_private.blocked_readers()$$;
create function public.mark_active_reader() returns void language sql set search_path='' as $$select aepilog_private.mark_active_reader()$$;
create function public.consume_ai_budget() returns boolean language sql set search_path='' as $$select aepilog_private.consume_ai_budget()$$;
create function public.safety_usage_summary() returns jsonb language sql stable set search_path='' as $$select aepilog_private.usage_summary()$$;

revoke all on function aepilog_private.is_moderator(),aepilog_private.require_reader(),aepilog_private.blocked_with(text),aepilog_private.consume_window(text,text,timestamptz,integer),aepilog_private.write_guard(),aepilog_private.cleanup_block(),aepilog_private.submit_report(text,uuid,text,text),aepilog_private.review_report(uuid,text),aepilog_private.blocked_readers(),aepilog_private.mark_active_reader(),aepilog_private.consume_ai_budget(),aepilog_private.usage_summary() from public,anon,authenticated;
grant usage on schema aepilog_private to anon,authenticated;
grant execute on function aepilog_private.blocked_with(text) to anon,authenticated;
grant execute on function aepilog_private.is_moderator(),aepilog_private.submit_report(text,uuid,text,text),aepilog_private.review_report(uuid,text),aepilog_private.blocked_readers(),aepilog_private.mark_active_reader(),aepilog_private.usage_summary() to authenticated;
grant execute on function aepilog_private.consume_ai_budget() to anon,authenticated;
revoke all on function public.safety_is_moderator(),public.safety_submit_report(text,uuid,text,text),public.safety_review_report(uuid,text),public.safety_blocked_readers(),public.mark_active_reader(),public.consume_ai_budget(),public.safety_usage_summary() from public,anon,authenticated;
grant execute on function public.safety_is_moderator(),public.safety_submit_report(text,uuid,text,text),public.safety_review_report(uuid,text),public.safety_blocked_readers(),public.mark_active_reader(),public.safety_usage_summary() to authenticated;
grant execute on function public.consume_ai_budget() to anon,authenticated;

-- This retired table is not used by the application; close its legacy public write policy.
do $$begin if to_regclass('public.reviews') is not null then execute 'revoke insert,update,delete on public.reviews from public,anon,authenticated'; end if; end$$;
notify pgrst,'reload schema';
commit;
