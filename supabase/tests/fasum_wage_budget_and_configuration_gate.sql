-- All fixtures roll back; no operational data is retained.
begin;
select set_config('request.jwt.claim.sub','2d50291d-03e3-46a3-b3d8-c4550bc1bce7',true);
update public.company_settings set mode_progress_default='KATEGORI' where id=true;
create function pg_temp.expect_gate_error(sql text,message text) returns void language plpgsql as $$ begin
 begin execute sql; exception when others then if position(message in sqlerrm)>0 then return; end if; raise; end;
 raise exception 'Expected rejection: %',message;
end $$;
do $$ declare id uuid; parents jsonb; lines jsonb; office text; mandor text; lot text; typ text:='TEST_W_'||substr(gen_random_uuid()::text,1,8); config jsonb:='[{"id_kategori":"KP01","bobot_final":0.2},{"id_kategori":"KP02","bobot_final":0.8}]';
begin
 select id_kantor,id_mandor into office,mandor from master_mandor where status_aktif order by id_mandor limit 1;
 id:=create_fasum_spk_with_wages_atomic('TEST WAGE FASUM',current_date,current_date+30,office,mandor,'[{"nama_pekerjaan":"Galian","bobot":0.2,"volume":10,"satuan":"m3","harga_satuan_upah":20000,"keterangan":"Blok A"},{"nama_pekerjaan":"Pondasi","bobot":0.8,"volume":10,"satuan":"m3","harga_satuan_upah":80000}]');
 if (select total_upah_borongan from spk where id_spk=id)<>1000000 or (select sum(total_upah_rencana) from spk_work_item where id_spk=id)<>1000000 then raise exception 'Wrong wage sum'; end if;
 if (select keterangan from spk_work_item where id_spk=id and urutan=1)<>'Blok A' then raise exception 'Notes not persisted'; end if;
 perform pg_temp.expect_gate_error(format('select activate_spk_atomic(%L)',id),'Simpan konfigurasi');
 select jsonb_agg(jsonb_build_object('id_kategori',id_item,'bobot',bobot)) into parents from spk_work_item where id_spk=id;
 select jsonb_agg(jsonb_build_object('group_id',id_item,'urutan',urutan,'nama_pekerjaan',nama_pekerjaan,'bobot',bobot,'volume',volume,'satuan',satuan,'id_mandor',mandor,'retensi',.05)) into lines from spk_work_item where id_spk=id;
 perform pg_temp.expect_gate_error(format('select configure_spk_work_atomic(%L,''PERINCIAN'',999999,%L,%L)',id,parents,lines),'Total upah Fasum');
 perform configure_spk_work_atomic(id,'PERINCIAN',1000000,parents,lines);
 update spk_work_item set keterangan='Revised draft' where id_spk=id and urutan=1;
 if (select configured_at from spk where id_spk=id) is not null then raise exception 'Draft edit must invalidate configuration'; end if;
 perform pg_temp.expect_gate_error(format('select activate_spk_atomic(%L)',id),'Simpan konfigurasi');
 perform configure_spk_work_atomic(id,'PERINCIAN',1000000,parents,lines);
 perform activate_spk_atomic(id);
 if not (select is_active from spk where id_spk=id) then raise exception 'Configured Fasum activation failed'; end if;
 perform insert_work_detail_progress_batch_atomic(id,current_date,(select jsonb_agg(jsonb_build_object('id_item',d.id_detail,'progress_percent',100)) from spk_work_detail d join spk_work_item w using(id_item) where w.id_spk=id and w.urutan=1));
 if (select sum(upah_bruto) from v_spk_work_detail_progress_current where id_spk=id)<>200000 or (select sum(upah_retensi) from v_spk_work_detail_progress_current where id_spk=id)<>10000 then raise exception 'Fasum wage basis does not feed shared wage/retention engine'; end if;
 perform pg_temp.expect_gate_error(format('update spk_work_item set harga_satuan_upah=1 where id_spk=%L',id),'tidak dapat diubah');
 perform pg_temp.expect_gate_error(format('select create_fasum_spk_with_wages_atomic(''TEST INVALID'',current_date,current_date+30,%L,%L,''[{"nama_pekerjaan":"X","bobot":1,"volume":0,"satuan":"m","harga_satuan_upah":1}]'')',office,mandor),'tidak valid');
 -- Kavling must also configure category mode before activation.
 select k.id_kavling into lot from master_kavling k where k.status_aktif and k.status_kavling='AVAILABLE' and not exists(select 1 from spk where id_kavling=k.id_kavling) and not exists(select 1 from sales where id_kavling=k.id_kavling and status_aktif) order by k.id_kavling limit 1;
 if lot is null then raise exception 'Need available fixture lot'; end if;
 insert into master_tipe_rumah(id_tipe,nama_tipe,luas_tanah_m2,luas_bangunan_m2,status_aktif) values(typ,'TEST WAGE',72,36,true);
 insert into template_progress_tipe(id_tipe,id_kategori,bobot_standar) values(typ,'KP01',.2),(typ,'KP02',.8);
 update master_kavling set id_tipe=typ where id_kavling=lot;
 id:=(create_or_update_spk_atomic(lot,current_date,current_date+30,office,mandor,'STANDAR',config)->>'id_spk')::uuid;
 perform pg_temp.expect_gate_error(format('select activate_spk_atomic(%L)',id),'Simpan konfigurasi');
 select jsonb_agg(jsonb_build_object('id_kategori',id_item,'bobot',bobot)) into parents from spk_work_item where id_spk=id;
 perform configure_spk_work_atomic(id,'KATEGORI',0,parents,'[]');
 perform activate_spk_atomic(id);
 if not (select is_active from spk where id_spk=id) then raise exception 'Configured Kavling activation failed'; end if;
 if has_function_privilege('anon','public.create_fasum_spk_with_wages_atomic(text,date,date,text,text,jsonb)','execute') then raise exception 'Anonymous RPC privilege'; end if;
end $$;
rollback;
select 'PASS: Fasum wage metadata and sums, mandatory configuration in both modes/types, invalidation, wage provenance, immutable active costs, input validation, RPC privilege' as result;
