create or replace function public.enforce_sales_no_reactivation_after_akad()
returns trigger
language plpgsql
security invoker
set search_path to public
as $$
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1 from public.sales
      where id_kavling = new.id_kavling
        and status_sales = 'AKAD'
    ) then
      raise exception 'KAVLING SUDAH PERNAH AKAD DAN TIDAK DAPAT MEMILIKI SALES BARU';
    end if;
    return new;
  end if;

  if old.status_sales = 'AKAD' and new.status_sales <> 'AKAD' then
    raise exception 'SALES YANG SUDAH AKAD TIDAK DAPAT DIBUKA KEMBALI KE STATUS SEBELUM AKAD';
  end if;

  if new.id_kavling is distinct from old.id_kavling then
    if exists (
      select 1 from public.sales
      where id_kavling = new.id_kavling
        and status_sales = 'AKAD'
    ) then
      raise exception 'KAVLING SUDAH PERNAH AKAD DAN TIDAK DAPAT MEMILIKI SALES BARU';
    end if;
  end if;

  if new.status_aktif = true and old.status_aktif = false then
    if exists (
      select 1 from public.sales
      where id_kavling = new.id_kavling
        and status_sales = 'AKAD'
        and id_sales <> old.id_sales
    ) then
      raise exception 'KAVLING SUDAH PERNAH AKAD DAN SALES BARU TIDAK DAPAT DIAKTIFKAN';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sales_no_reactivation_after_akad on public.sales;

create trigger trg_sales_no_reactivation_after_akad
before insert or update of id_kavling, status_sales, status_aktif
on public.sales
for each row
execute function public.enforce_sales_no_reactivation_after_akad();

