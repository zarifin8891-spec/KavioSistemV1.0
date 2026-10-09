-- Use the same weighted work-item model for Kavling and Fasum Progress.
alter table public.progress_update alter column id_kategori drop not null;

create or replace function public.sync_spk_work_item_from_legacy_config()
returns trigger
language plpgsql
set search_path = 'public'
as $function$
declare
  v_name text;
  v_order integer;
begin
  select nama_kategori into v_name
  from public.master_kategori_pekerjaan
  where id_kategori = new.id_kategori;
  if v_name is null then raise exception 'KATEGORI PEKERJAAN TIDAK DITEMUKAN'; end if;

  select urutan into v_order
  from public.spk_work_item
  where id_spk = new.id_spk and id_kategori_legacy = new.id_kategori;
  if v_order is null then
    select coalesce(max(urutan), 0) + 1 into v_order
    from public.spk_work_item where id_spk = new.id_spk;
  end if;

  insert into public.spk_work_item(id_spk, urutan, nama_pekerjaan, bobot, id_kategori_legacy)
  values(new.id_spk, v_order, v_name, new.bobot_final, new.id_kategori)
  on conflict (id_spk, id_kategori_legacy)
  do update set bobot = excluded.bobot, nama_pekerjaan = excluded.nama_pekerjaan;
  return new;
end;
$function$;

create trigger trg_sync_spk_work_item_from_legacy_config
after insert or update of bobot_final on public.spk_progress_config
for each row execute function public.sync_spk_work_item_from_legacy_config();

create or replace function public.delete_spk_work_item_from_legacy_config()
returns trigger
language plpgsql
set search_path = 'public'
as $function$
begin
  delete from public.spk_work_item
  where id_spk = old.id_spk and id_kategori_legacy = old.id_kategori;
  return old;
end;
$function$;

create trigger trg_delete_spk_work_item_from_legacy_config
after delete on public.spk_progress_config
for each row execute function public.delete_spk_work_item_from_legacy_config();

