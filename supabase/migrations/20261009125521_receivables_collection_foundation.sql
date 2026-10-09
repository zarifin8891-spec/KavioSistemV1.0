-- Receivables and collections foundation for KAVIO V2.
-- Receipt records are immutable; cancellations and refunds are separate case decisions.

alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles add constraint user_profiles_role_check
  check (role = any (array['DIREKTUR','ADMIN','MARKETING','PELAKSANA','GUDANG','KEUANGAN','USER']::text[]));
alter table public.kavio_role_actions drop constraint if exists kavio_role_actions_role_check;
alter table public.kavio_role_actions add constraint kavio_role_actions_role_check
  check (role = any (array['DIREKTUR','ADMIN','MARKETING','PELAKSANA','GUDANG','KEUANGAN','USER']::text[]));

insert into public.kavio_role_actions(role, action) values
  ('ADMIN','PAYMENT_PLAN_WRITE'), ('DIREKTUR','PAYMENT_PLAN_WRITE'), ('KEUANGAN','PAYMENT_PLAN_WRITE'),
  ('ADMIN','PAYMENT_RECEIPT_WRITE'), ('DIREKTUR','PAYMENT_RECEIPT_WRITE'), ('KEUANGAN','PAYMENT_RECEIPT_WRITE')
on conflict (role, action) do nothing;

create table public.sales_cash_installment_terms (
  id_sales uuid primary key references public.sales(id_sales) on delete restrict,
  tenor_bulan smallint not null check (tenor_bulan between 6 and 12),
  pola_pelunasan text not null check (pola_pelunasan in ('CICILAN_FLEKSIBEL','LUNAS_DI_AKHIR')),
  persentase_minimal_awal numeric not null default 40 check (persentase_minimal_awal = 40),
  dibuat_oleh uuid not null default auth.uid() references auth.users(id) on delete restrict,
  dibuat_pada timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now()
);

create table public.sales_bank_guarantee_item (
  id_jaminan uuid primary key default gen_random_uuid(),
  id_sales uuid not null references public.sales(id_sales) on delete restrict,
  jenis_item text not null check (jenis_item in ('IMB','SERTIFIKAT','AIR_LISTRIK','BESTEK','GLOBAL')),
  nominal_tagihan numeric not null check (nominal_tagihan > 0),
  status text not null default 'BELUM_DIAJUKAN' check (status in ('BELUM_DIAJUKAN','DIAJUKAN_KE_BANK','DICAIRKAN')),
  tanggal_pengajuan date,
  keterangan text,
  dibuat_oleh uuid not null default auth.uid() references auth.users(id) on delete restrict,
  dibuat_pada timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now(),
  unique (id_sales, jenis_item),
  check ((status = 'BELUM_DIAJUKAN' and tanggal_pengajuan is null) or (status <> 'BELUM_DIAJUKAN' and tanggal_pengajuan is not null))
);
create index sales_bank_guarantee_status_idx on public.sales_bank_guarantee_item(status, tanggal_pengajuan);

create table public.sales_receipt (
  id_penerimaan uuid primary key default gen_random_uuid(),
  no_kuitansi text not null unique,
  nilai_barcode text not null unique,
  id_sales uuid not null references public.sales(id_sales) on delete restrict,
  id_jaminan uuid references public.sales_bank_guarantee_item(id_jaminan) on delete restrict,
  jenis_penerimaan text not null check (jenis_penerimaan in (
    'BOOKING_FEE','UANG_MUKA','CICILAN_CASH_BERTAHAP','PELUNASAN_CASH',
    'PENCAIRAN_KPR','PENCAIRAN_DANA_JAMINAN','BIAYA_NOTARIS','BIAYA_AKAD'
  )),
  tanggal_penerimaan date not null,
  nominal numeric not null check (nominal > 0),
  metode_penerimaan text not null check (metode_penerimaan in ('TUNAI','TRANSFER','GIRO','LAINNYA')),
  no_referensi text,
  keterangan text,
  diterima_oleh uuid not null default auth.uid() references auth.users(id) on delete restrict,
  dibuat_pada timestamptz not null default now(),
  check ((jenis_penerimaan = 'PENCAIRAN_DANA_JAMINAN' and id_jaminan is not null) or (jenis_penerimaan <> 'PENCAIRAN_DANA_JAMINAN' and id_jaminan is null))
);
create index sales_receipt_sale_date_idx on public.sales_receipt(id_sales, tanggal_penerimaan desc, dibuat_pada desc);
create index sales_receipt_type_date_idx on public.sales_receipt(jenis_penerimaan, tanggal_penerimaan desc);

