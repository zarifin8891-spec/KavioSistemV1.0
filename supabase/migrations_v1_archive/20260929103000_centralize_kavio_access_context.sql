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
    coalesce(p.status_aktif, true) as status_aktif,
    coalesce(
      array_agg(ra.action order by ra.action) filter (where ra.action is not null),
      '{}'::text[]
    ) as actions
  from (select auth.uid() as user_id) me
  left join public.user_profiles p on p.user_id = me.user_id
  left join public.kavio_role_actions ra on ra.role = p.role
  group by p.role, p.status_aktif;
$$;

revoke all on function public.kavio_get_current_access_context() from public;
grant execute on function public.kavio_get_current_access_context() to authenticated;
