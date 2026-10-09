-- Phase 6C operational-readiness hardening
-- Atomic KPR tracking, Sales cost updates, and Sales closing.

create or replace function public.upsert_kpr_progress_atomic(
  p_id_sales uuid,
  p_tahap text,
  p_tanggal_update date,
  p_keterangan text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sales public.sales%rowtype;
  v_id_progress uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SALES_WRITE') then raise exception 'FORBIDDEN: SALES_WRITE'; end if;

  if p_id_sales is null or p_tahap not in ('KELENGKAPAN_DATA','SURVEY_BANK','INTERVIEW','SP3K') or p_tanggal_update is null then
    raise exception 'DATA UPDATE KPR TIDAK LENGKAP';
  end if;

  select * into v_sales from public.sales where id_sales=p_id_sales for update;
  if not found then raise exception 'DATA SALES TIDAK DITEMUKAN'; end if;
  if v_sales.jenis_pembayaran <> 'KPR' then raise exception 'TRACKING KPR HANYA UNTUK SALES KPR'; end if;
  if not v_sales.status_aktif or v_sales.status_sales='BATAL' then raise exception 'SALES TIDAK AKTIF'; end if;
  if v_sales.tgl_booking is not null and p_tanggal_update < v_sales.tgl_booking then raise exception 'TANGGAL UPDATE KPR TIDAK BOLEH SEBELUM TANGGAL BOOKING'; end if;
  if p_tanggal_update > current_date then raise exception 'TANGGAL UPDATE KPR TIDAK BOLEH DI MASA DEPAN'; end if;

  insert into public.sales_kpr_progress(id_sales,tahap,tanggal_update,keterangan,input_by)
  values(p_id_sales,p_tahap,p_tanggal_update,nullif(btrim(coalesce(p_keterangan,'')),''),auth.uid())
  on conflict(id_sales,tahap)
  do update set
    tanggal_update=excluded.tanggal_update,
    keterangan=excluded.keterangan,
    input_by=excluded.input_by
  returning id_progress into v_id_progress;

  return v_id_progress;
end;
$function$;

create or replace function public.save_sales_biaya_atomic(
  p_id_sales uuid,
  p_biaya_penambahan_bangunan numeric,
  p_biaya_notaris numeric,
  p_biaya_hook numeric,
  p_biaya_lainnya numeric
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sale uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SALES_WRITE') then raise exception 'FORBIDDEN: SALES_WRITE'; end if;
  if p_id_sales is null then raise exception 'ID SALES TIDAK VALID'; end if;

  perform pg_advisory_xact_lock(hashtextextended('sales-cost:' || p_id_sales::text,0));
  select id_sales into v_sale from public.sales where id_sales=p_id_sales for update;
  if not found then raise exception 'DATA SALES TIDAK DITEMUKAN'; end if;

  if coalesce(p_biaya_penambahan_bangunan,0)<0 or coalesce(p_biaya_notaris,0)<0
     or coalesce(p_biaya_hook,0)<0 or coalesce(p_biaya_lainnya,0)<0 then
    raise exception 'BIAYA TAMBAHAN TIDAK VALID';
  end if;

  insert into public.sales_biaya_tambahan(id_sales,jenis_biaya,nominal,status_aktif)
  values
    (p_id_sales,'PENAMBAHAN BANGUNAN',coalesce(p_biaya_penambahan_bangunan,0),true),
    (p_id_sales,'NOTARIS',coalesce(p_biaya_notaris,0),true),
    (p_id_sales,'PEMILIHAN LOKASI HOOK',coalesce(p_biaya_hook,0),true),
    (p_id_sales,'BIAYA LAINNYA',coalesce(p_biaya_lainnya,0),true)
  on conflict(id_sales,jenis_biaya)
  do update set nominal=excluded.nominal,status_aktif=true;

  delete from public.sales_biaya_tambahan
  where id_sales=p_id_sales and nominal=0;
end;
$function$;

create or replace function public.close_sales_atomic(p_id_sales uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sales public.sales%rowtype;
  v_next_status text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SALES_WRITE') then raise exception 'FORBIDDEN: SALES_WRITE'; end if;
  if p_id_sales is null then raise exception 'ID SALES TIDAK VALID'; end if;

  select * into v_sales from public.sales where id_sales=p_id_sales for update;
  if not found then raise exception 'DATA SALES TIDAK DITEMUKAN'; end if;
  if not v_sales.status_aktif then raise exception 'SALES SUDAH TIDAK AKTIF'; end if;

  update public.sales
  set status_aktif=false,
      status_sales=case when v_sales.status_sales='AKAD' then 'AKAD' else 'BATAL' end
  where id_sales=p_id_sales and status_aktif=true;

  if not found then raise exception 'SALES BERUBAH SEBELUM DITUTUP. SILAKAN COBA LAGI'; end if;

  v_next_status := public.kavio_sync_kavling_status(v_sales.id_kavling);
  return coalesce(v_next_status,'AVAILABLE');
end;
$function$;

revoke all on function public.upsert_kpr_progress_atomic(uuid,text,date,text) from public,anon;
grant execute on function public.upsert_kpr_progress_atomic(uuid,text,date,text) to authenticated,service_role;

revoke all on function public.save_sales_biaya_atomic(uuid,numeric,numeric,numeric,numeric) from public,anon;
grant execute on function public.save_sales_biaya_atomic(uuid,numeric,numeric,numeric,numeric) to authenticated,service_role;

revoke all on function public.close_sales_atomic(uuid) from public,anon;
grant execute on function public.close_sales_atomic(uuid) to authenticated,service_role;
