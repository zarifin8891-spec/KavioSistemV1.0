create or replace function public.post_material_purchase_v2_atomic(p_data jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v_tx uuid; v_spk uuid; v_supplier text; v_item jsonb; v_m public.master_material%rowtype; v_qty numeric; v_cost numeric; v_date date;
begin
 if auth.uid() is null or not public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE') then raise exception 'AKSES GUDANG DITOLAK'; end if;
 -- Business date is editable; posting/valuation still follows created_at.
 if p_data ? 'tanggal' then
  if coalesce(p_data->>'tanggal','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'TANGGAL PEMBELIAN TIDAK VALID'; end if;
  begin v_date:=(p_data->>'tanggal')::date; exception when others then raise exception 'TANGGAL PEMBELIAN TIDAK VALID'; end;
 else v_date:=(now() at time zone 'Asia/Jakarta')::date; end if;
 if v_date>(now() at time zone 'Asia/Jakarta')::date then raise exception 'TANGGAL PEMBELIAN TIDAK BOLEH DI MASA DEPAN'; end if;
 select nama_pemasok into v_supplier from public.master_pemasok where id_pemasok=(p_data->>'id_pemasok')::uuid and status_aktif;
 if v_supplier is null or nullif(btrim(p_data->>'no_nota'),'') is null then raise exception 'PEMASOK AKTIF DAN NOMOR NOTA WAJIB DIISI'; end if;
 if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items')=0 then raise exception 'ITEM PEMBELIAN WAJIB DIISI'; end if;
 for v_item in select value from jsonb_array_elements(p_data->'items') loop
  v_qty:=(v_item->>'jumlah')::numeric; v_cost:=(v_item->>'harga_satuan')::numeric;
  if v_qty is null or v_qty<=0 or v_cost is null or v_cost<0 or v_qty::text in ('NaN','Infinity') or v_cost::text in ('NaN','Infinity') then raise exception 'JUMLAH ATAU HARGA TIDAK VALID'; end if;
 end loop;
 if p_data->>'tujuan'='GUDANG' then
  v_tx:=public.post_material_receipt_atomic((p_data->>'id_lokasi')::uuid,p_data->'items',false,v_supplier,p_data->>'no_nota',p_data->>'keterangan');
  update public.material_transaction set tanggal=v_date where id_transaksi=v_tx;
  return v_tx;
 end if;
 if p_data->>'tujuan' is distinct from 'SPK' then raise exception 'TUJUAN PEMBELIAN TIDAK VALID'; end if;
 v_spk:=(p_data->>'id_spk')::uuid;
 perform 1 from public.spk where id_spk=v_spk and is_active and status_spk='AKTIF' for update;
 if not found then raise exception 'SPK AKTIF TIDAK DITEMUKAN'; end if;
 if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items')=0 then raise exception 'ITEM PEMBELIAN WAJIB DIISI'; end if;
 if (select count(*)<>count(distinct value->>'id_material') from jsonb_array_elements(p_data->'items')) then raise exception 'MATERIAL DUPLIKAT'; end if;
 for v_item in select value from jsonb_array_elements(p_data->'items') order by value->>'id_material' loop
  select * into v_m from public.master_material where id_material=(v_item->>'id_material')::uuid and status_aktif and jenis_item<>'UPAH';
  v_qty:=(v_item->>'jumlah')::numeric; v_cost:=(v_item->>'harga_satuan')::numeric;
  if not found or v_qty is null or v_qty<=0 or v_cost is null or v_cost<0 or v_qty::text in ('NaN','Infinity') or v_cost::text in ('NaN','Infinity') then raise exception 'ITEM, JUMLAH ATAU HARGA TIDAK VALID'; end if;
 end loop;
 insert into public.material_transaction(no_transaksi,jenis_transaksi,id_spk,nama_pemasok,id_pemasok,no_nota,keterangan)
 values('MT-'||to_char(now() at time zone 'Asia/Jakarta','YYYYMMDD')||'-'||lpad(nextval('public.material_transaction_no_seq')::text,6,'0'),'PENERIMAAN_SPK',v_spk,v_supplier,(p_data->>'id_pemasok')::uuid,p_data->>'no_nota',p_data->>'keterangan') returning id_transaksi into v_tx;
 for v_item in select value from jsonb_array_elements(p_data->'items') order by value->>'id_material' loop
  select * into v_m from public.master_material where id_material=(v_item->>'id_material')::uuid;
  v_qty:=(v_item->>'jumlah')::numeric; v_cost:=(v_item->>'harga_satuan')::numeric;
  insert into public.material_stock_spk(id_spk,id_material,jumlah,harga_rata_rata) values(v_spk,v_m.id_material,v_qty,v_cost)
  on conflict(id_spk,id_material) do update set harga_rata_rata=(material_stock_spk.jumlah*material_stock_spk.harga_rata_rata+excluded.jumlah*excluded.harga_rata_rata)/(material_stock_spk.jumlah+excluded.jumlah),jumlah=material_stock_spk.jumlah+excluded.jumlah,updated_at=now();
  insert into public.material_transaction_item(id_transaksi,id_material,jumlah,harga_satuan,biaya_dibebankan) values(v_tx,v_m.id_material,v_qty,v_cost,case when v_m.jenis_item='ALAT_PAKAI_ULANG' then v_qty*v_cost else 0 end);
 end loop;
 update public.material_transaction set tanggal=v_date where id_transaksi=v_tx;
 return v_tx;
end $$;
revoke all on function public.post_material_purchase_v2_atomic(jsonb) from public,anon;
grant execute on function public.post_material_purchase_v2_atomic(jsonb) to authenticated;

comment on column public.material_transaction.tanggal is 'Tanggal bisnis; pembelian mengikuti tanggal barang datang yang diisi. created_at menyimpan urutan posting dan perhitungan harga rata-rata.';
