CREATE OR REPLACE FUNCTION public.update_sales_atomic(p_id_sales uuid, p_nama_konsumen text, p_alamat_konsumen text, p_hp_konsumen text, p_status_sales text, p_jenis_pembayaran text, p_id_bank text, p_id_notaris text, p_tgl_akad date, p_target_akad date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sales public.sales%rowtype;
  v_kavling public.master_kavling%rowtype;
  v_existing_akad uuid;
  v_total numeric;
  v_paid numeric;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SALES_WRITE') then raise exception 'FORBIDDEN: SALES_WRITE'; end if;
  if p_status_sales not in ('BOOKING','DP','PROSES_KPR','AKAD','BATAL') then raise exception 'STATUS SALES TIDAK VALID'; end if;
  if p_jenis_pembayaran not in ('KPR','CASH','CASH_BERTAHAP') then raise exception 'JENIS PEMBAYARAN TIDAK VALID'; end if;
  if nullif(btrim(coalesce(p_nama_konsumen,'')), '') is null then raise exception 'NAMA KONSUMEN WAJIB DIISI'; end if;
  select * into v_sales from public.sales where id_sales=p_id_sales for update;
  if not found then raise exception 'DATA SALES TIDAK DITEMUKAN'; end if;
  select * into v_kavling from public.master_kavling where id_kavling=v_sales.id_kavling for update;
  if not found or not v_kavling.status_aktif then raise exception 'KAVLING SALES TIDAK AKTIF ATAU TIDAK DITEMUKAN'; end if;
  if v_sales.status_sales='AKAD' and p_status_sales<>'AKAD' then raise exception 'SALES YANG SUDAH AKAD TIDAK DAPAT DIBUKA KEMBALI'; end if;
  if v_sales.status_aktif=false and p_status_sales<>'BATAL' then raise exception 'SALES YANG SUDAH DITUTUP TIDAK DAPAT DIAKTIFKAN KEMBALI. BUAT SALES BARU PADA KAVLING YANG BERSTATUS BATAL.'; end if;
  if v_sales.tgl_booking is not null and p_target_akad is not null and p_target_akad<v_sales.tgl_booking then raise exception 'TARGET AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING'; end if;
  if v_sales.tgl_booking is not null and p_tgl_akad is not null and p_tgl_akad<v_sales.tgl_booking then raise exception 'TANGGAL AKAD TIDAK BOLEH SEBELUM BOOKING'; end if;
  if p_jenis_pembayaran='KPR' and nullif(btrim(coalesce(p_id_bank,'')),'') is null then raise exception 'BANK KPR WAJIB DIISI'; end if;
  if p_jenis_pembayaran<>'KPR' and nullif(btrim(coalesce(p_id_bank,'')),'') is not null then raise exception 'BANK HANYA DIISI UNTUK KPR'; end if;
  if p_status_sales='AKAD' and (p_tgl_akad is null or nullif(btrim(coalesce(p_id_notaris,'')),'') is null) then raise exception 'TANGGAL AKAD DAN NOTARIS WAJIB DIISI UNTUK STATUS AKAD'; end if;
  if p_status_sales<>'AKAD' and p_tgl_akad is not null then raise exception 'TANGGAL AKAD HANYA DIISI SAAT STATUS AKAD'; end if;
  if p_status_sales<>'AKAD' and nullif(btrim(coalesce(p_id_notaris,'')),'') is not null then raise exception 'NOTARIS AKAD HANYA DIISI SAAT STATUS AKAD'; end if;
  if v_sales.jenis_pembayaran<>p_jenis_pembayaran and exists(select 1 from public.sales_receipt where id_sales=p_id_sales) then
    raise exception 'JENIS PEMBAYARAN TIDAK DAPAT DIUBAH SETELAH ADA PENERIMAAN';
  end if;
  if p_status_sales='AKAD' and v_sales.status_sales<>'AKAD' and p_jenis_pembayaran in ('CASH','CASH_BERTAHAP') then
    select total_harga_jual,total_pembayaran_harga_jual into v_total,v_paid
    from public.v_sales_financial_position where id_sales=p_id_sales;
    if coalesce(v_paid,0)+0.000001<coalesce(v_total,0) then
      raise exception 'AKAD CASH MENUNGGU PELUNASAN HARGA JUAL. SISA %',greatest(0,coalesce(v_total,0)-coalesce(v_paid,0));
    end if;
  end if;
  if p_status_sales='AKAD' and v_sales.status_sales<>'AKAD' and p_jenis_pembayaran='KPR'
    and (not exists(select 1 from public.sales_receipt where id_sales=p_id_sales and status='AKTIF' and jenis_penerimaan='BOOKING_FEE')
      or not exists(select 1 from public.sales_receipt where id_sales=p_id_sales and status='AKTIF' and jenis_penerimaan='UANG_MUKA')) then
    raise exception 'AKAD KPR MENUNGGU BOOKING FEE DAN UANG MUKA CUSTOMER';
  end if;
  if p_status_sales<>'BATAL' then
    select id_sales into v_existing_akad from public.sales
    where id_kavling=v_sales.id_kavling and status_sales='AKAD' and id_sales<>p_id_sales limit 1;
    if v_existing_akad is not null then raise exception 'KAVLING SUDAH PERNAH AKAD DAN TIDAK DAPAT MEMILIKI SALES BARU'; end if;
  end if;
  update public.sales
  set nama_konsumen=btrim(p_nama_konsumen),alamat_konsumen=nullif(btrim(coalesce(p_alamat_konsumen,'')),''),
      hp_konsumen=nullif(btrim(coalesce(p_hp_konsumen,'')),''),status_sales=p_status_sales,jenis_pembayaran=p_jenis_pembayaran,
      id_bank=case when p_jenis_pembayaran='KPR' then nullif(btrim(coalesce(p_id_bank,'')),'') else null end,
      id_notaris=case when p_status_sales='AKAD' then nullif(btrim(coalesce(p_id_notaris,'')),'') else null end,
      tgl_akad=case when p_status_sales='AKAD' then p_tgl_akad else null end,target_akad=p_target_akad,
      status_aktif=p_status_sales<>'BATAL'
  where id_sales=p_id_sales;
end;
$function$

;
create function public.record_sales_akad_atomic(p_id_sales uuid,p_tanggal date,p_id_notaris text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.sales%rowtype;
begin
 if auth.uid() is null or not public.kavio_can_action('SALES_WRITE') then raise exception 'FORBIDDEN: SALES_WRITE';end if;
 if p_tanggal is null or p_tanggal>(now() at time zone 'Asia/Jakarta')::date then raise exception 'TANGGAL AKAD WAJIB VALID DAN TIDAK BOLEH DI MASA DEPAN';end if;
 if not exists(select 1 from public.master_notaris where id_notaris=p_id_notaris and status_aktif) then raise exception 'PILIH NOTARIS AKTIF';end if;
 select * into s from public.sales where id_sales=p_id_sales for update;
 if not found or not s.status_aktif or s.status_sales='BATAL' then raise exception 'SALES AKTIF TIDAK DITEMUKAN';end if;
 if s.status_sales='AKAD' then
  if s.tgl_akad=p_tanggal and s.id_notaris=p_id_notaris then return s.id_sales;end if;
  raise exception 'AKAD SUDAH DICATAT';
 end if;
 perform public.update_sales_atomic(s.id_sales,s.nama_konsumen,s.alamat_konsumen,s.hp_konsumen,'AKAD',s.jenis_pembayaran,s.id_bank,p_id_notaris,p_tanggal,s.target_akad);
 return s.id_sales;
end $$;
revoke all on function public.record_sales_akad_atomic(uuid,date,text) from public,anon;
grant execute on function public.record_sales_akad_atomic(uuid,date,text) to authenticated;
