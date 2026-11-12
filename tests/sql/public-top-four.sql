begin;
insert into public.books(id,external_id,title) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','shelf-test','Shelf Test');
insert into public.profile_top_books(user_id,book_id,position) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1),
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1),
 ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1);
update public.reader_profiles set is_public=false where user_id='33333333-3333-4333-8333-333333333333';
update public.reader_profiles set show_top_books=false where user_id='22222222-2222-4222-8222-222222222222';
update public.reader_profiles set show_activity=false where user_id='11111111-1111-4111-8111-111111111111';
set local role anon;
set local request.jwt.claims='{}';
do $$begin
 if (select count(*) from public.profile_top_books) <> 1 then raise exception 'hidden shelves leaked or activity setting hid public Top 4'; end if;
 begin insert into public.profile_top_books(user_id,book_id,position) values('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2); raise exception 'signed out insert allowed'; exception when insufficient_privilege then null; end;
end$$;
reset role;
set local role authenticated;
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
do $$begin
 if (select count(*) from public.profile_top_books where user_id='22222222-2222-4222-8222-222222222222') <> 1 then raise exception 'hidden shelf owner lost access'; end if;
 begin update public.profile_top_books set user_id='11111111-1111-4111-8111-111111111111'; raise exception 'owner identity mutation allowed'; exception when insufficient_privilege then null; end;
 begin insert into public.profile_top_books(user_id,book_id,position) values('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2); raise exception 'cross-user insert allowed'; exception when insufficient_privilege then null; end;
end$$;
update public.reader_profiles set show_top_books=true where user_id='22222222-2222-4222-8222-222222222222';
update public.profile_top_books set position=2 where user_id='22222222-2222-4222-8222-222222222222';
reset role;
set local role anon;
set local request.jwt.claims='{}';
do $$begin
 if (select count(*) from public.profile_top_books) <> 2 then raise exception 'visibility choice did not expose shelf'; end if;
 if (select position from public.profile_top_books where user_id='22222222-2222-4222-8222-222222222222') <> 2 then raise exception 'owner update failed'; end if;
end$$;
reset role;
set local role authenticated;
set local request.jwt.claims='{"sub":"33333333-3333-4333-8333-333333333333","is_anonymous":false}';
do $$begin
 if (select count(*) from public.profile_top_books where user_id='33333333-3333-4333-8333-333333333333') <> 1 then raise exception 'private profile owner lost shelf'; end if;
end$$;
set local request.jwt.claims='{"sub":"44444444-4444-4444-8444-444444444444","is_anonymous":true}';
do $$begin
 begin insert into public.profile_top_books(user_id,book_id,position) values('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1); raise exception 'anonymous guest insert allowed'; exception when insufficient_privilege then null; end;
end$$;
reset role;
rollback;
