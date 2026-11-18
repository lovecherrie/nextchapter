begin;
insert into aepilog_private.moderators(user_id) values('22222222-2222-4222-8222-222222222222');
insert into public.discussion_posts(id,user_id,username,content) values
 ('96000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Bob','Reported discussion'),
 ('96000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','Alice','Alice discussion');
insert into public.comments(id,post_id,user_id,username,content) values('96000000-0000-4000-8000-000000000003','96000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Bob','Reported comment');
insert into public.reply_notifications(id,recipient_id,actor_id,actor_name,post_id,comment_id,kind) values('96000000-0000-4000-8000-000000000099','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','Bob','96000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000003','comment');
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false,"user_metadata":{"is_admin":true}}';
do $$begin
 if public.safety_is_moderator() then raise exception 'Self-assigned admin claim worked'; end if;
 begin insert into aepilog_private.moderators(user_id) values(auth.uid());raise exception 'Self-promotion allowed';exception when insufficient_privilege then null;end;
 begin perform public.safety_usage_summary();raise exception 'Non-admin saw usage';exception when insufficient_privilege then null;end;
end$$;
select public.safety_submit_report('post','96000000-0000-4000-8000-000000000001','spam','A private explanation');
select public.safety_submit_report('post','96000000-0000-4000-8000-000000000001','spam','Retry');
do $$begin
 if (select count(*) from public.content_reports)<>1 then raise exception 'Report retry duplicated';end if;
 if (select snapshot->>'content' from public.content_reports limit 1)<>'Reported discussion' then raise exception 'Snapshot did not use the actual target';end if;
 begin update public.discussion_posts set moderation_hidden=true where user_id=auth.uid()::text;raise exception 'Reader changed moderation state';exception when insufficient_privilege then null;end;
 begin perform public.safety_review_report((select id from public.content_reports limit 1),'hide');raise exception 'Non-admin moderated';exception when insufficient_privilege then null;end;
end$$;
set local request.jwt.claims='{"sub":"33333333-3333-4333-8333-333333333333","is_anonymous":false}';
do $$begin if exists(select 1 from public.content_reports) then raise exception 'Other reader saw private reports';end if;end$$;
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
select public.safety_review_report((select id from public.content_reports limit 1),'hide');
do $$begin
 if exists(select 1 from public.discussion_posts where id='96000000-0000-4000-8000-000000000001') then raise exception 'Hidden post visible';end if;
 if exists(select 1 from public.comments where post_id='96000000-0000-4000-8000-000000000001') then raise exception 'Hidden thread comments exposed';end if;
end$$;
select public.safety_review_report((select id from public.content_reports limit 1),'restore');
do $$begin if not exists(select 1 from public.discussion_posts where id='96000000-0000-4000-8000-000000000001') then raise exception 'Restore failed';end if;end$$;
reset role;
insert into public.reader_follows(follower_id,following_id) values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'),('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
insert into public.reader_blocks(blocker_id,blocked_id) values(auth.uid(),'22222222-2222-4222-8222-222222222222');
do $$begin
 if exists(select 1 from public.reader_follows) then raise exception 'Block did not remove follows';end if;
 if exists(select 1 from public.reply_notifications) then raise exception 'Block did not remove reply notifications';end if;
 if exists(select 1 from public.reader_profiles where user_id='22222222-2222-4222-8222-222222222222') then raise exception 'Blocked profile visible';end if;
 if exists(select 1 from public.discussion_posts where user_id='22222222-2222-4222-8222-222222222222') then raise exception 'Blocked post visible';end if;
 if (select count(*) from public.safety_blocked_readers())<>1 then raise exception 'Own blocked list unavailable';end if;
 begin insert into public.comments(post_id,user_id,content) values('96000000-0000-4000-8000-000000000001',auth.uid()::text,'Blocked reply');raise exception 'Blocked reply allowed';exception when insufficient_privilege then null;end;
 begin insert into public.comments(post_id,parent_comment_id,user_id,content) values('96000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000003',auth.uid()::text,'Wrong thread');raise exception 'Cross-thread reply allowed';exception when check_violation then null;end;
end$$;
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
do $$begin begin insert into public.comments(post_id,user_id,content) values('96000000-0000-4000-8000-000000000002',auth.uid()::text,'Reply after being blocked');raise exception 'Reverse block bypass';exception when insufficient_privilege then null;end;end$$;
set local role anon;
set local request.jwt.claims='{}';
do $$begin
 if not exists(select 1 from public.discussion_posts where id='96000000-0000-4000-8000-000000000001') then raise exception 'Blocking unexpectedly made public posts private';end if;
 begin insert into public.reviews(content) values('Retired endpoint spam');raise exception 'Retired reviews write allowed';exception when insufficient_privilege then null;end;
 begin perform aepilog_private.consume_window('attacker','ai',now(),999999);raise exception 'Caller could raise quota';exception when insufficient_privilege then null;end;
end$$;
reset role;
delete from aepilog_private.request_windows where subject='11111111-1111-4111-8111-111111111111';
insert into aepilog_private.active_reader_days(user_id,day) values('11111111-1111-4111-8111-111111111111',(now() at time zone 'UTC')::date-1);
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
select public.mark_active_reader();select public.mark_active_reader();
do $$declare i integer;begin
 begin insert into public.books(title,author,cover_url) values('Forged cover','An Author','https://evil.example/tracker');raise exception 'Untrusted cover allowed';exception when check_violation then null;end;
 for i in 1..10 loop insert into public.discussion_posts(user_id,content,username) values(auth.uid()::text,'Post '||i,'Forged name');end loop;
 begin insert into public.discussion_posts(user_id,content) values(auth.uid()::text,'Too fast');raise exception 'Post rate cap failed';exception when raise_exception then if sqlerrm='Post rate cap failed' then raise;end if;end;
 if exists(select 1 from public.discussion_posts where username='Forged name') then raise exception 'Author name was spoofed';end if;
 for i in 1..10 loop insert into storage.objects(bucket_id,name) values('reader-avatars',auth.uid()::text||'/'||gen_random_uuid()::text||'.jpg');end loop;
 begin insert into storage.objects(bucket_id,name) values('reader-avatars',auth.uid()::text||'/'||gen_random_uuid()::text||'.jpg');raise exception 'Avatar capacity exceeded';exception when insufficient_privilege then null;end;
end$$;
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
select public.mark_active_reader();
do $$declare summary jsonb;begin
 summary:=public.safety_usage_summary();
 if (summary->0->>'active_readers')::integer<>1 or (summary->0->>'returning_readers')::integer<>1 then raise exception 'Usage is not daily unique or returning; moderator visits must be excluded';end if;
end$$;
set local role anon;set local request.jwt.claims='{}';
do $$declare i integer;begin
 for i in 1..20 loop if not public.consume_ai_budget() then raise exception 'Shared budget refused too early';end if;end loop;
 if public.consume_ai_budget() then raise exception 'Shared minute budget exceeded';end if;
end$$;
rollback;
