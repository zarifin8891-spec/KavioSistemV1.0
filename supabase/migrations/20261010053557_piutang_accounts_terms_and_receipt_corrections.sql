-- One project/database. Receipts remain auditable when corrected or canceled.
alter table public.master_bank add column is_kpr boolean not null default true,
 add column jenis_akun text not null default 'BANK' check (jenis_akun in ('KAS','BANK')),
 add constraint master_bank_cash_not_kpr check (jenis_akun <> 'KAS' or not is_kpr);
alter table public.sales_cash_installment_terms drop constraint sales_cash_installment_terms_tenor_bulan_check;
alter table public.sales_cash_installment_terms add constraint sales_cash_installment_terms_tenor_bulan_check check (tenor_bulan between 1 and 12);
alter table public.sales_receipt add column status text not null default 'AKTIF' check (status in ('AKTIF','BATAL')),
 add column id_bank_penerimaan text references public.master_bank(id_bank) on delete restrict,
 add column koreksi_dari uuid references public.sales_receipt(id_penerimaan) on delete restrict,
 add column dibatalkan_oleh uuid references auth.users(id) on delete restrict,
 add column dibatalkan_pada timestamptz, add column alasan_pembatalan text, add column jaminan_snapshot jsonb not null default '[]'::jsonb;
