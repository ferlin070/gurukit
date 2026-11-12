begin;
create table if not exists public.production_limits (
 id boolean primary key default true check(id),
 generation_enabled boolean not null default true,
 global_daily_attempts integer not null default 500 check(global_daily_attempts between 1 and 100000),
 global_concurrent integer not null default 10 check(global_concurrent between 1 and 100),
 user_concurrent integer not null default 1 check(user_concurrent between 1 and 5),
 user_per_minute integer not null default 6 check(user_per_minute between 1 and 60)
);
insert into public.production_limits(id) values(true) on conflict do nothing;
create table if not exists public.model_attempts (
 id bigint generated always as identity primary key,
 request_id uuid references public.generation_requests(id) on delete set null,
 model text not null check(model in ('gemini-3.5-flash','gemini-3.6-flash','gemini-3.1-flash-lite')),
 attempt_date date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
 created_at timestamptz not null default now(),
 unique(request_id,model)
);
create index if not exists model_attempts_day on public.model_attempts(attempt_date);
create table if not exists public.daily_model_budget (
 usage_date date primary key,
 attempts integer not null default 0 check(attempts>=0)
);
create table if not exists public.operational_events (
 id bigint generated always as identity primary key,
 event text not null check(event in ('generation_ok','generation_error','request_rejected','client_error','backup_ok','backup_error','health_ok','health_error')),
 code text not null check(code ~ '^[A-Z0-9_]{1,64}$'),
 request_id uuid,
 actor_id uuid references public.profiles(id) on delete set null,
 tool_id text check(length(tool_id)<=80),
 duration_ms integer check(duration_ms between 0 and 120000),
 created_at timestamptz not null default now()
);
create index if not exists operational_events_recent on public.operational_events(created_at desc);
create index if not exists generation_requests_actor_rate on public.generation_requests(user_id,created_at desc);
create table if not exists public.operations_runs (
 usage_date date primary key,
 state text not null check(state in ('running','completed','failed')),
 object_name text,
 started_at timestamptz not null default now(),
 completed_at timestamptz
);
alter table public.production_limits enable row level security;
alter table public.model_attempts enable row level security;
alter table public.daily_model_budget enable row level security;
alter table public.operational_events enable row level security;
alter table public.operations_runs enable row level security;
revoke all on public.production_limits,public.model_attempts,public.daily_model_budget,public.operational_events,public.operations_runs from public,anon,authenticated;
grant all on public.production_limits,public.model_attempts,public.daily_model_budget,public.operational_events,public.operations_runs to service_role;
revoke all on sequence public.model_attempts_id_seq,public.operational_events_id_seq from public,anon,authenticated;
grant usage,select on sequence public.model_attempts_id_seq,public.operational_events_id_seq to service_role;