create or replace function public.update_sales_atomic(
  p_id_sales uuid,
  p_nama_konsumen text,
  p_alamat_konsumen text,
  p_hp_konsumen text,
  p_status_sales text,
  p_jenis_pembayaran text,
  p_id_bank text,
  p_id_notaris text,
  p_tgl_akad date,
  p_target_akad date
)
returns void
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_sales public.sales%rowtype;
  v_kavling public.master_kavling%rowtype;
  v_active_spk uuid;
  v_completed_spk uuid;
  v_existing_akad uuid;
  v_next_status text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_status_sales not in ('BOOKING','DP','PROSES_KPR','AKAD','BATAL') then
    raise exception 'STATUS SALES TIDAK VALID';
  end if;

  if p_jenis_pembayaran not in ('KPR','CASH','CASH_BERTAHAP') then
    raise exception 'JENIS PEMBAYARAN TIDAK VALID';
  end if;

  if nullif(btrim(coalesce(p_nama_konsumen,'')), '') is null then
    raise exception 'NAMA KONSUMEN WAJIB DIISI';
  end if;

  select * into v_sales
  from public.sales
  where id_sales = p_id_sales
  for update;

  if not found then
    raise exception 'DATA SALES TIDAK DITEMUKAN';
  end if;

  select * into v_kavling
  from public.master_kavling
  where id_kavling = v_sales.id_kavling
  for update;

  if not found or not v_kavling.status_aktif then
    raise exception 'KAVLING SALES TIDAK AKTIF ATAU TIDAK DITEMUKAN';
  end if;

  if v_sales.status_sales = 'AKAD' and p_status_sales <> 'AKAD' then
    raise exception 'SALES YANG SUDAH AKAD TIDAK DAPAT DIBUKA KEMBALI';
  end if;

  if v_sales.tgl_booking is not null and p_target_akad is not null and p_target_akad < v_sales.tgl_booking then
    raise exception 'TARGET AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING';
  end if;

  if v_sales.tgl_booking is not null and p_tgl_akad is not null and p_tgl_akad < v_sales.tgl_booking then
    raise exception 'TANGGAL AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING';
  end if;

  if p_jenis_pembayaran = 'KPR' and nullif(btrim(coalesce(p_id_bank,'')), '') is null then
    raise exception 'BANK KPR WAJIB DIISI';
  end if;

  if p_jenis_pembayaran <> 'KPR' and nullif(btrim(coalesce(p_id_bank,'')), '') is not null then
    raise exception 'BANK HANYA DIISI UNTUK KPR';
  end if;

  if p_status_sales = 'AKAD' and (
    p_tgl_akad is null or
    nullif(btrim(coalesce(p_id_notaris,'')), '') is null or
    p_target_akad is null
  ) then
    raise exception 'TARGET AKAD, TANGGAL AKAD, DAN NOTARIS WAJIB DIISI UNTUK STATUS AKAD';
  end if;

  if p_status_sales <> 'AKAD' and p_tgl_akad is not null then
    raise exception 'TANGGAL AKAD HANYA DIISI SAAT STATUS AKAD';
  end if;

  if p_status_sales <> 'AKAD' and nullif(btrim(coalesce(p_id_notaris,'')), '') is not null then
    raise exception 'NOTARIS AKAD HANYA DIISI SAAT STATUS AKAD';
  end if;

  if p_status_sales = 'BATAL' then
    p_id_bank := case when p_jenis_pembayaran = 'KPR' then p_id_bank else null end;
    p_id_notaris := null;
    p_tgl_akad := null;
  end if;

  if p_status_sales <> 'BATAL' then
    select id_sales into v_existing_akad
    from public.sales
    where id_kavling = v_sales.id_kavling
      and status_sales = 'AKAD'
      and id_sales <> p_id_sales
    limit 1;

    if v_existing_akad is not null then
      raise exception 'KAVLING SUDAH PERNAH AKAD DAN TIDAK DAPAT MEMILIKI SALES BARU';
    end if;

    if v_sales.status_aktif = false then
      if exists (
        select 1
        from public.sales
        where id_kavling = v_sales.id_kavling
          and status_aktif = true
          and id_sales <> p_id_sales
      ) then
        raise exception 'KAVLING TERSEBUT SUDAH MEMILIKI SALES AKTIF';
      end if;
    end if;
  end if;

  update public.sales
  set nama_konsumen = btrim(p_nama_konsumen),
      alamat_konsumen = nullif(btrim(coalesce(p_alamat_konsumen,'')), ''),
      hp_konsumen = nullif(btrim(coalesce(p_hp_konsumen,'')), ''),
      status_sales = p_status_sales,
      jenis_pembayaran = p_jenis_pembayaran,
      id_bank = case when p_jenis_pembayaran = 'KPR' then nullif(btrim(coalesce(p_id_bank,'')), '') else null end,
      id_notaris = case when p_status_sales = 'AKAD' then nullif(btrim(coalesce(p_id_notaris,'')), '') else null end,
      tgl_akad = case when p_status_sales = 'AKAD' then p_tgl_akad else null end,
      target_akad = p_target_akad,
      status_aktif = p_status_sales <> 'BATAL'
  where id_sales = p_id_sales;

  select id_spk into v_active_spk
  from public.spk
  where id_kavling = v_sales.id_kavling and is_active = true
  limit 1;

  if v_active_spk is not null then
    v_next_status := 'BUILDING';
  elsif p_status_sales = 'AKAD' then
    v_next_status := 'SOLD';
  elsif p_status_sales <> 'BATAL' then
    v_next_status := 'BOOKING';
  else
    select id_spk into v_completed_spk
    from public.spk
    where id_kavling = v_sales.id_kavling
      and status_spk = 'SELESAI'
    order by tgl_target_selesai desc nulls last
    limit 1;

    v_next_status := case when v_completed_spk is not null then 'READY_STOCK' else 'AVAILABLE' end;
  end if;

  update public.master_kavling
  set status_kavling = v_next_status
  where id_kavling = v_sales.id_kavling
    and status_aktif = true;

  if not found then
    raise exception 'GAGAL MEMPERBARUI STATUS KAVLING';
  end if;
end;
$function$;

