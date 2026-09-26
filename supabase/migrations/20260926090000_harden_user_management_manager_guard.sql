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
