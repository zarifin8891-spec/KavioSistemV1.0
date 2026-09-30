-- Phase 6B regression hardening: enforce invariants even on direct table writes.

create or replace function public.validate_progress_relations()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  v_spk public.spk%rowtype;
begin
  select * into v_spk from public.spk where id_spk = new.id_spk;
  if not found then
    raise exception 'SPK % tidak ditemukan', new.id_spk;
  end if;

  if not v_spk.is_active or v_spk.status_spk <> 'AKTIF' then
    raise exception 'SPK % tidak aktif', new.id_spk;
  end if;

  if not exists (
    select 1 from public.spk_progress_config c
    where c.id_spk = new.id_spk and c.id_kategori = new.id_kategori
  ) then
    raise exception 'Kategori % belum dikonfigurasi pada SPK %', new.id_kategori, new.id_spk;
  end if;

  if new.tanggal_update < v_spk.tgl_spk then
    raise exception 'Tanggal update tidak boleh sebelum tanggal SPK';
  end if;

  if new.tanggal_update > current_date then
    raise exception 'Tanggal update tidak boleh di masa depan';
  end if;

  return new;
end;
$function$;

create or replace function public.validate_sales_business_rules()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if new.status_sales not in ('BOOKING','DP','PROSES_KPR','AKAD','BATAL') then
    raise exception 'STATUS SALES TIDAK VALID';
  end if;

  if new.jenis_pembayaran not in ('KPR','CASH','CASH_BERTAHAP') then
    raise exception 'JENIS PEMBAYARAN TIDAK VALID';
  end if;

  if new.jenis_pembayaran='KPR' and new.id_bank is null then
    raise exception 'BANK KPR WAJIB DIISI';
  end if;

  if new.jenis_pembayaran<>'KPR' and new.id_bank is not null then
    raise exception 'BANK HANYA DIISI UNTUK KPR';
  end if;

  if new.status_sales='AKAD' and (new.tgl_akad is null or new.id_notaris is null or new.target_akad is null) then
    raise exception 'TARGET AKAD, TANGGAL AKAD, DAN NOTARIS WAJIB DIISI UNTUK STATUS AKAD';
  end if;

  if new.status_sales<>'AKAD' and (new.tgl_akad is not null or new.id_notaris is not null) then
    raise exception 'TANGGAL AKAD DAN NOTARIS HANYA DIISI SAAT STATUS AKAD';
  end if;

  if new.tgl_booking is not null and new.target_akad is not null and new.target_akad < new.tgl_booking then
    raise exception 'TARGET AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING';
  end if;

  if new.tgl_booking is not null and new.tgl_akad is not null and new.tgl_akad < new.tgl_booking then
    raise exception 'TANGGAL AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING';
  end if;

  if new.status_sales='BATAL' and new.status_aktif then
    raise exception 'SALES BATAL TIDAK BOLEH AKTIF';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_validate_sales_business_rules on public.sales;
create trigger trg_validate_sales_business_rules
before insert or update on public.sales
for each row execute function public.validate_sales_business_rules();

create or replace function public.guard_active_spk_weight_config()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  v_id_spk uuid;
  v_status text;
begin
  v_id_spk := coalesce(new.id_spk, old.id_spk);
  select status_spk into v_status from public.spk where id_spk=v_id_spk;
  if v_status is not null and v_status <> 'DRAFT' then
    raise exception 'Bobot SPK tidak dapat diubah setelah SPK aktif';
  end if;
  return coalesce(new,old);
end;
$function$;

drop trigger if exists trg_guard_active_spk_weight_config on public.spk_progress_config;
create trigger trg_guard_active_spk_weight_config
before insert or update or delete on public.spk_progress_config
for each row execute function public.guard_active_spk_weight_config();