create or replace function public.update_sales_atomic(
  p_id_sales uuid,
  p_nama_konsumen text,
  p_alamat_konsumen text,
  p_hp_konsumen text,
  p_status_sales text,
  p_jenis_pembayaran text,
  p_id_bank text,
  p_id_notaris text,
  p_tgl_akad date,
  p_target_akad date
)
returns void
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_sales public.sales%rowtype;
  v_kavling public.master_kavling%rowtype;
  v_active_spk uuid;
  v_completed_spk uuid;
  v_existing_akad uuid;
  v_next_status text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_status_sales not in ('BOOKING','DP','PROSES_KPR','AKAD','BATAL') then
    raise exception 'STATUS SALES TIDAK VALID';
  end if;

  if p_jenis_pembayaran not in ('KPR','CASH','CASH_BERTAHAP') then
    raise exception 'JENIS PEMBAYARAN TIDAK VALID';
  end if;

  if nullif(btrim(coalesce(p_nama_konsumen,'')), '') is null then
    raise exception 'NAMA KONSUMEN WAJIB DIISI';
  end if;

  select * into v_sales
  from public.sales
  where id_sales = p_id_sales
  for update;

  if not found then
    raise exception 'DATA SALES TIDAK DITEMUKAN';
  end if;

  select * into v_kavling
  from public.master_kavling
  where id_kavling = v_sales.id_kavling
  for update;

  if not found or not v_kavling.status_aktif then
    raise exception 'KAVLING SALES TIDAK AKTIF ATAU TIDAK DITEMUKAN';
  end if;

  if v_sales.status_sales = 'AKAD' and p_status_sales <> 'AKAD' then
    raise exception 'SALES YANG SUDAH AKAD TIDAK DAPAT DIBUKA KEMBALI';
  end if;

  if v_sales.status_aktif = false and p_status_sales <> 'BATAL' then
    raise exception 'SALES YANG SUDAH DITUTUP TIDAK DAPAT DIAKTIFKAN KEMBALI. BUAT SALES BARU PADA KAVLING YANG BERSTATUS BATAL.';
  end if;

  if v_sales.tgl_booking is not null and p_target_akad is not null and p_target_akad < v_sales.tgl_booking then
    raise exception 'TARGET AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING';
  end if;

  if v_sales.tgl_booking is not null and p_tgl_akad is not null and p_tgl_akad < v_sales.tgl_booking then
    raise exception 'TANGGAL AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING';
  end if;

  if p_jenis_pembayaran = 'KPR' and nullif(btrim(coalesce(p_id_bank,'')), '') is null then
    raise exception 'BANK KPR WAJIB DIISI';
  end if;

  if p_jenis_pembayaran <> 'KPR' and nullif(btrim(coalesce(p_id_bank,'')), '') is not null then
    raise exception 'BANK HANYA DIISI UNTUK KPR';
  end if;

  if p_status_sales = 'AKAD' and (
    p_tgl_akad is null or
    nullif(btrim(coalesce(p_id_notaris,'')), '') is null or
    p_target_akad is null
  ) then
    raise exception 'TARGET AKAD, TANGGAL AKAD, DAN NOTARIS WAJIB DIISI UNTUK STATUS AKAD';
  end if;

  if p_status_sales <> 'AKAD' and p_tgl_akad is not null then
    raise exception 'TANGGAL AKAD HANYA DIISI SAAT STATUS AKAD';
  end if;

  if p_status_sales <> 'AKAD' and nullif(btrim(coalesce(p_id_notaris,'')), '') is not null then
    raise exception 'NOTARIS AKAD HANYA DIISI SAAT STATUS AKAD';
  end if;

  if p_status_sales = 'BATAL' then
    p_id_bank := case when p_jenis_pembayaran = 'KPR' then p_id_bank else null end;
    p_id_notaris := null;
    p_tgl_akad := null;
  end if;

  if p_status_sales <> 'BATAL' then
    select id_sales into v_existing_akad
    from public.sales
    where id_kavling = v_sales.id_kavling
      and status_sales = 'AKAD'
      and id_sales <> p_id_sales
    limit 1;

    if v_existing_akad is not null then
      raise exception 'KAVLING SUDAH PERNAH AKAD DAN TIDAK DAPAT MEMILIKI SALES BARU';
    end if;

    if v_sales.status_aktif = false then
      if exists (
        select 1
        from public.sales
        where id_kavling = v_sales.id_kavling
          and status_aktif = true
          and id_sales <> p_id_sales
      ) then
        raise exception 'KAVLING TERSEBUT SUDAH MEMILIKI SALES AKTIF';
      end if;
    end if;
  end if;

  update public.sales
  set nama_konsumen = btrim(p_nama_konsumen),
      alamat_konsumen = nullif(btrim(coalesce(p_alamat_konsumen,'')), ''),
      hp_konsumen = nullif(btrim(coalesce(p_hp_konsumen,'')), ''),
      status_sales = p_status_sales,
      jenis_pembayaran = p_jenis_pembayaran,
      id_bank = case when p_jenis_pembayaran = 'KPR' then nullif(btrim(coalesce(p_id_bank,'')), '') else null end,
      id_notaris = case when p_status_sales = 'AKAD' then nullif(btrim(coalesce(p_id_notaris,'')), '') else null end,
      tgl_akad = case when p_status_sales = 'AKAD' then p_tgl_akad else null end,
      target_akad = p_target_akad,
      status_aktif = p_status_sales <> 'BATAL'
  where id_sales = p_id_sales;

  select id_spk into v_active_spk
  from public.spk
  where id_kavling = v_sales.id_kavling and is_active = true
  limit 1;

  if v_active_spk is not null then
    v_next_status := 'BUILDING';
  elsif p_status_sales = 'AKAD' then
    v_next_status := 'SOLD';
  elsif p_status_sales <> 'BATAL' then
    v_next_status := 'BOOKING';
  else
    select id_spk into v_completed_spk
    from public.spk
    where id_kavling = v_sales.id_kavling
      and status_spk = 'SELESAI'
    order by tgl_target_selesai desc nulls last
    limit 1;

    v_next_status := case when v_completed_spk is not null then 'READY_STOCK' else 'AVAILABLE' end;
  end if;

  update public.master_kavling
  set status_kavling = v_next_status
  where id_kavling = v_sales.id_kavling
    and status_aktif = true;

  if not found then
    raise exception 'GAGAL MEMPERBARUI STATUS KAVLING';
  end if;
