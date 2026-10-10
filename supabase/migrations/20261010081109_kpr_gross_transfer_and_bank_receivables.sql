-- Cash nominal remains net, preserving existing receipts and the frozen print format.
-- KPR gross transfers consumer receivables to cash and bank receivables.
alter table public.sales_receipt drop constraint sales_receipt_nominal_check;
alter table public.sales_receipt add constraint sales_receipt_nominal_check
 check(nominal>0 or (nominal=0 and jenis_penerimaan='PENCAIRAN_KPR'));
create view public.v_sales_receipt_financial with(security_invoker=true) as
select r.*, h.dana_jaminan,
 r.nominal+h.dana_jaminan as nominal_bruto,
 case when r.jenis_penerimaan='PENCAIRAN_DANA_JAMINAN' then 0::numeric else r.nominal+h.dana_jaminan end as pelunasan_konsumen
from public.sales_receipt r
cross join lateral(select coalesce(sum((i->>'nominal_tagihan')::numeric),0) as dana_jaminan
 from jsonb_array_elements(case when r.jenis_penerimaan='PENCAIRAN_KPR' then r.jaminan_snapshot else '[]'::jsonb end)i)h;
revoke all on public.v_sales_receipt_financial from public,anon;
grant select on public.v_sales_receipt_financial to authenticated;

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
    coalesce(sum(pelunasan_konsumen),0) as total_pelunasan_konsumen,
    coalesce(sum(pelunasan_konsumen) filter (where jenis_penerimaan not in ('BIAYA_NOTARIS','BIAYA_AKAD')),0) as total_pembayaran_harga_jual
  from public.v_sales_receipt_financial where status='AKTIF' group by id_sales
)
select s.id_sales,s.id_kavling,s.nama_konsumen,s.status_sales,s.status_aktif,s.jenis_pembayaran,
  coalesce(s.harga_jual,0) as harga_jual_dasar,coalesce(c.tambahan_harga_jual,0) as tambahan_harga_jual,
  coalesce(s.harga_jual,0)+coalesce(c.tambahan_harga_jual,0) as total_harga_jual,
  coalesce(c.biaya_terpisah,0) as biaya_terpisah,
  coalesce(s.harga_jual,0)+coalesce(c.tambahan_harga_jual,0)+coalesce(c.biaya_terpisah,0) as total_tagihan,
  coalesce(r.total_diterima,0) as total_diterima,
  coalesce(r.total_pembayaran_harga_jual,0) as total_pembayaran_harga_jual,
  case when s.status_sales='BATAL' then 0 else coalesce(s.harga_jual,0)+coalesce(c.tambahan_harga_jual,0)+coalesce(c.biaya_terpisah,0)-coalesce(r.total_pelunasan_konsumen,0) end as saldo_piutang,
  case when s.status_sales='BATAL' then 0 when coalesce(s.harga_jual,0)+coalesce(c.tambahan_harga_jual,0)<=0 then 0
    else coalesce(r.total_pembayaran_harga_jual,0)/(coalesce(s.harga_jual,0)+coalesce(c.tambahan_harga_jual,0)) end as persentase_terbayar,
  coalesce(r.total_pelunasan_konsumen,0) as total_pelunasan_konsumen
from public.sales s left join costs c on c.id_sales=s.id_sales left join receipts r on r.id_sales=s.id_sales;




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
  if p_nominal is null or (p_nominal<0 or (p_nominal=0 and p_jenis_penerimaan<>'PENCAIRAN_KPR')) or p_tanggal_penerimaan is null or p_tanggal_penerimaan>(now() at time zone 'Asia/Jakarta')::date then raise exception 'TANGGAL DAN NOMINAL PENERIMAAN TIDAK VALID'; end if;
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
  if p_jenis_penerimaan<>'PENCAIRAN_DANA_JAMINAN' and p_nominal>coalesce(v_balance,0)+0.000001 then raise exception 'NOMINAL PENERIMAAN MELEBIHI SISA TAGIHAN %',greatest(0,coalesce(v_balance,0)); end if;
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

create or replace function public.post_sales_receipt_v2_atomic(p_data jsonb) returns table(id_penerimaan uuid,no_kuitansi text,nilai_barcode text)
language plpgsql security definer set search_path='' as $$
declare v_sale uuid:=(p_data->>'id_sales')::uuid; v_row record; v_item jsonb; v_kind text;
 v_items jsonb:=coalesce(p_data->'jaminan','[]'::jsonb); v_amount numeric; v_outstanding numeric; v_balance numeric; v_gross numeric; v_held numeric:=0; v_net numeric;
