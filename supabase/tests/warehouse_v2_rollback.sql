-- Administrative runner, existing DIREKTUR identity. Every fixture is rolled back.
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.user_profiles where role='DIREKTUR' and status_aktif limit 1),true);
set local role authenticated;
do $test$
declare supplier uuid; warehouse uuid; material uuid; tool uuid; spk uuid; office text; mandor text; tx uuid; correction uuid; req uuid; data jsonb; failed boolean; q numeric; avg numeric;
begin
 begin
 insert into public.master_pemasok(nama_pemasok) values('TEST PEMASOK ROLLBACK V2') returning id_pemasok into supplier;
 insert into public.material_location(kode_lokasi,nama_lokasi,jenis_lokasi) values('TEST-V2-ROLLBACK','TEST GUDANG','GUDANG') returning id_lokasi into warehouse;
 insert into public.master_material(nama_material,kategori,satuan,jenis_item) values('TEST BAHAN ROLLBACK','TEST','PCS','BAHAN') returning id_material into material;
 insert into public.master_material(nama_material,kategori,satuan,jenis_item) values('TEST ALAT ROLLBACK','TEST','PCS','ALAT_PAKAI_ULANG') returning id_material into tool;
 select m.id_kantor,m.id_mandor into office,mandor from public.master_mandor m join public.master_kantor_pelaksana k using(id_kantor) where m.status_aktif and k.status_aktif limit 1;
 spk:=public.create_fasum_spk_atomic('TEST FASUM ROLLBACK',current_date,current_date+30,office,mandor,'[{"nama_pekerjaan":"TEST","bobot":1}]'::jsonb);
 perform public.activate_spk_atomic(spk);
 data:=jsonb_build_object('tujuan','GUDANG','id_lokasi',warehouse,'id_pemasok',supplier,'no_nota','TEST-NOTA','items',jsonb_build_array(jsonb_build_object('id_material',material,'jumlah',10,'harga_satuan',100)));
 tx:=public.post_material_purchase_v2_atomic(data);
 correction:=public.amend_material_purchase_atomic(tx,'Koreksi qty dan harga',data||jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id_material',material,'jumlah',20,'harga_satuan',150))));
 select jumlah,harga_rata_rata into q,avg from public.material_stock_location where id_lokasi=warehouse and id_material=material;
 if q<>20 or avg<>150 or (select status from public.material_transaction where id_transaksi=tx)<>'BATAL' then raise exception 'FAILED correction balance/audit'; end if;
 if (select saldo from public.v_material_stock_card where id_transaksi=correction and pemegang=warehouse::text)<>20 then raise exception 'FAILED stock card reverse'; end if;
 perform public.post_material_purchase_v2_atomic(data||jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id_material',material,'jumlah',10,'harga_satuan',300))));
 select jumlah,harga_rata_rata into q,avg from public.material_stock_location where id_lokasi=warehouse and id_material=material;
 if q<>30 or avg<>200 then raise exception 'FAILED weighted average'; end if;
 failed:=false;begin perform public.amend_material_purchase_atomic(correction,'Invalid edit');exception when others then if sqlerrm like '%TRANSAKSI MATERIAL LANJUTAN%' then failed:=true;else raise;end if;end;
 if not failed then raise exception 'FAILED downstream correction accepted';end if;
 req:=public.create_material_request_atomic(spk,'MANDOR_PELAKSANA',jsonb_build_array(jsonb_build_object('id_material',material,'jumlah',4)),null);
 perform public.fulfill_material_request_v2_atomic(req,warehouse,jsonb_build_array(jsonb_build_object('id_material',material,'jumlah',4)),true,null);
 if (select jumlah from public.material_stock_location where id_lokasi=warehouse and id_material=material)<>26 or (select jumlah from public.material_stock_spk where id_spk=spk and id_material=material)<>0 then raise exception 'FAILED requested direct usage';end if;
 if (select sum(biaya_dibebankan) from public.v_material_spk_usage where id_spk=spk)<>800 then raise exception 'FAILED requested cost';end if;
 -- Partial fulfillment remains in SPK stock until used.
 req:=public.create_material_request_atomic(spk,'GUDANG',jsonb_build_array(jsonb_build_object('id_material',material,'jumlah',4)),null);
 perform public.fulfill_material_request_v2_atomic(req,warehouse,jsonb_build_array(jsonb_build_object('id_material',material,'jumlah',2)),false,null);
 if (select status from public.material_request where id_permintaan=req)<>'SEBAGIAN_DIPENUHI' or (select jumlah from public.material_stock_spk where id_spk=spk and id_material=material)<>2 then raise exception 'FAILED partial fulfillment';end if;
 -- Direct delivery: goods form SPK stock, tools are charged once.
 data:=data||jsonb_build_object('tujuan','SPK','id_spk',spk,'items',jsonb_build_array(jsonb_build_object('id_material',tool,'jumlah',2,'harga_satuan',500)));
 tx:=public.post_material_purchase_v2_atomic(data);
 if (select jumlah from public.material_stock_spk where id_spk=spk and id_material=tool)<>2 or (select sum(biaya_dibebankan) from public.v_material_spk_usage where id_spk=spk)<>1800 then raise exception 'FAILED SPK purchase/tools cost';end if;
 perform public.amend_material_purchase_atomic(tx,'Cancel tool purchase');
 if (select jumlah from public.material_stock_spk where id_spk=spk and id_material=tool)<>0 or (select sum(biaya_dibebankan) from public.v_material_spk_usage where id_spk=spk)<>800 then raise exception 'FAILED tool cancellation';end if;
 -- Atomic failure must leave the original purchase valid.
 tx:=public.post_material_purchase_v2_atomic(data);
 failed:=false;begin perform public.amend_material_purchase_atomic(tx,'Invalid replacement',data||jsonb_build_object('no_nota',''));exception when others then if sqlerrm like '%NOMOR NOTA%' then failed:=true;else raise;end if;end;
 if not failed or (select status from public.material_transaction where id_transaksi=tx)<>'POSTED' then raise exception 'FAILED atomic amendment rollback';end if;
 if exists(select 1 from public.v_material_stock_card where saldo<0) then raise exception 'FAILED negative stock card';end if;
 -- Compare the last card balance with actual location/SPK stock for the fixtures.
 if exists(select 1 from public.material_stock_location b where b.id_lokasi=warehouse and b.jumlah<>(select c.saldo from public.v_material_stock_card c where c.pemegang=warehouse::text and c.id_material=b.id_material order by c.created_at desc,c.no_transaksi desc,c.id_item_transaksi desc limit 1)) then raise exception 'FAILED card != warehouse balance';end if;
 if exists(select 1 from public.material_stock_spk b where b.id_spk=spk and b.jumlah<>(select c.saldo from public.v_material_stock_card c where c.pemegang=spk::text and c.id_material=b.id_material order by c.created_at desc,c.no_transaksi desc,c.id_item_transaksi desc limit 1)) then raise exception 'FAILED card != SPK balance';end if;
 if has_table_privilege('authenticated','public.material_stock_location','UPDATE') or has_function_privilege('anon','public.post_material_purchase_v2_atomic(jsonb)','EXECUTE') then raise exception 'FAILED stock permission';end if;
 raise exception using errcode='ZX001',message='ROLLBACK_ALL_SUCCESS';
 exception when sqlstate 'ZX001' then null;
 end;
end $test$;
select 'PASS: correction/audit, weighted average, downstream guard, requested direct usage and cost, partial fulfillment, SPK purchase and reusable tools, cancellation, atomic failure rollback, stock card reconciliation, permissions' as verification,
(select count(*) from public.material_transaction) as remaining_transactions,
(select count(*) from public.spk) as remaining_spk;
rollback;