create table public.sales_cancellation_settlement (
  id_penyelesaian uuid primary key default gen_random_uuid(),
  id_sales uuid not null unique references public.sales(id_sales) on delete restrict,
  keputusan text not null check (keputusan in ('BOOKING_FEE_DIKEMBALIKAN','BOOKING_FEE_DIHANGUSKAN','DIKEMBALIKAN_SEBAGIAN','TANPA_PENGEMBALIAN')),
  nominal_dikembalikan numeric not null default 0 check (nominal_dikembalikan >= 0),
  nominal_ditahan numeric not null default 0 check (nominal_ditahan >= 0),
  alasan text not null check (btrim(alasan) <> ''),
  status_pengembalian text not null default 'BELUM_DIBAYAR' check (status_pengembalian in ('TIDAK_ADA','BELUM_DIBAYAR','SUDAH_DIBAYAR')),
  tanggal_pengembalian date,
  diputuskan_oleh uuid not null default auth.uid() references auth.users(id) on delete restrict,
  dibuat_pada timestamptz not null default now(),
  check ((nominal_dikembalikan = 0 and status_pengembalian = 'TIDAK_ADA' and tanggal_pengembalian is null)
      or (nominal_dikembalikan > 0 and status_pengembalian in ('BELUM_DIBAYAR','SUDAH_DIBAYAR'))),
  check ((status_pengembalian = 'SUDAH_DIBAYAR' and tanggal_pengembalian is not null)
      or (status_pengembalian <> 'SUDAH_DIBAYAR' and tanggal_pengembalian is null))
);

create sequence public.sales_receipt_no_seq;
revoke all on sequence public.sales_receipt_no_seq from public, anon, authenticated;

alter table public.sales_cash_installment_terms enable row level security;
alter table public.sales_bank_guarantee_item enable row level security;
alter table public.sales_receipt enable row level security;
alter table public.sales_cancellation_settlement enable row level security;
create policy sales_cash_terms_read on public.sales_cash_installment_terms for select to authenticated
  using (public.kavio_is_active_user() and (public.kavio_can_action('PAYMENT_PLAN_WRITE') or public.kavio_can_action('PAYMENT_RECEIPT_WRITE')));
create policy sales_guarantee_read on public.sales_bank_guarantee_item for select to authenticated
  using (public.kavio_is_active_user() and public.kavio_can_action('PAYMENT_RECEIPT_WRITE'));
create policy sales_receipt_read on public.sales_receipt for select to authenticated
  using (public.kavio_is_active_user() and public.kavio_can_action('PAYMENT_RECEIPT_WRITE'));
create policy sales_cancellation_read on public.sales_cancellation_settlement for select to authenticated
  using (public.kavio_is_active_user() and public.kavio_can_action('PAYMENT_RECEIPT_WRITE'));
revoke all on public.sales_cash_installment_terms, public.sales_bank_guarantee_item,
  public.sales_receipt, public.sales_cancellation_settlement from public, anon, authenticated;
grant select on public.sales_cash_installment_terms, public.sales_bank_guarantee_item,
  public.sales_receipt, public.sales_cancellation_settlement to authenticated;

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
  if p_tenor_bulan not between 6 and 12 or p_pola_pelunasan not in ('CICILAN_FLEKSIBEL','LUNAS_DI_AKHIR') then raise exception 'TENOR CASH BERTAHAP HARUS 6-12 BULAN DAN POLA PEMBAYARAN VALID'; end if;
  select * into v_sale from public.sales where id_sales=p_id_sales for update;
  if not found or not v_sale.status_aktif then raise exception 'SALES AKTIF TIDAK DITEMUKAN'; end if;
  if v_sale.jenis_pembayaran <> 'CASH_BERTAHAP' then raise exception 'PENGATURAN TENOR HANYA UNTUK CASH BERTAHAP'; end if;
  insert into public.sales_cash_installment_terms(id_sales,tenor_bulan,pola_pelunasan,dibuat_oleh)
  values(p_id_sales,p_tenor_bulan,p_pola_pelunasan,auth.uid())
  on conflict(id_sales) do update set tenor_bulan=excluded.tenor_bulan,pola_pelunasan=excluded.pola_pelunasan,diperbarui_pada=now();