create or replace function public.create_fasum_spk_atomic(
  p_nama_objek text,
  p_tgl_spk date,
  p_tgl_target_selesai date,
  p_id_kantor text,
  p_id_mandor text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_kantor public.master_kantor_pelaksana%rowtype;
  v_mandor public.master_mandor%rowtype;
  v_item jsonb;
  v_name text;
  v_weight numeric;
  v_total numeric := 0;
  v_count integer := 0;
  v_position integer := 0;
  v_id_spk uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SPK_WRITE') then raise exception 'FORBIDDEN: SPK_WRITE'; end if;
  p_nama_objek := nullif(btrim(coalesce(p_nama_objek, '')), '');
  if p_nama_objek is null or p_tgl_spk is null or p_tgl_target_selesai is null or p_id_kantor is null or p_id_mandor is null then
    raise exception 'NAMA OBJEK, TANGGAL, KANTOR, DAN MANDOR WAJIB DIISI';
  end if;
  if p_tgl_target_selesai < p_tgl_spk then raise exception 'TANGGAL TARGET TIDAK BOLEH SEBELUM TANGGAL SPK'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then raise exception 'ITEM PEKERJAAN FASUM WAJIB DIISI'; end if;

  select * into v_kantor from public.master_kantor_pelaksana where id_kantor = p_id_kantor and status_aktif;
  if not found then raise exception 'KANTOR/PELAKSANA TIDAK DITEMUKAN ATAU NONAKTIF'; end if;
  select * into v_mandor from public.master_mandor where id_mandor = p_id_mandor and status_aktif;
  if not found or v_mandor.id_kantor <> p_id_kantor then raise exception 'MANDOR TIDAK AKTIF ATAU BUKAN DARI KANTOR TERPILIH'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_name := nullif(btrim(coalesce(v_item->>'nama_pekerjaan', '')), '');
    begin v_weight := (v_item->>'bobot')::numeric; exception when others then raise exception 'BOBOT ITEM TIDAK VALID'; end;
    if v_name is null or v_weight is null or v_weight <= 0 or v_weight > 1 then raise exception 'NAMA ATAU BOBOT ITEM TIDAK VALID'; end if;
    v_total := v_total + v_weight;
    v_count := v_count + 1;
  end loop;
  if v_count <> jsonb_array_length(p_items) or abs(v_total - 1) > 0.00001 then raise exception 'TOTAL BOBOT ITEM FASUM HARUS 100%%. SAAT INI %%%', round(v_total * 100, 2); end if;

  insert into public.spk(jenis_spk, nama_objek, tgl_spk, jenis_bobot, id_kantor, id_mandor, status_spk, tgl_target_selesai, is_active)
  values('FASUM', p_nama_objek, p_tgl_spk, 'CUSTOM', p_id_kantor, p_id_mandor, 'DRAFT', p_tgl_target_selesai, false)
  returning id_spk into v_id_spk;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_position := v_position + 1;
    insert into public.spk_work_item(id_spk, urutan, nama_pekerjaan, bobot)
    values(v_id_spk, v_position, btrim(v_item->>'nama_pekerjaan'), (v_item->>'bobot')::numeric);
  end loop;
  return v_id_spk;
end;
$function$;

revoke all on function public.create_fasum_spk_atomic(text, date, date, text, text, jsonb) from public, anon;
grant execute on function public.create_fasum_spk_atomic(text, date, date, text, text, jsonb) to authenticated, service_role;

create or replace function public.sync_progress_update_work_item()
returns trigger
language plpgsql
set search_path = 'public'
as $function$
declare
  v_item public.spk_work_item%rowtype;
begin
  if new.id_item is null and new.id_kategori is not null then
    select * into v_item from public.spk_work_item
    where id_spk = new.id_spk and id_kategori_legacy = new.id_kategori;
    if found then new.id_item := v_item.id_item; end if;
  elsif new.id_item is not null then
    select * into v_item from public.spk_work_item
    where id_item = new.id_item and id_spk = new.id_spk;
    if not found then raise exception 'ITEM PEKERJAAN TIDAK TERDAFTAR PADA SPK'; end if;
    new.id_kategori := v_item.id_kategori_legacy;
  end if;
  return new;
end;
$function$;

create trigger trg_sync_progress_update_work_item
before insert or update of id_spk, id_item, id_kategori on public.progress_update
for each row execute function public.sync_progress_update_work_item();

do $migration$
begin
  if exists (select 1 from public.progress_update where id_item is null) then
    raise exception 'MIGRASI DIBATALKAN: ADA HISTORI PROGRESS YANG BELUM DAPAT DIPETAKAN KE ITEM SPK';
  end if;
end;
$migration$;
alter table public.progress_update alter column id_item set not null;

create or replace view public.v_spk_work_item_progress_current
with (security_invoker = true)
as
select
  w.id_spk,
  w.id_item,
  w.urutan,
  w.nama_pekerjaan,
  w.bobot as bobot_final,
  coalesce(sum(p.progress_periode), 0)::numeric as progress_akumulasi,
  (coalesce(sum(p.progress_periode), 0) * w.bobot)::numeric as progress_berbobot,
  max(p.tanggal_update) as tanggal_update_terakhir
from public.spk_work_item w
left join public.progress_update p on p.id_item = w.id_item and p.id_spk = w.id_spk
group by w.id_spk, w.id_item, w.urutan, w.nama_pekerjaan, w.bobot;

revoke all on table public.v_spk_work_item_progress_current from public, anon;
grant select on table public.v_spk_work_item_progress_current to authenticated;

create or replace function public.insert_progress_work_item_batch_atomic(
  p_id_spk uuid,
  p_tanggal_update date,
  p_entries jsonb
)
returns integer
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_spk public.spk%rowtype;
  v_entry jsonb;
  v_id_item uuid;
  v_percent numeric;
  v_current numeric;
  v_inserted integer := 0;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('PROGRESS_WRITE') then raise exception 'FORBIDDEN: PROGRESS_WRITE'; end if;
  if p_id_spk is null or p_tanggal_update is null or p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'SPK, TANGGAL, DAN MINIMAL SATU ITEM PROGRESS WAJIB DIISI';
  end if;

  select * into v_spk from public.spk where id_spk = p_id_spk for update;
  if not found or not v_spk.is_active or v_spk.status_spk <> 'AKTIF' then raise exception 'SPK TIDAK AKTIF ATAU TIDAK DITEMUKAN'; end if;
  if p_tanggal_update < v_spk.tgl_spk then raise exception 'TANGGAL UPDATE TIDAK BOLEH SEBELUM TANGGAL SPK'; end if;
  if p_tanggal_update > current_date then raise exception 'TANGGAL UPDATE TIDAK BOLEH DI MASA DEPAN'; end if;
  if (select count(*) <> count(distinct nullif(btrim(value->>'id_item'), '')) from jsonb_array_elements(p_entries)) then
    raise exception 'ITEM PROGRESS TIDAK BOLEH DUPLIKAT DALAM SATU BATCH';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries) order by value->>'id_item'
  loop
    begin
      v_id_item := (v_entry->>'id_item')::uuid;
      v_percent := (v_entry->>'progress_percent')::numeric;
    exception when others then
      raise exception 'ITEM ATAU NILAI PROGRESS TIDAK VALID';
    end;
    if v_percent is null or v_percent <= 0 or v_percent > 100 then raise exception 'PROGRESS PERIODE HARUS LEBIH DARI 0 DAN MAKSIMAL 100%%'; end if;
    if not exists (select 1 from public.spk_work_item where id_item = v_id_item and id_spk = p_id_spk) then
      raise exception 'ITEM PEKERJAAN TIDAK TERDAFTAR PADA SPK';
    end if;
    if exists (select 1 from public.progress_update where id_spk = p_id_spk and id_item = v_id_item and tanggal_update = p_tanggal_update) then
      raise exception 'PROGRESS ITEM UNTUK TANGGAL TERSEBUT SUDAH ADA';
    end if;
    select coalesce(sum(progress_periode), 0) into v_current
    from public.progress_update where id_spk = p_id_spk and id_item = v_id_item;
    if v_current + v_percent / 100.0 > 1.000001 then
      raise exception 'PROGRESS ITEM MELEBIHI 100%%. SAAT INI %%%', round(v_current * 100, 2);
    end if;
  end loop;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    insert into public.progress_update(id_spk, id_item, tanggal_update, progress_periode, keterangan, input_by)
    values(p_id_spk, (v_entry->>'id_item')::uuid, p_tanggal_update,
      (v_entry->>'progress_percent')::numeric / 100.0,
      nullif(btrim(coalesce(v_entry->>'keterangan', '')), ''), auth.uid());
    v_inserted := v_inserted + 1;
  end loop;
  return v_inserted;
