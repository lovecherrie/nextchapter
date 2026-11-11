-- Disposable local database only. No production uploads or test accounts.
begin;
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
insert into storage.objects(bucket_id,name) values('reader-avatars','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg');
update public.reader_profiles set avatar_path='11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg' where user_id='11111111-1111-4111-8111-111111111111';
do $$begin
  if (select avatar_path from public.reader_cards where user_id='11111111-1111-4111-8111-111111111111') is null then raise exception 'owner photo did not save'; end if;
  begin update public.reader_profiles set avatar_path='22222222-2222-4222-8222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg' where user_id='11111111-1111-4111-8111-111111111111'; raise exception 'foreign photo path accepted'; exception when check_violation then null; end;
  begin insert into storage.objects(bucket_id,name) values('reader-avatars','22222222-2222-4222-8222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'); raise exception 'foreign upload accepted'; exception when insufficient_privilege then null; end;
  begin insert into storage.objects(bucket_id,name) values('reader-avatars','11111111-1111-4111-8111-111111111111/photo.svg'); raise exception 'invalid photo path accepted'; exception when insufficient_privilege then null; end;
end$$;
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
delete from storage.objects;
update public.reader_profiles set avatar_path=null where user_id='11111111-1111-4111-8111-111111111111';
reset role;
do $$begin
  if (select count(*) from storage.objects) <> 1 then raise exception 'another reader deleted photo'; end if;
  if (select avatar_path from public.reader_profiles where user_id='11111111-1111-4111-8111-111111111111') is null then raise exception 'another reader edited photo'; end if;
end$$;
set local role anon;
set local request.jwt.claims='{}';
do $$begin
  if (select avatar_path from public.reader_cards where user_id='11111111-1111-4111-8111-111111111111') is null then raise exception 'public photo not available'; end if;
  begin insert into storage.objects(bucket_id,name) values('reader-avatars','11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg'); raise exception 'signed out upload accepted'; exception when insufficient_privilege then null; end;
end$$;
reset role;
update public.reader_profiles set is_public=false where user_id='11111111-1111-4111-8111-111111111111';
set local role anon;
do $$begin if exists(select 1 from public.reader_cards where user_id='11111111-1111-4111-8111-111111111111') then raise exception 'private photo path leaked in profile'; end if; end$$;
reset role;
set local role authenticated;
set local request.jwt.claims='{"sub":"44444444-4444-4444-8444-444444444444","is_anonymous":true}';
do $$begin
  begin insert into storage.objects(bucket_id,name) values('reader-avatars','44444444-4444-4444-8444-444444444444/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'); raise exception 'guest upload accepted'; exception when insufficient_privilege then null; end;
end$$;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
delete from storage.objects;
update public.reader_profiles set avatar_path=null where user_id='11111111-1111-4111-8111-111111111111';
do $$begin if (select count(*) from storage.objects) <> 0 then raise exception 'own photo removal failed'; end if; end$$;
rollback;
select 'PASS: avatar ownership, public/private profiles, upload paths, guest restrictions, and removal' as result;
