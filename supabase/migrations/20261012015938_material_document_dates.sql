-- Business dates are separate from posting time and valuation order.
create or replace function public.post_material_document_dated_atomic(p_kind text,p_tanggal date,p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_use uuid;v_spk uuid;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED';end if;
 if p_tanggal is null or p_tanggal>(now() at time zone 'Asia/Jakarta')::date then raise exception 'TANGGAL WAJIB VALID DAN TIDAK BOLEH DI MASA DEPAN';end if;
 case p_kind
 when 'REQUEST' then
  v_id:=public.create_material_request_atomic((p_data->>'p_id_spk')::uuid,p_data->>'p_sumber_laporan',p_data->'p_items',p_data->>'p_keterangan');
  update public.material_request set tanggal=p_tanggal where id_permintaan=v_id;
 when 'ISSUE' then
  v_id:=public.post_material_issue_to_spk_atomic((p_data->>'p_id_permintaan')::uuid,(p_data->>'p_id_lokasi')::uuid,p_data->'p_items',p_data->>'p_keterangan');
  update public.material_transaction set tanggal=p_tanggal where id_transaksi=v_id;
  if coalesce((p_data->>'p_langsung_pakai')::boolean,true) then
   select id_spk into v_spk from public.material_request where id_permintaan=(p_data->>'p_id_permintaan')::uuid;
   v_use:=public.post_spk_material_usage_atomic(v_spk,p_data->'p_items',p_data->>'p_keterangan');
   update public.material_transaction set tanggal=p_tanggal where id_transaksi=v_use;
  end if;
 when 'DIRECT' then
  v_id:=public.post_material_direct_usage_atomic((p_data->>'p_id_spk')::uuid,(p_data->>'p_id_lokasi')::uuid,p_data->'p_items',p_data->>'p_keterangan');
  update public.material_transaction set tanggal=p_tanggal where id_transaksi=v_id;
 when 'SPK' then
  v_id:=public.post_spk_material_usage_atomic((p_data->>'p_id_spk')::uuid,p_data->'p_items',p_data->>'p_keterangan');
  update public.material_transaction set tanggal=p_tanggal where id_transaksi=v_id;
 when 'RECONCILE' then
  v_id:=public.post_spk_material_reconciliation_atomic((p_data->>'p_id_spk')::uuid,p_data->'p_items',p_data->>'p_keterangan');
  update public.material_spk_reconciliation set tanggal=p_tanggal where id_rekonsiliasi=v_id;
  update public.material_transaction set tanggal=p_tanggal where id_rekonsiliasi=v_id;
 else raise exception 'JENIS TRANSAKSI TIDAK VALID';
 end case;
 return v_id;
end $$;
revoke all on function public.post_material_document_dated_atomic(text,date,jsonb) from public,anon;
grant execute on function public.post_material_document_dated_atomic(text,date,jsonb) to authenticated,service_role;
