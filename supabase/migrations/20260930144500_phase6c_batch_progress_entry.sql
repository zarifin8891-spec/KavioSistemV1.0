-- Phase 6C UX: atomic batch progress entry.
create or replace function public.insert_progress_batch_atomic(
  p_id_spk uuid,
  p_tanggal_update date,
  p_entries jsonb
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_spk public.spk%rowtype;
  v_total_bobot numeric;
  v_count_bobot integer;
  v_item jsonb;
  v_kategori text;
  v_percent numeric;
  v_current numeric;
  v_inserted integer := 0;
  v_entry_count integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('PROGRESS_WRITE') then raise exception 'FORBIDDEN: PROGRESS_WRITE'; end if;
  if p_id_spk is null or p_tanggal_update is null then raise exception 'SPK DAN TANGGAL UPDATE WAJIB DIISI'; end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then raise exception 'DATA PROGRESS BATCH TIDAK VALID'; end if;

  v_entry_count := jsonb_array_length(p_entries);
  if v_entry_count = 0 then raise exception 'ISI MINIMAL SATU PROGRESS KATEGORI'; end if;

  if (
    select count(*) <> count(distinct nullif(btrim(value->>'id_kategori'),''))
    from jsonb_array_elements(p_entries)
  ) then
    raise exception 'KATEGORI PROGRESS TIDAK BOLEH DUPLIKAT DALAM SATU BATCH';
  end if;

  select * into v_spk from public.spk where id_spk=p_id_spk for update;
  if not found or not v_spk.is_active or v_spk.status_spk <> 'AKTIF' then raise exception 'SPK TIDAK AKTIF ATAU TIDAK DITEMUKAN'; end if;
  if p_tanggal_update < v_spk.tgl_spk then raise exception 'TANGGAL UPDATE TIDAK BOLEH SEBELUM TANGGAL SPK'; end if;
  if p_tanggal_update > current_date then raise exception 'TANGGAL UPDATE TIDAK BOLEH DI MASA DEPAN'; end if;

  select count(*),coalesce(sum(bobot_final),0)
    into v_count_bobot,v_total_bobot
  from public.spk_progress_config
  where id_spk=p_id_spk;

  if v_count_bobot=0 or abs(v_total_bobot-1)>0.00001 then
    raise exception 'KONFIGURASI BOBOT SPK TIDAK VALID. TOTAL SAAT INI %%%',round(v_total_bobot*100,2);
  end if;

  -- Acquire category locks in deterministic order to prevent concurrent overrun.
  for v_item in
    select value from jsonb_array_elements(p_entries)
    order by value->>'id_kategori'
  loop
    v_kategori := nullif(btrim(coalesce(v_item->>'id_kategori','')),'');
    begin
      v_percent := (v_item->>'progress_percent')::numeric;
    exception when others then
      raise exception 'PROGRESS PERIODE TIDAK VALID';
    end;

    if v_kategori is null or v_percent is null or v_percent <= 0 or v_percent > 100 then
      raise exception 'PROGRESS PERIODE HARUS LEBIH DARI 0 DAN MAKSIMAL 100%%';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_id_spk::text || ':' || v_kategori,0));

    if not exists (
      select 1 from public.spk_progress_config
      where id_spk=p_id_spk and id_kategori=v_kategori
    ) then
      raise exception 'KATEGORI % TIDAK TERDAFTAR PADA KONFIGURASI SPK',v_kategori;
    end if;

    if exists (
      select 1 from public.progress_update
      where id_spk=p_id_spk and id_kategori=v_kategori and tanggal_update=p_tanggal_update
    ) then
      raise exception 'PROGRESS KATEGORI % UNTUK TANGGAL TERSEBUT SUDAH ADA',v_kategori;
    end if;

    select coalesce(sum(progress_periode),0)
      into v_current
    from public.progress_update
    where id_spk=p_id_spk and id_kategori=v_kategori;

    if v_current >= 0.999999 then
      raise exception 'KATEGORI % SUDAH MENCAPAI 100%%',v_kategori;
    end if;

    if v_current + (v_percent/100.0) > 1.000001 then
      raise exception 'PROGRESS KATEGORI % MELEBIHI 100%%. SAAT INI %%%, MAKSIMAL TAMBAHAN %%%',
        v_kategori,round(v_current*100,2),round((1-v_current)*100,2);
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_entries)
  loop
    v_kategori := btrim(v_item->>'id_kategori');
    v_percent := (v_item->>'progress_percent')::numeric;

    insert into public.progress_update(
      id_spk,tanggal_update,id_kategori,progress_periode,keterangan,input_by
    ) values (
      p_id_spk,
      p_tanggal_update,
      v_kategori,
      v_percent/100.0,
      nullif(btrim(coalesce(v_item->>'keterangan','')),''),
      auth.uid()
    );
    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$function$;

revoke all on function public.insert_progress_batch_atomic(uuid,date,jsonb) from public,anon;
grant execute on function public.insert_progress_batch_atomic(uuid,date,jsonb) to authenticated,service_role;
