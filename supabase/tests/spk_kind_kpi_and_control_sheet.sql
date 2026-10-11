begin;
select set_config('request.jwt.claim.sub','2d50291d-03e3-46a3-b3d8-c4550bc1bce7',true);
update company_settings set mode_progress_default='KATEGORI' where id=true;
do $$ declare id uuid; office text; mandor text; parents jsonb; entries jsonb;
begin
 select id_kantor,id_mandor into office,mandor from master_mandor where status_aktif order by id_mandor limit 1;
 id:=create_fasum_spk_atomic('TEST MONITORING',current_date-10,current_date+10,office,mandor,'[{"nama_pekerjaan":"Jalan","bobot":0.2},{"nama_pekerjaan":"Drainase","bobot":0.8}]');
 select jsonb_agg(jsonb_build_object('id_kategori',id_item,'bobot',bobot)) into parents from spk_work_item where id_spk=id;
 perform configure_spk_work_atomic(id,'KATEGORI',0,parents,'[]');perform activate_spk_atomic(id);
 select jsonb_agg(jsonb_build_object('id_item',id_item,'progress_percent',case urutan when 1 then 50 else 75 end)) into entries from spk_work_item where id_spk=id;
 perform insert_progress_work_item_batch_atomic(id,current_date-1,entries);
 if (select progress_aktual from v_decision_engine where id_spk=id)<>.7 then raise exception 'Fasum actual does not match weighted work items'; end if;
 select jsonb_agg(jsonb_build_object('id_item',id_item,'progress_percent',case urutan when 1 then 10 else 5 end)) into entries from spk_work_item where id_spk=id;
 perform insert_progress_work_item_batch_atomic(id,current_date,entries);
 if (select progress_aktual from v_decision_engine where id_spk=id)<>.76 or (select progress_periode_terakhir from v_decision_engine where id_spk=id)<>.06 or (select tanggal_update_terakhir from v_decision_engine where id_spk=id)<>current_date then raise exception 'Latest weighted period/date incorrect'; end if;
 if (select progress_seharusnya from v_decision_engine where id_spk=id)<>.5 or (select gap_progress from v_decision_engine where id_spk=id)<>.26 then raise exception 'Shared schedule/gap incorrect'; end if;
 if (select progress_aktual from kavio_spk_curve_history(id::text) order by tanggal_update desc limit 1)<>.76 or (select progress_aktual from kavio_spk_curve_history(id::text) order by tanggal_update limit 1)<>.7 then raise exception 'Fasum curve must use shared item contributions'; end if;
 if exists(select 1 from v_progress_summary s where s.progress_total is distinct from (select round(coalesce(sum(v.progress_berbobot),0),6) from v_spk_work_item_progress_current v where v.id_spk=s.id_spk)) then raise exception 'Summary mismatch across object types'; end if;
 if not exists(select 1 from pg_class where oid='v_decision_engine'::regclass and 'security_invoker=true'=any(reloptions)) then raise exception 'View must preserve RLS'; end if;
end $$;
do $$ begin
 if exists(select 1 from kavio_spk_kpi_by_kind() k where k.total_spk<>(select count(*) from spk s where s.jenis_spk=k.jenis_spk) or k.aktif<>(select count(*) from spk s where s.jenis_spk=k.jenis_spk and is_active) or k.draft<>(select count(*) from spk s where s.jenis_spk=k.jenis_spk and status_spk='DRAFT') or k.selesai<>(select count(*) from spk s where s.jenis_spk=k.jenis_spk and status_spk='SELESAI')) then raise exception 'KPI kind counts inconsistent'; end if;
 if (select sum(total_spk) from kavio_spk_kpi_by_kind())<>(select total_spk from kavio_spk_kpi()) then raise exception 'Total mismatch'; end if;
 if exists(select 1 from spk s where exists(select 1 from progress_update p where p.id_spk=s.id_spk) and (select progress_aktual from kavio_spk_curve_history(s.id_spk::text) order by tanggal_update desc limit 1) is distinct from (select sum(progress_berbobot) from v_spk_work_item_progress_current v where v.id_spk=s.id_spk)) then raise exception 'Curve/source mismatch'; end if;
 if has_function_privilege('anon','kavio_spk_kpi_by_kind()','execute') or has_function_privilege('anon','kavio_spk_curve_history(text)','execute') then raise exception 'Anonymous access'; end if;
end $$;
rollback;
select 'PASS: shared Fasum curve, all-kind KPI counts and totals, all-SPK curve/source consistency, anonymous access revoked' as result;
