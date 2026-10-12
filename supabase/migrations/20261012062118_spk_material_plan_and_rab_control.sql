-- Shared, versioned material plan for Kavling and Fasum; no stock mutation here.
create table public.spk_material_plan (
 id_plan uuid primary key default gen_random_uuid(),
 id_spk uuid not null references public.spk(id_spk) on delete restrict,
 revisi integer not null check(revisi>0),
 id_rab uuid references public.rab_template(id_rab) on delete restrict,
 nama_sumber text not null,versi_sumber text,
 alasan text not null check(length(btrim(alasan)) between 1 and 500),
 dibuat_oleh uuid not null references auth.users(id) on delete restrict,
 dibuat_pada timestamptz not null default now(),
 unique(id_spk,revisi)
);
create index spk_material_plan_source_idx on public.spk_material_plan(id_rab);
create index spk_material_plan_actor_idx on public.spk_material_plan(dibuat_oleh);
create table public.spk_material_plan_item (
 id_plan uuid not null references public.spk_material_plan(id_plan) on delete restrict,
 id_material uuid not null references public.master_material(id_material) on delete restrict,
 urutan integer not null check(urutan>0),
 kode_snapshot text,nama_snapshot text not null,kategori_snapshot text not null,satuan_snapshot text not null,
 jenis_snapshot text not null check(jenis_snapshot in ('BAHAN','ALAT_PAKAI_ULANG')),
 volume numeric not null check(volume between 0 and 1000000000),
 harga_standar numeric not null check(harga_standar between 0 and 1000000000000),
 primary key(id_plan,id_material),unique(id_plan,urutan)
);
create index spk_material_plan_item_material_idx on public.spk_material_plan_item(id_material);
alter table public.spk_material_plan enable row level security;
alter table public.spk_material_plan_item enable row level security;
create policy spk_material_plan_read on public.spk_material_plan for select to authenticated using((select public.kavio_is_active_user()));
create policy spk_material_plan_item_read on public.spk_material_plan_item for select to authenticated using((select public.kavio_is_active_user()));
revoke all on public.spk_material_plan,public.spk_material_plan_item from public,anon,authenticated;
grant select on public.spk_material_plan,public.spk_material_plan_item to authenticated;

create function public.save_spk_material_plan_atomic(p_id_spk uuid,p_items jsonb default null,p_id_rab uuid default null,p_alasan text default null,p_expected_revision integer default 0)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.spk%rowtype;r public.rab_template%rowtype;m public.master_material%rowtype;
 lines jsonb:=p_items;entry jsonb;id uuid;latest integer;position integer:=0;qty numeric;price numeric;total_value numeric:=0;
