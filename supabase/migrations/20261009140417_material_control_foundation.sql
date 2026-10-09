-- KAVIO V2 Material Control foundation. Inventory mutations will be exposed
-- only through atomic, authorized RPCs; this migration defines the relational model.

-- Add the warehouse operator as a first-class KAVIO role.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles add constraint user_profiles_role_check
  check (role = any (array['DIREKTUR','ADMIN','MARKETING','PELAKSANA','GUDANG','USER']::text[]));
alter table public.kavio_role_actions drop constraint if exists kavio_role_actions_role_check;
alter table public.kavio_role_actions add constraint kavio_role_actions_role_check
  check (role = any (array['DIREKTUR','ADMIN','MARKETING','PELAKSANA','GUDANG','USER']::text[]));

insert into public.kavio_role_actions(role, action) values
  ('ADMIN','MATERIAL_CATALOG_WRITE'), ('DIREKTUR','MATERIAL_CATALOG_WRITE'),
  ('ADMIN','MATERIAL_WAREHOUSE_WRITE'), ('DIREKTUR','MATERIAL_WAREHOUSE_WRITE'), ('GUDANG','MATERIAL_WAREHOUSE_WRITE'),
  ('ADMIN','MATERIAL_REQUEST_WRITE'), ('DIREKTUR','MATERIAL_REQUEST_WRITE'), ('PELAKSANA','MATERIAL_REQUEST_WRITE'), ('GUDANG','MATERIAL_REQUEST_WRITE'),
  ('ADMIN','MATERIAL_USE_WRITE'), ('DIREKTUR','MATERIAL_USE_WRITE'), ('PELAKSANA','MATERIAL_USE_WRITE'), ('GUDANG','MATERIAL_USE_WRITE')
on conflict (role, action) do nothing;

create table public.master_material (
  id_material uuid primary key default gen_random_uuid(),
  kode_referensi text,
  nama_material text not null check (btrim(nama_material) <> ''),
  kategori text not null check (btrim(kategori) <> ''),
  satuan text not null check (btrim(satuan) <> ''),
  jenis_item text not null check (jenis_item in ('BAHAN','ALAT_PAKAI_ULANG','UPAH')),
  status_aktif boolean not null default true,
  created_at timestamptz not null default now()
);
create index master_material_nama_idx on public.master_material (lower(nama_material));
create index master_material_kode_idx on public.master_material (kode_referensi) where kode_referensi is not null;

create table public.rab_template (
  id_rab uuid primary key default gen_random_uuid(),
  id_tipe text not null references public.master_tipe_rumah(id_tipe) on delete restrict,
  nama_template text not null check (btrim(nama_template) <> ''),
  versi text not null default '1',
  status_aktif boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (id_tipe, versi)
);

create table public.rab_template_item (
  id_item_rab uuid primary key default gen_random_uuid(),
  id_rab uuid not null references public.rab_template(id_rab) on delete cascade,
  urutan integer not null check (urutan > 0),
  id_material uuid not null references public.master_material(id_material) on delete restrict,
  kode_snapshot text,
  nama_snapshot text not null check (btrim(nama_snapshot) <> ''),
  kategori_snapshot text not null check (btrim(kategori_snapshot) <> ''),
  satuan_snapshot text not null check (btrim(satuan_snapshot) <> ''),
  volume numeric not null check (volume >= 0),
  harga_standar numeric not null check (harga_standar >= 0),
  created_at timestamptz not null default now(),
  unique (id_rab, urutan)
);
create index rab_template_item_material_idx on public.rab_template_item(id_material);

