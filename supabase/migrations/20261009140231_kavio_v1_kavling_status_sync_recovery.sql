-- Centralize kavling lifecycle status so Siteplan, Master Kavling and Sales
-- always read the same authoritative status from master_kavling.
--
-- Priority:
--   AKAD (historical) > SPK AKTIF > SALES AKTIF > SPK SELESAI > AVAILABLE
--
-- SOLD remains SOLD even while construction/SPK continues after AKAD.

create or replace function public.kavio_sync_kavling_status(p_id_kavling text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_status text;
begin
  if p_id_kavling is null or btrim(p_id_kavling) = '' then
    return null;
  end if;

  if not exists (
    select 1
    from public.master_kavling
    where id_kavling = p_id_kavling
      and status_aktif = true
  ) then
    return null;
  end if;

  if exists (
    select 1 from public.sales
    where id_kavling = p_id_kavling
      and status_sales = 'AKAD'
  ) then
    v_next_status := 'SOLD';
  elsif exists (
    select 1 from public.spk
    where id_kavling = p_id_kavling
      and is_active = true
      and status_spk = 'AKTIF'
  ) then
    v_next_status := 'BUILDING';
  elsif exists (
    select 1 from public.sales
    where id_kavling = p_id_kavling
      and status_aktif = true
      and status_sales <> 'BATAL'
  ) then
    v_next_status := 'BOOKING';
  elsif exists (
    select 1 from public.spk
    where id_kavling = p_id_kavling
      and status_spk = 'SELESAI'
  ) then
    v_next_status := 'READY_STOCK';
  else
    v_next_status := 'AVAILABLE';
  end if;

  update public.master_kavling
  set status_kavling = v_next_status
  where id_kavling = p_id_kavling
    and status_aktif = true;

  return v_next_status;
end;
$$;

revoke all on function public.kavio_sync_kavling_status(text) from public;
grant execute on function public.kavio_sync_kavling_status(text) to authenticated;

create or replace function public.kavio_sync_kavling_from_sales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.kavio_sync_kavling_status(coalesce(new.id_kavling, old.id_kavling));

  if tg_op = 'UPDATE' and old.id_kavling is distinct from new.id_kavling then
    perform public.kavio_sync_kavling_status(old.id_kavling);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.kavio_sync_kavling_from_spk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.kavio_sync_kavling_status(coalesce(new.id_kavling, old.id_kavling));

  if tg_op = 'UPDATE' and old.id_kavling is distinct from new.id_kavling then
    perform public.kavio_sync_kavling_status(old.id_kavling);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_kavio_sync_kavling_from_sales on public.sales;
create trigger trg_kavio_sync_kavling_from_sales
after insert or update or delete on public.sales
for each row
execute function public.kavio_sync_kavling_from_sales();

drop trigger if exists trg_kavio_sync_kavling_from_spk on public.spk;
create trigger trg_kavio_sync_kavling_from_spk
after insert or update or delete on public.spk
for each row
execute function public.kavio_sync_kavling_from_spk();

-- Existing data reconciliation:
with desired as (
  select
    k.id_kavling,
    case
      when exists (
        select 1 from public.sales s
        where s.id_kavling = k.id_kavling
          and s.status_sales = 'AKAD'
      ) then 'SOLD'
      when exists (
        select 1 from public.spk p
        where p.id_kavling = k.id_kavling
          and p.is_active = true
          and p.status_spk = 'AKTIF'
      ) then 'BUILDING'
      when exists (
        select 1 from public.sales s
        where s.id_kavling = k.id_kavling
          and s.status_aktif = true
          and s.status_sales <> 'BATAL'
      ) then 'BOOKING'
      when exists (
        select 1 from public.spk p
        where p.id_kavling = k.id_kavling
          and p.status_spk = 'SELESAI'
      ) then 'READY_STOCK'
      else 'AVAILABLE'
    end as status_baru
  from public.master_kavling k
  where k.status_aktif = true
)
update public.master_kavling k
set status_kavling = d.status_baru
from desired d
where d.id_kavling = k.id_kavling
  and k.status_kavling is distinct from d.status_baru;


-- Guard direct writes to master_kavling.status_kavling as well.
-- This prevents any older action/function from reintroducing a stale status.
create or replace function public.kavio_guard_kavling_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() = 1 and new.status_aktif = true then
    perform public.kavio_sync_kavling_status(new.id_kavling);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_kavio_guard_kavling_status on public.master_kavling;
create trigger trg_kavio_guard_kavling_status
after update of status_kavling on public.master_kavling
for each row
when (new.status_kavling is distinct from old.status_kavling)
execute function public.kavio_guard_kavling_status();