end;
$function$;

DO $do$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_viewdef('public.v_decision_engine'::regclass, true)
    INTO v_def;

  v_def := replace(
    v_def,
    $old$FROM progress_update pu$old$,
    $new$FROM progress_update pu
                     JOIN spk_progress_config c ON c.id_spk = pu.id_spk AND c.id_kategori = pu.id_kategori$new$
  );

  v_def := replace(
    v_def,
    $old$sum(pu.progress_periode) FILTER (WHERE pu.tanggal_update = md.max_tanggal)$old$,
    $new$sum(pu.progress_periode * c.bobot_final) FILTER (WHERE pu.tanggal_update = md.max_tanggal)$new$
  );

  EXECUTE 'CREATE OR REPLACE VIEW public.v_decision_engine AS ' || v_def;
END
$do$;

create table if not exists public.siteplan_versions (
  id uuid primary key default gen_random_uuid(),
  nama_siteplan text not null,
  versi text not null default 'REV.01',
  file_name text not null,
  file_path text not null unique,
  mime_type text,
  file_size bigint,
  is_active boolean not null default false,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

alter table public.siteplan_kavling_mapping
  add column if not exists siteplan_version_id uuid references public.siteplan_versions(id);

alter table public.siteplan_versions enable row level security;

drop policy if exists siteplan_versions_select_authenticated on public.siteplan_versions;
create policy siteplan_versions_select_authenticated
on public.siteplan_versions for select
to authenticated using (true);

drop policy if exists siteplan_versions_insert_authenticated on public.siteplan_versions;
create policy siteplan_versions_insert_authenticated
on public.siteplan_versions for insert
to authenticated with check (uploaded_by = auth.uid());

drop policy if exists siteplan_versions_update_authenticated on public.siteplan_versions;
create policy siteplan_versions_update_authenticated
on public.siteplan_versions for update
to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('siteplans', 'siteplans', false)
on conflict (id) do nothing;

drop policy if exists siteplans_select_authenticated on storage.objects;
create policy siteplans_select_authenticated
on storage.objects for select
to authenticated using (bucket_id = 'siteplans');

drop policy if exists siteplans_insert_authenticated on storage.objects;
create policy siteplans_insert_authenticated
on storage.objects for insert
to authenticated with check (bucket_id = 'siteplans');

drop policy if exists siteplans_update_authenticated on storage.objects;
create policy siteplans_update_authenticated
on storage.objects for update
to authenticated using (bucket_id = 'siteplans') with check (bucket_id = 'siteplans');

alter table public.siteplan_versions
  add column if not exists image_width integer,
  add column if not exists image_height integer;
