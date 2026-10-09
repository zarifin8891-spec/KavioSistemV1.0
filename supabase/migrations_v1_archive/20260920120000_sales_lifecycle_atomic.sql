create unique index if not exists uq_sales_one_active_per_kavling
on public.sales (id_kavling)
where status_aktif = true;

create or replace function public.update_sales_atomic(
  p_id_sales uuid,
  p_nama_konsumen text,
  p_alamat_konsumen text,
  p_hp_konsumen text,
  p_status_sales text,
  p_jenis_pembayaran text,
  p_id_bank text,
  p_id_notaris text,
  p_tgl_akad date,
  p_target_akad date
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_sales public.sales%rowtype;
  v_kavling public.master_kavling%rowtype;
  v_active_spk uuid;
  v_completed_spk uuid;
  v_next_status text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_status_sales not in ('BOOKING','DP','PROSES_KPR','AKAD','BATAL') then
    raise exception 'STATUS SALES TIDAK VALID';
  end if;

  if p_jenis_pembayaran not in ('KPR','CASH','CASH_BERTAHAP') then
    raise exception 'JENIS PEMBAYARAN TIDAK VALID';
  end if;

  if nullif(btrim(coalesce(p_nama_konsumen,'')), '') is null then
    raise exception 'NAMA KONSUMEN WAJIB DIISI';
  end if;

  select * into v_sales
  from public.sales
  where id_sales = p_id_sales
  for update;

  if not found then
    raise exception 'DATA SALES TIDAK DITEMUKAN';
  end if;

  select * into v_kavling
  from public.master_kavling
  where id_kavling = v_sales.id_kavling
  for update;

  if not found or not v_kavling.status_aktif then
    raise exception 'KAVLING SALES TIDAK AKTIF ATAU TIDAK DITEMUKAN';
  end if;

  if v_sales.tgl_booking is not null and p_target_akad is not null and p_target_akad < v_sales.tgl_booking then
    raise exception 'TARGET AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING';
  end if;

  if v_sales.tgl_booking is not null and p_tgl_akad is not null and p_tgl_akad < v_sales.tgl_booking then
    raise exception 'TANGGAL AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING';
  end if;

  if p_jenis_pembayaran = 'KPR' and nullif(btrim(coalesce(p_id_bank,'')), '') is null then
    raise exception 'BANK KPR WAJIB DIISI';
  end if;

  if p_jenis_pembayaran <> 'KPR' and nullif(btrim(coalesce(p_id_bank,'')), '') is not null then
    raise exception 'BANK HANYA DIISI UNTUK PEMBAYARAN KPR';
  end if;

  if p_status_sales = 'AKAD' and (
    p_tgl_akad is null or
    nullif(btrim(coalesce(p_id_notaris,'')), '') is null or
    p_target_akad is null
  ) then
    raise exception 'TARGET AKAD, TANGGAL AKAD, DAN NOTARIS WAJIB DIISI UNTUK STATUS AKAD';
  end if;

  if p_status_sales <> 'AKAD' and p_tgl_akad is not null then
    raise exception 'TANGGAL AKAD HANYA DIISI SAAT STATUS AKAD';
  end if;

  if p_status_sales <> 'AKAD' and nullif(btrim(coalesce(p_id_notaris,'')), '') is not null then
    raise exception 'NOTARIS AKAD HANYA DIISI SAAT STATUS AKAD';
  end if;

  if v_sales.status_aktif = false and p_status_sales <> 'BATAL' then
    if exists (
      select 1
      from public.sales
      where id_kavling = v_sales.id_kavling
        and status_aktif = true
        and id_sales <> p_id_sales
    ) then
      raise exception 'KAVLING TERSEBUT SUDAH MEMILIKI SALES AKTIF';
    end if;
  end if;

  update public.sales
  set nama_konsumen = btrim(p_nama_konsumen),
      alamat_konsumen = nullif(btrim(coalesce(p_alamat_konsumen,'')), ''),
      hp_konsumen = nullif(btrim(coalesce(p_hp_konsumen,'')), ''),
      status_sales = p_status_sales,
      jenis_pembayaran = p_jenis_pembayaran,
      id_bank = case when p_jenis_pembayaran = 'KPR' then nullif(btrim(coalesce(p_id_bank,'')), '') else null end,
      id_notaris = case when p_status_sales = 'AKAD' then nullif(btrim(coalesce(p_id_notaris,'')), '') else null end,
      tgl_akad = case when p_status_sales = 'AKAD' then p_tgl_akad else null end,
      target_akad = p_target_akad,
      status_aktif = p_status_sales <> 'BATAL'
  where id_sales = p_id_sales;

  select id_spk into v_active_spk
  from public.spk
  where id_kavling = v_sales.id_kavling and is_active = true
  limit 1;

  if v_active_spk is not null then
    v_next_status := 'BUILDING';
  elsif p_status_sales = 'AKAD' then
    v_next_status := 'SOLD';
  elsif p_status_sales <> 'BATAL' then
    v_next_status := 'BOOKING';
  else
    select id_spk into v_completed_spk
    from public.spk
    where id_kavling = v_sales.id_kavling
      and status_spk = 'SELESAI'
    order by tgl_target_selesai desc nulls last
    limit 1;

    v_next_status := case when v_completed_spk is not null then 'READY_STOCK' else 'AVAILABLE' end;
  end if;

  update public.master_kavling
  set status_kavling = v_next_status
  where id_kavling = v_sales.id_kavling
    and status_aktif = true;

  if not found then
    raise exception 'GAGAL MEMPERBARUI STATUS KAVLING';
  end if;
end;
$function$;
