begin;
select set_config('request.jwt.claim.sub','2d50291d-03e3-46a3-b3d8-c4550bc1bce7',true);
do $test$
declare prefix text:='TEST-AKAD-SPK-'||substr(gen_random_uuid()::text,1,8);lot text;typ text;bank text;notary text;office text;mandor text;category text;kind text;sale uuid;work uuid;parents jsonb;config jsonb;data jsonb;failed boolean;result jsonb;
begin
 select id_tipe into typ from public.master_tipe_rumah where status_aktif limit 1;
 select id_bank into bank from public.master_bank where status_aktif and is_kpr limit 1;
 select id_notaris into notary from public.master_notaris where status_aktif limit 1;
 select id_kantor,id_mandor into office,mandor from public.master_mandor where status_aktif limit 1;
 select id_kategori into category from public.master_kategori_pekerjaan where status_aktif limit 1;
 config:=jsonb_build_array(jsonb_build_object('id_kategori',category,'bobot_final',1));
 for kind in select unnest(array['CASH','CASH_BERTAHAP','KPR']) loop
  lot:=prefix||kind;
  insert into public.master_kavling(id_kavling,blok,no_kavling,id_tipe,status_kavling,harga_standar) values(lot,prefix,kind,typ,'AVAILABLE',100000000);
  sale:=public.save_sales_v2_atomic(jsonb_build_object('id_kavling',lot,'nama_konsumen',prefix,'status_sales','BOOKING','jenis_pembayaran',kind,'id_bank',case when kind='KPR' then bank end,'tgl_booking',current_date,'tenor_bulan',6,'pola_pelunasan','CICILAN_FLEKSIBEL'));
  data:=jsonb_build_object('id_sales',sale,'tanggal_penerimaan',current_date,'metode_penerimaan','TRANSFER','id_bank_penerimaan',bank);
  perform public.post_sales_receipt_v2_atomic(data||jsonb_build_object('jenis_penerimaan','BOOKING_FEE','nominal',1000000));
  perform public.post_sales_receipt_v2_atomic(data||jsonb_build_object('jenis_penerimaan','UANG_MUKA','nominal',99000000));
  perform public.record_sales_akad_atomic(sale,current_date,notary);
  if (select status_kavling from public.master_kavling where id_kavling=lot)<>'SOLD' then raise exception 'AKAD did not mark SOLD';end if;
  execute 'set local role authenticated';
  result:=public.create_or_update_spk_atomic(lot,current_date,current_date+30,office,mandor,'CUSTOM',config);
  work:=(result->>'id_spk')::uuid;
  if work is null or not exists(select 1 from public.spk where id_spk=work and status_spk='DRAFT') then raise exception 'SOLD lot draft failed';end if;
  if (public.create_or_update_spk_atomic(lot,current_date,current_date+31,office,mandor,'CUSTOM',config)->>'id_spk')::uuid<>work then raise exception 'Draft not reused';end if;
  failed:=false;begin perform public.activate_spk_atomic(work);exception when others then if sqlerrm like '%konfigurasi%' then failed:=true;else raise;end if;end;if not failed then raise exception 'Unconfigured sold SPK activated';end if;
  select jsonb_agg(jsonb_build_object('id_kategori',id_item,'bobot',bobot)) into parents from public.spk_work_item where id_spk=work;
  perform public.configure_spk_work_atomic(work,'KATEGORI',0,parents,'[]');
  perform public.activate_spk_atomic(work);
  if not exists(select 1 from public.spk where id_spk=work and is_active and status_spk='AKTIF') or (select status_kavling from public.master_kavling where id_kavling=lot)<>'SOLD' or (select status_sales from public.sales where id_sales=sale)<>'AKAD' then raise exception 'Activation damaged sold Sales lifecycle';end if;
  failed:=false;begin perform public.create_or_update_spk_atomic(lot,current_date,current_date+31,office,mandor,'CUSTOM',config);exception when others then if sqlerrm like '%SATU KAVLING%' then failed:=true;else raise;end if;end;if not failed then raise exception 'Duplicate SPK accepted';end if;
  perform public.insert_progress_work_item_batch_atomic(work,current_date,(select jsonb_agg(jsonb_build_object('id_item',id_item,'progress_percent',100)) from public.spk_work_item where id_spk=work));
  perform public.deactivate_spk_atomic(work);
  failed:=false;begin perform public.create_or_update_spk_atomic(lot,current_date,current_date+31,office,mandor,'CUSTOM',config);exception when others then if sqlerrm like '%SATU KAVLING%' then failed:=true;else raise;end if;end;if not failed then raise exception 'Second SPK after close accepted';end if;
  execute 'reset role';
 end loop;
end $test$;
rollback;
select 'PASS: Cash/Cash Bertahap/KPR AKAD before construction, SOLD draft creation/reuse, configuration gate, activation/progress/closure, Sales state preserved and duplicate SPK rejected' verification;
