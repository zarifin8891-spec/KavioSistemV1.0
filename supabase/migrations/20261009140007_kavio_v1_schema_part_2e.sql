
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

-- Seed the existing administrator without hardcoding a generated UUID.
insert into public.user_profiles (user_id, nama, role, status_aktif)
select u.id, 'Admin KAVIO', 'DIREKTUR', true
from auth.users u
where lower(u.email) = 'admin@kavio.id'
  and not exists (
    select 1 from public.user_profiles p where p.user_id = u.id
  );


create or replace function public.kavio_get_current_access()
returns table (role text, status_aktif boolean)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(p.role, 'USER') as role,
    coalesce(p.status_aktif, true) as status_aktif
  from (select auth.uid() as user_id) me
  left join public.user_profiles p on p.user_id = me.user_id;
$$;

revoke all on function public.kavio_get_current_access() from public;
grant execute on function public.kavio_get_current_access() to authenticated;


create or replace function public.kavio_can_action(p_action text)
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
      and (
        (p.role = 'DIREKTUR' and p_action in ('MASTER_WRITE','SALES_WRITE','SPK_WRITE','PROGRESS_WRITE','SITEPLAN_MAP','USER_MANAGE'))
        or
        (p.role = 'ADMIN' and p_action in ('MASTER_WRITE','SALES_WRITE','SPK_WRITE','PROGRESS_WRITE','SITEPLAN_MAP','USER_MANAGE'))
        or
        (p.role = 'MARKETING' and p_action = 'SALES_WRITE')
        or
        (p.role = 'PELAKSANA' and p_action in ('SPK_WRITE','PROGRESS_WRITE'))
      )
  );
$$;

revoke all on function public.kavio_can_action(text) from public;
grant execute on function public.kavio_can_action(text) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'master_bank','master_kantor_pelaksana','master_kategori_pekerjaan',
    'master_mandor','master_notaris','master_tipe_rumah','template_progress_tipe'
  ] loop
    execute format('drop policy if exists "kavio_auth_all" on public.%I', t);
    execute format('create policy "kavio_select_authenticated" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "kavio_write_managers" on public.%I for all to authenticated using (public.kavio_can_action(''MASTER_WRITE'')) with check (public.kavio_can_action(''MASTER_WRITE''))', t);
  end loop;
end $$;

drop policy if exists "kavio_auth_all" on public.master_kavling;
create policy "kavio_select_authenticated" on public.master_kavling for select to authenticated using (true);
create policy "kavio_write_master" on public.master_kavling for all to authenticated using (public.kavio_can_action('MASTER_WRITE')) with check (public.kavio_can_action('MASTER_WRITE'));

drop policy if exists "kavio_auth_all" on public.sales;
create policy "kavio_select_sales" on public.sales for select to authenticated using (true);
create policy "kavio_write_sales" on public.sales for all to authenticated using (public.kavio_can_action('SALES_WRITE')) with check (public.kavio_can_action('SALES_WRITE'));

drop policy if exists "kavio_auth_all" on public.sales_biaya_tambahan;
create policy "kavio_select_sales_biaya" on public.sales_biaya_tambahan for select to authenticated using (true);
create policy "kavio_write_sales_biaya" on public.sales_biaya_tambahan for all to authenticated using (public.kavio_can_action('SALES_WRITE')) with check (public.kavio_can_action('SALES_WRITE'));

drop policy if exists "kavio_auth_all" on public.sales_kpr_progress;
create policy "kavio_select_sales_kpr" on public.sales_kpr_progress for select to authenticated using (true);
create policy "kavio_write_sales_kpr" on public.sales_kpr_progress for all to authenticated using (public.kavio_can_action('SALES_WRITE')) with check (public.kavio_can_action('SALES_WRITE'));

drop policy if exists "kavio_auth_all" on public.spk;
create policy "kavio_select_spk" on public.spk for select to authenticated using (true);
create policy "kavio_write_spk" on public.spk for all to authenticated using (public.kavio_can_action('SPK_WRITE')) with check (public.kavio_can_action('SPK_WRITE'));

drop policy if exists "kavio_auth_all" on public.spk_progress_config;
create policy "kavio_select_spk_config" on public.spk_progress_config for select to authenticated using (true);
create policy "kavio_write_spk_config" on public.spk_progress_config for all to authenticated using (public.kavio_can_action('SPK_WRITE')) with check (public.kavio_can_action('SPK_WRITE'));

