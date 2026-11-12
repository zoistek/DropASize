begin;
-- UPDATE/UPSERT needs SELECT visibility as well as the existing managed-key write policies.
-- These are exactly the three keys already readable through coach_user_data regardless of consent.
create policy "coach reads managed keys" on public.user_data for select to authenticated
using ((select public.is_coach()) and key in ('daily-target','training-plan','coach-plan'));

-- Verify assignment, updates, own-member reads, and private-data denial before committing.
do $$ declare fixture uuid:=gen_random_uuid(); coach record; visible integer; before_value jsonb; begin
  select id,email into coach from public.profiles where role='coach' limit 1;
  if coach.id is null then raise exception 'No coach available to validate managed-key access'; end if;
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
    values(fixture,'authenticated','authenticated','assignment-check-'||fixture||'@example.invalid','',now(),now(),now(),'{}','{}');
  insert into public.user_data(user_id,key,value) values
    (fixture,'coach-plan','"{}"'::jsonb),(fixture,'reflections','"private fixture"'::jsonb);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',coach.id,'role','authenticated','email',coach.email)::text,true);
  execute 'set local role authenticated';
  insert into public.user_data(user_id,key,value) values(fixture,'coach-plan','"{\"check\":true}"'::jsonb)
    on conflict(user_id,key) do update set value=excluded.value;
  insert into public.user_data(user_id,key,value) values(fixture,'training-plan','"{\"check\":true}"'::jsonb)
    on conflict(user_id,key) do update set value=excluded.value;
  select count(*) into visible from public.user_data where user_id=fixture and key in ('coach-plan','training-plan');
  if visible<>2 then raise exception 'Coach managed-key read/update validation failed'; end if;
  select count(*) into visible from public.user_data where user_id=fixture and key='reflections';
  if visible<>0 then raise exception 'Private member data became visible'; end if;
  update public.user_data set value='"not allowed"'::jsonb where user_id=fixture and key='reflections';
  get diagnostics visible=row_count;
  if visible<>0 then raise exception 'Coach could update private member data'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',fixture,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  select count(*) into visible from public.user_data where user_id=fixture;
  if visible<>3 then raise exception 'Member own-data access validation failed'; end if;
  execute 'reset role';
  delete from auth.users where id=fixture;
end $$;
commit;
