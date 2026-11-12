-- Disposable local PostgreSQL only.
begin;
insert into public.books(id,title,author) values('91000000-0000-4000-8000-000000000001','Buddy book','Author');
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
select public.create_buddy_read('91000000-0000-4000-8000-000000000001','Our group','91000000-0000-4000-8000-000000000002');
select public.create_buddy_read('91000000-0000-4000-8000-000000000001','Retry','91000000-0000-4000-8000-000000000002');
select set_config('test.buddy_token',(select token::text from public.buddy_read_invites where read_id='91000000-0000-4000-8000-000000000002'),true);
do $$begin if (select count(*) from public.buddy_reads)<>1 or (select count(*) from public.buddy_read_members)<>1 then raise exception 'create retry duplicated group'; end if; end$$;
insert into public.buddy_read_messages(id,read_id,user_id,display_name,chapter,content) values('91000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','Alice',4,'Chapter secret');
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
do $$begin
 if exists(select 1 from public.buddy_reads) or exists(select 1 from public.buddy_read_messages) or exists(select 1 from public.buddy_read_members) or exists(select 1 from public.buddy_read_invites) then raise exception 'outsider read private group'; end if;
 begin insert into public.buddy_read_members(read_id,user_id,display_name) values('91000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','Bob'); raise exception 'joined without invite'; exception when insufficient_privilege then null; end;
 begin perform public.join_buddy_read('91000000-0000-4000-8000-000000000099'); raise exception 'invalid token joined'; exception when invalid_parameter_value then null; end;
end$$;
select public.join_buddy_read(current_setting('test.buddy_token')::uuid);
select public.join_buddy_read(current_setting('test.buddy_token')::uuid);
do $$begin
 if (select count(*) from public.buddy_read_members)<>2 or (select count(*) from public.buddy_read_messages)<>1 then raise exception 'join access failed'; end if;
 if exists(select 1 from public.buddy_read_invites) then raise exception 'member can read owner invite'; end if;
 begin insert into public.buddy_read_messages(read_id,user_id,display_name,content) values('91000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','Alice','Impersonated'); raise exception 'spoofed author'; exception when insufficient_privilege then null; end;
 begin insert into public.buddy_read_messages(read_id,user_id,display_name,content) values('91000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','Alice','Spoofed name'); raise exception 'spoofed name'; exception when insufficient_privilege then null; end;
end$$;
insert into public.buddy_read_messages(read_id,user_id,display_name,content) values('91000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','Bob','Hello');
delete from public.buddy_read_messages where id='91000000-0000-4000-8000-000000000003';
delete from public.buddy_reads;
do $$begin if (select count(*) from public.buddy_reads)<>1 or not exists(select 1 from public.buddy_read_messages where id='91000000-0000-4000-8000-000000000003') then raise exception 'member deleted owner group/message'; end if; end$$;
delete from public.buddy_read_members where user_id='22222222-2222-4222-8222-222222222222';
do $$begin if exists(select 1 from public.buddy_reads) or exists(select 1 from public.buddy_read_messages) then raise exception 'leave retained access'; end if; end$$;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
delete from public.buddy_read_members where user_id='11111111-1111-4111-8111-111111111111';
do $$begin if (select count(*) from public.buddy_read_members)<>1 then raise exception 'host left ownerless group'; end if; end$$;
update public.buddy_read_invites set token=gen_random_uuid() where read_id='91000000-0000-4000-8000-000000000002';
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
do $$begin begin perform public.join_buddy_read(current_setting('test.buddy_token')::uuid); raise exception 'old token worked'; exception when invalid_parameter_value then null; end; end$$;
set local request.jwt.claims='{"sub":"44444444-4444-4444-8444-444444444444","is_anonymous":true}';
do $$begin
 begin perform public.create_buddy_read('91000000-0000-4000-8000-000000000001','Guest group'); raise exception 'guest created group'; exception when insufficient_privilege then null; end;
 begin perform public.join_buddy_read(current_setting('test.buddy_token')::uuid); raise exception 'guest joined'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.buddy_reads) then raise exception 'guest read group'; end if;
end$$;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
delete from public.buddy_reads where id='91000000-0000-4000-8000-000000000002';
reset role;
do $$begin if exists(select 1 from public.buddy_read_members) or exists(select 1 from public.buddy_read_messages) or exists(select 1 from public.buddy_read_invites) then raise exception 'group cascade failed'; end if; end$$;
rollback;
select 'PASS: private groups, atomic/idempotent create/join, invite rotation, name/owner checks, leave revocation, guest rejection and deletion cascades' as result;
