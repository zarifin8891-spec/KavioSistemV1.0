-- Match the accepted two-decimal configuration total while requiring complete work items.
CREATE OR REPLACE FUNCTION public.deactivate_spk_atomic(p_id_spk uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_spk public.spk%rowtype;
  v_progress_total numeric;
  v_next_status text;
  v_item_sisa integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SPK_WRITE') then raise exception 'FORBIDDEN: SPK_WRITE'; end if;
  select * into v_spk from public.spk where id_spk = p_id_spk for update;
  if not found or not v_spk.is_active or v_spk.status_spk <> 'AKTIF' then raise exception 'HANYA SPK AKTIF YANG DAPAT DITANDAI SELESAI'; end if;

  select coalesce(sum(progress_berbobot), 0) into v_progress_total
  from public.v_spk_work_item_progress_current where id_spk = p_id_spk;
  if round(v_progress_total * 100,2) < 100 or (v_spk.mode_progress='PERINCIAN' and exists(select 1 from public.v_spk_work_detail_progress_current where id_spk=p_id_spk and progress_akumulasi<1)) or (v_spk.mode_progress<>'PERINCIAN' and exists(select 1 from public.v_spk_work_item_progress_current where id_spk=p_id_spk and bobot_final>0 and progress_akumulasi<1)) then raise exception 'Progress belum 100%%'; end if;

  select count(*) filter (where jumlah > 0.000001)::integer into v_item_sisa
  from public.material_stock_spk where id_spk = p_id_spk;
  if coalesce(v_item_sisa, 0) > 0 then
    raise exception 'MASIH ADA % ITEM SISA MATERIAL PADA SPK. LAKUKAN REKONSILIASI PER ITEM SEBELUM MENUTUP SPK', v_item_sisa;
  end if;

  update public.spk set status_spk = 'SELESAI', is_active = false
  where id_spk = p_id_spk and is_active = true and status_spk = 'AKTIF';
  if not found then raise exception 'SPK BERUBAH SEBELUM DISELESAIKAN. SILAKAN COBA LAGI'; end if;
  if v_spk.jenis_spk = 'FASUM' then return 'SELESAI'; end if;
  v_next_status := public.kavio_sync_kavling_status(v_spk.id_kavling);
  return coalesce(v_next_status, 'READY_STOCK');
end;
$function$
;
