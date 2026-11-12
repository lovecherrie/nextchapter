-- Run in the disposable local database only.
begin;
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
insert into public.discussion_posts(id,user_id,username,content,book_id)
values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','Alice','Which books are underrated?',null);
do $$begin
  if not exists(select 1 from public.discussion_posts where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' and book_id is null) then raise exception 'general discussion failed'; end if;
  begin
    insert into public.discussion_posts(user_id,content,book_id) values('22222222-2222-4222-8222-222222222222','Impersonation',null);
    raise exception 'general post allowed another owner';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_book_poll(null,null,'Invalid poll',false);
    raise exception 'poll allowed missing books';
  exception when check_violation or invalid_parameter_value or not_null_violation or insufficient_privilege then null; end;
  if exists(select 1 from public.discussion_posts where content='Invalid poll') then raise exception 'failed poll left orphan post'; end if;
end$$;
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
update public.discussion_posts set content='Other edit' where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
delete from public.discussion_posts where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $$begin
  if not exists(select 1 from public.discussion_posts where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' and content='Which books are underrated?') then raise exception 'general post ownership lost'; end if;
end$$;
set local role anon;
set local request.jwt.claims='{}';
do $$begin
  if not exists(select 1 from public.discussion_posts where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') then raise exception 'public cannot read general posts'; end if;
  begin
    insert into public.discussion_posts(user_id,content,book_id) values('11111111-1111-4111-8111-111111111111','Signed out',null);
    raise exception 'signed-out post allowed';
  exception when insufficient_privilege then null; end;
end$$;
set local role authenticated;
set local request.jwt.claims='{"sub":"44444444-4444-4444-8444-444444444444","is_anonymous":true}';
do $$begin
  begin
    insert into public.discussion_posts(user_id,content,book_id) values('44444444-4444-4444-8444-444444444444','Guest',null);
    raise exception 'anonymous account posted';
  exception when insufficient_privilege then null; end;
end$$;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
update public.discussion_posts set content='Own edit' where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $$begin
  if not exists(select 1 from public.discussion_posts where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' and content='Own edit') then raise exception 'owner cannot edit'; end if;
end$$;
delete from public.discussion_posts where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $$begin
  if exists(select 1 from public.discussion_posts where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') then raise exception 'owner cannot delete'; end if;
end$$;
rollback;
select 'PASS: optional books, public general posts, owner-only writes, guest restrictions and required poll books' as result;
