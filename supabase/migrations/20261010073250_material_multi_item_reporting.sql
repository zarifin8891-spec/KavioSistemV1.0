-- Transaction headers retain all item lines when the operational screen limits
-- itself to the latest 20 documents (not 20 item rows).
create view public.v_material_usage_transaction with(security_invoker=true) as
select t.id_transaksi,t.no_transaksi,t.tanggal,t.created_at,t.jenis_transaksi,t.id_spk,
 jsonb_agg(jsonb_build_object('id_material',i.id_material,'nama_material',m.nama_material,'satuan',m.satuan,'jumlah',i.jumlah,'harga_satuan',i.harga_satuan,'biaya_dibebankan',i.biaya_dibebankan) order by i.id_material) as items
from public.material_transaction t join public.material_transaction_item i using(id_transaksi) join public.master_material m using(id_material)
where t.status='POSTED' and (t.jenis_transaksi in ('PEMAKAIAN_LANGSUNG','PEMAKAIAN_DARI_SPK','PEMAKAIAN_SUPPLIER_LANGSUNG','REKONSILIASI_KELUAR') or (t.jenis_transaksi in ('PENERIMAAN_SPK','KELUAR_KE_SPK') and i.biaya_dibebankan>0))
group by t.id_transaksi;
revoke all on public.v_material_usage_transaction from public,anon;
grant select on public.v_material_usage_transaction to authenticated;

-- Detailed reporting applies filters to the same item, with source/destination
-- location IDs retained for warehouse, SPK Kavling and SPK Fasum alike.
create view public.v_material_report_detail with(security_invoker=true) as
select i.id_item_transaksi::text as id_baris,t.id_transaksi::text as id_dokumen,t.no_transaksi as nomor,t.tanggal,t.created_at,
 case when t.jenis_transaksi in ('PENERIMAAN','PENERIMAAN_SPK','PEMAKAIAN_SUPPLIER_LANGSUNG') then 'PEMBELIAN' when t.id_rekonsiliasi is not null then 'REKONSILIASI' when t.jenis_transaksi in ('PEMAKAIAN_LANGSUNG','PEMAKAIAN_DARI_SPK') then 'PEMAKAIAN' else 'MUTASI' end as jenis_laporan,
 t.jenis_transaksi,t.status,t.id_pemasok,t.nama_pemasok,t.no_nota,t.keterangan,
 array_remove(array[t.id_lokasi_asal::text,t.id_lokasi_tujuan::text,t.id_spk::text,t.id_spk_tujuan::text],null) as lokasi_ids,
 concat_ws(' → ',la.nama_lokasi,coalesce(case when s.jenis_spk='KAVLING' then 'Kavling '||s.id_kavling else s.nama_objek end),lt.nama_lokasi,case when st.jenis_spk='KAVLING' then 'Kavling '||st.id_kavling else st.nama_objek end) as lokasi,
 i.id_material,m.nama_material,m.kategori,m.satuan,i.jumlah,null::numeric as jumlah_dipenuhi,i.harga_satuan,i.jumlah*i.harga_satuan as nilai,i.biaya_dibebankan
from public.material_transaction t join public.material_transaction_item i using(id_transaksi) join public.master_material m using(id_material)
left join public.material_location la on la.id_lokasi=t.id_lokasi_asal left join public.material_location lt on lt.id_lokasi=t.id_lokasi_tujuan
left join public.spk s on s.id_spk=t.id_spk left join public.spk st on st.id_spk=t.id_spk_tujuan
union all
select i.id_item_permintaan::text,r.id_permintaan::text,r.no_permintaan,r.tanggal,r.created_at,'PERMINTAAN','PERMINTAAN',r.status,null::uuid,null::text,null::text,r.keterangan,
 array_remove(array[r.id_spk::text,r.id_lokasi::text],null),concat_ws(' → ',l.nama_lokasi,case when s.jenis_spk='KAVLING' then 'Kavling '||s.id_kavling else s.nama_objek end),
 i.id_material,m.nama_material,m.kategori,m.satuan,i.jumlah_diminta,i.jumlah_dipenuhi,null::numeric,null::numeric,null::numeric
from public.material_request r join public.material_request_item i using(id_permintaan) join public.master_material m using(id_material)
left join public.material_location l on l.id_lokasi=r.id_lokasi left join public.spk s on s.id_spk=r.id_spk;
revoke all on public.v_material_report_detail from public,anon;
grant select on public.v_material_report_detail to authenticated;