begin
 if auth.uid() is null or not public.kavio_can_action('SPK_WRITE') then raise exception 'AKSES RENCANA MATERIAL DITOLAK';end if;
 select * into s from public.spk where id_spk=p_id_spk for update;
 if not found then raise exception 'SPK TIDAK DITEMUKAN';end if;
 if s.status_spk='SELESAI' then raise exception 'RAB SPK SELESAI TIDAK DAPAT DIUBAH';end if;
 select coalesce(max(revisi),0) into latest from public.spk_material_plan where id_spk=p_id_spk;
 if p_expected_revision is distinct from latest then raise exception 'RAB TELAH BERUBAH. MUAT ULANG SEBELUM MENYIMPAN';end if;
 if nullif(btrim(p_alasan),'') is null or length(p_alasan)>500 then raise exception 'ALASAN PENETAPAN / REVISI RAB WAJIB DIISI (MAKSIMAL 500 KARAKTER)';end if;
 if p_id_rab is not null then
  select * into r from public.rab_template where id_rab=p_id_rab and status_aktif for share;
  if not found or s.jenis_spk<>'KAVLING' or s.id_tipe is distinct from r.id_tipe then raise exception 'RAB STANDAR HARUS SESUAI TIPE SPK KAVLING';end if;
  if lines is null then
   select jsonb_agg(jsonb_build_object('id_material',i.id_material,'jumlah',i.volume,'harga_satuan',i.harga_standar,'kode',i.kode_snapshot,'nama',i.nama_snapshot,'kategori',i.kategori_snapshot,'satuan',i.satuan_snapshot) order by i.urutan) into lines
   from public.rab_template_item i join public.master_material x using(id_material) where i.id_rab=r.id_rab and x.jenis_item<>'UPAH';
  end if;
 end if;
 if lines is null or jsonb_typeof(lines)<>'array' or jsonb_array_length(lines) not between 1 and 500 then raise exception 'ISI 1-500 MATERIAL DALAM RAB';end if;
 if (select count(*)<>count(distinct value->>'id_material') from jsonb_array_elements(lines)) then raise exception 'MATERIAL RAB TIDAK BOLEH DUPLIKAT';end if;
 insert into public.spk_material_plan(id_spk,revisi,id_rab,nama_sumber,versi_sumber,alasan,dibuat_oleh)
 values(s.id_spk,latest+1,p_id_rab,coalesce(r.nama_template,'RAB Custom SPK'),r.versi,btrim(p_alasan),auth.uid()) returning id_plan into id;
 for entry in select value from jsonb_array_elements(lines) loop
  position:=position+1;
  select * into m from public.master_material where id_material=(entry->>'id_material')::uuid and status_aktif and jenis_item<>'UPAH' for share;
  if not found then raise exception 'RAB HANYA UNTUK MATERIAL / ALAT AKTIF';end if;
  qty:=(entry->>'jumlah')::numeric;price:=(entry->>'harga_satuan')::numeric;
  if qty is null or price is null or qty not between 0 and 1000000000 or price not between 0 and 1000000000000 or qty<>round(qty,4) or price<>round(price,2) then raise exception 'VOLUME / HARGA RAB TIDAK VALID (VOLUME MAKSIMAL 4 DESIMAL, HARGA 2 DESIMAL)';end if;
  if entry ? 'satuan' and btrim(entry->>'satuan')<>btrim(m.satuan) then raise exception 'SATUAN RAB BERBEDA DARI MASTER MATERIAL: %',m.nama_material;end if;
  total_value:=total_value+qty*price;
  if total_value>1000000000000000 then raise exception 'TOTAL RAB MELEBIHI BATAS NILAI';end if;
  insert into public.spk_material_plan_item(id_plan,id_material,urutan,kode_snapshot,nama_snapshot,kategori_snapshot,satuan_snapshot,jenis_snapshot,volume,harga_standar)
  values(id,m.id_material,position,coalesce(entry->>'kode',m.kode_referensi),m.nama_material,m.kategori,m.satuan,m.jenis_item,qty,price);
 end loop;
 return id;
end $$;
revoke all on function public.save_spk_material_plan_atomic(uuid,jsonb,uuid,text,integer) from public,anon;
grant execute on function public.save_spk_material_plan_atomic(uuid,jsonb,uuid,text,integer) to authenticated;

create view public.v_spk_material_plan_current with(security_invoker=true) as
select distinct on(id_spk) * from public.spk_material_plan order by id_spk,revisi desc;

-- Actual cost always comes from the existing charged-cost ledger.
-- Stocks/transfers are not consumed materials. Reusable tools are cost-only.
create view public.v_spk_material_actual with(security_invoker=true) as
select t.id_spk,i.id_material,
 coalesce(sum(i.jumlah) filter(where m.jenis_item='BAHAN' and t.jenis_transaksi in ('PEMAKAIAN_LANGSUNG','PEMAKAIAN_DARI_SPK','PEMAKAIAN_SUPPLIER_LANGSUNG')),0) jumlah_pakai,
 coalesce(sum(i.jumlah) filter(where m.jenis_item='BAHAN' and t.jenis_transaksi='REKONSILIASI_KELUAR'),0) jumlah_hilang_rusak,
 coalesce(sum(i.biaya_dibebankan),0) biaya_aktual
from public.material_transaction t join public.material_transaction_item i using(id_transaksi)
join public.master_material m using(id_material)
where t.status='POSTED' and t.id_spk is not null and m.jenis_item<>'UPAH'
group by t.id_spk,i.id_material;