end;
$function$;

create or replace function public.upsert_sales_bank_guarantee_atomic(p_id_sales uuid,p_items jsonb)
returns integer
language plpgsql security definer set search_path = 'public'
as $function$
declare
  v_sale public.sales%rowtype;
  v_item jsonb;
  v_kind text;
  v_amount numeric;
  v_global_count integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('PAYMENT_RECEIPT_WRITE') then raise exception 'FORBIDDEN: PAYMENT_RECEIPT_WRITE'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'MINIMAL SATU ITEM DANA JAMINAN WAJIB DIISI'; end if;
  select * into v_sale from public.sales where id_sales=p_id_sales for update;
  if not found or not v_sale.status_aktif then raise exception 'SALES AKTIF TIDAK DITEMUKAN'; end if;
  if v_sale.jenis_pembayaran <> 'KPR' or v_sale.status_sales <> 'AKAD' then raise exception 'DANA JAMINAN HANYA DICATAT UNTUK SALES KPR SETELAH AKAD'; end if;
  if (select count(*) <> count(distinct upper(btrim(value->>'jenis_item'))) from jsonb_array_elements(p_items)) then raise exception 'ITEM DANA JAMINAN TIDAK BOLEH DUPLIKAT DALAM SATU INPUT'; end if;
  select count(*) filter (where upper(btrim(value->>'jenis_item'))='GLOBAL') into v_global_count from jsonb_array_elements(p_items);
  if v_global_count > 0 and jsonb_array_length(p_items)>1 then raise exception 'ITEM GLOBAL TIDAK DAPAT DIGABUNG DENGAN ITEM RINCI'; end if;
  if v_global_count>0 and exists(select 1 from public.sales_bank_guarantee_item where id_sales=p_id_sales and jenis_item<>'GLOBAL') then raise exception 'ITEM GLOBAL TIDAK DAPAT DIGABUNG DENGAN ITEM RINCI'; end if;
  if v_global_count=0 and exists(select 1 from public.sales_bank_guarantee_item where id_sales=p_id_sales and jenis_item='GLOBAL') then raise exception 'SALES INI SUDAH MENGGUNAKAN DANA JAMINAN GLOBAL'; end if;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin v_kind:=upper(btrim(v_item->>'jenis_item')); v_amount:=(v_item->>'nominal_tagihan')::numeric;
    exception when others then raise exception 'DATA ITEM DANA JAMINAN TIDAK VALID'; end;
    if v_kind not in ('IMB','SERTIFIKAT','AIR_LISTRIK','BESTEK','GLOBAL') or v_amount is null or v_amount<=0 then raise exception 'JENIS ATAU NOMINAL DANA JAMINAN TIDAK VALID'; end if;
    if exists(select 1 from public.sales_bank_guarantee_item where id_sales=p_id_sales and jenis_item=v_kind and status<>'BELUM_DIAJUKAN') then raise exception 'ITEM DANA JAMINAN SUDAH DIAJUKAN DAN TIDAK DAPAT DIUBAH'; end if;
  end loop;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.sales_bank_guarantee_item(id_sales,jenis_item,nominal_tagihan,keterangan,dibuat_oleh)
    values(p_id_sales,upper(btrim(v_item->>'jenis_item')),(v_item->>'nominal_tagihan')::numeric,nullif(btrim(coalesce(v_item->>'keterangan','')),''),auth.uid())
    on conflict(id_sales,jenis_item) do update set nominal_tagihan=excluded.nominal_tagihan,keterangan=excluded.keterangan,diperbarui_pada=now()
    where sales_bank_guarantee_item.status='BELUM_DIAJUKAN';
  end loop;
  return jsonb_array_length(p_items);
end;
$function$;

create or replace function public.submit_sales_bank_guarantee_claim_atomic(p_id_jaminan uuid,p_tanggal_pengajuan date,p_keterangan text default null)
returns void
language plpgsql security definer set search_path = 'public'
as $function$
declare v_item public.sales_bank_guarantee_item%rowtype;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('PAYMENT_RECEIPT_WRITE') then raise exception 'FORBIDDEN: PAYMENT_RECEIPT_WRITE'; end if;
  if p_tanggal_pengajuan is null or p_tanggal_pengajuan>(now() at time zone 'Asia/Jakarta')::date then raise exception 'TANGGAL PENGAJUAN TIDAK VALID'; end if;
  select * into v_item from public.sales_bank_guarantee_item where id_jaminan=p_id_jaminan for update;
  if not found or v_item.status<>'BELUM_DIAJUKAN' then raise exception 'DANA JAMINAN TIDAK DAPAT DIAJUKAN'; end if;
  update public.sales_bank_guarantee_item set status='DIAJUKAN_KE_BANK',tanggal_pengajuan=p_tanggal_pengajuan,
    keterangan=coalesce(nullif(btrim(coalesce(p_keterangan,'')),''),keterangan),diperbarui_pada=now()
  where id_jaminan=p_id_jaminan;
