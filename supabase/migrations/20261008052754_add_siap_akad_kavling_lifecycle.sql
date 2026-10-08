alter table public.master_kavling
  drop constraint if exists master_kavling_status_kavling_check;

alter table public.master_kavling
  add constraint master_kavling_status_kavling_check
  check (
    status_kavling = any (
      array[
        'AVAILABLE'::text,
        'BOOKING'::text,
        'BUILDING'::text,
        'READY_STOCK'::text,
        'SIAP_AKAD'::text,
        'SOLD'::text,
        'COMPLETED'::text
      ]
    )
  );

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
    select 1
    from public.sales s
    where s.id_kavling = p_id_kavling
      and s.status_sales = 'AKAD'
  ) then
    v_next_status := 'SOLD';

  elsif exists (
    select 1
    from public.sales s
    join public.spk p on p.id_kavling = s.id_kavling
    join public.v_progress_summary ps on ps.id_spk = p.id_spk
    where s.id_kavling = p_id_kavling
      and s.status_aktif = true
      and s.status_sales <> 'BATAL'
      and ps.progress_total >= 0.99999
      and (
        s.jenis_pembayaran = 'CASH_BERTAHAP'
        or (
          s.jenis_pembayaran = 'KPR'
          and exists (
            select 1
            from public.sales_kpr_progress kp
            where kp.id_sales = s.id_sales
              and kp.tahap = 'SP3K'
          )
        )
      )
  ) then
    v_next_status := 'SIAP_AKAD';

  elsif exists (
    select 1
    from public.spk
    where id_kavling = p_id_kavling
      and is_active = true
      and status_spk = 'AKTIF'
  ) then
    v_next_status := 'BUILDING';

  elsif exists (
    select 1
    from public.sales
    where id_kavling = p_id_kavling
      and status_aktif = true
      and status_sales <> 'BATAL'
  ) then
    v_next_status := 'BOOKING';

  elsif exists (
    select 1
    from public.spk
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
revoke all on function public.kavio_sync_kavling_status(text) from anon;
revoke all on function public.kavio_sync_kavling_status(text) from authenticated;

create or replace function public.kavio_sync_kavling_from_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_kavling text;
  v_old_kavling text;
begin
  if tg_op <> 'DELETE' then
    select id_kavling into v_new_kavling
    from public.spk
    where id_spk = new.id_spk;

    perform public.kavio_sync_kavling_status(v_new_kavling);
  end if;

  if tg_op <> 'INSERT' then
    select id_kavling into v_old_kavling
    from public.spk
    where id_spk = old.id_spk;

    if v_old_kavling is distinct from v_new_kavling then
      perform public.kavio_sync_kavling_status(v_old_kavling);
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.kavio_sync_kavling_from_progress() from public;
revoke all on function public.kavio_sync_kavling_from_progress() from anon;
revoke all on function public.kavio_sync_kavling_from_progress() from authenticated;

drop trigger if exists trg_kavio_sync_kavling_from_progress on public.progress_update;
create trigger trg_kavio_sync_kavling_from_progress
after insert or update or delete on public.progress_update
for each row
execute function public.kavio_sync_kavling_from_progress();

create or replace function public.kavio_sync_kavling_from_kpr_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_kavling text;
  v_old_kavling text;
begin
  if tg_op <> 'DELETE' then
    select id_kavling into v_new_kavling
    from public.sales
    where id_sales = new.id_sales;

    perform public.kavio_sync_kavling_status(v_new_kavling);
  end if;

  if tg_op <> 'INSERT' then
    select id_kavling into v_old_kavling
    from public.sales
    where id_sales = old.id_sales;

    if v_old_kavling is distinct from v_new_kavling then
      perform public.kavio_sync_kavling_status(v_old_kavling);
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.kavio_sync_kavling_from_kpr_progress() from public;
revoke all on function public.kavio_sync_kavling_from_kpr_progress() from anon;
revoke all on function public.kavio_sync_kavling_from_kpr_progress() from authenticated;

drop trigger if exists trg_kavio_sync_kavling_from_kpr_progress on public.sales_kpr_progress;
create trigger trg_kavio_sync_kavling_from_kpr_progress
after insert or update or delete on public.sales_kpr_progress
for each row
execute function public.kavio_sync_kavling_from_kpr_progress();

do $$
declare
  r record;
begin
  for r in
    select id_kavling
    from public.master_kavling
    where status_aktif = true
  loop
    perform public.kavio_sync_kavling_status(r.id_kavling);
  end loop;
end
$$;
