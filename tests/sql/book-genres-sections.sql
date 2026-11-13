begin;
insert into public.books(id,title) values('95000000-0000-4000-8000-000000000001','Sparse catalogue manga');
insert into public.book_genres(book_id,genres) values('95000000-0000-4000-8000-000000000001',array['Manga & Graphic Novels','Fantasy']);
set local role anon;
set local request.jwt.claims='{}';
do $$begin
 if (select count(*) from public.book_genres)<>1 then raise exception 'Public genres unavailable'; end if;
 begin update public.book_genres set genres=array['Wrong']; raise exception 'Public can overwrite curated genres'; exception when insufficient_privilege then null; end;
end$$;
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}';
do $$begin
 begin delete from public.book_genres; raise exception 'Readers can delete curated genres'; exception when insufficient_privilege then null; end;
end$$;
insert into public.discussion_posts(id,user_id,content) values('95000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','Whole book discussion');
insert into public.discussion_posts(id,user_id,content,section_label) values('95000000-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','Chapter discussion','chapter:12');
update public.discussion_posts set section_label='epilogue' where id='95000000-0000-4000-8000-000000000003';
do $$begin
 if (select section_label from public.discussion_posts where id='95000000-0000-4000-8000-000000000002') is not null then raise exception 'Whole book default changed'; end if;
 begin update public.discussion_posts set section_label='chapter:1001' where id='95000000-0000-4000-8000-000000000003'; raise exception 'Invalid chapter allowed'; exception when check_violation then null; end;
end$$;
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}';
update public.discussion_posts set section_label='chapter:1' where id='95000000-0000-4000-8000-000000000003';
do $$begin if (select section_label from public.discussion_posts where id='95000000-0000-4000-8000-000000000003')<>'epilogue' then raise exception 'Edited another reader section'; end if; end$$;
rollback;