begin
 if auth.uid() is null or not public.kavio_can_action('PAYMENT_RECEIPT_WRITE') then raise exception 'FORBIDDEN: PAYMENT_RECEIPT_WRITE'; end if;
 perform 1 from public.sales where id_sales=v_sale for update;
 if not exists(select 1 from public.master_bank where id_bank=p_data->>'id_bank_penerimaan' and status_aktif) then raise exception 'Pilih Kas/Bank tujuan yang aktif'; end if;
 if jsonb_typeof(v_items)<>'array' then raise exception 'Format dana jaminan tidak valid'; end if;
 if jsonb_array_length(v_items)>0 and p_data->>'jenis_penerimaan'<>'PENCAIRAN_KPR' then raise exception 'Dana jaminan hanya dicatat bersama pencairan KPR'; end if;
 -- Existing receipts keep their cash nominal. New KPR forms pass nominal_bruto.
 if p_data->>'jenis_penerimaan'='PENCAIRAN_KPR' then
  for v_item in select value from jsonb_array_elements(v_items) loop
   v_amount:=(v_item->>'nominal_tagihan')::numeric;
   if v_amount is null or v_amount<=0 or v_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Nilai dana jaminan tidak valid'; end if;
   v_held:=v_held+v_amount;
  end loop;
  v_gross:=case when p_data ? 'nominal_bruto' then (p_data->>'nominal_bruto')::numeric else (p_data->>'nominal')::numeric+v_held end;
  if v_gross is null or v_gross<=0 or v_gross::text in ('NaN','Infinity','-Infinity') then raise exception 'Nilai pencairan bruto KPR tidak valid'; end if;
  if v_held>v_gross then raise exception 'Dana jaminan tidak boleh melebihi pencairan bruto KPR'; end if;
  select saldo_piutang into v_balance from public.v_sales_financial_position where id_sales=v_sale;
  if v_gross>coalesce(v_balance,0)+0.000001 then raise exception 'Pencairan bruto KPR melebihi sisa piutang konsumen %',coalesce(v_balance,0); end if;
  v_net:=v_gross-v_held;
  p_data:=p_data||jsonb_build_object('nominal',v_net);
 end if;
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
 select saldo_piutang into v_balance from public.v_sales_financial_position where id_sales=v_sale;
 if v_balance < -0.000001 then raise exception 'Pelunasan melebihi piutang konsumen'; end if;
 return query select v_row.id_penerimaan,v_row.no_kuitansi,v_row.nilai_barcode;
end; $$;


-- Receipt-related cash movements only; this is not a general-ledger bank balance.
create view public.v_sales_bank_movement with(security_invoker=true) as
select r.id_penerimaan::text||':MASUK' as id_mutasi,r.id_penerimaan,r.id_sales,r.id_bank_penerimaan,
 r.tanggal_penerimaan,r.no_kuitansi,r.jenis_penerimaan,
 case when r.jenis_penerimaan='PENCAIRAN_KPR' then 'PENCAIRAN_KPR_BRUTO' else r.jenis_penerimaan end as jenis_mutasi,
 r.nominal_bruto as debit,0::numeric as kredit,r.nominal_bruto as nilai_mutasi
from public.v_sales_receipt_financial r where r.status='AKTIF'
union all
select r.id_penerimaan::text||':JAMINAN',r.id_penerimaan,r.id_sales,r.id_bank_penerimaan,
 r.tanggal_penerimaan,r.no_kuitansi,r.jenis_penerimaan,'DANA_JAMINAN_DITAHAN',0::numeric,r.dana_jaminan,-r.dana_jaminan
from public.v_sales_receipt_financial r where r.status='AKTIF' and r.dana_jaminan>0;
create view public.v_sales_bank_receivable with(security_invoker=true) as
select g.*,s.id_bank as id_bank_kpr,coalesce(p.nominal_diterima,0) as nominal_diterima,
 g.nominal_tagihan-coalesce(p.nominal_diterima,0) as saldo_piutang_bank
from public.sales_bank_guarantee_item g join public.sales s on s.id_sales=g.id_sales
left join lateral(select sum(r.nominal) nominal_diterima from public.sales_receipt r
 where r.id_jaminan=g.id_jaminan and r.status='AKTIF')p on true;
revoke all on public.v_sales_bank_movement,public.v_sales_bank_receivable from public,anon;
grant select on public.v_sales_bank_movement,public.v_sales_bank_receivable to authenticated;
-- Preserve existing guarded RPC access; no direct table write grants.
revoke all on function public.post_sales_receipt_v2_atomic(jsonb) from public,anon;
grant execute on function public.post_sales_receipt_v2_atomic(jsonb) to authenticated,service_role;
comment on view public.v_sales_receipt_financial is 'Nominal = uang bersih; nominal_bruto KPR = uang bersih + jaminan. Klaim jaminan tidak mengurangi piutang konsumen lagi.';

create view public.v_sales_bank_receipt_balance with(security_invoker=true) as
select id_bank_penerimaan,sum(debit) as total_bruto,sum(kredit) as total_jaminan,
 sum(nilai_mutasi) as total_uang_masuk from public.v_sales_bank_movement group by id_bank_penerimaan;
revoke all on public.v_sales_bank_receipt_balance from public,anon;
grant select on public.v_sales_bank_receipt_balance to authenticated;
