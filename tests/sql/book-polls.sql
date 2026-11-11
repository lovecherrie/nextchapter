-- Disposable local PostgreSQL only.
begin;
insert into public.books(id,title,author) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Book A','Author A'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Book B','Author B');
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
select set_config('test.poll',public.create_book_poll('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Which book?',false)::text,true);
do $$declare n bigint; result uuid; begin
 select count(*) into n from public.discussion_posts;
 result := public.create_book_poll('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Retry-safe poll',false,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
 if public.create_book_poll('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Retry-safe poll',false,result) <> result then raise exception 'retry returned another post'; end if;
 if (select count(*) from public.discussion_posts) <> n+1 then raise exception 'retry created a duplicate poll'; end if;
end$$;
select public.cast_book_vote(current_setting('test.poll')::uuid,'left');
select public.cast_book_vote(current_setting('test.poll')::uuid,'left');
update public.discussion_posts set username='Alice Updated',contains_spoilers=true where id=current_setting('test.poll')::uuid;
do $$begin
 begin update public.discussion_posts set content='Changed question' where id=current_setting('test.poll')::uuid; raise exception 'poll question changed after posting'; exception when insufficient_privilege then null; end;
 if not exists(select 1 from public.book_polls where post_id=current_setting('test.poll')::uuid and left_votes=1 and right_votes=0) then raise exception 'repeat voting inflated counts'; end if;
 begin update public.book_polls set left_votes=50; raise exception 'counts editable'; exception when insufficient_privilege then null; end;
 begin insert into public.book_poll_votes values(current_setting('test.poll')::uuid,'33333333-3333-4333-8333-333333333333','left'); raise exception 'forged voter allowed'; exception when insufficient_privilege then null; end;
 begin update public.book_poll_votes set user_id='22222222-2222-4222-8222-222222222222'; raise exception 'voter identity editable'; exception when insufficient_privilege then null; end;
 begin perform public.cast_book_vote(current_setting('test.poll')::uuid,'invalid'); raise exception 'invalid option allowed'; exception when check_violation then null; end;
end$$;
select public.cast_book_vote(current_setting('test.poll')::uuid,'right');
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
select public.cast_book_vote(current_setting('test.poll')::uuid,'left');
do $$begin
 if (select count(*) from public.book_poll_votes) <> 1 then raise exception 'other ballots exposed'; end if;
 if not exists(select 1 from public.book_polls where post_id=current_setting('test.poll')::uuid and left_votes=1 and right_votes=1) then raise exception 'changed vote totals incorrect'; end if;
end$$;
set local role anon;
set local request.jwt.claims='{}';
do $$begin
 if (select left_votes+right_votes from public.book_polls where post_id=current_setting('test.poll')::uuid) <> 2 then raise exception 'public totals hidden'; end if;
 begin perform public.cast_book_vote(current_setting('test.poll')::uuid,'left'); raise exception 'signed-out vote allowed'; exception when insufficient_privilege then null; end;
 begin perform count(*) from public.book_poll_votes; raise exception 'signed-out ballots exposed'; exception when insufficient_privilege then null; end;
end$$;
reset role;
set local role authenticated;
set local request.jwt.claims='{"sub":"44444444-4444-4444-8444-444444444444","is_anonymous":true}';
do $$begin
 begin perform public.cast_book_vote(current_setting('test.poll')::uuid,'left'); raise exception 'guest vote allowed'; exception when insufficient_privilege then null; end;
end$$;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
do $$declare n bigint; begin
 select count(*) into n from public.discussion_posts;
 begin perform public.create_book_poll('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','Invalid book',false); exception when foreign_key_violation then null; end;
 if (select count(*) from public.discussion_posts) <> n then raise exception 'failed poll left an orphan post'; end if;
end$$;
insert into public.comments(user_id,post_id,content,recommended_book_id) values('11111111-1111-4111-8111-111111111111',current_setting('test.poll')::uuid,'Read this one','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
update public.comments set recommended_book_id=null;
do $$begin if not exists(select 1 from public.comments where recommended_book_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then raise exception 'another user changed the book reply'; end if; end$$;
reset role;
-- Account cascades must remove the ballot and update public counts.
delete from auth.users where id='22222222-2222-4222-8222-222222222222';
do $$begin if (select left_votes from public.book_polls where post_id=current_setting('test.poll')::uuid) <> 0 then raise exception 'account cascade left stale votes'; end if; end$$;
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
delete from public.discussion_posts where id=current_setting('test.poll')::uuid;
do $$begin if exists(select 1 from public.book_polls where post_id=current_setting('test.poll')::uuid) then raise exception 'poll deletion did not cascade'; end if; end$$;
rollback;
select 'PASS: atomic polls, one vote/reader, vote changes, private ballots, public totals, guest restrictions, attachment ownership and cascades' as result;
