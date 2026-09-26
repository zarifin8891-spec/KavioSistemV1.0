create table if not exists public.kavio_role_actions (
  role text not null,
  action text not null,
  primary key (role, action),
  check (role in ('DIREKTUR','ADMIN','MARKETING','PELAKSANA','USER'))
);

alter table public.kavio_role_actions enable row level security;

drop policy if exists "kavio_role_actions_no_direct_access" on public.kavio_role_actions;
create policy "kavio_role_actions_no_direct_access"
on public.kavio_role_actions
for all to authenticated
using (false)
with check (false);

insert into public.kavio_role_actions (role, action) values
('DIREKTUR','MASTER_WRITE'),('DIREKTUR','SALES_WRITE'),('DIREKTUR','SPK_WRITE'),
('DIREKTUR','PROGRESS_WRITE'),('DIREKTUR','SITEPLAN_MAP'),('DIREKTUR','USER_MANAGE'),
('ADMIN','MASTER_WRITE'),('ADMIN','SALES_WRITE'),('ADMIN','SPK_WRITE'),
('ADMIN','PROGRESS_WRITE'),('ADMIN','SITEPLAN_MAP'),('ADMIN','USER_MANAGE'),
('MARKETING','SALES_WRITE'),
('PELAKSANA','SPK_WRITE'),('PELAKSANA','PROGRESS_WRITE')
on conflict do nothing;

create or replace function public.kavio_can_action(p_action text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles p
    join public.kavio_role_actions ra on ra.role = p.role
    where p.user_id = auth.uid()
      and p.status_aktif = true
      and ra.action = upper(trim(p_action))
  );
$$;

revoke all on table public.kavio_role_actions from public;
revoke all on function public.kavio_can_action(text) from public;
grant execute on function public.kavio_can_action(text) to authenticated;
