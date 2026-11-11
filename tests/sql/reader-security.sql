-- Run only with tests/fixtures/reader-database.sql in a disposable local DB.
begin;
do $$begin
  if (select count(*) from public.reader_profiles) <> 3 then raise exception 'registered account backfill failed'; end if;
  if exists(select 1 from public.reader_profiles where user_id='44444444-4444-4444-8444-444444444444') then raise exception 'anonymous account was published'; end if;
end$$;
update public.reader_profiles set is_public=false where user_id='33333333-3333-4333-8333-333333333333';
set local role anon;
set local request.jwt.claims='{}';
do $$begin
  if (select count(*) from public.reader_cards) <> 2 then raise exception 'private profile leaked through view'; end if;
  begin insert into public.reader_follows values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',now()); raise exception 'signed-out follow allowed'; exception when insufficient_privilege then null; end;
end$$;
reset role;
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
insert into public.reader_follows(follower_id,following_id) values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
do $$begin
  if (select follower_count from public.reader_cards where user_id='22222222-2222-4222-8222-222222222222') <> 1 then raise exception 'follower count incorrect'; end if;
  begin insert into public.reader_follows(follower_id,following_id) values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'); raise exception 'duplicate follow allowed'; exception when unique_violation then null; end;
  begin insert into public.reader_follows(follower_id,following_id) values('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111'); raise exception 'self follow allowed'; exception when check_violation then null; end;
  begin insert into public.reader_follows(follower_id,following_id) values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111'); raise exception 'follow impersonation allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.reader_follows(follower_id,following_id) values('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333'); raise exception 'private profile follow allowed'; exception when insufficient_privilege then null; end;
end$$;
update public.reader_profiles set is_public=false where user_id='22222222-2222-4222-8222-222222222222';
do $$begin if not (select is_public from public.reader_cards where user_id='22222222-2222-4222-8222-222222222222') then raise exception 'another profile was edited'; end if; end$$;
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
delete from public.reader_follows where follower_id='11111111-1111-4111-8111-111111111111';
do $$begin if (select count(*) from public.reader_follows) <> 1 then raise exception 'another readers follow was deleted'; end if; end$$;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
delete from public.reader_follows where follower_id='11111111-1111-4111-8111-111111111111' and following_id='22222222-2222-4222-8222-222222222222';
do $$begin if (select follower_count from public.reader_cards where user_id='22222222-2222-4222-8222-222222222222') <> 0 then raise exception 'unfollow count incorrect'; end if; end$$;
update public.reader_profiles set is_public=false,show_activity=false where user_id='11111111-1111-4111-8111-111111111111';
do $$begin if not exists(select 1 from public.reader_cards where user_id='11111111-1111-4111-8111-111111111111') then raise exception 'owner cannot read own private profile'; end if; end$$;
reset role;
update auth.users set raw_user_meta_data='{"username":"Alice New","bio":"New account bio"}' where id='11111111-1111-4111-8111-111111111111';
do $$begin
  if not exists(select 1 from public.reader_profiles where display_name='Alice New' and bio='New account bio' and not is_public and not show_activity) then raise exception 'account sync overwrote privacy or failed'; end if;
  if has_column_privilege('authenticated','public.reader_profiles','user_id','UPDATE') then raise exception 'profile identity can be reassigned'; end if;
  if has_table_privilege('anon','auth.users','SELECT') then raise exception 'private auth data exposed'; end if;
end$$;
set local role anon;
set local request.jwt.claims='{}';
do $$begin if (select count(*) from public.reader_cards) <> 1 then raise exception 'hidden account remained discoverable'; end if; end$$;
reset role;
set local role authenticated;
set local request.jwt.claims='{"sub":"44444444-4444-4444-8444-444444444444","is_anonymous":true}';
do $$begin
  begin insert into public.reader_profiles(user_id,display_name) values('44444444-4444-4444-8444-444444444444','Guest'); raise exception 'anonymous profile created'; exception when insufficient_privilege then null; end;
end$$;

-- The second migration must enforce ownership despite legacy permissive rules.
reset role;
set local role anon;
set local request.jwt.claims='{}';
do $$declare tbl text; begin
  foreach tbl in array array['ratings','discussion_posts','comments','discussion_likes'] loop
    begin execute format('insert into public.%I(user_id) values(%L)',tbl,'11111111-1111-4111-8111-111111111111'); raise exception 'signed-out write allowed: %',tbl; exception when insufficient_privilege then null; end;
  end loop;
end$$;
reset role;
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
do $$declare tbl text; begin
  foreach tbl in array array['ratings','discussion_posts','comments','discussion_likes'] loop
    execute format('insert into public.%I(user_id) values(%L)',tbl,'11111111-1111-4111-8111-111111111111');
    begin execute format('insert into public.%I(user_id) values(%L)',tbl,'22222222-2222-4222-8222-222222222222'); raise exception 'forged author allowed: %',tbl; exception when insufficient_privilege then null; end;
  end loop;
end$$;
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
update public.ratings set content='wrong owner';
update public.discussion_posts set content='wrong owner';
update public.comments set content='wrong owner';
delete from public.ratings;
delete from public.discussion_posts;
delete from public.comments;
delete from public.discussion_likes;
do $$declare tbl text; n integer; begin
  foreach tbl in array array['ratings','discussion_posts','comments','discussion_likes'] loop
    execute format('select count(*) from public.%I',tbl) into n;
    if n <> 1 then raise exception 'other readers records deleted: %',tbl; end if;
  end loop;
end$$;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
update public.ratings set content='own edit';
update public.discussion_posts set content='own edit';
update public.comments set content='own edit';
do $$begin
  if (select content from public.ratings limit 1) <> 'own edit' or (select content from public.discussion_posts limit 1) <> 'own edit' or (select content from public.comments limit 1) <> 'own edit' then raise exception 'own editing failed'; end if;
end$$;
delete from public.ratings;
delete from public.discussion_posts;
delete from public.comments;
delete from public.discussion_likes;
rollback;
select 'PASS: public/private profiles, account sync, ownership, duplicates, self-follow, following counts, and community ownership' as result;
