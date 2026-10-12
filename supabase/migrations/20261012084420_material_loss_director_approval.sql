-- Proposals are immutable snapshots; approval uses the existing reconciliation engine.
insert into public.kavio_role_actions(role,action) values('DIREKTUR','MATERIAL_LOSS_APPROVE') on conflict do nothing;
create table public.material_loss_approval (
 id_pengajuan uuid primary key default gen_random_uuid(),
 urutan bigint generated always as identity unique,
 request_key uuid not null unique,
 id_spk uuid not null references public.spk(id_spk) on delete restrict,
 tanggal date not null,
 status text not null default 'DIAJUKAN' check(status in ('DIAJUKAN','APPLYING','DISETUJUI','DITOLAK','DIBATALKAN')),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items)>0),
 payload jsonb not null,
 keterangan text,
 diajukan_oleh uuid not null references auth.users(id) on delete restrict,
 diajukan_pada timestamptz not null default now(),
 diputuskan_oleh uuid references auth.users(id) on delete restrict,
 diputuskan_pada timestamptz,catatan_keputusan text,
 id_rekonsiliasi uuid unique references public.material_spk_reconciliation(id_rekonsiliasi) on delete restrict,
 check((status='DISETUJUI')=(id_rekonsiliasi is not null)),
 check(status not in ('APPLYING','DISETUJUI','DITOLAK') or diputuskan_oleh is not null)
);
create index material_loss_spk_idx on public.material_loss_approval(id_spk,urutan);
create index material_loss_submitter_idx on public.material_loss_approval(diajukan_oleh);
create index material_loss_decider_idx on public.material_loss_approval(diputuskan_oleh);
alter table public.material_loss_approval enable row level security;
create policy material_loss_read on public.material_loss_approval for select to authenticated
 using((select public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE')) or (select public.kavio_can_action('MATERIAL_LOSS_APPROVE')));
revoke all on public.material_loss_approval from public,anon,authenticated;
grant select on public.material_loss_approval to authenticated;

create function public.submit_material_loss_atomic(p_request_key uuid,p_id_spk uuid,p_tanggal date,p_items jsonb,p_keterangan text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_existing public.material_loss_approval%rowtype; v_item jsonb; v_m public.master_material%rowtype;v_s public.material_stock_spk%rowtype;v_qty numeric;v_reason text;v_snapshot jsonb:='[]';v_payload jsonb:='[]';
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED';end if;
 if not public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE') then raise exception 'FORBIDDEN: MATERIAL_WAREHOUSE_WRITE';end if;
 if p_request_key is null or p_tanggal is null or p_tanggal>(now() at time zone 'Asia/Jakarta')::date then raise exception 'TANGGAL TIDAK VALID ATAU DI MASA DEPAN';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'ISI 1–200 MATERIAL';end if;
 -- Lock the SPK before inspecting stock, matching all posting engine lock order.
 perform 1 from public.spk where id_spk=p_id_spk and is_active and status_spk='AKTIF' for update;
 if not found then raise exception 'SPK AKTIF TIDAK DITEMUKAN';end if;
 select * into v_existing from public.material_loss_approval where request_key=p_request_key;
 if found then
  if v_existing.id_spk<>p_id_spk or v_existing.diajukan_oleh<>auth.uid() or v_existing.tanggal<>p_tanggal or v_existing.payload<>p_items or v_existing.keterangan is distinct from nullif(btrim(p_keterangan),'') then raise exception 'KUNCI PENGAJUAN SUDAH DIGUNAKAN';end if;
  return v_existing.id_pengajuan;
 end if;
 if (select count(*)<>count(distinct value->>'id_material') from jsonb_array_elements(p_items)) then raise exception 'MATERIAL TIDAK BOLEH DUPLIKAT';end if;
 for v_item in select value from jsonb_array_elements(p_items) order by value->>'id_material' loop
  if upper(btrim(v_item->>'tindakan')) is distinct from 'HILANG_RUSAK' or nullif(v_item->>'id_spk_tujuan','') is not null or nullif(v_item->>'id_lokasi_tujuan','') is not null then raise exception 'PENGAJUAN KHUSUS HILANG/RUSAK TANPA TUJUAN';end if;
  v_qty:=(v_item->>'jumlah')::numeric;v_reason:=nullif(btrim(v_item->>'alasan'),'');
  if v_qty is null or v_qty::text in ('NaN','Infinity','-Infinity') or v_qty<=0 or v_qty>1000000000000 or v_reason is null or length(v_reason)>500 then raise exception 'JUMLAH DAN ALASAN HILANG/RUSAK TIDAK VALID';end if;
  select * into v_m from public.master_material where id_material=(v_item->>'id_material')::uuid and status_aktif and jenis_item<>'UPAH';
  if not found then raise exception 'MATERIAL STOK AKTIF TIDAK DITEMUKAN';end if;
  select * into v_s from public.material_stock_spk where id_spk=p_id_spk and id_material=v_m.id_material for update;
  if not found or v_qty>v_s.jumlah then raise exception 'JUMLAH MELEBIHI SISA STOK SPK';end if;
  v_snapshot:=v_snapshot||jsonb_build_array(jsonb_build_object('id_material',v_m.id_material,'nama_material',v_m.nama_material,'satuan',v_m.satuan,'jenis_item',v_m.jenis_item,'jumlah',v_qty,'harga_rata_rata',v_s.harga_rata_rata,'biaya',case when v_m.jenis_item='BAHAN' then v_qty*v_s.harga_rata_rata else 0 end,'alasan',v_reason));
 end loop;
 insert into public.material_loss_approval(request_key,id_spk,tanggal,items,payload,keterangan,diajukan_oleh)
 values(p_request_key,p_id_spk,p_tanggal,v_snapshot,p_items,nullif(btrim(p_keterangan),''),auth.uid()) returning id_pengajuan into v_id;
 return v_id;
end $$;

-- A caller-controlled session setting alone can never authorize stock mutation.
create function public.kavio_material_loss_apply_allowed(p_id_spk uuid,p_items jsonb) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.material_loss_approval a join public.user_profiles p on p.user_id=auth.uid() and p.role='DIREKTUR' and p.status_aktif
 where a.id_pengajuan::text=current_setting('kavio.material_loss_apply',true) and a.id_spk=p_id_spk and a.status='APPLYING' and a.diputuskan_oleh=auth.uid() and a.payload=p_items);
$$;
revoke all on function public.kavio_material_loss_apply_allowed(uuid,jsonb) from public,anon,authenticated;

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
  if exists(select 1 from jsonb_array_elements(p_items) where upper(btrim(value->>'tindakan'))='HILANG_RUSAK')
     and not public.kavio_material_loss_apply_allowed(p_id_spk,p_items) then
    raise exception 'HILANG/RUSAK HARUS DIAJUKAN DAN DISETUJUI DIREKTUR';
  end if;
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
create function public.decide_material_loss_atomic(p_id_pengajuan uuid,p_aksi text,p_catatan text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_a public.material_loss_approval%rowtype;v_spk uuid;v_item jsonb;v_s public.material_stock_spk%rowtype;v_m public.master_material%rowtype;v_recon uuid;v_action text:=upper(btrim(p_aksi));
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED';end if;
 if v_action is null or v_action not in ('SETUJUI','TOLAK','BATAL') then raise exception 'AKSI TIDAK VALID';end if;
 if v_action='BATAL' then
  if not public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE') then raise exception 'FORBIDDEN: MATERIAL_WAREHOUSE_WRITE';end if;
 elsif not public.kavio_can_action('MATERIAL_LOSS_APPROVE') or not exists(select 1 from public.user_profiles where user_id=auth.uid() and role='DIREKTUR' and status_aktif) then raise exception 'PERSETUJUAN HANYA OLEH DIREKTUR';
 end if;
 if length(coalesce(p_catatan,''))>500 or (v_action in ('TOLAK','BATAL') and nullif(btrim(p_catatan),'') is null) then raise exception 'ALASAN KEPUTUSAN WAJIB, MAKSIMAL 500 KARAKTER';end if;
 select id_spk into v_spk from public.material_loss_approval where id_pengajuan=p_id_pengajuan;
 if not found then raise exception 'PENGAJUAN TIDAK DITEMUKAN';end if;
 perform 1 from public.spk where id_spk=v_spk for update;
 select * into v_a from public.material_loss_approval where id_pengajuan=p_id_pengajuan for update;
 if v_a.status<>'DIAJUKAN' then raise exception 'PENGAJUAN SUDAH DIPROSES';end if;
 if v_action='BATAL' then
  update public.material_loss_approval set status='DIBATALKAN',catatan_keputusan=btrim(p_catatan),diputuskan_pada=now() where id_pengajuan=p_id_pengajuan;
  return p_id_pengajuan;
 end if;
 if v_action='TOLAK' then
  update public.material_loss_approval set status='DITOLAK',catatan_keputusan=btrim(p_catatan),diputuskan_pada=now(),diputuskan_oleh=auth.uid() where id_pengajuan=p_id_pengajuan;
  return p_id_pengajuan;
 end if;
 if not exists(select 1 from public.spk where id_spk=v_spk and is_active and status_spk='AKTIF') then raise exception 'SPK SUDAH TIDAK AKTIF; BATALKAN PENGAJUAN';end if;
 for v_item in select value from jsonb_array_elements(v_a.items) order by value->>'id_material' loop
  select * into v_m from public.master_material where id_material=(v_item->>'id_material')::uuid;
  if not v_m.status_aktif or v_m.jenis_item is distinct from v_item->>'jenis_item' or v_m.satuan is distinct from v_item->>'satuan' then raise exception 'MASTER MATERIAL BERUBAH; BATALKAN DAN AJUKAN KEMBALI';end if;
  select * into v_s from public.material_stock_spk where id_spk=v_spk and id_material=v_m.id_material for update;
  if not found or v_s.jumlah<(v_item->>'jumlah')::numeric or v_s.harga_rata_rata is distinct from (v_item->>'harga_rata_rata')::numeric then raise exception 'STOK ATAU HARGA BERUBAH; BATALKAN DAN AJUKAN KEMBALI';end if;
 end loop;
 update public.material_loss_approval set status='APPLYING',diputuskan_oleh=auth.uid() where id_pengajuan=p_id_pengajuan;
 perform set_config('kavio.material_loss_apply',p_id_pengajuan::text,true);
 v_recon:=public.post_spk_material_reconciliation_atomic(v_spk,v_a.payload,v_a.keterangan);
 update public.material_spk_reconciliation set tanggal=v_a.tanggal,diajukan_oleh=v_a.diajukan_oleh where id_rekonsiliasi=v_recon;
 update public.material_transaction set tanggal=v_a.tanggal where id_rekonsiliasi=v_recon;
 update public.material_loss_approval set status='DISETUJUI',id_rekonsiliasi=v_recon,diputuskan_pada=now(),catatan_keputusan=nullif(btrim(p_catatan),'') where id_pengajuan=p_id_pengajuan;
 perform set_config('kavio.material_loss_apply','',true);
 return p_id_pengajuan;
end $$;
revoke all on function public.submit_material_loss_atomic(uuid,uuid,date,jsonb,text),public.decide_material_loss_atomic(uuid,text,text) from public,anon;
grant execute on function public.submit_material_loss_atomic(uuid,uuid,date,jsonb,text),public.decide_material_loss_atomic(uuid,text,text) to authenticated;
