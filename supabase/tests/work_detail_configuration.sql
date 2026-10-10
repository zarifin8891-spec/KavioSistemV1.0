-- Phase 1 regression fixtures; all writes are rolled back.
begin;
select set_config('request.jwt.claim.sub','2d50291d-03e3-46a3-b3d8-c4550bc1bce7',true);
update public.company_settings set mode_progress_default='KATEGORI' where id=true;
create function pg_temp.expect_work_error(p_sql text,p_message text) returns void language plpgsql as $$
begin
 begin execute p_sql;
 exception when others then
  if position(p_message in sqlerrm)>0 then return; end if;
  raise;
 end;
 raise exception 'TEST FAILED: expected rejection %',p_message;
end $$;
do $test$
declare typ text:='TEST_W_'||substr(gen_random_uuid()::text,1,8); categories jsonb; details jsonb; id uuid; parent1 uuid; parent2 uuid; snapshot jsonb; parents jsonb; lines jsonb; lot text; config jsonb; kavling_spk uuid; m1 text; m2 text; office text;
begin
 select id_mandor,id_kantor into m1,office from public.master_mandor where status_aktif order by id_mandor limit 1;
 select id_mandor into m2 from public.master_mandor where status_aktif and id_mandor<>m1 order by id_mandor limit 1;
 if m1 is null or m2 is null then raise exception 'Test requires two active mandors'; end if;
 insert into public.master_tipe_rumah(id_tipe,nama_tipe,luas_tanah_m2,luas_bangunan_m2,status_aktif) values(typ,'TEST WORK MASTER',72,36,true);
 categories:='[{"id_kategori":"KP01","bobot":0.4},{"id_kategori":"KP02","bobot":0.6}]';
 details:='[{"group_id":"KP01","urutan":1,"nama_pekerjaan":"Persiapan","volume":10,"satuan":"m2","bobot":0.1,"retensi":0.05},{"group_id":"KP01","urutan":2,"nama_pekerjaan":"Rangka atap","volume":30,"satuan":"m2","bobot":0.3,"retensi":0},{"group_id":"KP02","urutan":3,"nama_pekerjaan":"Tanah","volume":50,"satuan":"m3","bobot":0.6,"retensi":0.05}]';
 perform public.save_work_master_atomic(typ,10000000,categories,details,true);
 if not (select perincian_siap from public.master_tipe_rumah where id_tipe=typ) then raise exception 'FAILED publish ready'; end if;
 perform pg_temp.expect_work_error(format('select public.save_work_master_atomic(%L,10000000,%L::jsonb,%L::jsonb,true)',typ,categories,jsonb_set(details,'{2,bobot}','0.5999')),'Total bobot item');
 if (select sum(bobot) from public.master_work_detail where id_tipe=typ)<>1 or not (select perincian_siap from public.master_tipe_rumah where id_tipe=typ) then raise exception 'FAILED atomic master rollback'; end if;
 perform pg_temp.expect_work_error(format('update public.template_progress_tipe set bobot_standar=.3 where id_tipe=%L and id_kategori=''KP01''',typ),'Ubah bobot dan item bersama');
 perform public.save_work_master_atomic(typ,10000000,categories,jsonb_set(details,'{2,bobot}','0.5999'),false);
 if (select perincian_siap from public.master_tipe_rumah where id_tipe=typ) then raise exception 'FAILED draft flag'; end if;
 perform public.save_work_master_atomic(typ,10000000,categories,details,true);
 id:=public.create_fasum_spk_atomic('TEST WORK FASUM',current_date,current_date+30,office,m1,'[{"nama_pekerjaan":"Persiapan","bobot":0.4},{"nama_pekerjaan":"Tanah","bobot":0.6}]');
 select id_item into parent1 from public.spk_work_item where id_spk=id and urutan=1;
 select id_item into parent2 from public.spk_work_item where id_spk=id and urutan=2;
 parents:=jsonb_build_array(jsonb_build_object('id_kategori',parent1,'bobot',.4),jsonb_build_object('id_kategori',parent2,'bobot',.6));
 lines:=jsonb_build_array((details->0)||jsonb_build_object('group_id',parent1,'id_mandor',m1),(details->1)||jsonb_build_object('group_id',parent1,'id_mandor',m2),(details->2)||jsonb_build_object('group_id',parent2,'id_mandor',m1));
 perform public.configure_spk_work_atomic(id,'PERINCIAN',10000000,parents,lines);
 if (select count(*) from public.spk_work_detail where id_item in(parent1,parent2))<>3 then raise exception 'FAILED child snapshot'; end if;
 if (select count(distinct id_mandor) from public.spk_work_detail where id_item=parent1)<>2 then raise exception 'FAILED independent mandors'; end if;
 if (select sum(bobot*10000000) from public.spk_work_detail where id_item in(parent1,parent2))<>10000000 then raise exception 'FAILED wage weights'; end if;
 select jsonb_agg(to_jsonb(d) order by d.urutan) into snapshot from public.spk_work_detail d where id_item in(parent1,parent2);
 perform public.save_work_master_atomic(typ,12000000,categories,jsonb_set(details,'{1,nama_pekerjaan}','"Master changed"'),true);
 if snapshot is distinct from (select jsonb_agg(to_jsonb(d) order by d.urutan) from public.spk_work_detail d where id_item in(parent1,parent2)) or (select total_upah_borongan from public.spk where id_spk=id)<>10000000 then raise exception 'FAILED snapshot independent of master'; end if;
 perform pg_temp.expect_work_error(format('select public.configure_spk_work_atomic(%L,''PERINCIAN'',10000000,%L::jsonb,%L::jsonb)',id,parents,jsonb_set(lines,'{2,bobot}','0.59')),'Total bobot item');
 if snapshot is distinct from (select jsonb_agg(to_jsonb(d) order by d.urutan) from public.spk_work_detail d where id_item in(parent1,parent2)) then raise exception 'FAILED config atomic rollback'; end if;
 perform pg_temp.expect_work_error(format('select public.configure_spk_work_atomic(%L,''PERINCIAN'',10000000,%L::jsonb,%L::jsonb)',id,parents,jsonb_set(lines,'{0,group_id}',to_jsonb(gen_random_uuid()::text))),'Item bukan milik SPK');
 perform pg_temp.expect_work_error(format('select public.activate_spk_atomic(%L)',id),'Aktivasi menunggu');
 perform public.configure_spk_work_atomic(id,'KATEGORI',10000000,parents,'[]');
 perform public.activate_spk_atomic(id);
 if not (select is_active from public.spk where id_spk=id) then raise exception 'FAILED legacy category activation'; end if;
 perform pg_temp.expect_work_error(format('update public.spk set total_upah_borongan=1 where id_spk=%L',id),'Konfigurasi SPK berjalan');
 perform pg_temp.expect_work_error(format('update public.spk_work_item set bobot=.5 where id_item=%L',parent1),'Rincian dan bobot SPK');
 perform pg_temp.expect_work_error(format('select public.configure_spk_work_atomic(%L,''KATEGORI'',10000000,%L::jsonb,''[]'')',id,parents),'Konfigurasi hanya');
 -- Existing Kavling engine remains draft until explicit activation; total wage is copied at creation.
 select k.id_kavling into lot from public.master_kavling k where status_kavling='AVAILABLE' and status_aktif and not exists(select 1 from public.spk s where s.id_kavling=k.id_kavling) and not exists(select 1 from public.sales s where s.id_kavling=k.id_kavling and s.status_aktif) order by k.id_kavling limit 1;
 if lot is null then raise exception 'Test needs an available unsold lot'; end if;
 update public.master_kavling set id_tipe=typ where id_kavling=lot;
 config:='[{"id_kategori":"KP01","bobot_final":0.4},{"id_kategori":"KP02","bobot_final":0.6}]';
 kavling_spk:=(public.create_or_update_spk_atomic(lot,current_date,current_date+30,office,m1,'STANDAR',config)->>'id_spk')::uuid;
 perform public.create_or_update_spk_atomic(lot,current_date,current_date+40,office,m1,'STANDAR',config);
 if (select status_spk from public.spk where id_spk=kavling_spk)<>'DRAFT' or (select total_upah_borongan from public.spk where id_spk=kavling_spk)<>12000000 then raise exception 'FAILED Kavling draft / master wage snapshot'; end if;
 perform public.activate_spk_atomic(kavling_spk);
 if not (select is_active from public.spk where id_spk=kavling_spk) then raise exception 'FAILED Kavling activation'; end if;
 update public.company_settings c set mode_progress_default='PERINCIAN' where c.id=true;
 id:=public.create_fasum_spk_atomic('TEST DEFAULT MODE',current_date,current_date+30,office,m1,'[{"nama_pekerjaan":"Jalan","bobot":1}]');
 if (select mode_progress from public.spk where id_spk=id)<>'PERINCIAN' or (select mode_progress from public.spk where id_spk=kavling_spk)<>'KATEGORI' then raise exception 'FAILED default only affects new SPK'; end if;
 if has_function_privilege('anon','public.save_work_master_atomic(text,numeric,jsonb,jsonb,boolean)','execute') or has_function_privilege('anon','public.configure_spk_work_atomic(uuid,text,numeric,jsonb,jsonb)','execute') or has_table_privilege('authenticated','public.spk_work_detail','insert') then raise exception 'FAILED privileges'; end if;
end $test$;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.master_work_detail) or exists(select 1 from public.spk_work_detail) then raise exception 'FAILED RLS for missing identity'; end if;
end $$;
rollback;
select 'PASS: publication, exact weights, draft, atomic rollback, snapshots, mandates, Kavling/Fasum compatibility, immutability, privileges' as work_detail_tests;
