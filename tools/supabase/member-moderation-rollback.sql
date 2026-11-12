begin;
do $$ declare row record; begin
  for row in select schemaname,tablename,policyname from pg_policies where policyname in ('member_must_be_active','member_active_insert','member_active_update','member_active_delete')
  loop execute format('drop policy %I on %I.%I',row.policyname,row.schemaname,row.tablename); end loop;
end $$;
drop function if exists public.account_status();
drop function if exists public.moderation_revoke_sessions(uuid);
drop function if exists private.member_status();
-- Keep member_actions as a private service-only delivery/audit record; do not discard pending email.
commit;
