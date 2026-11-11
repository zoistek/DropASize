-- Test endpoint only. Reverting the frontend commit restores ai-test and its old counters.
create table if not exists public.ai_feature_usage (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null,
 kind text not null,
 count integer not null default 0 check (count >= 0),
 primary key (user_id, day, kind)
);
alter table public.ai_feature_usage enable row level security;
revoke all on public.ai_feature_usage from public, anon, authenticated;
grant all on public.ai_feature_usage to service_role;

create or replace function public.ai_feature_take(p_user uuid, p_kind text, p_limit integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare d date := (now() at time zone 'Europe/London')::date; n integer;
begin
 if p_limit < 1 or p_limit > 20 then raise exception 'Invalid allowance'; end if;
 insert into public.ai_feature_usage(user_id,day,kind,count) values(p_user,d,p_kind,0)
 on conflict (user_id,day,kind) do nothing;
 update public.ai_feature_usage set count=count+1
 where user_id=p_user and day=d and kind=p_kind and count<p_limit returning count into n;
 return coalesce(n,-1);
end $$;
create or replace function public.ai_feature_refund(p_user uuid, p_kind text)
returns void language sql security invoker set search_path = '' as $$
 update public.ai_feature_usage set count=greatest(0,count-1)
 where user_id=p_user and day=(now() at time zone 'Europe/London')::date and kind=p_kind;
$$;
revoke all on function public.ai_feature_take(uuid,text,integer) from public, anon, authenticated;
revoke all on function public.ai_feature_refund(uuid,text) from public, anon, authenticated;
grant execute on function public.ai_feature_take(uuid,text,integer) to service_role;
grant execute on function public.ai_feature_refund(uuid,text) to service_role;
