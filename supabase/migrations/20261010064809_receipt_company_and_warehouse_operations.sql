-- One project per database: company identity is a singleton, protected by MASTER_WRITE.
create table public.company_settings (
 id boolean primary key default true check(id), nama_perusahaan text not null check(length(btrim(nama_perusahaan)) between 1 and 200),
 logo_data_url text check(logo_data_url is null or (length(logo_data_url)<=350000 and logo_data_url ~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$')),
 updated_at timestamptz not null default now()
);
alter table public.company_settings enable row level security;
create policy company_read on public.company_settings for select to authenticated using((select public.kavio_is_active_user()));
create policy company_insert on public.company_settings for insert to authenticated with check((select public.kavio_can_action('MASTER_WRITE')));
create policy company_update on public.company_settings for update to authenticated using((select public.kavio_can_action('MASTER_WRITE'))) with check((select public.kavio_can_action('MASTER_WRITE')));
revoke all on public.company_settings from public,anon,authenticated;
grant select,insert,update on public.company_settings to authenticated;

alter table public.material_transaction drop constraint material_transaction_status_check;
alter table public.material_transaction add constraint material_transaction_status_check check(status in ('POSTED','BATAL'));
alter table public.material_transaction drop constraint material_transaction_jenis_transaksi_check;
alter table public.material_transaction add constraint material_transaction_jenis_transaksi_check check(jenis_transaksi in (
'SALDO_AWAL','PENERIMAAN','PENERIMAAN_SPK','KELUAR_KE_SPK','PEMAKAIAN_LANGSUNG','PEMAKAIAN_DARI_SPK','KEMBALI_KE_GUDANG','TRANSFER_ANTAR_SPK','PEMAKAIAN_SUPPLIER_LANGSUNG','REKONSILIASI_KELUAR','PEMBATALAN_PEMBELIAN'));
alter table public.material_transaction add column id_transaksi_asal uuid references public.material_transaction(id_transaksi) on delete restrict,
 add column alasan_koreksi text, add column dibatalkan_oleh uuid references auth.users(id), add column dibatalkan_pada timestamptz;
create index material_transaction_origin_idx on public.material_transaction(id_transaksi_asal) where id_transaksi_asal is not null;

-- Single purchase entry point. Direct delivery forms SPK stock; reusable tools are
-- charged once to the receiving SPK, consistently with the warehouse issue engine.
create function public.post_material_purchase_v2_atomic(p_data jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v_tx uuid; v_spk uuid; v_supplier text; v_item jsonb; v_m public.master_material%rowtype; v_qty numeric; v_cost numeric;
begin
 if auth.uid() is null or not public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE') then raise exception 'AKSES GUDANG DITOLAK'; end if;
 select nama_pemasok into v_supplier from public.master_pemasok where id_pemasok=(p_data->>'id_pemasok')::uuid and status_aktif;
 if v_supplier is null or nullif(btrim(p_data->>'no_nota'),'') is null then raise exception 'PEMASOK AKTIF DAN NOMOR NOTA WAJIB DIISI'; end if;
 if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items')=0 then raise exception 'ITEM PEMBELIAN WAJIB DIISI'; end if;
 for v_item in select value from jsonb_array_elements(p_data->'items') loop
  v_qty:=(v_item->>'jumlah')::numeric; v_cost:=(v_item->>'harga_satuan')::numeric;
  if v_qty is null or v_qty<=0 or v_cost is null or v_cost<0 or v_qty::text in ('NaN','Infinity') or v_cost::text in ('NaN','Infinity') then raise exception 'JUMLAH ATAU HARGA TIDAK VALID'; end if;
 end loop;
 if p_data->>'tujuan'='GUDANG' then
  return public.post_material_receipt_atomic((p_data->>'id_lokasi')::uuid,p_data->'items',false,v_supplier,p_data->>'no_nota',p_data->>'keterangan');
 end if;
 if p_data->>'tujuan' is distinct from 'SPK' then raise exception 'TUJUAN PEMBELIAN TIDAK VALID'; end if;
 v_spk:=(p_data->>'id_spk')::uuid;
 perform 1 from public.spk where id_spk=v_spk and is_active and status_spk='AKTIF' for update;
 if not found then raise exception 'SPK AKTIF TIDAK DITEMUKAN'; end if;
 if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items')=0 then raise exception 'ITEM PEMBELIAN WAJIB DIISI'; end if;
 if (select count(*)<>count(distinct value->>'id_material') from jsonb_array_elements(p_data->'items')) then raise exception 'MATERIAL DUPLIKAT'; end if;
 for v_item in select value from jsonb_array_elements(p_data->'items') order by value->>'id_material' loop
  select * into v_m from public.master_material where id_material=(v_item->>'id_material')::uuid and status_aktif and jenis_item<>'UPAH';
  v_qty:=(v_item->>'jumlah')::numeric; v_cost:=(v_item->>'harga_satuan')::numeric;
  if not found or v_qty is null or v_qty<=0 or v_cost is null or v_cost<0 or v_qty::text in ('NaN','Infinity') or v_cost::text in ('NaN','Infinity') then raise exception 'ITEM, JUMLAH ATAU HARGA TIDAK VALID'; end if;
 end loop;
 insert into public.material_transaction(no_transaksi,jenis_transaksi,id_spk,nama_pemasok,id_pemasok,no_nota,keterangan)
 values('MT-'||to_char(now() at time zone 'Asia/Jakarta','YYYYMMDD')||'-'||lpad(nextval('public.material_transaction_no_seq')::text,6,'0'),'PENERIMAAN_SPK',v_spk,v_supplier,(p_data->>'id_pemasok')::uuid,p_data->>'no_nota',p_data->>'keterangan') returning id_transaksi into v_tx;
 for v_item in select value from jsonb_array_elements(p_data->'items') order by value->>'id_material' loop
  select * into v_m from public.master_material where id_material=(v_item->>'id_material')::uuid;
  v_qty:=(v_item->>'jumlah')::numeric; v_cost:=(v_item->>'harga_satuan')::numeric;
  insert into public.material_stock_spk(id_spk,id_material,jumlah,harga_rata_rata) values(v_spk,v_m.id_material,v_qty,v_cost)
  on conflict(id_spk,id_material) do update set harga_rata_rata=(material_stock_spk.jumlah*material_stock_spk.harga_rata_rata+excluded.jumlah*excluded.harga_rata_rata)/(material_stock_spk.jumlah+excluded.jumlah),jumlah=material_stock_spk.jumlah+excluded.jumlah,updated_at=now();
  insert into public.material_transaction_item(id_transaksi,id_material,jumlah,harga_satuan,biaya_dibebankan) values(v_tx,v_m.id_material,v_qty,v_cost,case when v_m.jenis_item='ALAT_PAKAI_ULANG' then v_qty*v_cost else 0 end);
 end loop;
 return v_tx;
end $$;
revoke all on function public.post_material_purchase_v2_atomic(jsonb) from public,anon;
grant execute on function public.post_material_purchase_v2_atomic(jsonb) to authenticated;

-- Reverse only purchases without subsequent stock activity for ANY item at the
-- receiving location. No historic consumption repricing, no physical ledger deletion.
create function public.amend_material_purchase_atomic(p_id uuid,p_alasan text,p_pengganti jsonb default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v public.material_transaction%rowtype; i record; b record; v_rev uuid; v_qty numeric; v_avg numeric; v_new uuid;
begin
 if auth.uid() is null or not public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE') then raise exception 'AKSES GUDANG DITOLAK'; end if;
 if nullif(btrim(p_alasan),'') is null then raise exception 'ALASAN KOREKSI WAJIB DIISI'; end if;
 select * into v from public.material_transaction where id_transaksi=p_id for update;
 if not found or v.status<>'POSTED' or v.jenis_transaksi not in ('PENERIMAAN','PENERIMAAN_SPK') then raise exception 'PEMBELIAN AKTIF TIDAK DITEMUKAN'; end if;
 if v.id_spk is not null then
  perform 1 from public.spk where id_spk=v.id_spk and is_active and status_spk='AKTIF' for update;
  if not found then raise exception 'SPK SUDAH DITUTUP'; end if;
 end if;
 for i in select * from public.material_transaction_item where id_transaksi=p_id order by id_material loop
  if v.id_spk is not null then
   select jumlah,harga_rata_rata into b from public.material_stock_spk where id_spk=v.id_spk and id_material=i.id_material for update;
  else
   select jumlah,harga_rata_rata into b from public.material_stock_location where id_lokasi=v.id_lokasi_tujuan and id_material=i.id_material for update;
  end if;
  if not found or b.jumlah<i.jumlah then raise exception 'STOK PEMBELIAN SUDAH DIGUNAKAN'; end if;
  if exists(select 1 from public.material_transaction t join public.material_transaction_item ti using(id_transaksi)
   where ti.id_material=i.id_material and t.id_transaksi<>p_id and (t.created_at,t.no_transaksi)>(v.created_at,v.no_transaksi)
   and ((v.id_spk is not null and (t.id_spk=v.id_spk or t.id_spk_tujuan=v.id_spk)) or (v.id_spk is null and (t.id_lokasi_asal=v.id_lokasi_tujuan or t.id_lokasi_tujuan=v.id_lokasi_tujuan)))) then
   raise exception 'PEMBELIAN TIDAK DAPAT DIKOREKSI KARENA SUDAH ADA TRANSAKSI MATERIAL LANJUTAN';
  end if;
 end loop;
 insert into public.material_transaction(no_transaksi,jenis_transaksi,id_spk,id_lokasi_tujuan,id_transaksi_asal,keterangan)
 values('MT-'||to_char(now() at time zone 'Asia/Jakarta','YYYYMMDD')||'-'||lpad(nextval('public.material_transaction_no_seq')::text,6,'0'),'PEMBATALAN_PEMBELIAN',v.id_spk,v.id_lokasi_tujuan,p_id,p_alasan) returning id_transaksi into v_rev;
 for i in select ti.*,m.jenis_item from public.material_transaction_item ti join public.master_material m using(id_material) where ti.id_transaksi=p_id order by ti.id_material loop
  if v.id_spk is not null then
   select jumlah,harga_rata_rata into b from public.material_stock_spk where id_spk=v.id_spk and id_material=i.id_material;
  else
   select jumlah,harga_rata_rata into b from public.material_stock_location where id_lokasi=v.id_lokasi_tujuan and id_material=i.id_material;
  end if;
  v_qty:=b.jumlah-i.jumlah; v_avg:=case when v_qty=0 then 0 else greatest(0,(b.jumlah*b.harga_rata_rata-i.jumlah*i.harga_satuan)/v_qty) end;
  if v.id_spk is not null then update public.material_stock_spk set jumlah=v_qty,harga_rata_rata=v_avg,updated_at=now() where id_spk=v.id_spk and id_material=i.id_material;
  else update public.material_stock_location set jumlah=v_qty,harga_rata_rata=v_avg,jumlah_belum_dibebankan=jumlah_belum_dibebankan-case when i.jenis_item='ALAT_PAKAI_ULANG' then i.jumlah else 0 end,updated_at=now() where id_lokasi=v.id_lokasi_tujuan and id_material=i.id_material; end if;
  insert into public.material_transaction_item(id_transaksi,id_material,jumlah,harga_satuan) values(v_rev,i.id_material,i.jumlah,i.harga_satuan);
 end loop;
 update public.material_transaction set status='BATAL',alasan_koreksi=p_alasan,dibatalkan_oleh=auth.uid(),dibatalkan_pada=now() where id_transaksi=p_id;
 if p_pengganti is not null then v_new:=public.post_material_purchase_v2_atomic(p_pengganti); update public.material_transaction set id_transaksi_asal=p_id,alasan_koreksi=p_alasan where id_transaksi=v_new; return v_new; end if;
 return v_rev;
end $$;
revoke all on function public.amend_material_purchase_atomic(uuid,text,jsonb) from public,anon;
grant execute on function public.amend_material_purchase_atomic(uuid,text,jsonb) to authenticated;

-- Same stock engine: optionally consume requested materials in the same transaction.
create function public.fulfill_material_request_v2_atomic(p_id_permintaan uuid,p_id_lokasi uuid,p_items jsonb,p_langsung_pakai boolean default true,p_keterangan text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_tx uuid; v_spk uuid;
begin
 v_tx:=public.post_material_issue_to_spk_atomic(p_id_permintaan,p_id_lokasi,p_items,p_keterangan);
 if coalesce(p_langsung_pakai,true) then
  select id_spk into v_spk from public.material_request where id_permintaan=p_id_permintaan;
  perform public.post_spk_material_usage_atomic(v_spk,p_items,p_keterangan);
 end if;
 return v_tx;
end $$;
revoke all on function public.fulfill_material_request_v2_atomic(uuid,uuid,jsonb,boolean,text) from public,anon;
grant execute on function public.fulfill_material_request_v2_atomic(uuid,uuid,jsonb,boolean,text) to authenticated;

-- Stock card has separate entries per material AND stock holder. Transfers never
-- inflate project stock; opening balances include all history before the filter.
create view public.v_material_stock_card with(security_invoker=true) as
with entries as (
 select t.*,i.id_item_transaksi,i.id_material,i.jumlah,i.harga_satuan,m.nama_material,m.satuan from public.material_transaction t join public.material_transaction_item i using(id_transaksi) join public.master_material m using(id_material)
), moves as (
 select e.*, 'GUDANG'::text as jenis_lokasi, e.id_lokasi_tujuan::text as pemegang,
 case when e.jenis_transaksi='PEMBATALAN_PEMBELIAN' then 0 else e.jumlah end as masuk,
 case when e.jenis_transaksi='PEMBATALAN_PEMBELIAN' then e.jumlah else 0 end as keluar
 from entries e where e.id_lokasi_tujuan is not null
 union all
 select e.*, 'GUDANG',e.id_lokasi_asal::text,0,e.jumlah from entries e where e.id_lokasi_asal is not null
 union all
 select e.*,'SPK',e.id_spk::text,
 case when e.jenis_transaksi in ('PENERIMAAN_SPK','KELUAR_KE_SPK','PEMAKAIAN_SUPPLIER_LANGSUNG') then e.jumlah else 0 end,
 case when e.jenis_transaksi in ('PEMAKAIAN_DARI_SPK','KEMBALI_KE_GUDANG','TRANSFER_ANTAR_SPK','REKONSILIASI_KELUAR','PEMBATALAN_PEMBELIAN','PEMAKAIAN_SUPPLIER_LANGSUNG') then e.jumlah else 0 end
 from entries e where e.id_spk is not null and e.jenis_transaksi <> 'PEMAKAIAN_LANGSUNG'
 union all
 select e.*,'SPK',e.id_spk_tujuan::text,e.jumlah,0 from entries e where e.id_spk_tujuan is not null
)
select moves.id_item_transaksi,moves.id_transaksi,moves.no_transaksi,moves.tanggal,moves.created_at,moves.jenis_transaksi,moves.id_material,moves.nama_material,moves.satuan,moves.jenis_lokasi,moves.pemegang,
 coalesce(l.nama_lokasi,case when s.jenis_spk='KAVLING' then 'Kavling '||s.id_kavling else s.nama_objek end,moves.pemegang) as nama_lokasi,
 moves.masuk,moves.keluar,moves.harga_satuan,
 sum(moves.masuk-moves.keluar) over(partition by moves.jenis_lokasi,moves.pemegang,moves.id_material order by moves.created_at,moves.no_transaksi,moves.id_item_transaksi rows unbounded preceding) as saldo
from moves left join public.material_location l on l.id_lokasi::text=moves.pemegang and moves.jenis_lokasi='GUDANG'
left join public.spk s on s.id_spk::text=moves.pemegang and moves.jenis_lokasi='SPK';
revoke all on public.v_material_stock_card from public,anon;
grant select on public.v_material_stock_card to authenticated;
create view public.v_material_purchase with(security_invoker=true) as
select t.id_transaksi,t.no_transaksi,t.tanggal,t.created_at,t.status,t.id_pemasok,t.nama_pemasok,t.no_nota,t.keterangan,t.id_spk,t.id_lokasi_tujuan,
 case when t.id_spk is null then 'GUDANG' else 'SPK' end as tujuan,
 coalesce(l.nama_lokasi,case when s.jenis_spk='KAVLING' then 'Kavling '||s.id_kavling else s.nama_objek end) as nama_tujuan,
 array_agg(i.id_material order by i.id_material) as id_materials,
 sum(i.jumlah*i.harga_satuan) as total,
 jsonb_agg(jsonb_build_object('id_material',i.id_material,'nama_material',m.nama_material,'satuan',m.satuan,'jumlah',i.jumlah,'harga_satuan',i.harga_satuan) order by i.id_material) as items
from public.material_transaction t join public.material_transaction_item i using(id_transaksi) join public.master_material m using(id_material)
left join public.material_location l on l.id_lokasi=t.id_lokasi_tujuan left join public.spk s on s.id_spk=t.id_spk
where t.jenis_transaksi in ('PENERIMAAN','PENERIMAAN_SPK','PEMAKAIAN_SUPPLIER_LANGSUNG')
group by t.id_transaksi,l.nama_lokasi,s.jenis_spk,s.id_kavling,s.nama_objek;
revoke all on public.v_material_purchase from public,anon;
grant select on public.v_material_purchase to authenticated;
-- Tools delivered directly to an SPK appear in the same cost report as issued tools.
create or replace view public.v_material_spk_usage with(security_invoker=true) as
select t.id_spk,t.tanggal,t.jenis_transaksi,i.id_material,m.kode_referensi,m.nama_material,m.satuan,i.jumlah,i.harga_satuan,i.biaya_dibebankan,t.no_transaksi,t.no_nota,t.nama_pemasok,t.keterangan
from public.material_transaction t join public.material_transaction_item i using(id_transaksi) join public.master_material m using(id_material)
where t.status='POSTED' and (t.jenis_transaksi in ('PEMAKAIAN_LANGSUNG','PEMAKAIAN_DARI_SPK','PEMAKAIAN_SUPPLIER_LANGSUNG','REKONSILIASI_KELUAR') or (t.jenis_transaksi in ('PENERIMAAN_SPK','KELUAR_KE_SPK') and i.biaya_dibebankan>0));