end;
$function$;

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
  if p_jenis_penerimaan<>'BOOKING_FEE' and not exists(select 1 from public.sales_receipt where id_sales=p_id_sales and jenis_penerimaan='BOOKING_FEE') then raise exception 'BOOKING FEE HARUS DICATAT SEBELUM PENERIMAAN BERIKUTNYA'; end if;
  if p_jenis_penerimaan in ('PENCAIRAN_KPR','PENCAIRAN_DANA_JAMINAN') and (v_sale.jenis_pembayaran<>'KPR' or v_sale.status_sales<>'AKAD') then raise exception 'PENCAIRAN BANK DICATAT SETELAH AKAD SALES KPR'; end if;
  if p_jenis_penerimaan='PENCAIRAN_DANA_JAMINAN' then
    select * into v_guarantee from public.sales_bank_guarantee_item where id_jaminan=p_id_jaminan and id_sales=p_id_sales for update;
    if not found or v_guarantee.status<>'DIAJUKAN_KE_BANK' then raise exception 'DANA JAMINAN BELUM DIAJUKAN KE BANK'; end if;
    select coalesce(sum(nominal),0) into v_claimed from public.sales_receipt where id_jaminan=p_id_jaminan;
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
    select coalesce(sum(nominal),0) into v_claimed from public.sales_receipt where id_jaminan=p_id_jaminan;
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
  select coalesce(sum(nominal),0) into v_received from public.sales_receipt where id_sales=p_id_sales;
  if p_nominal_dikembalikan+p_nominal_ditahan>v_received then raise exception 'TOTAL PENGEMBALIAN DAN DANA DITAHAN MELEBIHI PENERIMAAN YANG TERCATAT'; end if;
  insert into public.sales_cancellation_settlement(id_sales,keputusan,nominal_dikembalikan,nominal_ditahan,alasan,status_pengembalian,tanggal_pengembalian,diputuskan_oleh)
  values(p_id_sales,p_keputusan,p_nominal_dikembalikan,p_nominal_ditahan,btrim(p_alasan),case when p_nominal_dikembalikan=0 then 'TIDAK_ADA' else p_status_pengembalian end,p_tanggal_pengembalian,auth.uid())
  on conflict(id_sales) do update set keputusan=excluded.keputusan,nominal_dikembalikan=excluded.nominal_dikembalikan,nominal_ditahan=excluded.nominal_ditahan,
    alasan=excluded.alasan,status_pengembalian=excluded.status_pengembalian,tanggal_pengembalian=excluded.tanggal_pengembalian,diputuskan_oleh=auth.uid(),dibuat_pada=now()
  returning id_penyelesaian into v_id;
  return v_id;
end;
$function$;

