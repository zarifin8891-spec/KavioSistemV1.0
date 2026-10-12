-- V2-only transactional fixture: all created masters, users, stock and plans roll back.
begin;
select set_config('request.jwt.claim.sub','2d50291d-03e3-46a3-b3d8-c4550bc1bce7',true);
do $test$
declare prefix text:='TEST-RAB-'||substr(gen_random_uuid()::text,1,8);typ text;lot text;office text;mandor text;category text;
 a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();d uuid:=gen_random_uuid();tool uuid:=gen_random_uuid();wage uuid:=gen_random_uuid();
 rab uuid:=gen_random_uuid();loc uuid:=gen_random_uuid();k uuid;f uuid;empty_spk uuid;parent uuid;plan uuid;newplan uuid;req uuid;actor uuid;failed boolean;r record;
begin
 typ:=prefix;lot:=prefix||'-LOT';
 select id_kantor,id_mandor into office,mandor from public.master_mandor where status_aktif limit 1;
 insert into public.master_tipe_rumah(id_tipe,nama_tipe,luas_tanah_m2,luas_bangunan_m2) values(typ,prefix,72,36);
 insert into public.master_material(id_material,nama_material,kategori,satuan,jenis_item) values
 (a,prefix||' Bahan A','TEST','m','BAHAN'),(b,prefix||' Bahan B','TEST','m','BAHAN'),(c,prefix||' Bahan C','TEST','m','BAHAN'),(d,prefix||' Nol','TEST','m','BAHAN'),(tool,prefix||' Alat','TEST','bh','ALAT_PAKAI_ULANG'),(wage,prefix||' Upah','TEST','hari','UPAH');
 insert into public.rab_template(id_rab,id_tipe,nama_template,versi) values(rab,typ,prefix,'1');
 insert into public.rab_template_item(id_rab,urutan,id_material,nama_snapshot,kategori_snapshot,satuan_snapshot,volume,harga_standar)
 select rab,v.n,m.id_material,m.nama_material,m.kategori,m.satuan,v.qty,v.price from (values(1,a,5,100),(2,b,1,50),(3,tool,1,200),(4,d,0,0),(5,wage,1,1000))v(n,id,qty,price) join public.master_material m on m.id_material=v.id;
 insert into public.master_kavling(id_kavling,blok,no_kavling,id_tipe,status_kavling) values(lot,prefix,'1',typ,'AVAILABLE');
 insert into public.spk(id_kavling,tgl_spk,id_tipe,jenis_bobot,id_kantor,id_mandor,status_spk,tgl_target_selesai,jenis_spk)
 values(lot,current_date,typ,'CUSTOM',office,mandor,'DRAFT',current_date+30,'KAVLING') returning id_spk into k;
 select id_plan into plan from public.v_spk_material_plan_current where id_spk=k;
 if plan is null or (select count(*) from public.spk_material_plan_item where id_plan=plan)<>4 or exists(select 1 from public.spk_material_plan_item where id_plan=plan and id_material=wage) then raise exception 'Automatic standard snapshot / wage exclusion failed';end if;
 select id_kategori into category from public.master_kategori_pekerjaan where status_aktif order by id_kategori limit 1;
 insert into public.spk_progress_config(id_spk,id_kategori,bobot_final) values(k,category,1);
 select id_item into parent from public.spk_work_item where id_spk=k;
 perform public.configure_spk_work_atomic(k,'KATEGORI',0,jsonb_build_array(jsonb_build_object('id_kategori',parent,'bobot',1)),'[]');
 perform public.activate_spk_atomic(k);
 update public.rab_template_item set volume=99,harga_standar=999 where id_rab=rab and id_material=a;
 if (select volume from public.spk_material_plan_item where id_plan=plan and id_material=a)<>5 or (select nilai_rab from public.v_spk_material_rab_control where id_spk=k and id_material=a)<>500 then raise exception 'Master RAB changed SPK snapshot';end if;
 f:=public.create_fasum_spk_atomic(prefix||' Fasum',current_date,current_date+30,office,mandor,'[{"nama_pekerjaan":"TEST","bobot":1}]');
 select id_item into parent from public.spk_work_item where id_spk=f;
 perform public.configure_spk_work_atomic(f,'KATEGORI',0,jsonb_build_array(jsonb_build_object('id_kategori',parent,'bobot',1)),'[]');perform public.activate_spk_atomic(f);
 perform public.save_spk_material_plan_atomic(f,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',1,'harga_satuan',100),jsonb_build_object('id_material',tool,'jumlah',1,'harga_satuan',0)),null,'RAB awal Fasum',0);
 insert into public.material_location(id_lokasi,kode_lokasi,nama_lokasi,jenis_lokasi) values(loc,prefix,prefix,'GUDANG');
 insert into public.master_pemasok(nama_pemasok) values(prefix);
 perform public.post_material_receipt_atomic(loc,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',20,'harga_satuan',100),jsonb_build_object('id_material',b,'jumlah',2,'harga_satuan',100),jsonb_build_object('id_material',c,'jumlah',3,'harga_satuan',300),jsonb_build_object('id_material',tool,'jumlah',1,'harga_satuan',200)),false,prefix,'TEST-NOTA');
 perform public.post_material_direct_usage_atomic(k,loc,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',3)));
 req:=public.create_material_request_atomic(k,'GUDANG',jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',8),jsonb_build_object('id_material',tool,'jumlah',1)));
 perform public.post_material_issue_to_spk_atomic(req,loc,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',8),jsonb_build_object('id_material',tool,'jumlah',1)));
 select * into r from public.v_spk_material_rab_control where id_spk=k and id_material=a;
 if r.jumlah_pakai<>3 or r.stok_spk<>8 or r.biaya_aktual<>300 then raise exception 'Stock receipt counted as actual usage';end if;
 if (select biaya_aktual from public.v_spk_material_rab_control where id_spk=k and id_material=tool)<>200 then raise exception 'First tool charge missing';end if;
 perform public.post_spk_material_usage_atomic(k,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',2)));
 perform public.post_spk_material_reconciliation_atomic(k,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',1,'tindakan','HILANG_RUSAK','alasan','TEST LOST')));
 select * into r from public.v_spk_material_rab_control where id_spk=k and id_material=a;
 if r.jumlah_pakai<>5 or r.jumlah_hilang_rusak<>1 or r.biaya_aktual<>600 or r.status_kontrol<>'MELEBIHI_VOLUME' or r.sisa_volume_rab<>-1 then raise exception 'Usage/loss/quantity overrun mismatch';end if;
 perform public.post_spk_material_reconciliation_atomic(k,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',1,'tindakan','KEMBALI_KE_GUDANG','id_lokasi_tujuan',loc)));
 perform public.post_spk_material_reconciliation_atomic(k,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',2,'tindakan','PINDAH_KE_SPK','id_spk_tujuan',f),jsonb_build_object('id_material',tool,'jumlah',1,'tindakan','PINDAH_KE_SPK','id_spk_tujuan',f)));
 select * into r from public.v_spk_material_rab_control where id_spk=k and id_material=a;
 if r.jumlah_pakai<>5 or r.jumlah_hilang_rusak<>1 or r.stok_spk<>2 or r.biaya_aktual<>600 then raise exception 'Return/transfer double-counted';end if;
 if (select biaya_aktual from public.v_spk_material_rab_control where id_spk=f and id_material=tool)<>0 or (select biaya_aktual from public.v_spk_material_rab_control where id_spk=k and id_material=tool)<>200 then raise exception 'Transferred tool charged twice';end if;
 perform public.post_spk_material_usage_atomic(f,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',1)));
 if (select jumlah_pakai from public.v_spk_material_rab_control where id_spk=f and id_material=a)<>1 or (select biaya_aktual from public.v_spk_material_rab_control where id_spk=f and id_material=a)<>100 then raise exception 'Fasum shared actual engine failed';end if;
 perform public.post_material_direct_usage_atomic(k,loc,jsonb_build_array(jsonb_build_object('id_material',b,'jumlah',1),jsonb_build_object('id_material',c,'jumlah',1)));
 if (select status_kontrol from public.v_spk_material_rab_control where id_spk=k and id_material=b)<>'MELEBIHI_NILAI' or (select status_kontrol from public.v_spk_material_rab_control where id_spk=k and id_material=c)<>'DI_LUAR_RAB' then raise exception 'Cost/unplanned warning failed';end if;
 if (select status_kontrol from public.v_spk_material_rab_control where id_spk=k and id_material=d)<>'DALAM_RAB' then raise exception 'Zero budget falsely flagged';end if;
 empty_spk:=public.create_fasum_spk_atomic(prefix||' No RAB',current_date,current_date+30,office,mandor,'[{"nama_pekerjaan":"TEST","bobot":1}]');
 select id_item into parent from public.spk_work_item where id_spk=empty_spk;
 perform public.configure_spk_work_atomic(empty_spk,'KATEGORI',0,jsonb_build_array(jsonb_build_object('id_kategori',parent,'bobot',1)),'[]');perform public.activate_spk_atomic(empty_spk);
 perform public.post_material_direct_usage_atomic(empty_spk,loc,jsonb_build_array(jsonb_build_object('id_material',c,'jumlah',1)));
 if (select status_kontrol from public.v_spk_material_rab_control where id_spk=empty_spk)<>'BELUM_ADA_RAB' or exists(select 1 from public.v_spk_material_rab_control where id_spk=empty_spk and (nilai_rab is not null or selisih_nilai is not null)) then raise exception 'No baseline shown as zero budget';end if;
 failed:=false;begin perform public.save_spk_material_plan_atomic(k,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',10,'harga_satuan',100)),null,'TEST STALE',0);exception when others then if sqlerrm like '%TELAH BERUBAH%' then failed:=true;else raise;end if;end;if not failed then raise exception 'Stale edit accepted';end if;
 failed:=false;begin perform public.save_spk_material_plan_atomic(k,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',10,'harga_satuan',100),jsonb_build_object('id_material',a,'jumlah',1,'harga_satuan',1)),null,'TEST DUPLICATE',1);exception when others then if sqlerrm like '%DUPLIKAT%' then failed:=true;else raise;end if;end;if not failed then raise exception 'Duplicate material accepted';end if;
 failed:=false;begin perform public.save_spk_material_plan_atomic(k,jsonb_build_array(jsonb_build_object('id_material',wage,'jumlah',1,'harga_satuan',1)),null,'TEST WAGE',1);exception when others then if sqlerrm like '%MATERIAL / ALAT%' then failed:=true;else raise;end if;end;if not failed then raise exception 'Wage accepted in material RAB';end if;
 if (select count(*) from public.spk_material_plan where id_spk=k)<>1 then raise exception 'Invalid plan not atomic';end if;
 newplan:=public.save_spk_material_plan_atomic(k,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',10,'harga_satuan',100)),null,'Revisi kebutuhan',1);
 if (select count(*) from public.spk_material_plan where id_spk=k)<>2 or (select volume from public.spk_material_plan_item where id_plan=plan and id_material=a)<>5 or (select id_plan from public.v_spk_material_plan_current where id_spk=k)<>newplan then raise exception 'Revision history not preserved';end if;
 update public.master_material set satuan='meter' where id_material=d;
 -- D is no longer in the newest custom revision; check the historical snapshot remains unchanged.
 if (select satuan_snapshot from public.spk_material_plan_item where id_plan=plan and id_material=d)<>'m' then raise exception 'Master unit changed old snapshot';end if;
 update public.master_material set satuan='m' where id_material=d;
 failed:=false;begin perform public.save_spk_material_plan_atomic(f,null,rab,'Wrong object type',1);exception when others then if sqlerrm like '%SESUAI TIPE%' then failed:=true;else raise;end if;end;if not failed then raise exception 'Kavling template applied to Fasum';end if;
 empty_spk:=public.create_fasum_spk_atomic(prefix||' Closed',current_date,current_date+30,office,mandor,'[{"nama_pekerjaan":"TEST","bobot":1}]');
 select id_item into parent from public.spk_work_item where id_spk=empty_spk;
 perform public.configure_spk_work_atomic(empty_spk,'KATEGORI',0,jsonb_build_array(jsonb_build_object('id_kategori',parent,'bobot',1)),'[]');perform public.activate_spk_atomic(empty_spk);
 perform public.insert_progress_work_item_batch_atomic(empty_spk,current_date,jsonb_build_array(jsonb_build_object('id_item',parent,'progress_percent',100)));
 perform public.deactivate_spk_atomic(empty_spk);
 failed:=false;begin perform public.save_spk_material_plan_atomic(empty_spk,jsonb_build_array(jsonb_build_object('id_material',a,'jumlah',1,'harga_satuan',100)),null,'Closed edit',0);exception when others then if sqlerrm like '%SELESAI%' then failed:=true;else raise;end if;end;if not failed then raise exception 'Closed SPK plan changed';end if;
 actor:=gen_random_uuid();insert into auth.users(id,email) values(actor,'rab-test-'||actor::text||'@example.invalid');
 insert into public.user_profiles(user_id,role,status_aktif,nama) values(actor,'MARKETING',true,'TEST RAB') on conflict(user_id) do update set role='MARKETING',status_aktif=true;
 perform set_config('request.jwt.claim.sub',actor::text,true);execute 'set local role authenticated';
 if not exists(select 1 from public.v_spk_material_rab_control where id_spk=k) then raise exception 'Active read policy failed';end if;
 failed:=false;begin perform public.save_spk_material_plan_atomic(k,'[]',null,'Unauthorized',2);exception when others then if sqlerrm like '%DITOLAK%' then failed:=true;else raise;end if;end;if not failed then raise exception 'Marketing plan write permitted';end if;
 if has_table_privilege('authenticated','public.spk_material_plan','insert') or has_table_privilege('authenticated','public.spk_material_plan_item','update') or has_function_privilege('anon','public.save_spk_material_plan_atomic(uuid,jsonb,uuid,text,integer)','execute') then raise exception 'Direct/anon plan mutation granted';end if;
 execute 'reset role';
end $test$;
rollback;
select 'PASS: standard snapshot, wage exclusion, zero volumes, immutable revision history, stale edit, Kavling/Fasum, stock vs consumption, loss, return/transfer, tool single charge, quantity/cost/unplanned warnings, missing baseline, permissions' verification;

