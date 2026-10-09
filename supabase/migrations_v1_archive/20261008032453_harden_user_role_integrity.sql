alter table public.user_profiles
  alter column status_aktif set default false;

insert into public.user_profiles (
  user_id,
  nama,
  role,
  status_aktif,
  created_at,
  updated_at
)
select
  u.id,
  null,
  'USER',
  false,
  now(),
  now()
from auth.users u
left join public.user_profiles p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;

create or replace function public.kavio_provision_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (
    user_id,
    nama,
    role,
    status_aktif,
    created_at,
    updated_at
  )
  values (
    new.id,
    null,
    'USER',
    false,
    now(),
    now()
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.kavio_provision_auth_user_profile() from public;
revoke all on function public.kavio_provision_auth_user_profile() from anon;
revoke all on function public.kavio_provision_auth_user_profile() from authenticated;
grant execute on function public.kavio_provision_auth_user_profile() to supabase_auth_admin;

drop trigger if exists kavio_on_auth_user_created on auth.users;

create trigger kavio_on_auth_user_created
after insert on auth.users
for each row
execute function public.kavio_provision_auth_user_profile();

create or replace function public.kavio_get_current_access_context()
returns table (
  role text,
  status_aktif boolean,
  actions text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(p.role, 'USER') as role,
    coalesce(p.status_aktif, false) as status_aktif,
    coalesce(
      array_agg(ra.action order by ra.action)
        filter (
          where ra.action is not null
            and p.status_aktif is true
        ),
      '{}'::text[]
    ) as actions
  from (select auth.uid() as user_id) me
  left join public.user_profiles p on p.user_id = me.user_id
  left join public.kavio_role_actions ra on ra.role = p.role
  group by p.role, p.status_aktif;
$$;

revoke all on function public.kavio_get_current_access_context() from public;
grant execute on function public.kavio_get_current_access_context() to authenticated;

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
    coalesce(p.status_aktif, false),
    u.created_at,
    u.last_sign_in_at
  from auth.users u
  left join public.user_profiles p on p.user_id = u.id
  order by u.created_at;
end;
$$;

revoke all on function public.kavio_list_users() from public;
grant execute on function public.kavio_list_users() to authenticated;
