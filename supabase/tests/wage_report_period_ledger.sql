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
 if (kavio_wage_report(current_date-1,current_date-1,id,null)->'totals'->>'upah_bruto')::numeric<>7400000 or (kavio_wage_report(current_date-1,current_date-1,id,null)->'totals'->>'upah_retensi')::numeric<>250000 or (kavio_wage_report(current_date-1,current_date-1,id,null)->'totals'->>'upah_netto')::numeric<>7150000 then raise exception 'Period report includes earlier progress or recalculates wages'; end if;
 if (kavio_wage_report(current_date-2,current_date-2,id,null)->'totals'->>'upah_bruto')::numeric<>2600000 then raise exception 'Inclusive single-day period mismatch'; end if;
 if (kavio_wage_report(current_date-1,current_date-1,id,m2)->'totals'->>'upah_netto')::numeric<>2400000 or (kavio_wage_report(current_date-1,current_date-1,id,m2)->'totals'->>'upah_retensi')::numeric<>0 then raise exception 'Mandor/exempt retention mismatch'; end if;
 if jsonb_array_length(kavio_wage_report(current_date-1,current_date-1,id,m1)->'rows')<>2 then raise exception 'Mandor filter'; end if;
 if jsonb_array_length(kavio_wage_report(current_date,current_date,id,null)->'rows')<>0 then raise exception 'Empty period';end if;
 if jsonb_array_length(kavio_wage_report(current_date-2,current_date,gen_random_uuid(),null)->'rows')<>0 then raise exception 'SPK filter';end if;
 perform pg_temp.expect_detail_error(format('select kavio_wage_report(%L,%L)',current_date,current_date-1),'Periode');
 if has_function_privilege('anon','kavio_wage_report(date,date,uuid,text)','execute') then raise exception 'Anonymous wage report';end if;
end $test$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
do $$ begin if jsonb_array_length(kavio_wage_report(current_date-30,current_date,null,null)->'rows')<>0 then raise exception 'Inactive user must not read wages';end if;end $$;
rollback;
select 'PASS: period ledger amounts, retention/exemption, mandor and SPK filters, empty/inclusive dates, inactive RLS and anonymous access' as result;
