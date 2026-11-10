-- file: supabase/schema.sql
-- GuruKit: profil member, kuota harian, dokumen tersimpan. Jalankan dalam SQL Editor Supabase.

create extension if not exists "pgcrypto";

-- Profil: 1:1 dengan auth.users, dicipta automatik bila daftar
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Guru',
  plan text not null default 'free' check (plan in ('free', 'pro')),
  daily_quota int not null default 5,     -- bilangan jana/hari untuk plan free
  created_at timestamptz not null default now()
);

-- Kuota harian: satu baris per hari per pengguna
create table public.quota_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  used int not null default 0,
  primary key (user_id, usage_date)
);

-- Dokumen tersimpan
create table public.saved_documents (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_id text not null,
  title text not null default 'Dokumen',
  content text not null,
  created_at timestamptz not null default now()
);

-- RLS: pengguna hanya nampak baris sendiri; service role (API proxy) langkau RLS
alter table public.profiles enable row level security;
alter table public.quota_usage enable row level security;
alter table public.saved_documents enable row level security;

create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "read own quota" on public.quota_usage
  for select using (auth.uid() = user_id);
create policy "own documents" on public.saved_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-wujud profil bila daftar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Guru'))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Kuota ATOMIK: sahkan + tingkatkan dalam satu transaksi.
-- Dipanggil oleh API proxy (service role) SAHAJA.
create or replace function public.consume_daily_quota()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_quota int;
  v_used int;
begin
  select daily_quota into v_quota from public.profiles where id = auth.uid();
  if v_quota is null then
    raise exception 'profil tidak dijumpai' using errcode = 'P0001';
  end if;

  insert into public.quota_usage (user_id, usage_date, used)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, usage_date) do update set used = quota_usage.used + 1
  returning used into v_used;

  if v_used > v_quota then
    -- balikkan kenaikan dan tolak permintaan
    update public.quota_usage
      set used = used - 1
      where user_id = auth.uid() and usage_date = current_date;
    raise exception 'kuota harian telah habis' using errcode = 'GURUQ';
  end if;

  return v_quota - v_used;  -- baki baki hari ini
end $$;
