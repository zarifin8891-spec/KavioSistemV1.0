-- Reuse existing authorized engines, while committing a selection atomically.
create function public.process_sales_guarantee_batch_atomic(p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_items jsonb:=p_data->'items';v_mode text:=p_data->>'mode';v_bank text:=p_data->>'id_bank_kpr';
 v_item jsonb;v_id uuid;v_receipt uuid;v_sale uuid;v_amount numeric;v_count integer:=0;v_receipts jsonb:='[]'::jsonb;
begin
 if auth.uid() is null or not public.kavio_can_action('PAYMENT_RECEIPT_WRITE') then raise exception 'FORBIDDEN: PAYMENT_RECEIPT_WRITE';end if;
 if v_mode is null or v_mode not in ('PENGAJUAN','PENCAIRAN') or v_bank is null or btrim(v_bank)='' then raise exception 'Pilih proses dan bank KPR';end if;
 if v_items is null or jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items)=0 then raise exception 'Pilih minimal satu item dana jaminan';end if;
 if exists(select 1 from jsonb_array_elements(v_items)i where nullif(i->>'id_jaminan','') is null) then raise exception 'Item dana jaminan wajib diisi';end if;
 if (select count(*) from jsonb_array_elements(v_items))<>(select count(distinct i->>'id_jaminan') from jsonb_array_elements(v_items)i) then raise exception 'Item dana jaminan tidak boleh berulang';end if;
 if (p_data->>'tanggal')::date is null then raise exception 'Tanggal wajib diisi';end if;
 -- Lock parent Sales first, in consistent order, matching existing receipt engines.
 perform 1 from public.sales s where exists(select 1 from public.sales_bank_guarantee_item g
 join jsonb_array_elements(v_items)i on g.id_jaminan=(i->>'id_jaminan')::uuid where g.id_sales=s.id_sales)
 order by s.id_sales for update;
 if (select count(*) from public.sales_bank_guarantee_item g join public.sales s on s.id_sales=g.id_sales
 join jsonb_array_elements(v_items)i on g.id_jaminan=(i->>'id_jaminan')::uuid
 where s.id_bank=v_bank and s.status_aktif and s.status_sales='AKAD' and s.jenis_pembayaran='KPR')<>jsonb_array_length(v_items)
 then raise exception 'Semua item harus berasal dari Sales KPR AKAD pada bank yang dipilih';end if;
 for v_item in select value from jsonb_array_elements(v_items) order by value->>'id_jaminan' loop
  v_id:=(v_item->>'id_jaminan')::uuid;
  if v_mode='PENGAJUAN' then
   perform public.submit_sales_bank_guarantee_claim_atomic(v_id,(p_data->>'tanggal')::date,p_data->>'keterangan');
  else
   v_amount:=(v_item->>'nominal')::numeric;
   if v_amount is null or v_amount<=0 or v_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Nominal setiap item harus positif dan valid';end if;
   select id_sales into v_sale from public.sales_bank_guarantee_item where id_jaminan=v_id;
   select id_penerimaan into v_receipt from public.post_sales_receipt_v2_atomic(jsonb_build_object(
    'id_sales',v_sale,'id_jaminan',v_id,'jenis_penerimaan','PENCAIRAN_DANA_JAMINAN',
    'tanggal_penerimaan',p_data->>'tanggal','nominal',v_amount,'id_bank_penerimaan',p_data->>'id_bank_penerimaan',
    'metode_penerimaan',p_data->>'metode_penerimaan','no_referensi',p_data->>'no_referensi','keterangan',p_data->>'keterangan'));
   v_receipts:=v_receipts||jsonb_build_array(v_receipt);
  end if;
  v_count:=v_count+1;
 end loop;
 return jsonb_build_object('jumlah_item',v_count,'id_penerimaan',v_receipts);
end;$$;
revoke all on function public.process_sales_guarantee_batch_atomic(jsonb) from public,anon;
grant execute on function public.process_sales_guarantee_batch_atomic(jsonb) to authenticated,service_role;
