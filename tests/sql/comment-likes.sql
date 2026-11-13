-- Disposable local PostgreSQL only.
begin;
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
insert into public.discussion_posts(id,user_id,content) values('93000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Post');
insert into public.comments(id,post_id,user_id,content) values('93000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Comment');
insert into public.comments(id,post_id,user_id,content,parent_comment_id) values('93000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Reply','93000000-0000-4000-8000-000000000002');
insert into public.comment_likes(comment_id,user_id) values('93000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111') on conflict(comment_id,user_id) do nothing;
insert into public.comment_likes(comment_id,user_id) values('93000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111') on conflict(comment_id,user_id) do nothing;
insert into public.discussion_likes(post_id,user_id) values('93000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111') on conflict(post_id,user_id) do nothing;
insert into public.discussion_likes(post_id,user_id) values('93000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111') on conflict(post_id,user_id) do nothing;
do $$begin
 if (select count(*) from public.comment_likes)<>1 or (select count(*) from public.discussion_likes)<>1 then raise exception 'retry duplicated likes'; end if;
 begin insert into public.comment_likes(comment_id,user_id) values('93000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222'); raise exception 'forged liker'; exception when insufficient_privilege then null; end;
 begin update public.comment_likes set user_id='22222222-2222-4222-8222-222222222222'; raise exception 'like owner mutable'; exception when insufficient_privilege then null; end;
end$$;
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
delete from public.comment_likes where comment_id='93000000-0000-4000-8000-000000000002';
do $$begin if (select count(*) from public.comment_likes)<>1 then raise exception 'deleted another reader like'; end if; end$$;
insert into public.comment_likes(comment_id,user_id) values('93000000-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222');
set local role anon;
set local request.jwt.claims='{}';
do $$begin
 if (select count(*) from public.comment_likes)<>2 then raise exception 'public totals unavailable'; end if;
 begin insert into public.comment_likes(comment_id,user_id) values('93000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222'); raise exception 'signed-out like'; exception when insufficient_privilege then null; end;
end$$;
set local role authenticated;
set local request.jwt.claims='{"sub":"44444444-4444-4444-8444-444444444444","is_anonymous":true}';
do $$begin begin insert into public.comment_likes(comment_id,user_id) values('93000000-0000-4000-8000-000000000002','44444444-4444-4444-8444-444444444444'); raise exception 'guest like'; exception when insufficient_privilege then null; end; end$$;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
delete from public.comment_likes where comment_id='93000000-0000-4000-8000-000000000002' and user_id='11111111-1111-4111-8111-111111111111';
delete from public.comment_likes where comment_id='93000000-0000-4000-8000-000000000002' and user_id='11111111-1111-4111-8111-111111111111';
do $$begin if (select count(*) from public.comment_likes)<>1 then raise exception 'idempotent unlike failed'; end if; end$$;
delete from public.comments where id='93000000-0000-4000-8000-000000000002';
do $$begin if exists(select 1 from public.comment_likes) then raise exception 'comment/reply deletion left likes'; end if; end$$;
rollback;
select 'PASS: one like/reader/comment or reply, idempotent post/comment saves, public reads, owner-only unlike, guest rejection and cascades' as result;