drop policy if exists "kavio_auth_all" on public.progress_update;
create policy "kavio_select_progress" on public.progress_update for select to authenticated using (true);
create policy "kavio_write_progress" on public.progress_update for all to authenticated using (public.kavio_can_action('PROGRESS_WRITE')) with check (public.kavio_can_action('PROGRESS_WRITE'));

drop policy if exists "siteplan_mapping_insert_authenticated" on public.siteplan_kavling_mapping;
drop policy if exists "siteplan_mapping_update_authenticated" on public.siteplan_kavling_mapping;
drop policy if exists "siteplan_mapping_select_authenticated" on public.siteplan_kavling_mapping;
create policy "siteplan_mapping_select_authenticated" on public.siteplan_kavling_mapping for select to authenticated using (true);
create policy "siteplan_mapping_insert_authenticated" on public.siteplan_kavling_mapping for insert to authenticated with check (public.kavio_can_action('SITEPLAN_MAP') and updated_by = auth.uid());
create policy "siteplan_mapping_update_authenticated" on public.siteplan_kavling_mapping for update to authenticated using (public.kavio_can_action('SITEPLAN_MAP')) with check (public.kavio_can_action('SITEPLAN_MAP') and updated_by = auth.uid());

drop policy if exists "siteplan_versions_insert_authenticated" on public.siteplan_versions;
drop policy if exists "siteplan_versions_update_authenticated" on public.siteplan_versions;
drop policy if exists "siteplan_versions_select_authenticated" on public.siteplan_versions;
create policy "siteplan_versions_select_authenticated" on public.siteplan_versions for select to authenticated using (true);
create policy "siteplan_versions_insert_authenticated" on public.siteplan_versions for insert to authenticated with check (public.kavio_can_action('SITEPLAN_MAP') and uploaded_by = auth.uid());
create policy "siteplan_versions_update_authenticated" on public.siteplan_versions for update to authenticated using (public.kavio_can_action('SITEPLAN_MAP')) with check (public.kavio_can_action('SITEPLAN_MAP'));

drop policy if exists "user_profiles_no_direct_select" on public.user_profiles;
drop policy if exists "user_profiles_no_direct_insert" on public.user_profiles;
drop policy if exists "user_profiles_no_direct_update" on public.user_profiles;
drop policy if exists "user_profiles_no_direct_delete" on public.user_profiles;
create policy "user_profiles_self_select" on public.user_profiles for select to authenticated using (user_id = auth.uid());
create policy "user_profiles_manager_write" on public.user_profiles for all to authenticated using (public.kavio_can_action('USER_MANAGE')) with check (public.kavio_can_action('USER_MANAGE'));


alter table public.siteplan_kavling_mapping
  alter column siteplan_version_id set not null;

alter table public.siteplan_kavling_mapping
  drop constraint siteplan_kavling_mapping_pkey;

alter table public.siteplan_kavling_mapping
  add constraint siteplan_kavling_mapping_pkey
  primary key (id_kavling, siteplan_version_id);

create policy siteplan_mapping_delete_authenticated
on public.siteplan_kavling_mapping
for delete
to authenticated
using (kavio_can_action('SITEPLAN_MAP'));

create policy siteplan_versions_delete_authenticated
on public.siteplan_versions
for delete
to authenticated
using (kavio_can_action('SITEPLAN_MAP'));

create policy siteplans_delete_authenticated
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'siteplans'
  and public.kavio_can_action('SITEPLAN_MAP')
);


create or replace function public.kavio_guard_last_manager()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  manager_count integer;
  old_is_manager boolean;
  new_is_manager boolean;
begin
  old_is_manager :=
    coalesce(old.status_aktif, false)
    and old.role in ('DIREKTUR','ADMIN');

  new_is_manager :=
    coalesce(new.status_aktif, false)
    and new.role in ('DIREKTUR','ADMIN');

  if old_is_manager and not new_is_manager then
    select count(*)
      into manager_count
    from public.user_profiles
    where status_aktif = true
      and role in ('DIREKTUR','ADMIN');

    if manager_count <= 1 then
      raise exception 'Tidak dapat menonaktifkan atau menurunkan role manager terakhir.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_kavio_guard_last_manager on public.user_profiles;

create trigger trg_kavio_guard_last_manager
before update on public.user_profiles
for each row
execute function public.kavio_guard_last_manager();

revoke all on function public.kavio_guard_last_manager() from public;
