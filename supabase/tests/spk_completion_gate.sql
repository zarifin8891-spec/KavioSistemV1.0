begin;
select set_config('request.jwt.claim.sub','2d50291d-03e3-46a3-b3d8-c4550bc1bce7',true);
do $test$
declare office text;mandor text;work uuid;parents jsonb;first_item uuid;last_item uuid;failed boolean;
begin
 select id_kantor,id_mandor into office,mandor from public.master_mandor where status_aktif limit 1;
 work:=public.create_fasum_spk_atomic('TEST CLOSE '||gen_random_uuid()::text,current_date-2,current_date+30,office,mandor,'[{"nama_pekerjaan":"Minor","bobot":0.0001},{"nama_pekerjaan":"Major","bobot":0.9999}]');
 select jsonb_agg(jsonb_build_object('id_kategori',id_item,'bobot',bobot)) into parents from public.spk_work_item where id_spk=work;
 perform public.configure_spk_work_atomic(work,'KATEGORI',0,parents,'[]');perform public.activate_spk_atomic(work);
 select id_item into first_item from public.spk_work_item where id_spk=work and nama_pekerjaan='Minor';
 select id_item into last_item from public.spk_work_item where id_spk=work and nama_pekerjaan='Major';
 execute 'set local role authenticated';
 failed:=false;begin perform public.deactivate_spk_atomic(work);exception when others then if sqlerrm='Progress belum 100%' then failed:=true;else raise;end if;end;if not failed then raise exception 'Zero progress closed';end if;
 perform public.insert_progress_work_item_batch_atomic(work,current_date-1,jsonb_build_array(jsonb_build_object('id_item',first_item,'progress_percent',99.99),jsonb_build_object('id_item',last_item,'progress_percent',100)));
 failed:=false;begin perform public.deactivate_spk_atomic(work);exception when others then if sqlerrm='Progress belum 100%' then failed:=true;else raise;end if;end;if not failed then raise exception 'Rounded total hid incomplete item';end if;
 if not exists(select 1 from public.spk where id_spk=work and status_spk='AKTIF' and is_active) then raise exception 'Rejected close mutated SPK';end if;
 perform public.insert_progress_work_item_batch_atomic(work,current_date,jsonb_build_array(jsonb_build_object('id_item',first_item,'progress_percent',0.01)));
 perform public.deactivate_spk_atomic(work);
 if not exists(select 1 from public.spk where id_spk=work and status_spk='SELESAI' and not is_active) then raise exception '100%% close failed';end if;
 execute 'reset role';
end $test$;
rollback;
select 'PASS: 0% and near-100% incomplete work blocked with exact message, rollback state preserved, 100% completes' verification;
