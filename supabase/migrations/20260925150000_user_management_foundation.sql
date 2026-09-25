create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nama text,
  role text not null default 'USER'
    check (role in ('DIREKTUR','ADMIN','MARKETING','PELAKSANA','USER')),
  status_aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_no_direct_select" on public.user_profiles;
drop policy if exists "user_profiles_no_direct_insert" on public.user_profiles;
drop policy if exists "user_profiles_no_direct_update" on public.user_profiles;
drop policy if exists "user_profiles_no_direct_delete" on public.user_profiles;

create or replace function public.kavio_is_manager()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.user_id = auth.uid()
      and p.status_aktif = true
      and p.role in ('DIREKTUR','ADMIN')
  );
$$;

revoke all on function public.kavio_is_manager() from public;
grant execute on function public.kavio_is_manager() to authenticated;

create or replace function public.kavio_list_users()
returns table (
  user_id uuid,
  email text,
  nama text,
  role text,
  status_aktif boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
stable
as $$
begin
  if not public.kavio_is_manager() then
    raise exception 'Akses ditolak';
  end if;

  return query
  select
    u.id,
    u.email,
    p.nama,
    coalesce(p.role, 'USER'),
    coalesce(p.status_aktif, true),
    u.created_at,
    u.last_sign_in_at
  from auth.users u
  left join public.user_profiles p on p.user_id = u.id
  order by u.created_at;
end;
$$;

revoke all on function public.kavio_list_users() from public;
grant execute on function public.kavio_list_users() to authenticated;

create or replace function public.kavio_upsert_user_profile(
  p_user_id uuid,
  p_nama text,
  p_role text,
  p_status_aktif boolean
)
returns public.user_profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result public.user_profiles;
begin
  if not public.kavio_is_manager() then
    raise exception 'Akses ditolak';
  end if;

  if p_role not in ('DIREKTUR','ADMIN','MARKETING','PELAKSANA','USER') then
    raise exception 'Role tidak valid';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'User tidak ditemukan';
  end if;

  insert into public.user_profiles (user_id, nama, role, status_aktif)
  values (p_user_id, nullif(trim(p_nama), ''), p_role, p_status_aktif)
  on conflict (user_id) do update
    set nama = excluded.nama,
        role = excluded.role,
        status_aktif = excluded.status_aktif,
        updated_at = now()
  returning * into result;

  return result;
end;
$$;

revoke all on function public.kavio_upsert_user_profile(uuid,text,text,boolean) from public;
grant execute on function public.kavio_upsert_user_profile(uuid,text,text,boolean) to authenticated;

insert into public.user_profiles (user_id, nama, role, status_aktif)
select u.id, 'Admin KAVIO', 'DIREKTUR', true
from auth.users u
where lower(u.email) = 'admin@kavio.id'
  and not exists (
    select 1 from public.user_profiles p where p.user_id = u.id
  );
