-- Rounding regression: all fixtures roll back.
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
declare typ text:='TEST_R_'||substr(gen_random_uuid()::text,1,8); categories jsonb; details jsonb; id uuid; parent1 uuid; parent2 uuid; parents jsonb; lines jsonb; m1 text; m2 text; office text;
begin
 select id_mandor,id_kantor into m1,office from public.master_mandor where status_aktif order by id_mandor limit 1;
 select id_mandor into m2 from public.master_mandor where status_aktif and id_mandor<>m1 order by id_mandor limit 1;
 insert into public.master_tipe_rumah(id_tipe,nama_tipe,luas_tanah_m2,luas_bangunan_m2,status_aktif) values(typ,'TEST ROUND',72,36,true);
 categories:='[{"id_kategori":"KP01","bobot":0.4},{"id_kategori":"KP02","bobot":0.599964}]';
 details:='[{"group_id":"KP01","urutan":1,"nama_pekerjaan":"Persiapan","volume":10,"satuan":"m2","bobot":0.1,"retensi":0.05},{"group_id":"KP01","urutan":2,"nama_pekerjaan":"Rangka atap","volume":30,"satuan":"m2","bobot":0.3,"retensi":0},{"group_id":"KP02","urutan":3,"nama_pekerjaan":"Tanah","volume":50,"satuan":"m3","bobot":0.599964,"retensi":0.05}]';
 perform public.save_work_master_atomic(typ,10000000,categories,details,true);
 if not (select perincian_siap from public.master_tipe_rumah where id_tipe=typ) or (select sum(bobot) from public.master_work_detail where id_tipe=typ)<>.999964 then raise exception 'FAILED rounded publication / preserved source'; end if;
 perform pg_temp.expect_work_error(format('select public.save_work_master_atomic(%L,10000000,%L::jsonb,%L::jsonb,true)',typ,jsonb_set(categories,'{1,bobot}','0.599949'),jsonb_set(details,'{2,bobot}','0.599949')),'Total bobot kategori');
 perform pg_temp.expect_work_error(format('select public.save_work_master_atomic(%L,10000000,%L::jsonb,%L::jsonb,true)',typ,categories,jsonb_set(details,'{2,bobot}','0.599963')),'Total bobot item');
 id:=public.create_fasum_spk_atomic('TEST WORK FASUM',current_date,current_date+30,office,m1,'[{"nama_pekerjaan":"Persiapan","bobot":0.4},{"nama_pekerjaan":"Tanah","bobot":0.599964}]');
 select id_item into parent1 from public.spk_work_item where id_spk=id and urutan=1;
 select id_item into parent2 from public.spk_work_item where id_spk=id and urutan=2;
 parents:=jsonb_build_array(jsonb_build_object('id_kategori',parent1,'bobot',.4),jsonb_build_object('id_kategori',parent2,'bobot',.599964));
 lines:=jsonb_build_array((details->0)||jsonb_build_object('group_id',parent1,'id_mandor',m1),(details->1)||jsonb_build_object('group_id',parent1,'id_mandor',m2),(details->2)||jsonb_build_object('group_id',parent2,'id_mandor',m1));
 perform public.configure_spk_work_atomic(id,'PERINCIAN',10000000,parents,lines);
 if (select count(*) from public.spk_work_detail where id_item in(parent1,parent2))<>3 then raise exception 'FAILED child snapshot'; end if;
 if (select count(distinct id_mandor) from public.spk_work_detail where id_item=parent1)<>2 then raise exception 'FAILED independent mandors'; end if;

 perform public.configure_spk_work_atomic(id,'KATEGORI',10000000,parents,'[]');
 perform public.activate_spk_atomic(id);
 if not (select is_active from public.spk where id_spk=id) then raise exception 'FAILED rounded activation'; end if;
end $test$;
rollback;
select 'PASS: rounded publication, preserve source, reject 99.99%, exact category/item equality, SPK snapshot and activation' as result;