end;
$function$;

revoke all on function public.insert_progress_work_item_batch_atomic(uuid, date, jsonb) from public, anon;
grant execute on function public.insert_progress_work_item_batch_atomic(uuid, date, jsonb) to authenticated, service_role;

create or replace function public.activate_spk_atomic(p_id_spk uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_spk public.spk%rowtype;
  v_kavling public.master_kavling%rowtype;
  v_total numeric;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SPK_WRITE') then raise exception 'FORBIDDEN: SPK_WRITE'; end if;
  select * into v_spk from public.spk where id_spk = p_id_spk for update;
  if not found or v_spk.status_spk <> 'DRAFT' or v_spk.is_active then raise exception 'SPK TIDAK BERADA PADA STATUS DRAFT YANG VALID'; end if;

  select count(*), coalesce(sum(bobot), 0) into v_count, v_total
  from public.spk_work_item where id_spk = p_id_spk;
  if v_count = 0 or abs(v_total - 1) > 0.00001 then raise exception 'TOTAL BOBOT ITEM SPK HARUS 100%%. SAAT INI %%%', round(v_total * 100, 2); end if;

  if v_spk.jenis_spk = 'KAVLING' then
    select * into v_kavling from public.master_kavling where id_kavling = v_spk.id_kavling for update;
    if not found or not v_kavling.status_aktif then raise exception 'KAVLING PADA SPK TIDAK AKTIF ATAU TIDAK DITEMUKAN'; end if;
    if v_kavling.status_kavling not in ('AVAILABLE', 'BOOKING') then raise exception 'KAVLING BERSTATUS % TIDAK SIAP UNTUK SPK', v_kavling.status_kavling; end if;
    if exists (select 1 from public.spk where id_kavling = v_spk.id_kavling and is_active = true and id_spk <> p_id_spk) then raise exception 'KAVLING SUDAH MEMILIKI SPK AKTIF LAIN'; end if;
  end if;

  update public.spk set status_spk = 'AKTIF', is_active = true where id_spk = p_id_spk and status_spk = 'DRAFT' and is_active = false;
  if not found then raise exception 'SPK BERUBAH SEBELUM AKTIVASI. SILAKAN COBA LAGI'; end if;
end;
$function$;

create or replace function public.deactivate_spk_atomic(p_id_spk uuid)
returns text
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_spk public.spk%rowtype;
  v_progress_total numeric;
  v_next_status text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SPK_WRITE') then raise exception 'FORBIDDEN: SPK_WRITE'; end if;
  select * into v_spk from public.spk where id_spk = p_id_spk for update;
  if not found or not v_spk.is_active or v_spk.status_spk <> 'AKTIF' then raise exception 'HANYA SPK AKTIF YANG DAPAT DITANDAI SELESAI'; end if;
  select coalesce(sum(progress_berbobot), 0) into v_progress_total
  from public.v_spk_work_item_progress_current where id_spk = p_id_spk;
  if v_progress_total < 0.99999 then raise exception 'SPK BELUM DAPAT DISELESAIKAN. PROGRESS AKTUAL BARU %%%', round(v_progress_total * 100, 2); end if;
  update public.spk set status_spk = 'SELESAI', is_active = false where id_spk = p_id_spk and is_active = true and status_spk = 'AKTIF';
  if not found then raise exception 'SPK BERUBAH SEBELUM DISELESAIKAN. SILAKAN COBA LAGI'; end if;
  if v_spk.jenis_spk = 'FASUM' then return 'SELESAI'; end if;
  v_next_status := public.kavio_sync_kavling_status(v_spk.id_kavling);
  return coalesce(v_next_status, 'READY_STOCK');
end;
$function$;

revoke all on function public.activate_spk_atomic(uuid) from public, anon;
grant execute on function public.activate_spk_atomic(uuid) to authenticated, service_role;
revoke all on function public.deactivate_spk_atomic(uuid) from public, anon;
grant execute on function public.deactivate_spk_atomic(uuid) to authenticated, service_role;
