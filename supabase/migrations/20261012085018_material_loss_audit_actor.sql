-- Record the actual cancellation actor, including another authorized warehouse administrator.
create or replace function public.decide_material_loss_atomic(p_id_pengajuan uuid,p_aksi text,p_catatan text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_a public.material_loss_approval%rowtype;v_spk uuid;v_item jsonb;v_s public.material_stock_spk%rowtype;v_m public.master_material%rowtype;v_recon uuid;v_action text:=upper(btrim(p_aksi));
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED';end if;
 if v_action is null or v_action not in ('SETUJUI','TOLAK','BATAL') then raise exception 'AKSI TIDAK VALID';end if;
 if v_action='BATAL' then
  if not public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE') then raise exception 'FORBIDDEN: MATERIAL_WAREHOUSE_WRITE';end if;
 elsif not public.kavio_can_action('MATERIAL_LOSS_APPROVE') or not exists(select 1 from public.user_profiles where user_id=auth.uid() and role='DIREKTUR' and status_aktif) then raise exception 'PERSETUJUAN HANYA OLEH DIREKTUR';
 end if;
 if length(coalesce(p_catatan,''))>500 or (v_action in ('TOLAK','BATAL') and nullif(btrim(p_catatan),'') is null) then raise exception 'ALASAN KEPUTUSAN WAJIB, MAKSIMAL 500 KARAKTER';end if;
 select id_spk into v_spk from public.material_loss_approval where id_pengajuan=p_id_pengajuan;
 if not found then raise exception 'PENGAJUAN TIDAK DITEMUKAN';end if;
 perform 1 from public.spk where id_spk=v_spk for update;
 select * into v_a from public.material_loss_approval where id_pengajuan=p_id_pengajuan for update;
 if v_a.status<>'DIAJUKAN' then raise exception 'PENGAJUAN SUDAH DIPROSES';end if;
 if v_action='BATAL' then
  update public.material_loss_approval set status='DIBATALKAN',diputuskan_oleh=auth.uid(),catatan_keputusan=btrim(p_catatan),diputuskan_pada=now() where id_pengajuan=p_id_pengajuan;
  return p_id_pengajuan;
 end if;
 if v_action='TOLAK' then
  update public.material_loss_approval set status='DITOLAK',catatan_keputusan=btrim(p_catatan),diputuskan_pada=now(),diputuskan_oleh=auth.uid() where id_pengajuan=p_id_pengajuan;
  return p_id_pengajuan;
 end if;
 if not exists(select 1 from public.spk where id_spk=v_spk and is_active and status_spk='AKTIF') then raise exception 'SPK SUDAH TIDAK AKTIF; BATALKAN PENGAJUAN';end if;
 for v_item in select value from jsonb_array_elements(v_a.items) order by value->>'id_material' loop
  select * into v_m from public.master_material where id_material=(v_item->>'id_material')::uuid;
  if not v_m.status_aktif or v_m.jenis_item is distinct from v_item->>'jenis_item' or v_m.satuan is distinct from v_item->>'satuan' then raise exception 'MASTER MATERIAL BERUBAH; BATALKAN DAN AJUKAN KEMBALI';end if;
  select * into v_s from public.material_stock_spk where id_spk=v_spk and id_material=v_m.id_material for update;
  if not found or v_s.jumlah<(v_item->>'jumlah')::numeric or v_s.harga_rata_rata is distinct from (v_item->>'harga_rata_rata')::numeric then raise exception 'STOK ATAU HARGA BERUBAH; BATALKAN DAN AJUKAN KEMBALI';end if;
 end loop;
 update public.material_loss_approval set status='APPLYING',diputuskan_oleh=auth.uid() where id_pengajuan=p_id_pengajuan;
 perform set_config('kavio.material_loss_apply',p_id_pengajuan::text,true);
 v_recon:=public.post_spk_material_reconciliation_atomic(v_spk,v_a.payload,v_a.keterangan);
 update public.material_spk_reconciliation set tanggal=v_a.tanggal,diajukan_oleh=v_a.diajukan_oleh where id_rekonsiliasi=v_recon;
 update public.material_transaction set tanggal=v_a.tanggal where id_rekonsiliasi=v_recon;
 update public.material_loss_approval set status='DISETUJUI',id_rekonsiliasi=v_recon,diputuskan_pada=now(),catatan_keputusan=nullif(btrim(p_catatan),'') where id_pengajuan=p_id_pengajuan;
 perform set_config('kavio.material_loss_apply','',true);
 return p_id_pengajuan;
end $$;
