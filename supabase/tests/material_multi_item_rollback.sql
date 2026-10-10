begin;
select set_config('request.jwt.claim.sub',(select user_id::text from user_profiles where role='DIREKTUR' and status_aktif limit 1),true);
set local role authenticated;
do $test$
declare supplier uuid; warehouse uuid; a uuid; b uuid; spk uuid; office text; mandor text; tx uuid; req uuid; v_items jsonb; failed boolean; before_qty numeric; i integer;
begin
 begin
 insert into master_pemasok(nama_pemasok) values('TEST MULTI ROLLBACK') returning id_pemasok into supplier;
 insert into material_location(kode_lokasi,nama_lokasi,jenis_lokasi) values('TEST-MULTI-ROLLBACK','TEST MULTI','GUDANG') returning id_lokasi into warehouse;
 insert into master_material(nama_material,kategori,satuan,jenis_item) values('TEST MULTI A','TEST_A','PCS','BAHAN') returning id_material into a;
 insert into master_material(nama_material,kategori,satuan,jenis_item) values('TEST MULTI B','TEST_B','PCS','BAHAN') returning id_material into b;
 select m.id_kantor,m.id_mandor into office,mandor from master_mandor m join master_kantor_pelaksana k using(id_kantor) where m.status_aktif and k.status_aktif limit 1;
 spk:=create_fasum_spk_atomic('TEST MULTI FASUM',current_date,current_date+30,office,mandor,'[{"nama_pekerjaan":"TEST","bobot":1}]');perform activate_spk_atomic(spk);
 v_items:=jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',10,'harga_satuan',100),jsonb_build_object('id_material',b,'jumlah',10,'harga_satuan',200));
 for i in 1..21 loop
  perform post_material_purchase_v2_atomic(jsonb_build_object('tujuan','GUDANG','id_lokasi',warehouse,'id_pemasok',supplier,'no_nota','TEST-'||i,'items',v_items));
  req:=create_material_request_atomic(spk,'GUDANG',jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',1),jsonb_build_object('id_material',b,'jumlah',1)),null);
  perform fulfill_material_request_v2_atomic(req,warehouse,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',1),jsonb_build_object('id_material',b,'jumlah',1)),true,null);
 end loop;
 if (select count(*) from v_material_purchase where id_pemasok=supplier)<>21 or (select sum(jsonb_array_length(items)) from (select items from v_material_purchase where id_pemasok=supplier order by created_at desc,no_transaksi desc limit 20)x)<>40 then raise exception 'FAILED latest 20 purchases lost lines';end if;
 if (select count(*) from v_material_usage_transaction where id_spk=spk)<>21 or (select sum(jsonb_array_length(items)) from (select items from v_material_usage_transaction where id_spk=spk order by created_at desc,no_transaksi desc limit 20)x)<>40 then raise exception 'FAILED latest 20 usage lost lines';end if;
 if (select count(*) from v_material_report_detail where id_pemasok=supplier and kategori='TEST_A' and lokasi_ids @> array[warehouse::text] and tanggal=current_date)<>21 then raise exception 'FAILED report filters/truncated history';end if;
 if (select count(*) from material_request where id_spk=spk and status='DIPENUHI')<>21 then raise exception 'FAILED multi fulfillment';end if;
 select jumlah into before_qty from material_stock_location where id_lokasi=warehouse and id_material=a;
 failed:=false;begin perform post_material_direct_usage_atomic(spk,warehouse,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',1),jsonb_build_object('id_material',b,'jumlah',999999)),null);exception when others then if sqlerrm like '%STOK GUDANG TIDAK MENCUKUPI%' then failed:=true;else raise;end if;end;
 if not failed or (select jumlah from material_stock_location where id_lokasi=warehouse and id_material=a)<>before_qty then raise exception 'FAILED multi failure atomicity';end if;
 perform post_material_purchase_v2_atomic(jsonb_build_object('tujuan','SPK','id_spk',spk,'id_pemasok',supplier,'no_nota','TEST-SPK','items',jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',5,'harga_satuan',100),jsonb_build_object('id_material',b,'jumlah',5,'harga_satuan',200))));
 perform post_spk_material_usage_atomic(spk,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',1),jsonb_build_object('id_material',b,'jumlah',1)),null);
 perform post_spk_material_reconciliation_atomic(spk,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',4,'tindakan','KEMBALI_KE_GUDANG','id_lokasi_tujuan',warehouse),jsonb_build_object('id_material',b,'jumlah',4,'tindakan','KEMBALI_KE_GUDANG','id_lokasi_tujuan',warehouse)),null);
 if exists(select 1 from material_stock_spk where id_spk=spk and jumlah<>0) then raise exception 'FAILED multi reconciliation';end if;
 if (select sum(biaya_dibebankan) from v_material_spk_usage where id_spk=spk)<>6600 then raise exception 'FAILED multi usage cost';end if;
 raise exception using errcode='ZX001',message='ROLLBACK_ALL_SUCCESS';
 exception when sqlstate 'ZX001' then null;
 end;
end $test$;
select 'PASS: multi purchase/request/fulfillment/SPK usage/reconciliation, atomic stock failure, latest 20 documents retain 40 lines, complete history beyond 20, correlated category/location/supplier/period filters' as verification;
rollback;
