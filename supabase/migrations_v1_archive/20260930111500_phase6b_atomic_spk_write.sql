-- Phase 6B continuation: make SPK create/update + weight snapshot atomic.
create or replace function public.create_or_update_spk_atomic(
  p_id_kavling text,
  p_tgl_spk date,
  p_tgl_target_selesai date,
  p_id_kantor text,
  p_id_mandor text,
  p_jenis_bobot text,
  p_config jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_kavling public.master_kavling%rowtype;
  v_kantor public.master_kantor_pelaksana%rowtype;
  v_mandor public.master_mandor%rowtype;
  v_existing public.spk%rowtype;
  v_id_spk uuid;
  v_total numeric;
  v_count integer;
  v_item jsonb;
  v_kategori text;
  v_bobot numeric;
  v_status text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SPK_WRITE') then raise exception 'FORBIDDEN: SPK_WRITE'; end if;

  p_id_kavling := btrim(coalesce(p_id_kavling,''));
  p_id_kantor := btrim(coalesce(p_id_kantor,''));
  p_id_mandor := btrim(coalesce(p_id_mandor,''));
  p_jenis_bobot := upper(btrim(coalesce(p_jenis_bobot,'')));

  if p_id_kavling='' or p_tgl_spk is null or p_tgl_target_selesai is null or p_id_kantor='' or p_id_mandor='' or p_jenis_bobot not in ('STANDAR','CUSTOM') then
    raise exception 'SEMUA FIELD UTAMA SPK WAJIB DIISI';
  end if;
  if p_tgl_target_selesai < p_tgl_spk then raise exception 'TANGGAL TARGET SELESAI TIDAK BOLEH SEBELUM TANGGAL SPK'; end if;
  if p_config is null or jsonb_typeof(p_config)<>'array' or jsonb_array_length(p_config)=0 then raise exception 'KONFIGURASI BOBOT SPK KOSONG'; end if;

  select * into v_kavling from public.master_kavling where id_kavling=p_id_kavling for update;
  if not found or not v_kavling.status_aktif then raise exception 'KAVLING TIDAK DITEMUKAN ATAU NONAKTIF'; end if;
  if v_kavling.status_kavling not in ('AVAILABLE','BOOKING') then raise exception 'KAVLING BERSTATUS % TIDAK DAPAT DIBUATKAN SPK BARU',v_kavling.status_kavling; end if;

  select * into v_kantor from public.master_kantor_pelaksana where id_kantor=p_id_kantor;
  if not found or not v_kantor.status_aktif then raise exception 'KANTOR/PELAKSANA TIDAK DITEMUKAN ATAU NONAKTIF'; end if;

  select * into v_mandor from public.master_mandor where id_mandor=p_id_mandor;
  if not found or not v_mandor.status_aktif then raise exception 'MANDOR TIDAK DITEMUKAN ATAU NONAKTIF'; end if;
  if v_mandor.id_kantor<>p_id_kantor then raise exception 'MANDOR HARUS BERASAL DARI KANTOR PELAKSANA YANG DIPILIH'; end if;

  select * into v_existing from public.spk where id_kavling=p_id_kavling for update;
  if found and (v_existing.is_active or v_existing.status_spk<>'DRAFT') then
    raise exception 'KAVLING TERSEBUT SUDAH MEMILIKI SPK DENGAN STATUS %. SATU KAVLING HANYA BOLEH MEMILIKI SATU SPK',v_existing.status_spk;
  end if;

  v_total := 0;
  v_count := 0;
  for v_item in select value from jsonb_array_elements(p_config)
  loop
    v_kategori := nullif(btrim(coalesce(v_item->>'id_kategori','')),'');
    begin
      v_bobot := (v_item->>'bobot_final')::numeric;
    exception when others then
      raise exception 'BOBOT SPK TIDAK VALID';
    end;
    if v_kategori is null or v_bobot is null or v_bobot<0 or v_bobot>1 then raise exception 'BOBOT SPK TIDAK VALID'; end if;
    if not exists(select 1 from public.master_kategori_pekerjaan where id_kategori=v_kategori) then raise exception 'KATEGORI % TIDAK DITEMUKAN',v_kategori; end if;
    v_total := v_total+v_bobot; v_count := v_count+1;
  end loop;
  if v_count=0 or abs(v_total-1)>0.00001 then raise exception 'TOTAL BOBOT HARUS 100%%. SAAT INI %%%',round(v_total*100,2); end if;

  if v_existing.id_spk is not null then
    v_id_spk := v_existing.id_spk;
    delete from public.spk_progress_config where id_spk=v_id_spk;
    for v_item in select value from jsonb_array_elements(p_config)
    loop
      insert into public.spk_progress_config(id_spk,id_kategori,bobot_final)
      values(v_id_spk,v_item->>'id_kategori',(v_item->>'bobot_final')::numeric);
    end loop;

    update public.spk
    set tgl_spk=p_tgl_spk,
        id_tipe=v_kavling.id_tipe,
        jenis_bobot=p_jenis_bobot,
        id_kantor=p_id_kantor,
        id_mandor=p_id_mandor,
        status_spk='AKTIF',
        tgl_target_selesai=p_tgl_target_selesai,
        is_active=true
    where id_spk=v_id_spk and status_spk='DRAFT' and is_active=false;
    if not found then raise exception 'SPK DRAFT BERUBAH SEBELUM DISIMPAN. SILAKAN COBA LAGI'; end if;
    v_status := 'AKTIF';
  else
    insert into public.spk(id_kavling,tgl_spk,id_tipe,jenis_bobot,id_kantor,id_mandor,status_spk,tgl_target_selesai,is_active)
    values(p_id_kavling,p_tgl_spk,v_kavling.id_tipe,p_jenis_bobot,p_id_kantor,p_id_mandor,'DRAFT',p_tgl_target_selesai,false)
    returning id_spk into v_id_spk;

    for v_item in select value from jsonb_array_elements(p_config)
    loop
      insert into public.spk_progress_config(id_spk,id_kategori,bobot_final)
      values(v_id_spk,v_item->>'id_kategori',(v_item->>'bobot_final')::numeric);
    end loop;
    v_status := 'DRAFT';
  end if;

  return jsonb_build_object('id_spk',v_id_spk,'status_spk',v_status);
end;
$function$;

revoke all on function public.create_or_update_spk_atomic(text,date,date,text,text,text,jsonb) from public, anon;
grant execute on function public.create_or_update_spk_atomic(text,date,date,text,text,text,jsonb) to authenticated, service_role;
