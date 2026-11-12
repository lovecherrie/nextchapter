begin;
insert into public.books(id,external_id,title) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','atomic-one','One'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','atomic-two','Two');
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
select public.save_top_four(array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[],array[1]::smallint[]);
do $$begin
 begin perform public.save_top_four(array['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc']::uuid[],array[2,4]::smallint[]);raise exception 'missing book accepted';exception when foreign_key_violation then null;end;
 if (select count(*) from public.profile_top_books where user_id=(select auth.uid())) <> 1 or not exists(select 1 from public.profile_top_books where user_id=(select auth.uid()) and book_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and position=1) then raise exception 'failed save removed previous shelf';end if;
 begin perform public.save_top_four(array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[],array[1,2]::smallint[]);raise exception 'duplicate accepted';exception when raise_exception then if sqlerrm='duplicate accepted' then raise;end if;end;
 begin perform public.save_top_four(array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[],array[5]::smallint[]);raise exception 'invalid position accepted';exception when raise_exception then if sqlerrm='invalid position accepted' then raise;end if;end;
end$$;
select public.save_top_four(array['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[],array[2,4]::smallint[]);
do $$begin if (select count(*) from public.profile_top_books where user_id=(select auth.uid()))<>2 then raise exception 'replacement failed';end if;end$$;
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
select public.save_top_four(array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[],array[1]::smallint[]);
select public.save_top_four(array[]::uuid[],array[]::smallint[]);
do $$begin if exists(select 1 from public.profile_top_books where user_id=(select auth.uid())) then raise exception 'clear failed';end if;if (select count(*) from public.profile_top_books where user_id='11111111-1111-4111-8111-111111111111')<>2 then raise exception 'another shelf changed';end if;end$$;
set local request.jwt.claims='{"sub":"44444444-4444-4444-8444-444444444444","is_anonymous":true}';
do $$begin begin perform public.save_top_four(array[]::uuid[],array[]::smallint[]);raise exception 'guest save allowed';exception when insufficient_privilege then null;end;end$$;
reset role;set local role anon;
do $$begin begin perform public.save_top_four(array[]::uuid[],array[]::smallint[]);raise exception 'signed-out save allowed';exception when insufficient_privilege then null;end;end$$;
reset role;rollback;
