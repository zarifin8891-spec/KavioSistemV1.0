-- Phase 2 regression fixtures: no operational data is retained.
begin;
select set_config('request.jwt.claim.sub','2d50291d-03e3-46a3-b3d8-c4550bc1bce7',true);
update public.company_settings set mode_progress_default='KATEGORI' where id=true;
create function pg_temp.expect_detail_error(p_sql text,p_message text) returns void language plpgsql as $$
begin
 begin execute p_sql; exception when others then if position(p_message in sqlerrm)>0 then return; end if; raise; end;
 raise exception 'TEST FAILED: expected rejection %',p_message;
end $$;
do $test$
declare id uuid; p1 uuid; p2 uuid; d1 uuid; d2 uuid; d3 uuid; m1 text; m2 text; office text; parents jsonb; lines jsonb; input jsonb; before_count integer; typ text; lot text; kid uuid; kp1 uuid; kp2 uuid; config jsonb; rid uuid; rp uuid; mat uuid;
begin
 select id_mandor,id_kantor into m1,office from public.master_mandor where status_aktif order by id_mandor limit 1;
 select id_mandor into m2 from public.master_mandor where status_aktif and id_mandor<>m1 order by id_mandor limit 1;
 id:=public.create_fasum_spk_atomic('TEST DETAIL FASUM',current_date-7,current_date+30,office,m1,'[{"nama_pekerjaan":"Struktur","bobot":0.4},{"nama_pekerjaan":"Finishing","bobot":0.6}]');
 update public.spk set mode_progress='PERINCIAN' where id_spk=id;
 perform pg_temp.expect_detail_error(format('select public.activate_spk_atomic(%L)',id),'Simpan konfigurasi');
 select id_item into p1 from public.spk_work_item where id_spk=id and urutan=1;
 select id_item into p2 from public.spk_work_item where id_spk=id and urutan=2;
 parents:=jsonb_build_array(jsonb_build_object('id_kategori',p1,'bobot',.4),jsonb_build_object('id_kategori',p2,'bobot',.6));
 lines:=jsonb_build_array(jsonb_build_object('group_id',p1,'urutan',1,'nama_pekerjaan','Pondasi','volume',10,'satuan','m3','bobot',.1,'retensi',.05,'id_mandor',m1),jsonb_build_object('group_id',p1,'urutan',2,'nama_pekerjaan','Rangka atap','volume',30,'satuan','m2','bobot',.3,'retensi',0,'id_mandor',m2),jsonb_build_object('group_id',p2,'urutan',3,'nama_pekerjaan','Dinding','volume',50,'satuan','m2','bobot',.6,'retensi',.05,'id_mandor',m1));
 perform public.configure_spk_work_atomic(id,'PERINCIAN',10000000,parents,lines);
 select id_detail into d1 from public.spk_work_detail where id_item=p1 and urutan=1;
 select id_detail into d2 from public.spk_work_detail where id_item=p1 and urutan=2;
 select id_detail into d3 from public.spk_work_detail where id_item=p2;
 perform public.activate_spk_atomic(id);
 perform pg_temp.expect_detail_error(format('select public.insert_progress_work_item_batch_atomic(%L,current_date,''[]'')',id),'Gunakan input progress perincian');
 perform pg_temp.expect_detail_error(format('select public.configure_spk_work_atomic(%L,''PERINCIAN'',1,%L,%L)',id,parents,lines),'Konfigurasi hanya');
 input:=jsonb_build_array(jsonb_build_object('id_item',d1,'progress_percent',50),jsonb_build_object('id_item',d3,'progress_percent',25));
 perform public.insert_work_detail_progress_batch_atomic(id,current_date-2,input);
 -- A different item in the same category/day merges into the existing category projection.
 perform public.insert_work_detail_progress_batch_atomic(id,current_date-2,jsonb_build_array(jsonb_build_object('id_item',d2,'progress_percent',20)));
 if (select progress_akumulasi from public.v_spk_work_item_progress_current where id_item=p1)<>.275 then raise exception 'FAILED category progress formula'; end if;
 if (select sum(progress_berbobot) from public.v_spk_work_item_progress_current where id_spk=id)<>.26 then raise exception 'FAILED total SPK formula'; end if;
 if (select sum(upah_bruto) from public.v_spk_work_detail_progress_current where id_spk=id)<>2600000 or (select sum(upah_retensi) from public.v_spk_work_detail_progress_current where id_spk=id)<>100000 then raise exception 'FAILED wages / retention'; end if;
 if (select upah_retensi from public.v_spk_work_detail_progress_current where id_item=d2)<>0 or (select id_mandor from public.work_detail_progress where id_detail=d2)<>m2 then raise exception 'FAILED independent mandor / full payment'; end if;
 select count(*) into before_count from public.work_detail_progress;
 perform pg_temp.expect_detail_error(format('select public.insert_work_detail_progress_batch_atomic(%L,current_date,%L)',id,jsonb_build_array(jsonb_build_object('id_item',d1,'progress_percent',10),jsonb_build_object('id_item',d3,'progress_percent',76))),'melebihi 100');
 if (select count(*) from public.work_detail_progress)<>before_count then raise exception 'FAILED atomic rollback'; end if;
 perform pg_temp.expect_detail_error(format('select public.insert_work_detail_progress_batch_atomic(%L,current_date-2,%L)',id,input),'sudah dicatat');
 perform pg_temp.expect_detail_error(format('select public.insert_work_detail_progress_batch_atomic(%L,current_date,%L)',id,jsonb_build_array(jsonb_build_object('id_item',d1,'progress_percent',10),jsonb_build_object('id_item',d1,'progress_percent',10))),'duplikat');
 perform pg_temp.expect_detail_error(format('select public.insert_work_detail_progress_batch_atomic(%L,current_date,%L)',id,jsonb_build_array(jsonb_build_object('id_item',gen_random_uuid(),'progress_percent',10))),'bukan milik');
 perform public.insert_work_detail_progress_batch_atomic(id,current_date-1,jsonb_build_array(jsonb_build_object('id_item',d1,'progress_percent',50),jsonb_build_object('id_item',d2,'progress_percent',80),jsonb_build_object('id_item',d3,'progress_percent',75)));
 if exists(select 1 from public.v_spk_work_detail_progress_current where id_spk=id and progress_akumulasi<>1) or exists(select 1 from public.v_spk_work_item_progress_current where id_spk=id and progress_akumulasi<>1) then raise exception 'FAILED final item/category 100%%'; end if;
 if (select sum(upah_bruto) from public.v_spk_work_detail_progress_current where id_spk=id)<>10000000 or (select sum(upah_retensi) from public.v_spk_work_detail_progress_current where id_spk=id)<>350000 then raise exception 'FAILED final claim totals'; end if;
 perform pg_temp.expect_detail_error(format('select public.insert_work_detail_progress_batch_atomic(%L,current_date,%L)',id,jsonb_build_array(jsonb_build_object('id_item',d1,'progress_percent',.01))),'melebihi 100');

 -- Completion checks sources rather than rounded aggregate progress and keeps material reconciliation.
 perform public.deactivate_spk_atomic(id);
 rid:=public.create_fasum_spk_atomic('TEST ROUNDED COMPLETE',current_date-7,current_date+30,office,m1,'[{"nama_pekerjaan":"Jalan","bobot":0.999964}]');
 select id_item into rp from public.spk_work_item where id_spk=rid;
 perform public.configure_spk_work_atomic(rid,'PERINCIAN',15569000,jsonb_build_array(jsonb_build_object('id_kategori',rp,'bobot',.999964)),jsonb_build_array(jsonb_build_object('group_id',rp,'urutan',1,'nama_pekerjaan','Persiapan','volume',10,'satuan','m2','bobot',.333333,'retensi',.05,'id_mandor',m1),jsonb_build_object('group_id',rp,'urutan',2,'nama_pekerjaan','Pengecatan','volume',10,'satuan','m2','bobot',.666631,'retensi',0,'id_mandor',m2)));
 perform public.activate_spk_atomic(rid);
 perform pg_temp.expect_detail_error(format('select public.deactivate_spk_atomic(%L)',rid),'BELUM DAPAT DISELESAIKAN');
 select jsonb_agg(jsonb_build_object('id_item',id_detail,'progress_percent',100)) into input from public.spk_work_detail where id_item=rp;
 perform public.insert_work_detail_progress_batch_atomic(rid,current_date,input);
 if exists(select 1 from public.v_spk_work_detail_progress_current where id_spk=rid and upah_bruto<>upah_item) then raise exception 'FAILED rounded item wage at completion'; end if;
 select id_material into mat from public.master_material where status_aktif order by id_material limit 1;
 if mat is not null then
  insert into public.material_stock_spk(id_spk,id_material,jumlah,harga_rata_rata) values(rid,mat,1,1000);
  perform pg_temp.expect_detail_error(format('select public.deactivate_spk_atomic(%L)',rid),'SISA MATERIAL');
  delete from public.material_stock_spk where id_spk=rid;
 end if;
 perform public.deactivate_spk_atomic(rid);
 if (select status_spk from public.spk where id_spk=rid)<>'SELESAI' then raise exception 'FAILED rounded completed SPK'; end if;
 perform set_config('kavio.test_spk',id::text,true);
 -- Kavling uses the identical item RPC; projections feed the existing Decision Engine.
 typ:='TEST_D_'||substr(gen_random_uuid()::text,1,8);
 insert into public.master_tipe_rumah(id_tipe,nama_tipe,luas_tanah_m2,luas_bangunan_m2,status_aktif) values(typ,'TEST DETAIL KAVLING',72,36,true);
 perform public.save_work_master_atomic(typ,10000000,'[{"id_kategori":"KP01","bobot":0.4},{"id_kategori":"KP02","bobot":0.6}]',jsonb_build_array((lines->0)||jsonb_build_object('group_id','KP01'),(lines->1)||jsonb_build_object('group_id','KP01'),(lines->2)||jsonb_build_object('group_id','KP02')),true);
 select k.id_kavling into lot from public.master_kavling k where status_kavling='AVAILABLE' and status_aktif and not exists(select 1 from public.spk where id_kavling=k.id_kavling) and not exists(select 1 from public.sales where id_kavling=k.id_kavling and status_aktif) order by id_kavling limit 1;
 if lot is null then raise exception 'Test needs unsold available lot'; end if;
 update public.master_kavling set id_tipe=typ where id_kavling=lot;
 config:='[{"id_kategori":"KP01","bobot_final":0.4},{"id_kategori":"KP02","bobot_final":0.6}]';
 kid:=(public.create_or_update_spk_atomic(lot,current_date-7,current_date+30,office,m1,'STANDAR',config)->>'id_spk')::uuid;
 select id_item into kp1 from public.spk_work_item where id_spk=kid and id_kategori_legacy='KP01';
 select id_item into kp2 from public.spk_work_item where id_spk=kid and id_kategori_legacy='KP02';
 parents:=jsonb_build_array(jsonb_build_object('id_kategori',kp1,'bobot',.4),jsonb_build_object('id_kategori',kp2,'bobot',.6));
 lines:=jsonb_build_array((lines->0)||jsonb_build_object('group_id',kp1),(lines->1)||jsonb_build_object('group_id',kp1),(lines->2)||jsonb_build_object('group_id',kp2));
 perform public.configure_spk_work_atomic(kid,'PERINCIAN',10000000,parents,lines);
 perform public.activate_spk_atomic(kid);
 select jsonb_agg(jsonb_build_object('id_item',id_detail,'progress_percent',case urutan when 1 then 50 when 2 then 20 else 25 end)) into input from public.spk_work_detail where id_item in(kp1,kp2);
 perform public.insert_work_detail_progress_batch_atomic(kid,current_date,input);
 if (select progress_aktual from public.v_decision_engine where id_spk=kid)<>.26 then raise exception 'FAILED Kavling Decision Engine'; end if;
 if (select sum(progress_berbobot) from public.v_spk_work_item_progress_current where id_spk=kid)<>.26 then raise exception 'FAILED Kavling shared projection'; end if;

end $test$;
set local role authenticated;
select pg_temp.expect_detail_error(format('update public.progress_update set keterangan=''bypass'' where id_spk=%L',current_setting('kavio.test_spk')),'harus dicatat melalui form');
select set_config('request.jwt.claim.sub','',true);
do $$ begin if exists(select 1 from public.work_detail_progress) or exists(select 1 from public.v_spk_work_detail_progress_current) then raise exception 'FAILED missing identity RLS'; end if; end $$;
reset role;
do $$ begin
 if has_table_privilege('authenticated','public.work_detail_progress','insert') or has_function_privilege('anon','public.insert_work_detail_progress_batch_atomic(uuid,date,jsonb)','execute') then raise exception 'FAILED ledger/RPC privileges'; end if;
end $$;
rollback;
select 'PASS: detail activation, shared formulas, different mandors, 5%/0% retention, same-day category merging, duplicates, cross-SPK rejection, rollback, 100% completion, immutable config, RLS' as result;
