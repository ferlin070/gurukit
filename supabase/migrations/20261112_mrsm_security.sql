-- Additive GuruKit MRSM upgrade. The original schema.sql is intentionally unchanged.
begin;
alter table public.profiles add column if not exists teaching_context jsonb not null default '{}'::jsonb;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profiles_teaching_context_object') then
  alter table public.profiles add constraint profiles_teaching_context_object check (jsonb_typeof(teaching_context)='object' and octet_length(teaching_context::text)<=12000);
 end if;
end $$;
-- RLS restricts rows; column grants must separately protect plans and quotas.
revoke insert,update,delete,truncate,references,trigger on public.profiles from public,anon,authenticated;
grant select on public.profiles to authenticated;
grant update(full_name,teaching_context) on public.profiles to authenticated;
revoke insert,update,delete,truncate,references,trigger on public.quota_usage from public,anon,authenticated;
revoke all on function public.consume_daily_quota() from public,anon,authenticated;
revoke all on function public.handle_new_user() from public,anon,authenticated;

create table if not exists public.generation_requests (
 id uuid primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 usage_date date not null,
 state text not null default 'reserved' check(state in ('reserved','completed','refunded')),
 created_at timestamptz not null default now()
);
create index if not exists generation_requests_pending on public.generation_requests(user_id,created_at) where state='reserved';
alter table public.generation_requests enable row level security;
revoke all on public.generation_requests from public,anon,authenticated;
grant all on public.generation_requests to service_role;

create or replace function public.refund_stale_generations(p_user_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare r record;
begin
 for r in select * from public.generation_requests where user_id=p_user_id and state='reserved' and created_at<now()-interval '5 minutes' for update skip locked loop
  update public.quota_usage set used=greatest(0,used-1) where user_id=r.user_id and usage_date=r.usage_date;
  update public.generation_requests set state='refunded' where id=r.id;
 end loop;
end $$;
revoke all on function public.refund_stale_generations(uuid) from public,anon,authenticated;

create or replace function public.reserve_generation(p_request_id uuid,p_user_id uuid) returns integer language plpgsql security definer set search_path=public as $$
declare v_date date:=(now() at time zone 'Asia/Kuala_Lumpur')::date; v_limit integer; v_used integer;
begin
 if p_request_id is null or p_user_id is null then raise exception 'invalid request'; end if;
 -- Serialize per-user reservations and refunds in a consistent order.
 select daily_quota into v_limit from public.profiles where id=p_user_id for update;
 if v_limit is null or v_limit<0 then raise exception 'profile unavailable'; end if;
 if exists(select 1 from public.generation_requests where id=p_request_id) then raise exception 'request already reserved'; end if;
 perform public.refund_stale_generations(p_user_id);
 insert into public.quota_usage(user_id,usage_date,used) values(p_user_id,v_date,0) on conflict do nothing;
 update public.quota_usage set used=used+1 where user_id=p_user_id and usage_date=v_date and used<v_limit returning used into v_used;
 if not found then raise exception 'kuota harian telah habis' using errcode='GURUQ'; end if;
 insert into public.generation_requests(id,user_id,usage_date) values(p_request_id,p_user_id,v_date);
 return v_limit-v_used;
end $$;
revoke all on function public.reserve_generation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_generation(uuid,uuid) to service_role;

create or replace function public.finish_generation(p_request_id uuid,p_success boolean) returns void language plpgsql security definer set search_path=public as $$
declare r public.generation_requests; v_user uuid;
begin
 select user_id into v_user from public.generation_requests where id=p_request_id;
 if v_user is null then raise exception 'request not found'; end if;
 perform 1 from public.profiles where id=v_user for update;
 select * into r from public.generation_requests where id=p_request_id for update;
 if r.state<>'reserved' then return; end if;
 if not p_success then update public.quota_usage set used=greatest(0,used-1) where user_id=r.user_id and usage_date=r.usage_date; end if;
 update public.generation_requests set state=case when p_success then 'completed' else 'refunded' end where id=p_request_id;
end $$;
revoke all on function public.finish_generation(uuid,boolean) from public,anon,authenticated;
grant execute on function public.finish_generation(uuid,boolean) to service_role;

create or replace function public.get_daily_quota() returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_profile public.profiles; v_used integer; v_date date:=(now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
 if v_user is null then raise exception 'unauthorized' using errcode='42501'; end if;
 select * into v_profile from public.profiles where id=v_user for update;
 if not found then raise exception 'profile unavailable'; end if;
 perform public.refund_stale_generations(v_user);
 select used into v_used from public.quota_usage where user_id=v_user and usage_date=v_date;
 return jsonb_build_object('plan',v_profile.plan,'dailyQuota',v_profile.daily_quota,'used',coalesce(v_used,0),'usageDate',v_date,'timezone','Asia/Kuala_Lumpur');
end $$;
revoke all on function public.get_daily_quota() from public,anon;
grant execute on function public.get_daily_quota() to authenticated;
commit;
