-- Disposable local PostgreSQL only; never seed live user activity.
begin;
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
insert into public.discussion_posts(id,user_id,username,content) values('90000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Alice','General question');
insert into public.comments(id,post_id,user_id,content) values('90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','My own comment');
do $$begin if exists(select 1 from public.reply_notifications) then raise exception 'self alert generated'; end if; end$$;
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
insert into public.comments(id,post_id,user_id,content) values('90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Bob comments');
do $$begin if exists(select 1 from public.reply_notifications) then raise exception 'actor can see recipient alerts'; end if; end$$;
set local request.jwt.claims='{"sub":"33333333-3333-4333-8333-333333333333","is_anonymous":false}';
insert into public.comments(id,post_id,user_id,content,parent_comment_id) values('90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','Reply to Bob','90000000-0000-4000-8000-000000000003');
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
do $$begin
 if (select count(*) from public.reply_notifications)<>1 or not exists(select 1 from public.reply_notifications where kind='reply') then raise exception 'parent author not notified'; end if;
 begin insert into public.reply_notifications(recipient_id,actor_id,actor_name,post_id,comment_id,kind) values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','Forged','90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003','reply'); raise exception 'client forged alert'; exception when insufficient_privilege then null; end;
 begin update public.reply_notifications set recipient_id='33333333-3333-4333-8333-333333333333'; raise exception 'recipient mutable'; exception when insufficient_privilege then null; end;
end$$;
update public.reply_notifications set read_at=now();
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
do $$begin
 if (select count(*) from public.reply_notifications)<>2 then raise exception 'post author recipients missing or duplicate'; end if;
 if exists(select 1 from public.reply_notifications where read_at is not null) then raise exception 'other reader marked notifications'; end if;
end$$;
update public.comments set content='Edited reply' where id='90000000-0000-4000-8000-000000000002';
do $$begin if (select count(*) from public.reply_notifications)<>2 then raise exception 'edit generated duplicate alerts'; end if; end$$;
set local role anon;
set local request.jwt.claims='{}';
do $$begin begin perform count(*) from public.reply_notifications; raise exception 'signed-out alerts readable'; exception when insufficient_privilege then null; end; end$$;
reset role;
delete from public.comments where id='90000000-0000-4000-8000-000000000004';
do $$begin if exists(select 1 from public.reply_notifications where comment_id='90000000-0000-4000-8000-000000000004') then raise exception 'deleted reply left alert'; end if; end$$;
rollback;
select 'PASS: reply routing, distinct recipients, no self/edit alerts, recipient privacy, immutable delivery and read-state ownership' as result;
