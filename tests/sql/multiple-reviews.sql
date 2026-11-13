-- Disposable database only; never seed production activity.
begin;
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
insert into public.ratings(id,user_id,book_id,content,overall_rating) values
 ('94000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','94000000-0000-4000-8000-000000000010','First reading',2),
 ('94000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','94000000-0000-4000-8000-000000000010','Reread',5);
create temporary table original_reviews as select id,created_at from public.ratings;
update public.ratings set content='Corrected first review',created_at='2099-01-01' where id='94000000-0000-4000-8000-000000000001';
do $$begin
 if (select count(*) from public.ratings)<>2 then raise exception 'Reread overwrote history'; end if;
 if exists(select 1 from public.ratings r join original_reviews o using(id) where r.created_at is distinct from o.created_at) then raise exception 'Edit changed original date'; end if;
 if (select content from public.ratings where id='94000000-0000-4000-8000-000000000002')<>'Reread' then raise exception 'Editing one review changed another'; end if;
 begin update public.ratings set book_id='94000000-0000-4000-8000-000000000011' where id='94000000-0000-4000-8000-000000000001'; raise exception 'Identity change allowed'; exception when raise_exception then if sqlerrm='Identity change allowed' then raise; end if; end;
end$$;
-- Retrying the same new review ID edits that row rather than adding another.
insert into public.ratings(id,user_id,book_id,content,overall_rating) values('94000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','94000000-0000-4000-8000-000000000010','Reread retry',5) on conflict(id) do update set content=excluded.content;
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
update public.ratings set content='Not mine' where id='94000000-0000-4000-8000-000000000001';
delete from public.ratings where id='94000000-0000-4000-8000-000000000001';
do $$begin
 if (select count(*) from public.ratings)<>2 then raise exception 'Deleted another reader review'; end if;
 if (select content from public.ratings where id='94000000-0000-4000-8000-000000000001')<>'Corrected first review' then raise exception 'Edited another reader review'; end if;
 begin insert into public.ratings(user_id,book_id,content,overall_rating) values('11111111-1111-4111-8111-111111111111','94000000-0000-4000-8000-000000000010','Forged',1); raise exception 'forged review'; exception when insufficient_privilege then null; end;
end$$;
set local role anon;
set local request.jwt.claims='{}';
do $$begin if (select count(*) from public.ratings)<>2 then raise exception 'Public history unavailable'; end if; end$$;
rollback;
