begin;
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- Only the caller's status is exposed; user-editable metadata never authorises access.
create or replace function private.member_status() returns text
language sql stable security definer set search_path='' as $$
  select coalesce((select case when u.banned_until>now() then 'banned' else 'active' end
    from auth.users u where u.id=(select auth.uid())), 'deleted');
$$;
revoke all on function private.member_status() from public,anon;
grant execute on function private.member_status() to authenticated,service_role;
create or replace function public.account_status() returns text
language sql stable security invoker set search_path='' as $$ select private.member_status(); $$;
revoke all on function public.account_status() from public,anon;
grant execute on function public.account_status() to authenticated;

-- Only member-owned/private records and member write actions are guarded.
-- Catalog reads, AI usage tables and coach administration policies are unchanged.
drop policy if exists member_must_be_active on public.profiles;
create policy member_must_be_active on public.profiles as restrictive for all to authenticated using ((select private.member_status())='active') with check ((select private.member_status())='active');
drop policy if exists member_must_be_active on public.user_data;
create policy member_must_be_active on public.user_data as restrictive for all to authenticated using ((select private.member_status())='active') with check ((select private.member_status())='active');
drop policy if exists member_must_be_active on public.coach_notes;
create policy member_must_be_active on public.coach_notes as restrictive for all to authenticated using ((select private.member_status())='active') with check ((select private.member_status())='active');
drop policy if exists member_must_be_active on public.reports;
create policy member_must_be_active on public.reports as restrictive for all to authenticated using ((select private.member_status())='active') with check ((select private.member_status())='active');
drop policy if exists member_must_be_active on storage.objects;
create policy member_must_be_active on storage.objects as restrictive for all to authenticated using ((select private.member_status())='active') with check ((select private.member_status())='active');
drop policy if exists member_active_insert on public.shared_docs;
create policy member_active_insert on public.shared_docs as restrictive for insert to authenticated with check ((select private.member_status())='active');
drop policy if exists member_active_update on public.shared_docs;
create policy member_active_update on public.shared_docs as restrictive for update to authenticated using ((select private.member_status())='active') with check ((select private.member_status())='active');
drop policy if exists member_active_delete on public.shared_docs;
create policy member_active_delete on public.shared_docs as restrictive for delete to authenticated using ((select private.member_status())='active') ;

create table if not exists public.member_actions (
  id uuid primary key,
  actor_id uuid,
  target_id uuid not null,
  action text not null check(action in ('ban','unban','delete')),
  recipient text,
  reason text not null default '',
  status text not null default 'started' check(status in ('started','done','failed')),
  email_status text not null default 'pending' check(email_status in ('pending','sent','failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.member_actions enable row level security;
revoke all on public.member_actions from public,anon,authenticated;
grant select,insert,update on public.member_actions to service_role;

-- Only the service role used inside the protected moderation function can revoke other sessions.
create or replace function public.moderation_revoke_sessions(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$ begin
  if (select auth.role()) is distinct from 'service_role' then raise exception 'Not allowed'; end if;
  delete from auth.sessions where user_id=p_user;
end $$;
revoke all on function public.moderation_revoke_sessions(uuid) from public,anon,authenticated;
grant execute on function public.moderation_revoke_sessions(uuid) to service_role;
-- Abort this entire migration if normal access changes for any existing active account.
do $$ declare member record; visible_count bigint; state text; total_members bigint; begin
  select count(*) into total_members from public.profiles;
  for member in select p.id,p.email,p.role,(select count(*) from public.user_data d where d.user_id=p.id) as saved_count
    from public.profiles p join auth.users u on u.id=p.id where u.banned_until is null or u.banned_until<=now()
  loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub',member.id,'role','authenticated','email',member.email)::text,true);
    execute 'set local role authenticated';
    select public.account_status() into state;
    if state<>'active' then raise exception 'Active account status validation failed'; end if;
    select count(*) into visible_count from public.profiles where id=member.id;
    if visible_count<>1 then raise exception 'Active profile access validation failed'; end if;
    select count(*) into visible_count from public.user_data where user_id=member.id;
    if visible_count<>member.saved_count then raise exception 'Active saved-data access validation failed'; end if;
    if member.role='coach' then
      select count(*) into visible_count from public.admin_users();
      if visible_count<>total_members then raise exception 'Coach dashboard access validation failed'; end if;
    end if;
    execute 'reset role';
  end loop;
end $$;
commit;