create view public.v_spk_material_rab_control with(security_invoker=true) as
with plan as (
 select h.id_spk,h.id_plan,h.revisi,i.* from public.v_spk_material_plan_current h join public.spk_material_plan_item i using(id_plan)
), keys as (
 select id_spk,id_material from plan
 union select id_spk,id_material from public.v_spk_material_actual
 union select id_spk,id_material from public.material_stock_spk where jumlah>0
), base as (
 select k.id_spk,k.id_material,s.jenis_spk,s.id_kavling,s.nama_objek,s.status_spk,
 h.id_plan,h.revisi,p.id_material is not null dalam_rab,
 coalesce(p.nama_snapshot,m.nama_material) nama_material,coalesce(p.kategori_snapshot,m.kategori) kategori,
 coalesce(p.satuan_snapshot,m.satuan) satuan,coalesce(p.jenis_snapshot,m.jenis_item) jenis_item,
 p.volume volume_rab,p.harga_standar,
 case when p.id_material is not null then round(p.volume*p.harga_standar,2) end nilai_rab,
 coalesce(a.jumlah_pakai,0) jumlah_pakai,coalesce(a.jumlah_hilang_rusak,0) jumlah_hilang_rusak,
 coalesce(a.biaya_aktual,0) biaya_aktual,coalesce(st.jumlah,0) stok_spk,
 p.satuan_snapshot is distinct from m.satuan or p.jenis_snapshot is distinct from m.jenis_item master_berubah
 from keys k join public.spk s using(id_spk) join public.master_material m using(id_material)
 left join public.v_spk_material_plan_current h on h.id_spk=k.id_spk
 left join plan p on p.id_spk=k.id_spk and p.id_material=k.id_material
 left join public.v_spk_material_actual a on a.id_spk=k.id_spk and a.id_material=k.id_material
 left join public.material_stock_spk st on st.id_spk=k.id_spk and st.id_material=k.id_material
)
select b.*,
 case when id_plan is not null then biaya_aktual-coalesce(nilai_rab,0) end selisih_nilai,
 case when dalam_rab and jenis_item='BAHAN' and not master_berubah then volume_rab-jumlah_pakai-jumlah_hilang_rusak end sisa_volume_rab,
 case when id_plan is null then 'BELUM_ADA_RAB'
 when not dalam_rab then 'DI_LUAR_RAB'
 when master_berubah then 'MASTER_BERUBAH'
 when jenis_item='BAHAN' and jumlah_pakai+jumlah_hilang_rusak>volume_rab+0.000001 then 'MELEBIHI_VOLUME'
 when biaya_aktual>nilai_rab+0.005 then 'MELEBIHI_NILAI'
 else 'DALAM_RAB' end status_kontrol,
 id_plan is not null and (not dalam_rab or master_berubah or (jenis_item='BAHAN' and jumlah_pakai+jumlah_hilang_rusak>coalesce(volume_rab,0)+0.000001) or biaya_aktual>coalesce(nilai_rab,0)+0.005) perlu_perhatian
from base b;
revoke all on public.v_spk_material_plan_current,public.v_spk_material_actual,public.v_spk_material_rab_control from public,anon;
grant select on public.v_spk_material_plan_current,public.v_spk_material_actual,public.v_spk_material_rab_control to authenticated;

-- New Kavling SPKs capture available standard RAB; existing SPKs are not backfilled.
create function public.initialize_spk_material_plan() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare template_id uuid;
begin
 if new.jenis_spk='KAVLING' and new.status_spk='DRAFT' then
  select id_rab into template_id from public.rab_template where id_tipe=new.id_tipe and status_aktif
  order by created_at desc,id_rab desc limit 1;
  if template_id is not null then perform public.save_spk_material_plan_atomic(new.id_spk,null,template_id,'RAB standar saat pembuatan SPK',0);end if;
 end if;
 return null;
end $$;
revoke all on function public.initialize_spk_material_plan() from public,anon,authenticated;
create trigger initialize_spk_material_plan after insert on public.spk for each row execute function public.initialize_spk_material_plan();