create table public.material_location (
  id_lokasi uuid primary key default gen_random_uuid(),
  kode_lokasi text not null unique,
  nama_lokasi text not null check (btrim(nama_lokasi) <> ''),
  jenis_lokasi text not null check (jenis_lokasi in ('GUDANG','SITE')),
  status_aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- Project preparation is kept separate from Fasum SPKs (e.g. land shaping,
-- road compaction, and kavling formation).
create table public.project_preparation_work (
  id_persiapan uuid primary key default gen_random_uuid(),
  kode text not null unique,
  nama_pekerjaan text not null check (btrim(nama_pekerjaan) <> ''),
  status text not null default 'AKTIF' check (status in ('AKTIF','SELESAI')),
  created_at timestamptz not null default now()
);

create table public.material_request (
  id_permintaan uuid primary key default gen_random_uuid(),
  no_permintaan text not null unique,
  id_spk uuid references public.spk(id_spk) on delete restrict,
  id_persiapan uuid references public.project_preparation_work(id_persiapan) on delete restrict,
  id_lokasi uuid references public.material_location(id_lokasi) on delete restrict,
  status text not null default 'DIAJUKAN' check (status in ('DIAJUKAN','SEBAGIAN_DIPENUHI','DIPENUHI','DITOLAK','DIBATALKAN')),
  sumber_laporan text not null check (sumber_laporan in ('MANDOR_PELAKSANA','GUDANG')),
  tanggal date not null default ((now() at time zone 'Asia/Jakarta')::date),
  diminta_oleh uuid not null default auth.uid() references auth.users(id) on delete restrict,
  keterangan text,
  created_at timestamptz not null default now(),
  check ((id_spk is not null and id_persiapan is null) or (id_spk is null and id_persiapan is not null))
);
create index material_request_spk_status_idx on public.material_request(id_spk, status, tanggal desc);

create table public.material_request_item (
  id_item_permintaan uuid primary key default gen_random_uuid(),
  id_permintaan uuid not null references public.material_request(id_permintaan) on delete cascade,
  id_material uuid not null references public.master_material(id_material) on delete restrict,
  jumlah_diminta numeric not null check (jumlah_diminta > 0),
  jumlah_dipenuhi numeric not null default 0 check (jumlah_dipenuhi >= 0 and jumlah_dipenuhi <= jumlah_diminta),
  keterangan text,
  unique (id_permintaan, id_material)
);

create table public.material_transaction (
  id_transaksi uuid primary key default gen_random_uuid(),
  no_transaksi text not null unique,
  jenis_transaksi text not null check (jenis_transaksi in (
    'SALDO_AWAL','PENERIMAAN','KELUAR_KE_SPK','PEMAKAIAN_LANGSUNG',
    'PEMAKAIAN_DARI_SPK','KEMBALI_KE_GUDANG','TRANSFER_ANTAR_SPK',
    'PEMAKAIAN_SUPPLIER_LANGSUNG','REKONSILIASI_KELUAR'
  )),
  tanggal date not null default ((now() at time zone 'Asia/Jakarta')::date),
  id_spk uuid references public.spk(id_spk) on delete restrict,
  id_persiapan uuid references public.project_preparation_work(id_persiapan) on delete restrict,
  id_spk_tujuan uuid references public.spk(id_spk) on delete restrict,
  id_lokasi_asal uuid references public.material_location(id_lokasi) on delete restrict,
  id_lokasi_tujuan uuid references public.material_location(id_lokasi) on delete restrict,
  id_permintaan uuid references public.material_request(id_permintaan) on delete restrict,
  nama_pemasok text,
  no_nota text,
  status text not null default 'POSTED' check (status = 'POSTED'),
  mandor_status_informasi text not null default 'BELUM_DIKIRIM' check (mandor_status_informasi in ('BELUM_DIKIRIM','TERKIRIM','DIBACA')),
  mandor_status_informasi_pada timestamptz,
  dibuat_oleh uuid not null default auth.uid() references auth.users(id) on delete restrict,
  keterangan text,
  created_at timestamptz not null default now(),
  check (id_spk is null or id_spk_tujuan is null or id_spk <> id_spk_tujuan)
);
create index material_transaction_spk_date_idx on public.material_transaction(id_spk, tanggal desc);
create index material_transaction_kind_date_idx on public.material_transaction(jenis_transaksi, tanggal desc);

create table public.material_transaction_item (
  id_item_transaksi uuid primary key default gen_random_uuid(),
  id_transaksi uuid not null references public.material_transaction(id_transaksi) on delete restrict,
  id_material uuid not null references public.master_material(id_material) on delete restrict,
  jumlah numeric not null check (jumlah > 0),
  harga_satuan numeric not null check (harga_satuan >= 0),
  biaya_dibebankan numeric not null default 0 check (biaya_dibebankan >= 0),
  created_at timestamptz not null default now()
);
create index material_transaction_item_material_idx on public.material_transaction_item(id_material);

-- Cached, transactionally maintained balances. harga_rata_rata is per material/location.
-- jumlah_belum_dibebankan applies to reusable tools that have never been issued to an SPK.
create table public.material_stock_location (
  id_lokasi uuid not null references public.material_location(id_lokasi) on delete restrict,
  id_material uuid not null references public.master_material(id_material) on delete restrict,
  jumlah numeric not null default 0 check (jumlah >= 0),
  harga_rata_rata numeric not null default 0 check (harga_rata_rata >= 0),
  jumlah_belum_dibebankan numeric not null default 0 check (jumlah_belum_dibebankan >= 0 and jumlah_belum_dibebankan <= jumlah),
  updated_at timestamptz not null default now(),
  primary key (id_lokasi, id_material)
);

create table public.material_stock_spk (
  id_spk uuid not null references public.spk(id_spk) on delete restrict,
  id_material uuid not null references public.master_material(id_material) on delete restrict,
  jumlah numeric not null default 0 check (jumlah >= 0),
  harga_rata_rata numeric not null default 0 check (harga_rata_rata >= 0),
  updated_at timestamptz not null default now(),
  primary key (id_spk, id_material)
);

create table public.material_stock_preparation (
  id_persiapan uuid not null references public.project_preparation_work(id_persiapan) on delete restrict,
  id_material uuid not null references public.master_material(id_material) on delete restrict,
  jumlah numeric not null default 0 check (jumlah >= 0),
  harga_rata_rata numeric not null default 0 check (harga_rata_rata >= 0),
  updated_at timestamptz not null default now(),
  primary key (id_persiapan, id_material)
);

create table public.material_spk_reconciliation (
  id_rekonsiliasi uuid primary key default gen_random_uuid(),
  no_rekonsiliasi text not null unique,
  id_spk uuid not null references public.spk(id_spk) on delete restrict,
  tanggal date not null default ((now() at time zone 'Asia/Jakarta')::date),
  status text not null default 'DRAFT' check (status in ('DRAFT','POSTED')),
  diajukan_oleh uuid not null default auth.uid() references auth.users(id) on delete restrict,
  diselesaikan_oleh uuid references auth.users(id) on delete restrict,
  keterangan text,
  created_at timestamptz not null default now()
);
create index material_reconciliation_spk_idx on public.material_spk_reconciliation(id_spk, status, tanggal desc);

create table public.material_spk_reconciliation_item (
  id_item_rekonsiliasi uuid primary key default gen_random_uuid(),
  id_rekonsiliasi uuid not null references public.material_spk_reconciliation(id_rekonsiliasi) on delete cascade,
  id_material uuid not null references public.master_material(id_material) on delete restrict,
  jumlah numeric not null check (jumlah > 0),
  tindakan text not null check (tindakan in ('KEMBALI_KE_GUDANG','PINDAH_KE_SPK','PEMAKAIAN_FINAL','HILANG_RUSAK')),
  id_spk_tujuan uuid references public.spk(id_spk) on delete restrict,
  id_lokasi_tujuan uuid references public.material_location(id_lokasi) on delete restrict,
  alasan text,
  check ((tindakan = 'PINDAH_KE_SPK' and id_spk_tujuan is not null and id_lokasi_tujuan is null)
      or (tindakan = 'KEMBALI_KE_GUDANG' and id_lokasi_tujuan is not null and id_spk_tujuan is null)
      or (tindakan in ('PEMAKAIAN_FINAL','HILANG_RUSAK') and id_lokasi_tujuan is null and id_spk_tujuan is null))
);

alter table public.material_transaction
  add column id_rekonsiliasi uuid references public.material_spk_reconciliation(id_rekonsiliasi) on delete restrict;

create index material_request_item_material_idx on public.material_request_item(id_material);
create index material_transaction_item_transaction_idx on public.material_transaction_item(id_transaksi);
create index material_reconciliation_item_header_idx on public.material_spk_reconciliation_item(id_rekonsiliasi);

create sequence public.material_request_no_seq;
create sequence public.material_transaction_no_seq;
create sequence public.material_reconciliation_no_seq;

-- RLS: users can read operational data when active; writes will pass through RPCs.
do $rls$
declare
  t text;
begin
  foreach t in array array[
    'master_material','rab_template','rab_template_item','material_location','project_preparation_work',
    'material_request','material_request_item','material_transaction','material_transaction_item',
    'material_stock_location','material_stock_spk','material_stock_preparation','material_spk_reconciliation','material_spk_reconciliation_item'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.kavio_is_active_user())', 'kavio_select_'||t, t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$rls$;

revoke all on public.master_material, public.rab_template, public.rab_template_item, public.material_location,
  public.project_preparation_work, public.material_request, public.material_request_item,
  public.material_transaction, public.material_transaction_item, public.material_stock_location,
  public.material_stock_spk, public.material_stock_preparation, public.material_spk_reconciliation,
  public.material_spk_reconciliation_item from public, anon, authenticated;
grant select on public.master_material, public.rab_template, public.rab_template_item, public.material_location,
  public.project_preparation_work, public.material_request, public.material_request_item,
  public.material_transaction, public.material_transaction_item, public.material_stock_location,
  public.material_stock_spk, public.material_stock_preparation, public.material_spk_reconciliation,
  public.material_spk_reconciliation_item to authenticated;

create policy kavio_write_master_material on public.master_material
  for all to authenticated using (public.kavio_can_action('MATERIAL_CATALOG_WRITE'))
  with check (public.kavio_can_action('MATERIAL_CATALOG_WRITE'));
create policy kavio_write_rab_template on public.rab_template
  for all to authenticated using (public.kavio_can_action('MASTER_WRITE'))
  with check (public.kavio_can_action('MASTER_WRITE'));
create policy kavio_write_rab_template_item on public.rab_template_item
  for all to authenticated using (public.kavio_can_action('MASTER_WRITE'))
  with check (public.kavio_can_action('MASTER_WRITE'));
create policy kavio_write_material_location on public.material_location
  for all to authenticated using (public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE'))
  with check (public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE'));
create policy kavio_write_project_preparation_work on public.project_preparation_work
  for all to authenticated using (public.kavio_can_action('MATERIAL_CATALOG_WRITE'))
  with check (public.kavio_can_action('MATERIAL_CATALOG_WRITE'));
create policy kavio_write_material_request on public.material_request
  for all to authenticated using (public.kavio_can_action('MATERIAL_REQUEST_WRITE'))
  with check (public.kavio_can_action('MATERIAL_REQUEST_WRITE'));
create policy kavio_write_material_request_item on public.material_request_item
  for all to authenticated using (public.kavio_can_action('MATERIAL_REQUEST_WRITE'))
  with check (public.kavio_can_action('MATERIAL_REQUEST_WRITE'));

grant insert, update, delete on public.master_material, public.rab_template, public.rab_template_item,
  public.material_location, public.project_preparation_work to authenticated;

-- Ledger and balance tables are read-only to client roles. Privileged SECURITY DEFINER
-- RPCs will perform stock mutations atomically with role checks.
revoke insert, update, delete on public.material_transaction, public.material_transaction_item,
  public.material_stock_location, public.material_stock_spk,
  public.material_stock_preparation,
  public.material_spk_reconciliation, public.material_spk_reconciliation_item
from authenticated, anon;
revoke all on sequence public.material_request_no_seq, public.material_transaction_no_seq,
  public.material_reconciliation_no_seq from public, anon, authenticated;

create or replace view public.v_material_stock_location
with (security_invoker = true)
as
select l.id_lokasi, l.kode_lokasi, l.nama_lokasi, s.id_material, m.kode_referensi,
  m.nama_material, m.kategori, m.satuan, m.jenis_item, s.jumlah,
  s.harga_rata_rata, s.jumlah * s.harga_rata_rata as nilai_persediaan
from public.material_stock_location s
join public.material_location l on l.id_lokasi = s.id_lokasi
join public.master_material m on m.id_material = s.id_material;

create or replace view public.v_material_stock_spk
with (security_invoker = true)
as
select b.id_spk, s.jenis_spk, s.id_kavling, s.nama_objek, b.id_material,
  m.kode_referensi, m.nama_material, m.satuan, m.jenis_item, b.jumlah,
  b.harga_rata_rata, b.jumlah * b.harga_rata_rata as nilai_stok
from public.material_stock_spk b
join public.spk s on s.id_spk = b.id_spk
join public.master_material m on m.id_material = b.id_material;

create or replace view public.v_material_spk_close_check
with (security_invoker = true)
as
select id_spk, count(*) filter (where jumlah > 0.000001)::integer as item_sisa,
  coalesce(sum(jumlah * harga_rata_rata) filter (where jumlah > 0.000001), 0)::numeric as nilai_sisa
from public.material_stock_spk
group by id_spk;

create or replace view public.v_material_spk_usage
with (security_invoker = true)
as
select t.id_spk, t.tanggal, t.jenis_transaksi, i.id_material,
  m.kode_referensi, m.nama_material, m.satuan, i.jumlah,
  i.harga_satuan, i.biaya_dibebankan, t.no_transaksi, t.no_nota,
  t.nama_pemasok, t.keterangan
from public.material_transaction t
join public.material_transaction_item i on i.id_transaksi = t.id_transaksi
join public.master_material m on m.id_material = i.id_material
where t.jenis_transaksi in ('PEMAKAIAN_LANGSUNG','PEMAKAIAN_DARI_SPK','PEMAKAIAN_SUPPLIER_LANGSUNG','REKONSILIASI_KELUAR');

revoke all on table public.v_material_stock_location, public.v_material_stock_spk,
  public.v_material_spk_close_check, public.v_material_spk_usage from public, anon;
grant select on table public.v_material_stock_location, public.v_material_stock_spk,
  public.v_material_spk_close_check, public.v_material_spk_usage to authenticated;

create or replace function public.deactivate_spk_atomic(p_id_spk uuid)
returns text
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_spk public.spk%rowtype;
  v_progress_total numeric;
  v_next_status text;
  v_item_sisa integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SPK_WRITE') then raise exception 'FORBIDDEN: SPK_WRITE'; end if;
  select * into v_spk from public.spk where id_spk = p_id_spk for update;
  if not found or not v_spk.is_active or v_spk.status_spk <> 'AKTIF' then raise exception 'HANYA SPK AKTIF YANG DAPAT DITANDAI SELESAI'; end if;

  select coalesce(sum(progress_berbobot), 0) into v_progress_total
  from public.v_spk_work_item_progress_current where id_spk = p_id_spk;
  if v_progress_total < 0.99999 then raise exception 'SPK BELUM DAPAT DISELESAIKAN. PROGRESS AKTUAL BARU %%%', round(v_progress_total * 100, 2); end if;

  select count(*) filter (where jumlah > 0.000001)::integer into v_item_sisa
  from public.material_stock_spk where id_spk = p_id_spk;
  if coalesce(v_item_sisa, 0) > 0 then
    raise exception 'MASIH ADA % ITEM SISA MATERIAL PADA SPK. LAKUKAN REKONSILIASI PER ITEM SEBELUM MENUTUP SPK', v_item_sisa;
  end if;

  update public.spk set status_spk = 'SELESAI', is_active = false
  where id_spk = p_id_spk and is_active = true and status_spk = 'AKTIF';
  if not found then raise exception 'SPK BERUBAH SEBELUM DISELESAIKAN. SILAKAN COBA LAGI'; end if;
  if v_spk.jenis_spk = 'FASUM' then return 'SELESAI'; end if;
  v_next_status := public.kavio_sync_kavling_status(v_spk.id_kavling);
  return coalesce(v_next_status, 'READY_STOCK');
end;
$function$;

revoke all on function public.deactivate_spk_atomic(uuid) from public, anon;
grant execute on function public.deactivate_spk_atomic(uuid) to authenticated, service_role;

comment on table public.rab_template_item is 'Snapshot nama, kode, satuan, volume, dan harga standar RAB per tipe rumah; kuantitas nol diperbolehkan.';
comment on table public.material_stock_location is 'Saldo stok per lokasi dengan harga rata-rata tertimbang dan penanda alat reusable yang belum pernah dibebankan ke SPK.';
comment on table public.material_stock_spk is 'Saldo material yang sudah dialokasikan secara administratif ke SPK; konfirmasi mandor bersifat informatif.';
comment on table public.material_spk_reconciliation_item is 'Keputusan penyelesaian sisa stok dibuat per item dan per kasus saat SPK ditutup.';
comment on column public.material_transaction.tanggal is 'Tanggal posting otomatis hari ini; transaksi backdate tidak diizinkan.';

create or replace function public.create_material_request_atomic(
  p_id_spk uuid,
  p_sumber_laporan text,
  p_items jsonb,
  p_keterangan text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_spk public.spk%rowtype;
  v_item jsonb;
  v_material uuid;
  v_qty numeric;
  v_request uuid;
  v_no text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('MATERIAL_REQUEST_WRITE') then raise exception 'FORBIDDEN: MATERIAL_REQUEST_WRITE'; end if;
  if p_sumber_laporan not in ('MANDOR_PELAKSANA','GUDANG') or p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'SUMBER LAPORAN DAN MINIMAL SATU MATERIAL WAJIB DIISI';
  end if;
  select * into v_spk from public.spk where id_spk = p_id_spk and is_active and status_spk = 'AKTIF';
  if not found then raise exception 'SPK AKTIF TIDAK DITEMUKAN'; end if;
  if (select count(*) <> count(distinct nullif(btrim(value->>'id_material'), '')) from jsonb_array_elements(p_items)) then
    raise exception 'MATERIAL TIDAK BOLEH DUPLIKAT DALAM SATU PERMINTAAN';
  end if;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin v_material := (v_item->>'id_material')::uuid; v_qty := (v_item->>'jumlah')::numeric; exception when others then raise exception 'MATERIAL ATAU JUMLAH PERMINTAAN TIDAK VALID'; end;
    if v_qty is null or v_qty <= 0 or not exists (select 1 from public.master_material where id_material = v_material and status_aktif and jenis_item in ('BAHAN','ALAT_PAKAI_ULANG')) then
      raise exception 'MATERIAL NONAKTIF, BUKAN ITEM STOK, ATAU JUMLAH TIDAK VALID';
    end if;
  end loop;
  v_no := 'MR-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-' || lpad(nextval('public.material_request_no_seq')::text, 6, '0');
  insert into public.material_request(no_permintaan, id_spk, sumber_laporan, diminta_oleh, keterangan)
  values(v_no, p_id_spk, p_sumber_laporan, auth.uid(), nullif(btrim(coalesce(p_keterangan, '')), ''))
  returning id_permintaan into v_request;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.material_request_item(id_permintaan, id_material, jumlah_diminta, keterangan)
    values(v_request, (v_item->>'id_material')::uuid, (v_item->>'jumlah')::numeric, nullif(btrim(coalesce(v_item->>'keterangan', '')), ''));
  end loop;
  return v_request;
end;
$function$;

revoke all on function public.create_material_request_atomic(uuid, text, jsonb, text) from public, anon;
grant execute on function public.create_material_request_atomic(uuid, text, jsonb, text) to authenticated, service_role;

create or replace function public.post_material_receipt_atomic(
  p_id_lokasi uuid,
  p_items jsonb,
  p_saldo_awal boolean default false,
  p_nama_pemasok text default null,
  p_no_nota text default null,
  p_keterangan text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_location public.material_location%rowtype;
  v_item jsonb;
  v_material public.master_material%rowtype;
  v_id_material uuid;
  v_qty numeric;
  v_cost numeric;
  v_tx uuid;
  v_no text;
  v_kind text := case when coalesce(p_saldo_awal, false) then 'SALDO_AWAL' else 'PENERIMAAN' end;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE') then raise exception 'FORBIDDEN: MATERIAL_WAREHOUSE_WRITE'; end if;
  select * into v_location from public.material_location where id_lokasi = p_id_lokasi and jenis_lokasi = 'GUDANG' and status_aktif;
  if not found then raise exception 'LOKASI GUDANG TIDAK AKTIF ATAU TIDAK DITEMUKAN'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'MINIMAL SATU ITEM STOK WAJIB DIISI'; end if;
  if not coalesce(p_saldo_awal, false) and (nullif(btrim(coalesce(p_nama_pemasok, '')), '') is null or nullif(btrim(coalesce(p_no_nota, '')), '') is null) then
    raise exception 'PEMASOK DAN NOMOR NOTA WAJIB DIISI UNTUK PENERIMAAN';
  end if;
  if (select count(*) <> count(distinct nullif(btrim(value->>'id_material'), '')) from jsonb_array_elements(p_items)) then raise exception 'MATERIAL TIDAK BOLEH DUPLIKAT DALAM SATU TRANSAKSI'; end if;

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'id_material'
  loop
    begin v_id_material := (v_item->>'id_material')::uuid; v_qty := (v_item->>'jumlah')::numeric; v_cost := (v_item->>'harga_satuan')::numeric; exception when others then raise exception 'ITEM, JUMLAH, ATAU HARGA TIDAK VALID'; end;
    select * into v_material from public.master_material where id_material = v_id_material and status_aktif;
    if not found or v_material.jenis_item = 'UPAH' or v_qty is null or v_qty <= 0 or v_cost is null or v_cost < 0 then raise exception 'ITEM BUKAN STOK AKTIF ATAU JUMLAH/HARGA TIDAK VALID'; end if;
    if coalesce(p_saldo_awal, false) and exists (
      select 1 from public.material_transaction t join public.material_transaction_item i using(id_transaksi)
      where t.id_lokasi_tujuan = p_id_lokasi and i.id_material = v_material.id_material
    ) then raise exception 'SALDO AWAL HANYA BOLEH DICATAT SEBELUM TRANSAKSI ITEM PERTAMA'; end if;
  end loop;

  v_no := 'MT-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-' || lpad(nextval('public.material_transaction_no_seq')::text, 6, '0');
  insert into public.material_transaction(no_transaksi, jenis_transaksi, id_lokasi_tujuan, nama_pemasok, no_nota, dibuat_oleh, keterangan)
  values(v_no, v_kind, p_id_lokasi, nullif(btrim(coalesce(p_nama_pemasok, '')), ''), nullif(btrim(coalesce(p_no_nota, '')), ''), auth.uid(), nullif(btrim(coalesce(p_keterangan, '')), ''))
  returning id_transaksi into v_tx;

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'id_material'
  loop
    select * into v_material from public.master_material where id_material = (v_item->>'id_material')::uuid;
    v_qty := (v_item->>'jumlah')::numeric; v_cost := (v_item->>'harga_satuan')::numeric;
    insert into public.material_transaction_item(id_transaksi, id_material, jumlah, harga_satuan)
    values(v_tx, v_material.id_material, v_qty, v_cost);
    insert into public.material_stock_location(id_lokasi, id_material, jumlah, harga_rata_rata, jumlah_belum_dibebankan)
    values(p_id_lokasi, v_material.id_material, v_qty, v_cost, case when v_material.jenis_item = 'ALAT_PAKAI_ULANG' then v_qty else 0 end)
    on conflict (id_lokasi, id_material) do update
    set harga_rata_rata = case when material_stock_location.jumlah + excluded.jumlah = 0 then 0 else
          ((material_stock_location.jumlah * material_stock_location.harga_rata_rata) + (excluded.jumlah * excluded.harga_rata_rata)) / (material_stock_location.jumlah + excluded.jumlah) end,
        jumlah = material_stock_location.jumlah + excluded.jumlah,
        jumlah_belum_dibebankan = material_stock_location.jumlah_belum_dibebankan + excluded.jumlah_belum_dibebankan,
        updated_at = now();
  end loop;
  return v_tx;
end;
$function$;

revoke all on function public.post_material_receipt_atomic(uuid, jsonb, boolean, text, text, text) from public, anon;
grant execute on function public.post_material_receipt_atomic(uuid, jsonb, boolean, text, text, text) to authenticated, service_role;

create or replace function public.post_material_issue_to_spk_atomic(
  p_id_permintaan uuid,
  p_id_lokasi uuid,
  p_items jsonb,
  p_keterangan text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_request public.material_request%rowtype;
  v_spk public.spk%rowtype;
  v_location public.material_location%rowtype;
  v_item jsonb;
  v_material public.master_material%rowtype;
  v_stock public.material_stock_location%rowtype;
  v_spk_stock public.material_stock_spk%rowtype;
  v_request_item public.material_request_item%rowtype;
  v_id_material uuid;
  v_qty numeric;
  v_cost numeric;
  v_charge_qty numeric;
  v_charge_cost numeric;
  v_tx uuid;
  v_no text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE') then raise exception 'FORBIDDEN: MATERIAL_WAREHOUSE_WRITE'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'MINIMAL SATU ITEM PENGELUARAN WAJIB DIISI'; end if;
  select * into v_request from public.material_request where id_permintaan = p_id_permintaan for update;
  if not found or v_request.status not in ('DIAJUKAN','SEBAGIAN_DIPENUHI') then raise exception 'PERMINTAAN MATERIAL TIDAK DAPAT DIPENUHI'; end if;
  select * into v_spk from public.spk where id_spk = v_request.id_spk and is_active and status_spk = 'AKTIF';
  if not found then raise exception 'SPK PADA PERMINTAAN TIDAK AKTIF'; end if;
  select * into v_location from public.material_location where id_lokasi = p_id_lokasi and jenis_lokasi = 'GUDANG' and status_aktif;
  if not found then raise exception 'LOKASI GUDANG TIDAK AKTIF ATAU TIDAK DITEMUKAN'; end if;
  if (select count(*) <> count(distinct nullif(btrim(value->>'id_material'), '')) from jsonb_array_elements(p_items)) then raise exception 'MATERIAL TIDAK BOLEH DUPLIKAT DALAM SATU PENGELUARAN'; end if;

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'id_material'
  loop
    begin v_id_material := (v_item->>'id_material')::uuid; v_qty := (v_item->>'jumlah')::numeric; exception when others then raise exception 'ITEM ATAU JUMLAH PENGELUARAN TIDAK VALID'; end;
    if v_qty is null or v_qty <= 0 then raise exception 'JUMLAH PENGELUARAN HARUS LEBIH DARI NOL'; end if;
    select * into v_request_item from public.material_request_item where id_permintaan = p_id_permintaan and id_material = v_id_material for update;
    if not found or v_request_item.jumlah_dipenuhi + v_qty > v_request_item.jumlah_diminta then raise exception 'JUMLAH MELEBIHI SISA PERMINTAAN MATERIAL'; end if;
    select * into v_material from public.master_material where id_material = v_id_material and status_aktif and jenis_item in ('BAHAN','ALAT_PAKAI_ULANG');
    if not found then raise exception 'MATERIAL NONAKTIF ATAU BUKAN ITEM STOK'; end if;
    select * into v_stock from public.material_stock_location where id_lokasi = p_id_lokasi and id_material = v_id_material for update;
    if not found or v_stock.jumlah + 0.000001 < v_qty then raise exception 'STOK GUDANG TIDAK MENCUKUPI UNTUK MATERIAL %', v_material.nama_material; end if;
  end loop;

  v_no := 'MT-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-' || lpad(nextval('public.material_transaction_no_seq')::text, 6, '0');
  insert into public.material_transaction(no_transaksi, jenis_transaksi, id_spk, id_lokasi_asal, id_permintaan, dibuat_oleh, keterangan)
  values(v_no, 'KELUAR_KE_SPK', v_request.id_spk, p_id_lokasi, p_id_permintaan, auth.uid(), nullif(btrim(coalesce(p_keterangan, '')), ''))
  returning id_transaksi into v_tx;

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'id_material'
  loop
    v_id_material := (v_item->>'id_material')::uuid; v_qty := (v_item->>'jumlah')::numeric;
    select * into v_material from public.master_material where id_material = v_id_material;
    select * into v_stock from public.material_stock_location where id_lokasi = p_id_lokasi and id_material = v_id_material for update;
    v_cost := v_stock.harga_rata_rata;
    v_charge_qty := case when v_material.jenis_item = 'ALAT_PAKAI_ULANG' then least(v_qty, v_stock.jumlah_belum_dibebankan) else 0 end;
    v_charge_cost := v_charge_qty * v_cost;
    update public.material_stock_location
    set jumlah = jumlah - v_qty,
        jumlah_belum_dibebankan = jumlah_belum_dibebankan - v_charge_qty,
        updated_at = now()
    where id_lokasi = p_id_lokasi and id_material = v_id_material;
    insert into public.material_stock_spk(id_spk, id_material, jumlah, harga_rata_rata)
    values(v_request.id_spk, v_id_material, v_qty, v_cost)
    on conflict (id_spk, id_material) do update
    set harga_rata_rata = case when material_stock_spk.jumlah + excluded.jumlah = 0 then 0 else
          ((material_stock_spk.jumlah * material_stock_spk.harga_rata_rata) + (excluded.jumlah * excluded.harga_rata_rata)) / (material_stock_spk.jumlah + excluded.jumlah) end,
        jumlah = material_stock_spk.jumlah + excluded.jumlah,
        updated_at = now();
    insert into public.material_transaction_item(id_transaksi, id_material, jumlah, harga_satuan, biaya_dibebankan)
    values(v_tx, v_id_material, v_qty, v_cost, v_charge_cost);
    update public.material_request_item set jumlah_dipenuhi = jumlah_dipenuhi + v_qty where id_permintaan = p_id_permintaan and id_material = v_id_material;
  end loop;

  update public.material_request r set status = case
    when not exists (select 1 from public.material_request_item i where i.id_permintaan = r.id_permintaan and i.jumlah_dipenuhi < i.jumlah_diminta) then 'DIPENUHI'
    when exists (select 1 from public.material_request_item i where i.id_permintaan = r.id_permintaan and i.jumlah_dipenuhi > 0) then 'SEBAGIAN_DIPENUHI'
    else 'DIAJUKAN' end
  where r.id_permintaan = p_id_permintaan;
  return v_tx;
end;
$function$;

revoke all on function public.post_material_issue_to_spk_atomic(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.post_material_issue_to_spk_atomic(uuid, uuid, jsonb, text) to authenticated, service_role;

create or replace function public.post_material_direct_usage_atomic(
  p_id_spk uuid,
  p_id_lokasi uuid,
  p_items jsonb,
  p_keterangan text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_spk public.spk%rowtype;
  v_location public.material_location%rowtype;
  v_item jsonb;
  v_material public.master_material%rowtype;
  v_stock public.material_stock_location%rowtype;
  v_id_material uuid;
  v_qty numeric;
  v_cost numeric;
  v_tx uuid;
  v_no text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('MATERIAL_USE_WRITE') then raise exception 'FORBIDDEN: MATERIAL_USE_WRITE'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'MINIMAL SATU MATERIAL PEMAKAIAN WAJIB DIISI'; end if;
  select * into v_spk from public.spk where id_spk = p_id_spk and is_active and status_spk = 'AKTIF';
  if not found then raise exception 'SPK AKTIF TIDAK DITEMUKAN'; end if;
  select * into v_location from public.material_location where id_lokasi = p_id_lokasi and jenis_lokasi = 'GUDANG' and status_aktif;
  if not found then raise exception 'LOKASI GUDANG TIDAK AKTIF ATAU TIDAK DITEMUKAN'; end if;
  if (select count(*) <> count(distinct nullif(btrim(value->>'id_material'), '')) from jsonb_array_elements(p_items)) then raise exception 'MATERIAL TIDAK BOLEH DUPLIKAT DALAM SATU PEMAKAIAN'; end if;
  for v_item in select value from jsonb_array_elements(p_items) order by value->>'id_material'
  loop
    begin v_id_material := (v_item->>'id_material')::uuid; v_qty := (v_item->>'jumlah')::numeric; exception when others then raise exception 'ITEM ATAU JUMLAH PEMAKAIAN TIDAK VALID'; end;
    select * into v_material from public.master_material where id_material = v_id_material and status_aktif;
    if not found or v_material.jenis_item <> 'BAHAN' or v_qty is null or v_qty <= 0 then raise exception 'PEMAKAIAN LANGSUNG HANYA UNTUK BAHAN AKTIF DENGAN JUMLAH POSITIF'; end if;
    select * into v_stock from public.material_stock_location where id_lokasi = p_id_lokasi and id_material = v_id_material for update;
    if not found or v_stock.jumlah + 0.000001 < v_qty then raise exception 'STOK GUDANG TIDAK MENCUKUPI UNTUK MATERIAL %', v_material.nama_material; end if;
  end loop;

  v_no := 'MT-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-' || lpad(nextval('public.material_transaction_no_seq')::text, 6, '0');
  insert into public.material_transaction(no_transaksi, jenis_transaksi, id_spk, id_lokasi_asal, dibuat_oleh, keterangan)
  values(v_no, 'PEMAKAIAN_LANGSUNG', p_id_spk, p_id_lokasi, auth.uid(), nullif(btrim(coalesce(p_keterangan, '')), ''))
  returning id_transaksi into v_tx;
  for v_item in select value from jsonb_array_elements(p_items) order by value->>'id_material'
  loop
    v_id_material := (v_item->>'id_material')::uuid; v_qty := (v_item->>'jumlah')::numeric;
    select * into v_stock from public.material_stock_location where id_lokasi = p_id_lokasi and id_material = v_id_material for update;
    v_cost := v_stock.harga_rata_rata;
    update public.material_stock_location set jumlah = jumlah - v_qty, updated_at = now()
    where id_lokasi = p_id_lokasi and id_material = v_id_material;
    insert into public.material_transaction_item(id_transaksi, id_material, jumlah, harga_satuan, biaya_dibebankan)
    values(v_tx, v_id_material, v_qty, v_cost, v_qty * v_cost);
  end loop;
  return v_tx;
end;
$function$;

revoke all on function public.post_material_direct_usage_atomic(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.post_material_direct_usage_atomic(uuid, uuid, jsonb, text) to authenticated, service_role;

create or replace function public.post_spk_material_usage_atomic(
  p_id_spk uuid,
  p_items jsonb,
  p_keterangan text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_spk public.spk%rowtype;
  v_item jsonb;
  v_material public.master_material%rowtype;
  v_stock public.material_stock_spk%rowtype;
  v_id_material uuid;
  v_qty numeric;
  v_cost numeric;
  v_tx uuid;
  v_no text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('MATERIAL_USE_WRITE') then raise exception 'FORBIDDEN: MATERIAL_USE_WRITE'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'MINIMAL SATU MATERIAL PEMAKAIAN WAJIB DIISI'; end if;
  select * into v_spk from public.spk where id_spk = p_id_spk and is_active and status_spk = 'AKTIF';
  if not found then raise exception 'SPK AKTIF TIDAK DITEMUKAN'; end if;
  if (select count(*) <> count(distinct nullif(btrim(value->>'id_material'), '')) from jsonb_array_elements(p_items)) then raise exception 'MATERIAL TIDAK BOLEH DUPLIKAT DALAM SATU PEMAKAIAN'; end if;
  for v_item in select value from jsonb_array_elements(p_items) order by value->>'id_material'
  loop
    begin v_id_material := (v_item->>'id_material')::uuid; v_qty := (v_item->>'jumlah')::numeric; exception when others then raise exception 'ITEM ATAU JUMLAH PEMAKAIAN TIDAK VALID'; end;
    select * into v_material from public.master_material where id_material = v_id_material and status_aktif;
    if not found or v_material.jenis_item <> 'BAHAN' or v_qty is null or v_qty <= 0 then raise exception 'PEMAKAIAN SPK HANYA UNTUK BAHAN AKTIF DENGAN JUMLAH POSITIF'; end if;
    select * into v_stock from public.material_stock_spk where id_spk = p_id_spk and id_material = v_id_material for update;
    if not found or v_stock.jumlah + 0.000001 < v_qty then raise exception 'STOK SPK TIDAK MENCUKUPI UNTUK MATERIAL %', v_material.nama_material; end if;
  end loop;

  v_no := 'MT-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-' || lpad(nextval('public.material_transaction_no_seq')::text, 6, '0');
  insert into public.material_transaction(no_transaksi, jenis_transaksi, id_spk, dibuat_oleh, keterangan)
  values(v_no, 'PEMAKAIAN_DARI_SPK', p_id_spk, auth.uid(), nullif(btrim(coalesce(p_keterangan, '')), ''))
  returning id_transaksi into v_tx;
  for v_item in select value from jsonb_array_elements(p_items) order by value->>'id_material'
  loop
    v_id_material := (v_item->>'id_material')::uuid; v_qty := (v_item->>'jumlah')::numeric;
    select * into v_stock from public.material_stock_spk where id_spk = p_id_spk and id_material = v_id_material for update;
    v_cost := v_stock.harga_rata_rata;
    update public.material_stock_spk set jumlah = jumlah - v_qty, updated_at = now()
    where id_spk = p_id_spk and id_material = v_id_material;
    insert into public.material_transaction_item(id_transaksi, id_material, jumlah, harga_satuan, biaya_dibebankan)
    values(v_tx, v_id_material, v_qty, v_cost, v_qty * v_cost);
  end loop;
  return v_tx;
end;
$function$;

revoke all on function public.post_spk_material_usage_atomic(uuid, jsonb, text) from public, anon;
grant execute on function public.post_spk_material_usage_atomic(uuid, jsonb, text) to authenticated, service_role;

create or replace function public.post_supplier_direct_usage_atomic(
  p_id_spk uuid,
  p_nama_pemasok text,
  p_no_nota text,
  p_items jsonb,
  p_keterangan text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_spk public.spk%rowtype;
  v_item jsonb;
  v_material public.master_material%rowtype;
  v_id_material uuid;
  v_qty numeric;
  v_cost numeric;
  v_tx uuid;
  v_no text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('MATERIAL_USE_WRITE') then raise exception 'FORBIDDEN: MATERIAL_USE_WRITE'; end if;
  if nullif(btrim(coalesce(p_nama_pemasok, '')), '') is null or nullif(btrim(coalesce(p_no_nota, '')), '') is null then raise exception 'PEMASOK DAN NOMOR NOTA WAJIB DIISI'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'MINIMAL SATU ITEM PEMAKAIAN LANGSUNG WAJIB DIISI'; end if;
  select * into v_spk from public.spk where id_spk = p_id_spk and is_active and status_spk = 'AKTIF';
  if not found then raise exception 'SPK AKTIF TIDAK DITEMUKAN'; end if;
  if (select count(*) <> count(distinct nullif(btrim(value->>'id_material'), '')) from jsonb_array_elements(p_items)) then raise exception 'MATERIAL TIDAK BOLEH DUPLIKAT DALAM SATU TRANSAKSI'; end if;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin v_id_material := (v_item->>'id_material')::uuid; v_qty := (v_item->>'jumlah')::numeric; v_cost := (v_item->>'harga_satuan')::numeric; exception when others then raise exception 'ITEM, JUMLAH, ATAU HARGA TIDAK VALID'; end;
    select * into v_material from public.master_material where id_material = v_id_material and status_aktif;
    if not found or v_material.jenis_item <> 'BAHAN' or v_qty is null or v_qty <= 0 or v_cost is null or v_cost < 0 then raise exception 'PEMAKAIAN LANGSUNG HANYA UNTUK BAHAN AKTIF DENGAN JUMLAH/HARGA VALID'; end if;
  end loop;
  v_no := 'MT-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-' || lpad(nextval('public.material_transaction_no_seq')::text, 6, '0');
  insert into public.material_transaction(no_transaksi, jenis_transaksi, id_spk, nama_pemasok, no_nota, dibuat_oleh, keterangan)
  values(v_no, 'PEMAKAIAN_SUPPLIER_LANGSUNG', p_id_spk, nullif(btrim(p_nama_pemasok), ''), nullif(btrim(p_no_nota), ''), auth.uid(), nullif(btrim(coalesce(p_keterangan, '')), ''))
  returning id_transaksi into v_tx;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.material_transaction_item(id_transaksi, id_material, jumlah, harga_satuan, biaya_dibebankan)
    values(v_tx, (v_item->>'id_material')::uuid, (v_item->>'jumlah')::numeric,
      (v_item->>'harga_satuan')::numeric, (v_item->>'jumlah')::numeric * (v_item->>'harga_satuan')::numeric);
  end loop;
  return v_tx;
end;
$function$;

revoke all on function public.post_supplier_direct_usage_atomic(uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.post_supplier_direct_usage_atomic(uuid, text, text, jsonb, text) to authenticated, service_role;

create or replace function public.post_spk_material_reconciliation_atomic(
  p_id_spk uuid,
  p_items jsonb,
  p_keterangan text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_spk public.spk%rowtype;
  v_item jsonb;
  v_material public.master_material%rowtype;
  v_stock public.material_stock_spk%rowtype;
  v_location public.material_location%rowtype;
  v_target public.spk%rowtype;
  v_id_material uuid;
  v_qty numeric;
  v_action text;
  v_target_spk uuid;
  v_target_location uuid;
  v_reason text;
  v_cost numeric;
  v_charge numeric;
  v_recon uuid;
  v_recon_no text;
  v_tx uuid;
  v_tx_no text;
  v_tx_kind text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE') then raise exception 'FORBIDDEN: MATERIAL_WAREHOUSE_WRITE'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'MINIMAL SATU ITEM REKONSILIASI WAJIB DIISI'; end if;
  select * into v_spk from public.spk where id_spk = p_id_spk and is_active and status_spk = 'AKTIF' for update;
  if not found then raise exception 'SPK AKTIF TIDAK DITEMUKAN'; end if;
  if (select count(*) <> count(distinct nullif(btrim(value->>'id_material'), '')) from jsonb_array_elements(p_items)) then raise exception 'MATERIAL TIDAK BOLEH DUPLIKAT DALAM SATU REKONSILIASI'; end if;

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'id_material'
  loop
    begin
      v_id_material := (v_item->>'id_material')::uuid;
      v_qty := (v_item->>'jumlah')::numeric;
      v_action := upper(btrim(v_item->>'tindakan'));
      v_target_spk := nullif(v_item->>'id_spk_tujuan', '')::uuid;
      v_target_location := nullif(v_item->>'id_lokasi_tujuan', '')::uuid;
    exception when others then raise exception 'DATA ITEM REKONSILIASI TIDAK VALID'; end;
    v_reason := nullif(btrim(coalesce(v_item->>'alasan', '')), '');
    if v_qty is null or v_qty <= 0 or v_action not in ('KEMBALI_KE_GUDANG','PINDAH_KE_SPK','PEMAKAIAN_FINAL','HILANG_RUSAK') then raise exception 'TINDAKAN ATAU JUMLAH REKONSILIASI TIDAK VALID'; end if;
    if v_action = 'HILANG_RUSAK' and v_reason is null then raise exception 'ALASAN WAJIB DIISI UNTUK MATERIAL HILANG/RUSAK'; end if;
    select * into v_material from public.master_material where id_material = v_id_material and status_aktif;
    if not found or v_material.jenis_item = 'UPAH' then raise exception 'ITEM REKONSILIASI BUKAN MATERIAL STOK AKTIF'; end if;
    select * into v_stock from public.material_stock_spk where id_spk = p_id_spk and id_material = v_id_material for update;
    if not found or v_stock.jumlah + 0.000001 < v_qty then raise exception 'JUMLAH MELEBIHI SISA STOK SPK UNTUK %', v_material.nama_material; end if;
    if v_action = 'KEMBALI_KE_GUDANG' then
      select * into v_location from public.material_location where id_lokasi = v_target_location and jenis_lokasi = 'GUDANG' and status_aktif;
      if not found then raise exception 'TUJUAN PENGEMBALIAN HARUS GUDANG AKTIF'; end if;
    elsif v_action = 'PINDAH_KE_SPK' then
      select * into v_target from public.spk where id_spk = v_target_spk and is_active and status_spk = 'AKTIF';
      if not found or v_target_spk = p_id_spk then raise exception 'SPK TUJUAN TRANSFER TIDAK AKTIF ATAU SAMA DENGAN SPK ASAL'; end if;
    elsif v_action = 'PEMAKAIAN_FINAL' and v_material.jenis_item <> 'BAHAN' then
      raise exception 'ALAT PAKAI ULANG TIDAK DAPAT DICATAT SEBAGAI PEMAKAIAN HABIS';
    end if;
  end loop;

  v_recon_no := 'MRK-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-' || lpad(nextval('public.material_reconciliation_no_seq')::text, 6, '0');
  insert into public.material_spk_reconciliation(no_rekonsiliasi, id_spk, status, diajukan_oleh, diselesaikan_oleh, keterangan)
  values(v_recon_no, p_id_spk, 'POSTED', auth.uid(), auth.uid(), nullif(btrim(coalesce(p_keterangan, '')), ''))
  returning id_rekonsiliasi into v_recon;

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'id_material'
  loop
    v_id_material := (v_item->>'id_material')::uuid;
    v_qty := (v_item->>'jumlah')::numeric;
    v_action := upper(btrim(v_item->>'tindakan'));
    v_target_spk := nullif(v_item->>'id_spk_tujuan', '')::uuid;
    v_target_location := nullif(v_item->>'id_lokasi_tujuan', '')::uuid;
    v_reason := nullif(btrim(coalesce(v_item->>'alasan', '')), '');
    select * into v_material from public.master_material where id_material = v_id_material;
    select * into v_stock from public.material_stock_spk where id_spk = p_id_spk and id_material = v_id_material for update;
    v_cost := v_stock.harga_rata_rata;
    v_tx_kind := case v_action
      when 'KEMBALI_KE_GUDANG' then 'KEMBALI_KE_GUDANG'
      when 'PINDAH_KE_SPK' then 'TRANSFER_ANTAR_SPK'
      when 'PEMAKAIAN_FINAL' then 'PEMAKAIAN_DARI_SPK'
      else 'REKONSILIASI_KELUAR' end;
    v_tx_no := 'MT-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-' || lpad(nextval('public.material_transaction_no_seq')::text, 6, '0');
    insert into public.material_transaction(no_transaksi, jenis_transaksi, id_spk, id_spk_tujuan, id_lokasi_tujuan, id_rekonsiliasi, dibuat_oleh, keterangan)
    values(v_tx_no, v_tx_kind, p_id_spk, case when v_action = 'PINDAH_KE_SPK' then v_target_spk end,
      case when v_action = 'KEMBALI_KE_GUDANG' then v_target_location end, v_recon, auth.uid(), coalesce(v_reason, nullif(btrim(coalesce(p_keterangan, '')), '')))
    returning id_transaksi into v_tx;
    insert into public.material_spk_reconciliation_item(id_rekonsiliasi, id_material, jumlah, tindakan, id_spk_tujuan, id_lokasi_tujuan, alasan)
    values(v_recon, v_id_material, v_qty, v_action, case when v_action = 'PINDAH_KE_SPK' then v_target_spk end,
      case when v_action = 'KEMBALI_KE_GUDANG' then v_target_location end, v_reason);
    v_charge := case when v_action in ('PEMAKAIAN_FINAL','HILANG_RUSAK') and v_material.jenis_item = 'BAHAN' then v_qty * v_cost else 0 end;
    insert into public.material_transaction_item(id_transaksi, id_material, jumlah, harga_satuan, biaya_dibebankan)
    values(v_tx, v_id_material, v_qty, v_cost, v_charge);
    update public.material_stock_spk set jumlah = jumlah - v_qty, updated_at = now()
    where id_spk = p_id_spk and id_material = v_id_material;

    if v_action = 'KEMBALI_KE_GUDANG' then
      insert into public.material_stock_location(id_lokasi, id_material, jumlah, harga_rata_rata, jumlah_belum_dibebankan)
      values(v_target_location, v_id_material, v_qty, v_cost, 0)
      on conflict (id_lokasi, id_material) do update
      set harga_rata_rata = ((material_stock_location.jumlah * material_stock_location.harga_rata_rata) + (excluded.jumlah * excluded.harga_rata_rata)) / (material_stock_location.jumlah + excluded.jumlah),
          jumlah = material_stock_location.jumlah + excluded.jumlah, updated_at = now();
    elsif v_action = 'PINDAH_KE_SPK' then
      insert into public.material_stock_spk(id_spk, id_material, jumlah, harga_rata_rata)
      values(v_target_spk, v_id_material, v_qty, v_cost)
      on conflict (id_spk, id_material) do update
      set harga_rata_rata = ((material_stock_spk.jumlah * material_stock_spk.harga_rata_rata) + (excluded.jumlah * excluded.harga_rata_rata)) / (material_stock_spk.jumlah + excluded.jumlah),
          jumlah = material_stock_spk.jumlah + excluded.jumlah, updated_at = now();
    end if;
  end loop;
  return v_recon;
end;
$function$;

revoke all on function public.post_spk_material_reconciliation_atomic(uuid, jsonb, text) from public, anon;
grant execute on function public.post_spk_material_reconciliation_atomic(uuid, jsonb, text) to authenticated, service_role;
