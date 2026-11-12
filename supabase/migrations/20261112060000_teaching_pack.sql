begin;
create table if not exists public.rph_templates (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 config jsonb not null check(jsonb_typeof(config)='object' and octet_length(config::text)<=16000),
 updated_at timestamptz not null default now()
);
create table if not exists public.question_banks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 160),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=400000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists question_banks_owner_updated on public.question_banks(user_id,updated_at desc);
alter table public.rph_templates enable row level security;
alter table public.question_banks enable row level security;
revoke all on public.rph_templates,public.question_banks from public,anon;
grant select,insert,update,delete on public.rph_templates,public.question_banks to authenticated;
grant all on public.rph_templates,public.question_banks to service_role;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='rph_templates' and policyname='own RPH template') then
  create policy "own RPH template" on public.rph_templates for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='question_banks' and policyname='own question bank') then
  create policy "own question bank" on public.question_banks for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
 end if;
end $$;
commit;