revoke all on function public.save_sales_biaya_atomic(uuid,numeric,numeric,numeric,numeric) from public,anon,authenticated;
revoke all on function public.save_sales_biaya_atomic(uuid,numeric,numeric,numeric,numeric,numeric) from public,anon,authenticated;
create or replace function public.save_sales_biaya_atomic(
  p_id_sales uuid,p_biaya_penambahan_bangunan numeric,p_biaya_kelebihan_tanah numeric,
  p_biaya_notaris numeric,p_biaya_akad numeric,p_biaya_hook numeric,p_biaya_lainnya numeric
)
returns void
language plpgsql security definer set search_path = 'public'
as $function$
declare v_sale uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SALES_WRITE') then raise exception 'FORBIDDEN: SALES_WRITE'; end if;
  if p_id_sales is null then raise exception 'ID SALES TIDAK VALID'; end if;
  if coalesce(p_biaya_penambahan_bangunan,0)<0 or coalesce(p_biaya_kelebihan_tanah,0)<0 or coalesce(p_biaya_notaris,0)<0 or coalesce(p_biaya_akad,0)<0 or coalesce(p_biaya_hook,0)<0 or coalesce(p_biaya_lainnya,0)<0 then raise exception 'BIAYA SALES TIDAK BOLEH NEGATIF'; end if;
  perform pg_advisory_xact_lock(hashtextextended('sales-cost:'||p_id_sales::text,0));
  select id_sales into v_sale from public.sales where id_sales=p_id_sales for update;
  if not found then raise exception 'DATA SALES TIDAK DITEMUKAN'; end if;
  insert into public.sales_biaya_tambahan(id_sales,jenis_biaya,nominal,status_aktif) values
    (p_id_sales,'PENAMBAHAN BANGUNAN',coalesce(p_biaya_penambahan_bangunan,0),true),
    (p_id_sales,'KELEBIHAN TANAH',coalesce(p_biaya_kelebihan_tanah,0),true),
    (p_id_sales,'NOTARIS',coalesce(p_biaya_notaris,0),true),
    (p_id_sales,'BIAYA AKAD',coalesce(p_biaya_akad,0),true),
    (p_id_sales,'PEMILIHAN LOKASI HOOK',coalesce(p_biaya_hook,0),true),
    (p_id_sales,'BIAYA LAINNYA',coalesce(p_biaya_lainnya,0),true)
  on conflict(id_sales,jenis_biaya) do update set nominal=excluded.nominal,status_aktif=true;
  delete from public.sales_biaya_tambahan where id_sales=p_id_sales and nominal=0;
end;
$function$;

revoke all on function public.save_sales_biaya_atomic(uuid,numeric,numeric,numeric,numeric,numeric,numeric) from public,anon;
grant execute on function public.save_sales_biaya_atomic(uuid,numeric,numeric,numeric,numeric,numeric,numeric) to authenticated,service_role;

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
  from public.sales_receipt group by id_sales
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

create or replace view public.v_cash_bertahap_progress_payment_alert
with (security_invoker = true)
as
select f.id_sales,f.id_kavling,f.nama_konsumen,f.total_tagihan,f.total_diterima,f.saldo_piutang,
  f.persentase_terbayar,coalesce(p.progress_total,0) as progress_bangunan,
  greatest(0,coalesce(p.progress_total,0)-f.persentase_terbayar) as gap_persen,
  greatest(0,coalesce(p.progress_total,0)-f.persentase_terbayar)*f.total_harga_jual as nominal_ketertinggal
from public.v_sales_financial_position f
left join lateral (
  select s.id_kavling,coalesce(sum(v.progress_berbobot),0) as progress_total
  from public.spk s left join public.v_spk_work_item_progress_current v on v.id_spk=s.id_spk
  where s.id_kavling=f.id_kavling and s.jenis_spk='KAVLING' and s.is_active and s.status_spk='AKTIF'
  group by s.id_kavling
) p on true
where f.jenis_pembayaran='CASH_BERTAHAP' and f.status_aktif and f.status_sales not in ('AKAD','BATAL')
  and coalesce(p.progress_total,0)>f.persentase_terbayar;

revoke all on table public.v_sales_financial_position,public.v_cash_bertahap_progress_payment_alert from public,anon;
grant select on table public.v_sales_financial_position,public.v_cash_bertahap_progress_payment_alert to authenticated;

revoke all on function public.save_sales_cash_installment_terms_atomic(uuid,integer,text) from public,anon;
grant execute on function public.save_sales_cash_installment_terms_atomic(uuid,integer,text) to authenticated,service_role;
revoke all on function public.upsert_sales_bank_guarantee_atomic(uuid,jsonb) from public,anon;
grant execute on function public.upsert_sales_bank_guarantee_atomic(uuid,jsonb) to authenticated,service_role;
revoke all on function public.submit_sales_bank_guarantee_claim_atomic(uuid,date,text) from public,anon;
grant execute on function public.submit_sales_bank_guarantee_claim_atomic(uuid,date,text) to authenticated,service_role;
revoke all on function public.post_sales_receipt_atomic(uuid,text,date,numeric,text,uuid,text,text) from public,anon;
grant execute on function public.post_sales_receipt_atomic(uuid,text,date,numeric,text,uuid,text,text) to authenticated,service_role;
revoke all on function public.save_sales_cancellation_settlement_atomic(uuid,text,numeric,numeric,text,text,date) from public,anon;
grant execute on function public.save_sales_cancellation_settlement_atomic(uuid,text,numeric,numeric,text,text,date) to authenticated,service_role;