create table if not exists public.generation_rate_windows (
 user_id uuid not null references public.profiles(id) on delete cascade,
 minute_bucket timestamptz not null,
 hits integer not null default 1,
 primary key(user_id,minute_bucket)
);
alter table public.generation_rate_windows enable row level security;
revoke all on public.generation_rate_windows from public,anon,authenticated;
grant all on public.generation_rate_windows to service_role;
create or replace function public.check_generation_rate(p_user_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare v_limit int; v_hits int;
begin
 select user_per_minute into strict v_limit from public.production_limits where id=true;
 insert into public.generation_rate_windows(user_id,minute_bucket,hits) values(p_user_id,date_trunc('minute',now()),1)
 on conflict(user_id,minute_bucket) do update set hits=generation_rate_windows.hits+1 where generation_rate_windows.hits<v_limit returning hits into v_hits;
 if not found then raise exception 'rate limit' using errcode='GURUR';end if;
 return true;
end $$;
revoke all on function public.check_generation_rate(uuid) from public,anon,authenticated;
grant execute on function public.check_generation_rate(uuid) to service_role;

create or replace function public.reserve_generation(p_request_id uuid,p_user_id uuid) returns integer language plpgsql security definer set search_path=public as $$
declare v_date date:=(now() at time zone 'Asia/Kuala_Lumpur')::date; v_limit integer; v_used integer; v_config public.production_limits;
begin
 if p_request_id is null or p_user_id is null then raise exception 'invalid request';end if;
 perform pg_advisory_xact_lock(67704,1);
 select * into strict v_config from public.production_limits where id=true;
 if not v_config.generation_enabled then raise exception 'generation paused' using errcode='GURUM';end if;
 select daily_quota into v_limit from public.profiles where id=p_user_id for update;
 if v_limit is null or v_limit<0 then raise exception 'profile unavailable';end if;
 if exists(select 1 from public.generation_requests where id=p_request_id) then raise exception 'request already reserved';end if;
 perform public.refund_stale_generations(p_user_id);
 if (select count(*) from public.generation_requests where user_id=p_user_id and created_at>=now()-interval '1 minute')>=v_config.user_per_minute then raise exception 'rate limit' using errcode='GURUR';end if;
 if (select count(*) from public.generation_requests where user_id=p_user_id and state='reserved' and created_at>=now()-interval '5 minutes')>=v_config.user_concurrent then raise exception 'user concurrency limit' using errcode='GURUC';end if;
 if (select count(*) from public.generation_requests where state='reserved' and created_at>=now()-interval '5 minutes')>=v_config.global_concurrent then raise exception 'global concurrency limit' using errcode='GURUC';end if;
 if coalesce((select attempts from public.daily_model_budget where usage_date=v_date),0)>=v_config.global_daily_attempts then raise exception 'daily model budget' using errcode='GURUB';end if;
 insert into public.quota_usage(user_id,usage_date,used) values(p_user_id,v_date,0) on conflict do nothing;
 update public.quota_usage set used=used+1 where user_id=p_user_id and usage_date=v_date and used<v_limit returning used into v_used;
 if not found then raise exception 'kuota harian telah habis' using errcode='GURUQ';end if;
 insert into public.generation_requests(id,user_id,usage_date) values(p_request_id,p_user_id,v_date);
 return v_limit-v_used;
end $$;
revoke all on function public.reserve_generation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_generation(uuid,uuid) to service_role;

create or replace function public.begin_model_attempt(p_request_id uuid,p_model text) returns boolean language plpgsql security definer set search_path=public as $$
declare v_date date:=(now() at time zone 'Asia/Kuala_Lumpur')::date; v_config public.production_limits;
begin
 perform pg_advisory_xact_lock(67704,1);
 select * into strict v_config from public.production_limits where id=true;
 if not v_config.generation_enabled then raise exception 'generation paused' using errcode='GURUM';end if;
 if p_model not in ('gemini-3.5-flash','gemini-3.6-flash','gemini-3.1-flash-lite') then raise exception 'unknown model';end if;
 if not exists(select 1 from public.generation_requests where id=p_request_id and state='reserved' and created_at>=now()-interval '5 minutes') then raise exception 'invalid reservation';end if;
 if exists(select 1 from public.model_attempts where request_id=p_request_id and model=p_model) then return true;end if;
 insert into public.daily_model_budget(usage_date,attempts) values(v_date,0) on conflict do nothing;
 update public.daily_model_budget set attempts=attempts+1 where usage_date=v_date and attempts<v_config.global_daily_attempts;
 if not found then raise exception 'daily model budget' using errcode='GURUB';end if;
 insert into public.model_attempts(request_id,model,attempt_date) values(p_request_id,p_model,v_date);
 return true;
end $$;
revoke all on function public.begin_model_attempt(uuid,text) from public,anon,authenticated;
grant execute on function public.begin_model_attempt(uuid,text) to service_role;

create or replace function public.record_client_error(p_user_id uuid,p_code text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if p_code not in ('UI_RENDER_ERROR','UNHANDLED_ERROR','UNHANDLED_REJECTION') then raise exception 'invalid event';end if;
 perform 1 from public.profiles where id=p_user_id for update;
 if not found then return false;end if;
 if (select count(*) from public.operational_events where actor_id=p_user_id and event='client_error' and created_at>=now()-interval '1 hour')>=6 then return false;end if;
 insert into public.operational_events(event,code,actor_id) values('client_error',p_code,p_user_id);
 return true;
end $$;
revoke all on function public.record_client_error(uuid,text) from public,anon,authenticated;
grant execute on function public.record_client_error(uuid,text) to service_role;

create or replace function public.operational_health() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('database',true,'generationEnabled',(select generation_enabled from public.production_limits where id=true),'attemptsToday',coalesce((select attempts from public.daily_model_budget where usage_date=(now() at time zone 'Asia/Kuala_Lumpur')::date),0),'attemptLimit',(select global_daily_attempts from public.production_limits where id=true),'recentGenerationErrors',(select count(*) from public.operational_events where event='generation_error' and created_at>=now()-interval '1 hour'),'lastBackupAt',(select max(completed_at) from public.operations_runs where state='completed'));
$$;
revoke all on function public.operational_health() from public,anon,authenticated;
grant execute on function public.operational_health() to service_role;

create or replace function public.application_backup_snapshot() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_table text; v_bytes bigint:=0; v_size bigint; v_result jsonb:='{}'; v_rows jsonb;
begin
 foreach v_table in array array['profiles','quota_usage','saved_documents','rph_templates','question_banks'] loop
  execute format('select coalesce(sum(octet_length(to_jsonb(t)::text)),0) from public.%I t',v_table) into v_size;
  v_bytes:=v_bytes+v_size;
 end loop;
 if v_bytes>8388608 then raise exception 'application snapshot exceeds 8 MiB; configure native database backup';end if;
 foreach v_table in array array['profiles','quota_usage','saved_documents','rph_templates','question_banks'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t',v_table) into v_rows;
  v_result:=v_result||jsonb_build_object(v_table,v_rows);
 end loop;
 return jsonb_build_object('version',1,'kind','gurukit-application','createdAt',now(),'tables',v_result,'excludes',jsonb_build_array('auth credentials','auth sessions','storage objects','database schema'));
end $$;
revoke all on function public.application_backup_snapshot() from public,anon,authenticated;
grant execute on function public.application_backup_snapshot() to service_role;

create or replace function public.claim_operations_run(p_date date) returns boolean language plpgsql security definer set search_path=public as $$
declare v_row public.operations_runs;
begin
 insert into public.operations_runs(usage_date,state) values(p_date,'running') on conflict do nothing;
 if found then return true;end if;
 select * into strict v_row from public.operations_runs where usage_date=p_date for update;
 if v_row.state='completed' or (v_row.state='running' and v_row.started_at>now()-interval '10 minutes') then return false;end if;
 update public.operations_runs set state='running',started_at=now(),completed_at=null where usage_date=p_date;
 return true;
end $$;
revoke all on function public.claim_operations_run(date) from public,anon,authenticated;
grant execute on function public.claim_operations_run(date) to service_role;
create or replace function public.prune_operational_metadata() returns void language plpgsql security definer set search_path=public as $$
begin
 delete from public.generation_rate_windows where minute_bucket<now()-interval '2 days';
 delete from public.operational_events where created_at<now()-interval '30 days';
 delete from public.model_attempts where created_at<now()-interval '30 days';
 delete from public.generation_requests where created_at<now()-interval '30 days' and state<>'reserved';
 delete from public.daily_model_budget where usage_date<current_date-90;
 delete from public.operations_runs where usage_date<current_date-90;
end $$;
revoke all on function public.prune_operational_metadata() from public,anon,authenticated;
grant execute on function public.prune_operational_metadata() to service_role;
commit;
