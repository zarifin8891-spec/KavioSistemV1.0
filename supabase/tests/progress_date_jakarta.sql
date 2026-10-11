begin;
select set_config('request.jwt.claim.sub','2d50291d-03e3-46a3-b3d8-c4550bc1bce7',true);
update public.company_settings set mode_progress_default='KATEGORI' where id=true;
do $test$
declare id uuid; item uuid; office text; mandor text; project_today date:=(now() at time zone 'Asia/Jakarta')::date;
begin
 if (timestamptz '2026-10-10 18:00:00+00' at time zone 'Asia/Jakarta')::date<>date '2026-10-11' then raise exception 'FAILED Jakarta date boundary'; end if;
 select id_mandor,id_kantor into mandor,office from public.master_mandor where status_aktif order by id_mandor limit 1;
 id:=public.create_fasum_spk_atomic('TEST DATE',project_today-7,project_today+30,office,mandor,'[{"nama_pekerjaan":"Jalan","bobot":1}]');
 select id_item into item from public.spk_work_item where id_spk=id;
 perform public.activate_spk_atomic(id);
 perform public.insert_progress_work_item_batch_atomic(id,project_today,jsonb_build_array(jsonb_build_object('id_item',item,'progress_percent',10)));
 if (select progress_akumulasi from public.v_spk_work_item_progress_current where id_item=item)<>.1 then raise exception 'FAILED category progress today'; end if;
 begin
  perform public.insert_progress_work_item_batch_atomic(id,project_today+1,jsonb_build_array(jsonb_build_object('id_item',item,'progress_percent',10)));
  raise exception 'FAILED future date rejection';
 exception when others then if position('MASA DEPAN' in sqlerrm)=0 then raise; end if;
 end;
 if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname in ('insert_progress_work_item_batch_atomic','insert_progress_update_atomic','insert_progress_batch_atomic') and pg_get_functiondef(oid) !~ 'Asia/Jakarta') then raise exception 'FAILED shared timezone guard'; end if;
end $test$;
rollback;
select 'PASS: Jakarta rollover, legacy category RPC save today, future-date rejection and shared timezone guards' as result;