comment on table public.sales_receipt is 'Penerimaan immutable dengan nomor kuitansi barcode. Refund dan pembatalan dicatat terpisah.';
comment on table public.sales_bank_guarantee_item is 'Piutang dana jaminan KPR per IMB, Sertifikat, Air & Listrik, Bestek, atau Global.';
comment on table public.sales_cash_installment_terms is 'Tenor 6-12 bulan dan pola cash bertahap fleksibel tanpa jadwal jatuh tempo bulanan yang dipaksakan.';
comment on view public.v_cash_bertahap_progress_payment_alert is 'Peringatan cash bertahap saat progress pembangunan melebihi persentase pembayaran.';

-- Payment terms are checked at the SPK activation boundary, before construction starts.
create or replace function public.activate_spk_atomic(p_id_spk uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_spk public.spk%rowtype;
  v_kavling public.master_kavling%rowtype;
  v_sale public.sales%rowtype;
  v_total numeric;
  v_paid numeric;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SPK_WRITE') then raise exception 'FORBIDDEN: SPK_WRITE'; end if;
  select * into v_spk from public.spk where id_spk=p_id_spk for update;
  if not found or v_spk.status_spk<>'DRAFT' or v_spk.is_active then raise exception 'SPK TIDAK BERADA PADA STATUS DRAFT YANG VALID'; end if;
  select count(*),coalesce(sum(bobot),0) into v_count,v_total from public.spk_work_item where id_spk=p_id_spk;
  if v_count=0 or abs(v_total-1)>0.00001 then raise exception 'TOTAL BOBOT ITEM SPK HARUS 100%%. SAAT INI %%%',round(v_total*100,2); end if;
  if v_spk.jenis_spk='KAVLING' then
    select * into v_kavling from public.master_kavling where id_kavling=v_spk.id_kavling for update;
    if not found or not v_kavling.status_aktif then raise exception 'KAVLING PADA SPK TIDAK AKTIF ATAU TIDAK DITEMUKAN'; end if;
    if v_kavling.status_kavling not in ('AVAILABLE','BOOKING') then raise exception 'KAVLING BERSTATUS % TIDAK SIAP UNTUK SPK',v_kavling.status_kavling; end if;
    if exists(select 1 from public.spk where id_kavling=v_spk.id_kavling and is_active=true and id_spk<>p_id_spk) then raise exception 'KAVLING SUDAH MEMILIKI SPK AKTIF LAIN'; end if;
    select * into v_sale from public.sales where id_kavling=v_spk.id_kavling and status_aktif and status_sales<>'BATAL' order by created_at desc limit 1 for update;
    if found and v_sale.jenis_pembayaran='CASH' then
      select total_harga_jual,total_pembayaran_harga_jual into v_total,v_paid from public.v_sales_financial_position where id_sales=v_sale.id_sales;
      if coalesce(v_paid,0)+0.000001<coalesce(v_total,0) then raise exception 'PEMBANGUNAN CASH KERAS MENUNGGU PELUNASAN. SISA TAGIHAN %',greatest(0,coalesce(v_total,0)-coalesce(v_paid,0)); end if;
    elsif found and v_sale.jenis_pembayaran='CASH_BERTAHAP' then
      if not exists(select 1 from public.sales_cash_installment_terms where id_sales=v_sale.id_sales) then raise exception 'TENOR DAN POLA CASH BERTAHAP BELUM DICATAT'; end if;
      select total_harga_jual,total_pembayaran_harga_jual into v_total,v_paid from public.v_sales_financial_position where id_sales=v_sale.id_sales;
      if coalesce(v_paid,0)+0.000001<coalesce(v_total,0)*0.40 then raise exception 'UANG MUKA CASH BERTAHAP MINIMAL 40%% TERMASUK BOOKING FEE. KEKURANGAN %',greatest(0,coalesce(v_total,0)*0.40-coalesce(v_paid,0)); end if;
    end if;
  end if;
  update public.spk set status_spk='AKTIF',is_active=true where id_spk=p_id_spk and status_spk='DRAFT' and is_active=false;
  if not found then raise exception 'SPK BERUBAH SEBELUM AKTIVASI. SILAKAN COBA LAGI'; end if;
end;
$function$;

revoke all on function public.activate_spk_atomic(uuid) from public,anon;
grant execute on function public.activate_spk_atomic(uuid) to authenticated,service_role;