alter table public.sales_bank_guarantee_item add column id_penerimaan_asal uuid references public.sales_receipt(id_penerimaan) on delete restrict;
create index sales_receipt_account_idx on public.sales_receipt(id_bank_penerimaan);
create index sales_receipt_correction_idx on public.sales_receipt(koreksi_dari);
create index sales_receipt_cancel_actor_idx on public.sales_receipt(dibatalkan_oleh);
create index sales_guarantee_receipt_idx on public.sales_bank_guarantee_item(id_penerimaan_asal);
grant delete on public.master_pemasok to authenticated;
create policy pemasok_delete on public.master_pemasok for delete to authenticated using ((select public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE')));
comment on table public.sales_cash_installment_terms is 'Tenor 1-12 bulan diinput bersama Sales, pembayaran fleksibel atau lunas di akhir.';


create or replace function public.post_sales_receipt_atomic(
  p_id_sales uuid,p_jenis_penerimaan text,p_tanggal_penerimaan date,p_nominal numeric,
  p_metode_penerimaan text,p_id_jaminan uuid default null,p_no_referensi text default null,p_keterangan text default null
)
returns table(id_penerimaan uuid,no_kuitansi text,nilai_barcode text)
language plpgsql security definer set search_path = 'public'
as $function$
declare
  v_sale public.sales%rowtype;
  v_guarantee public.sales_bank_guarantee_item%rowtype;
  v_id uuid;
  v_receipt_no text;
  v_barcode text;
  v_claimed numeric;
  v_balance numeric;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('PAYMENT_RECEIPT_WRITE') then raise exception 'FORBIDDEN: PAYMENT_RECEIPT_WRITE'; end if;
  if p_nominal is null or p_nominal<=0 or p_tanggal_penerimaan is null or p_tanggal_penerimaan>(now() at time zone 'Asia/Jakarta')::date then raise exception 'TANGGAL DAN NOMINAL PENERIMAAN TIDAK VALID'; end if;
  if p_metode_penerimaan not in ('TUNAI','TRANSFER','GIRO','LAINNYA') then raise exception 'METODE PENERIMAAN TIDAK VALID'; end if;
  select * into v_sale from public.sales where id_sales=p_id_sales for update;
  if not found or not v_sale.status_aktif or v_sale.status_sales='BATAL' then raise exception 'SALES TIDAK AKTIF ATAU SUDAH DIBATALKAN'; end if;
  if p_jenis_penerimaan not in ('BOOKING_FEE','UANG_MUKA','CICILAN_CASH_BERTAHAP','PELUNASAN_CASH','PENCAIRAN_KPR','PENCAIRAN_DANA_JAMINAN','BIAYA_NOTARIS','BIAYA_AKAD') then raise exception 'JENIS PENERIMAAN TIDAK VALID'; end if;
  if v_sale.jenis_pembayaran='KPR' and p_jenis_penerimaan in ('CICILAN_CASH_BERTAHAP','PELUNASAN_CASH') then raise exception 'JENIS PENERIMAAN TIDAK SESUAI DENGAN SALES KPR'; end if;
  if v_sale.jenis_pembayaran='CASH' and p_jenis_penerimaan in ('CICILAN_CASH_BERTAHAP','PENCAIRAN_KPR','PENCAIRAN_DANA_JAMINAN') then raise exception 'JENIS PENERIMAAN TIDAK SESUAI DENGAN SALES CASH'; end if;
  if v_sale.jenis_pembayaran='CASH_BERTAHAP' and p_jenis_penerimaan in ('PENCAIRAN_KPR','PENCAIRAN_DANA_JAMINAN') then raise exception 'JENIS PENERIMAAN TIDAK SESUAI DENGAN CASH BERTAHAP'; end if;
  if p_jenis_penerimaan<>'BOOKING_FEE' and not exists(select 1 from public.sales_receipt where id_sales=p_id_sales and status='AKTIF' and jenis_penerimaan='BOOKING_FEE') then raise exception 'BOOKING FEE HARUS DICATAT SEBELUM PENERIMAAN BERIKUTNYA'; end if;
  if p_jenis_penerimaan in ('CICILAN_CASH_BERTAHAP','PELUNASAN_CASH') and not exists(select 1 from public.sales_receipt where id_sales=p_id_sales and status='AKTIF' and jenis_penerimaan='UANG_MUKA') then raise exception 'UANG MUKA HARUS DICATAT SEBELUM PEMBAYARAN LANJUTAN'; end if;
  if p_jenis_penerimaan in ('PENCAIRAN_KPR','PENCAIRAN_DANA_JAMINAN') and (v_sale.jenis_pembayaran<>'KPR' or v_sale.status_sales<>'AKAD') then raise exception 'PENCAIRAN BANK DICATAT SETELAH AKAD SALES KPR'; end if;
  if p_jenis_penerimaan='PENCAIRAN_DANA_JAMINAN' then
    select * into v_guarantee from public.sales_bank_guarantee_item where id_jaminan=p_id_jaminan and id_sales=p_id_sales for update;
    if not found or v_guarantee.status<>'DIAJUKAN_KE_BANK' then raise exception 'DANA JAMINAN BELUM DIAJUKAN KE BANK'; end if;
    select coalesce(sum(nominal),0) into v_claimed from public.sales_receipt where id_jaminan=p_id_jaminan and status='AKTIF';
    if p_nominal+v_claimed>v_guarantee.nominal_tagihan then raise exception 'PENCAIRAN MELEBIHI NILAI TAGIHAN DANA JAMINAN'; end if;
  elsif p_id_jaminan is not null then raise exception 'ID JAMINAN HANYA UNTUK PENCAIRAN DANA JAMINAN'; end if;
  if p_tanggal_penerimaan<coalesce(v_sale.tgl_booking,p_tanggal_penerimaan) then raise exception 'TANGGAL PENERIMAAN TIDAK BOLEH SEBELUM BOOKING'; end if;
  select saldo_piutang into v_balance from public.v_sales_financial_position where id_sales=p_id_sales;
  if p_nominal>coalesce(v_balance,0)+0.000001 then raise exception 'NOMINAL PENERIMAAN MELEBIHI SISA TAGIHAN %',greatest(0,coalesce(v_balance,0)); end if;
  v_receipt_no:='KW-'||to_char(now() at time zone 'Asia/Jakarta','YYYYMMDD')||'-'||lpad(nextval('public.sales_receipt_no_seq')::text,6,'0');
  v_barcode:='KAVIO-'||replace(v_receipt_no,'-','');
  insert into public.sales_receipt(no_kuitansi,nilai_barcode,id_sales,id_jaminan,jenis_penerimaan,tanggal_penerimaan,nominal,metode_penerimaan,no_referensi,keterangan,diterima_oleh)
  values(v_receipt_no,v_barcode,p_id_sales,p_id_jaminan,p_jenis_penerimaan,p_tanggal_penerimaan,p_nominal,p_metode_penerimaan,nullif(btrim(coalesce(p_no_referensi,'')),''),nullif(btrim(coalesce(p_keterangan,'')),''),auth.uid())
  returning sales_receipt.id_penerimaan into v_id;
  if p_jenis_penerimaan='PENCAIRAN_DANA_JAMINAN' then
    select coalesce(sum(nominal),0) into v_claimed from public.sales_receipt where id_jaminan=p_id_jaminan and status='AKTIF';
    if v_claimed>=v_guarantee.nominal_tagihan then update public.sales_bank_guarantee_item set status='DICAIRKAN',diperbarui_pada=now() where id_jaminan=p_id_jaminan; end if;
  end if;
  return query select v_id,v_receipt_no,v_barcode;
end;
$function$;

create or replace function public.save_sales_cancellation_settlement_atomic(
  p_id_sales uuid,p_keputusan text,p_nominal_dikembalikan numeric,p_nominal_ditahan numeric,
  p_alasan text,p_status_pengembalian text default 'BELUM_DIBAYAR',p_tanggal_pengembalian date default null
)
returns uuid
language plpgsql security definer set search_path = 'public'
as $function$
declare
  v_sale public.sales%rowtype;
  v_id uuid;
  v_received numeric;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('PAYMENT_RECEIPT_WRITE') then raise exception 'FORBIDDEN: PAYMENT_RECEIPT_WRITE'; end if;
  if p_nominal_dikembalikan is null or p_nominal_dikembalikan<0 or p_nominal_ditahan is null or p_nominal_ditahan<0 or nullif(btrim(coalesce(p_alasan,'')),'') is null then raise exception 'NOMINAL DAN ALASAN PENYELESAIAN PEMBATALAN WAJIB VALID'; end if;
  if p_keputusan not in ('BOOKING_FEE_DIKEMBALIKAN','BOOKING_FEE_DIHANGUSKAN','DIKEMBALIKAN_SEBAGIAN','TANPA_PENGEMBALIAN') then raise exception 'KEPUTUSAN PEMBATALAN TIDAK VALID'; end if;
  if p_nominal_dikembalikan=0 and p_status_pengembalian not in ('TIDAK_ADA','BELUM_DIBAYAR') then raise exception 'STATUS PENGEMBALIAN TIDAK VALID'; end if;
  if p_nominal_dikembalikan>0 and p_status_pengembalian not in ('BELUM_DIBAYAR','SUDAH_DIBAYAR') then raise exception 'STATUS PENGEMBALIAN TIDAK VALID'; end if;
  if p_status_pengembalian='SUDAH_DIBAYAR' and (p_tanggal_pengembalian is null or p_tanggal_pengembalian>(now() at time zone 'Asia/Jakarta')::date) then raise exception 'TANGGAL PENGEMBALIAN TIDAK VALID'; end if;
  if p_status_pengembalian<>'SUDAH_DIBAYAR' and p_tanggal_pengembalian is not null then raise exception 'TANGGAL PENGEMBALIAN HANYA DIISI SETELAH DIBAYAR'; end if;
  select * into v_sale from public.sales where id_sales=p_id_sales for update;
  if not found or v_sale.status_sales<>'BATAL' then raise exception 'PENYELESAIAN HANYA UNTUK SALES YANG SUDAH DIBATALKAN'; end if;
  select coalesce(sum(nominal),0) into v_received from public.sales_receipt where id_sales=p_id_sales and status='AKTIF';
  if p_nominal_dikembalikan+p_nominal_ditahan>v_received then raise exception 'TOTAL PENGEMBALIAN DAN DANA DITAHAN MELEBIHI PENERIMAAN YANG TERCATAT'; end if;
  insert into public.sales_cancellation_settlement(id_sales,keputusan,nominal_dikembalikan,nominal_ditahan,alasan,status_pengembalian,tanggal_pengembalian,diputuskan_oleh)
  values(p_id_sales,p_keputusan,p_nominal_dikembalikan,p_nominal_ditahan,btrim(p_alasan),case when p_nominal_dikembalikan=0 then 'TIDAK_ADA' else p_status_pengembalian end,p_tanggal_pengembalian,auth.uid())
  on conflict(id_sales) do update set keputusan=excluded.keputusan,nominal_dikembalikan=excluded.nominal_dikembalikan,nominal_ditahan=excluded.nominal_ditahan,
    alasan=excluded.alasan,status_pengembalian=excluded.status_pengembalian,tanggal_pengembalian=excluded.tanggal_pengembalian,diputuskan_oleh=auth.uid(),dibuat_pada=now()
  returning id_penyelesaian into v_id;
  return v_id;
end;
$function$;

create or replace function public.update_sales_atomic(
  p_id_sales uuid,p_nama_konsumen text,p_alamat_konsumen text,p_hp_konsumen text,
  p_status_sales text,p_jenis_pembayaran text,p_id_bank text,p_id_notaris text,p_tgl_akad date,p_target_akad date
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $function$
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
  if p_status_sales='AKAD' and (p_tgl_akad is null or nullif(btrim(coalesce(p_id_notaris,'')),'') is null or p_target_akad is null) then raise exception 'TARGET AKAD, TANGGAL AKAD, DAN NOTARIS WAJIB DIISI UNTUK STATUS AKAD'; end if;
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
$function$;

create or replace function public.save_sales_cash_installment_terms_atomic(
  p_id_sales uuid, p_tenor_bulan integer, p_pola_pelunasan text
)
returns void
language plpgsql security definer set search_path = 'public'
as $function$
declare v_sale public.sales%rowtype;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('PAYMENT_PLAN_WRITE') then raise exception 'FORBIDDEN: PAYMENT_PLAN_WRITE'; end if;
  if p_tenor_bulan not between 1 and 12 or p_pola_pelunasan not in ('CICILAN_FLEKSIBEL','LUNAS_DI_AKHIR') then raise exception 'TENOR CASH BERTAHAP HARUS 1-12 BULAN DAN POLA PEMBAYARAN VALID'; end if;
  select * into v_sale from public.sales where id_sales=p_id_sales for update;
  if not found or not v_sale.status_aktif then raise exception 'SALES AKTIF TIDAK DITEMUKAN'; end if;
  if v_sale.jenis_pembayaran <> 'CASH_BERTAHAP' then raise exception 'PENGATURAN TENOR HANYA UNTUK CASH BERTAHAP'; end if;
  insert into public.sales_cash_installment_terms(id_sales,tenor_bulan,pola_pelunasan,dibuat_oleh)
  values(p_id_sales,p_tenor_bulan,p_pola_pelunasan,auth.uid())
  on conflict(id_sales) do update set tenor_bulan=excluded.tenor_bulan,pola_pelunasan=excluded.pola_pelunasan,diperbarui_pada=now();
end;
$function$;

create or replace view public.v_sales_financial_position
with (security_invoker = true)
as
with costs as (
  select id_sales,
    coalesce(sum(nominal) filter (where jenis_biaya in ('PENAMBAHAN BANGUNAN','KELEBIHAN TANAH','PEMILIHAN LOKASI HOOK')),0) as tambahan_harga_jual,
    coalesce(sum(nominal) filter (where jenis_biaya in ('NOTARIS','BIAYA AKAD','BIAYA LAINNYA')),0) as biaya_terpisah
  from public.sales_biaya_tambahan where status_aktif group by id_sales
), receipts as (
  select id_sales,coalesce(sum(nominal),0) as total_diterima,
    coalesce(sum(nominal) filter (where jenis_penerimaan not in ('BIAYA_NOTARIS','BIAYA_AKAD')),0) as total_pembayaran_harga_jual
  from public.sales_receipt where status='AKTIF' group by id_sales
)
select s.id_sales,s.id_kavling,s.nama_konsumen,s.status_sales,s.status_aktif,s.jenis_pembayaran,
  coalesce(s.harga_jual,0) as harga_jual_dasar,coalesce(c.tambahan_harga_jual,0) as tambahan_harga_jual,
  coalesce(s.harga_jual,0)+coalesce(c.tambahan_harga_jual,0) as total_harga_jual,
  coalesce(c.biaya_terpisah,0) as biaya_terpisah,
  coalesce(s.harga_jual,0)+coalesce(c.tambahan_harga_jual,0)+coalesce(c.biaya_terpisah,0) as total_tagihan,
  coalesce(r.total_diterima,0) as total_diterima,
  coalesce(r.total_pembayaran_harga_jual,0) as total_pembayaran_harga_jual,
  case when s.status_sales='BATAL' then 0 else coalesce(s.harga_jual,0)+coalesce(c.tambahan_harga_jual,0)+coalesce(c.biaya_terpisah,0)-coalesce(r.total_diterima,0) end as saldo_piutang,
  case when s.status_sales='BATAL' then 0 when coalesce(s.harga_jual,0)+coalesce(c.tambahan_harga_jual,0)<=0 then 0
    else coalesce(r.total_pembayaran_harga_jual,0)/(coalesce(s.harga_jual,0)+coalesce(c.tambahan_harga_jual,0)) end as persentase_terbayar
from public.sales s left join costs c on c.id_sales=s.id_sales left join receipts r on r.id_sales=s.id_sales;




-- Enforce KPR eligibility for all Sales mutation paths, including older RPCs.
create function public.kavio_check_sales_kpr_bank() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.jenis_pembayaran='KPR' and (tg_op='INSERT' or new.id_bank is distinct from old.id_bank or new.jenis_pembayaran is distinct from old.jenis_pembayaran) then
  if not exists(select 1 from public.master_bank where id_bank=new.id_bank and status_aktif and is_kpr and jenis_akun='BANK') then raise exception 'Pilih bank aktif berstatus KPR dari Master Bank/Kas'; end if;
 end if;
 return new;
end; $$;
revoke all on function public.kavio_check_sales_kpr_bank() from public,anon;
create trigger sales_kpr_bank_check before insert or update on public.sales for each row execute function public.kavio_check_sales_kpr_bank();

create function public.save_sales_v2_atomic(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_payment text:=p_data->>'jenis_pembayaran'; v_tenor integer;
begin
 if auth.uid() is null or not public.kavio_can_action('SALES_WRITE') then raise exception 'FORBIDDEN: SALES_WRITE'; end if;
 if v_payment='CASH_BERTAHAP' then
  v_tenor:=(p_data->>'tenor_bulan')::integer;
  if v_tenor is null or v_tenor not between 1 and 12 or coalesce(p_data->>'pola_pelunasan','') not in ('CICILAN_FLEKSIBEL','LUNAS_DI_AKHIR') then raise exception 'Cash Bertahap memerlukan tenor 1-12 bulan dan pola pembayaran'; end if;
 end if;
 if nullif(p_data->>'id_sales','') is null then
  v_id:=public.create_sales_atomic(p_data->>'id_kavling',p_data->>'nama_konsumen',p_data->>'alamat_konsumen',p_data->>'hp_konsumen',p_data->>'status_sales',v_payment,p_data->>'id_bank',p_data->>'id_notaris',(p_data->>'tgl_booking')::date,(p_data->>'target_akad')::date,(p_data->>'tgl_akad')::date,(p_data->>'biaya_penambahan_bangunan')::numeric,(p_data->>'biaya_notaris')::numeric,(p_data->>'biaya_hook')::numeric,(p_data->>'biaya_lainnya')::numeric);
 else
  v_id:=(p_data->>'id_sales')::uuid;
  perform public.update_sales_atomic(v_id,p_data->>'nama_konsumen',p_data->>'alamat_konsumen',p_data->>'hp_konsumen',p_data->>'status_sales',v_payment,p_data->>'id_bank',p_data->>'id_notaris',(p_data->>'tgl_akad')::date,(p_data->>'target_akad')::date);
 end if;
 if v_payment='CASH_BERTAHAP' then
  insert into public.sales_cash_installment_terms(id_sales,tenor_bulan,pola_pelunasan,dibuat_oleh)
  values(v_id,v_tenor,p_data->>'pola_pelunasan',auth.uid()) on conflict(id_sales) do update set tenor_bulan=excluded.tenor_bulan,pola_pelunasan=excluded.pola_pelunasan,diperbarui_pada=now();
 else delete from public.sales_cash_installment_terms where id_sales=v_id;
 end if;
 return v_id;
end; $$;

-- All cash receipts use one mandatory destination account. Withheld guarantees
-- are NOT cash received; their outstanding balance stays collectible from bank.
create function public.post_sales_receipt_v2_atomic(p_data jsonb) returns table(id_penerimaan uuid,no_kuitansi text,nilai_barcode text)
language plpgsql security definer set search_path='' as $$
declare v_sale uuid:=(p_data->>'id_sales')::uuid; v_row record; v_item jsonb; v_kind text;
 v_items jsonb:=coalesce(p_data->'jaminan','[]'::jsonb); v_amount numeric; v_outstanding numeric; v_balance numeric;
begin
 if auth.uid() is null or not public.kavio_can_action('PAYMENT_RECEIPT_WRITE') then raise exception 'FORBIDDEN: PAYMENT_RECEIPT_WRITE'; end if;
 perform 1 from public.sales where id_sales=v_sale for update;
 if not exists(select 1 from public.master_bank where id_bank=p_data->>'id_bank_penerimaan' and status_aktif) then raise exception 'Pilih Kas/Bank tujuan yang aktif'; end if;
 if jsonb_typeof(v_items)<>'array' then raise exception 'Format dana jaminan tidak valid'; end if;
 if jsonb_array_length(v_items)>0 and p_data->>'jenis_penerimaan'<>'PENCAIRAN_KPR' then raise exception 'Dana jaminan hanya dicatat bersama pencairan KPR'; end if;
 -- Posted guarantee claims can be corrected even after final disbursement.
 if p_data->>'jenis_penerimaan'='PENCAIRAN_DANA_JAMINAN' then
  update public.sales_bank_guarantee_item set status='DIAJUKAN_KE_BANK' where id_jaminan=(p_data->>'id_jaminan')::uuid and id_sales=v_sale and status='DICAIRKAN';
 end if;
 select * into v_row from public.post_sales_receipt_atomic(v_sale,p_data->>'jenis_penerimaan',(p_data->>'tanggal_penerimaan')::date,(p_data->>'nominal')::numeric,p_data->>'metode_penerimaan',nullif(p_data->>'id_jaminan','')::uuid,p_data->>'no_referensi',p_data->>'keterangan');
 update public.sales_receipt set id_bank_penerimaan=p_data->>'id_bank_penerimaan',jaminan_snapshot=v_items where sales_receipt.id_penerimaan=v_row.id_penerimaan;
 for v_item in select value from jsonb_array_elements(v_items) loop
  v_kind:=upper(btrim(v_item->>'jenis_item')); v_amount:=(v_item->>'nominal_tagihan')::numeric;
  if v_kind is null or v_kind not in ('IMB','SERTIFIKAT','AIR_LISTRIK','BESTEK','GLOBAL') or v_amount is null or v_amount<=0 then raise exception 'Item atau nilai jaminan tidak valid'; end if;
  if exists(select 1 from public.sales_bank_guarantee_item where id_sales=v_sale and ((jenis_item='GLOBAL' and v_kind<>'GLOBAL') or (jenis_item<>'GLOBAL' and v_kind='GLOBAL'))) then raise exception 'Jaminan global dan rinci tidak dapat digabung'; end if;
  insert into public.sales_bank_guarantee_item(id_sales,jenis_item,nominal_tagihan,id_penerimaan_asal,dibuat_oleh)
  values(v_sale,v_kind,v_amount,v_row.id_penerimaan,auth.uid());
 end loop;
 select coalesce(sum(g.nominal_tagihan-coalesce(r.paid,0)),0) into v_outstanding from public.sales_bank_guarantee_item g
 left join lateral(select sum(nominal) paid from public.sales_receipt where id_jaminan=g.id_jaminan and status='AKTIF')r on true where g.id_sales=v_sale;
 select saldo_piutang into v_balance from public.v_sales_financial_position where id_sales=v_sale;
 if v_outstanding>v_balance+0.000001 then raise exception 'Nilai diterima dan dana jaminan melebihi sisa tagihan'; end if;
 return query select v_row.id_penerimaan,v_row.no_kuitansi,v_row.nilai_barcode;
end; $$;

create function public.amend_sales_receipt_atomic(p_id_penerimaan uuid,p_alasan text,p_pengganti jsonb default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_old public.sales_receipt%rowtype; v_sale public.sales%rowtype; v_new uuid; v_total numeric; v_paid numeric;
begin
 if auth.uid() is null or not public.kavio_can_action('PAYMENT_RECEIPT_WRITE') then raise exception 'FORBIDDEN: PAYMENT_RECEIPT_WRITE'; end if;
 if nullif(btrim(p_alasan),'') is null then raise exception 'Alasan koreksi/hapus wajib diisi'; end if;
 -- Same lock order as posting: Sales, receipt, guarantee.
 select * into v_old from public.sales_receipt where id_penerimaan=p_id_penerimaan;
 if not found then raise exception 'Penerimaan tidak ditemukan'; end if;
 select * into v_sale from public.sales where id_sales=v_old.id_sales for update;
 select * into v_old from public.sales_receipt where id_penerimaan=p_id_penerimaan for update;
 if v_old.status<>'AKTIF' then raise exception 'Penerimaan sudah dibatalkan'; end if;
 if not v_sale.status_aktif or v_sale.status_sales='BATAL' then raise exception 'Penerimaan Sales batal tidak dapat diubah; gunakan penyelesaian pembatalan'; end if;
 if p_pengganti is not null and (p_pengganti->>'id_sales')::uuid is distinct from v_old.id_sales then raise exception 'Koreksi tidak dapat memindahkan Sales'; end if;
 if exists(select 1 from public.sales_bank_guarantee_item where id_penerimaan_asal=p_id_penerimaan and status<>'BELUM_DIAJUKAN') then raise exception 'Dana jaminan sudah diajukan/dicairkan. Pencairan asal tidak dapat diubah'; end if;
 -- Keep references for canceled claim receipts; only unsubmitted origin items can be removed.
 if exists(select 1 from public.sales_receipt r join public.sales_bank_guarantee_item g on g.id_jaminan=r.id_jaminan where g.id_penerimaan_asal=p_id_penerimaan) then raise exception 'Jaminan memiliki riwayat pencairan dan tidak dapat dihapus'; end if;
 delete from public.sales_bank_guarantee_item where id_penerimaan_asal=p_id_penerimaan;
 update public.sales_receipt set status='BATAL',dibatalkan_oleh=auth.uid(),dibatalkan_pada=now(),alasan_pembatalan=btrim(p_alasan) where id_penerimaan=p_id_penerimaan;
 if v_old.id_jaminan is not null then update public.sales_bank_guarantee_item set status='DIAJUKAN_KE_BANK',diperbarui_pada=now() where id_jaminan=v_old.id_jaminan; end if;
 if p_pengganti is not null then
  select id_penerimaan into v_new from public.post_sales_receipt_v2_atomic(p_pengganti);
  update public.sales_receipt set koreksi_dari=p_id_penerimaan where id_penerimaan=v_new;
 end if;
 if exists(select 1 from public.sales_receipt where id_sales=v_sale.id_sales and status='AKTIF' and jenis_penerimaan<>'BOOKING_FEE') and not exists(select 1 from public.sales_receipt where id_sales=v_sale.id_sales and status='AKTIF' and jenis_penerimaan='BOOKING_FEE') then raise exception 'Booking fee masih diperlukan oleh penerimaan lanjutan'; end if;
 if (v_sale.status_sales='AKAD' and v_sale.jenis_pembayaran='KPR' or exists(select 1 from public.sales_receipt where id_sales=v_sale.id_sales and status='AKTIF' and jenis_penerimaan in ('CICILAN_CASH_BERTAHAP','PELUNASAN_CASH','PENCAIRAN_KPR','PENCAIRAN_DANA_JAMINAN'))) and not exists(select 1 from public.sales_receipt where id_sales=v_sale.id_sales and status='AKTIF' and jenis_penerimaan='UANG_MUKA') then raise exception 'Uang muka masih diperlukan oleh akad/pembayaran lanjutan'; end if;
 select total_harga_jual,total_pembayaran_harga_jual into v_total,v_paid from public.v_sales_financial_position where id_sales=v_sale.id_sales;
 if v_sale.jenis_pembayaran in ('CASH','CASH_BERTAHAP') then
  if v_sale.status_sales='AKAD' and v_paid+0.000001<v_total then raise exception 'Koreksi membuat pembayaran Cash sebelum akad belum lunas'; end if;
  if exists(select 1 from public.spk where id_kavling=v_sale.id_kavling and is_active and status_spk='AKTIF') and v_paid+0.000001<v_total*(case when v_sale.jenis_pembayaran='CASH' then 1 else 0.4 end) then raise exception 'Koreksi membuat pembayaran di bawah syarat SPK aktif'; end if;
 end if;
 return v_new;
end; $$;
revoke all on function public.save_sales_v2_atomic(jsonb),public.post_sales_receipt_v2_atomic(jsonb),public.amend_sales_receipt_atomic(uuid,text,jsonb) from public,anon;
grant execute on function public.save_sales_v2_atomic(jsonb),public.post_sales_receipt_v2_atomic(jsonb),public.amend_sales_receipt_atomic(uuid,text,jsonb) to authenticated,service_role;
-- Close legacy paths that bypass destination accounts or separate retention entry.
revoke execute on function public.post_sales_receipt_atomic(uuid,text,date,numeric,text,uuid,text,text),public.upsert_sales_bank_guarantee_atomic(uuid,jsonb) from authenticated;
