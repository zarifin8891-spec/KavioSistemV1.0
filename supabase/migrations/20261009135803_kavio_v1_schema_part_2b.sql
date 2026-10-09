ALTER FUNCTION public.activate_spk_atomic(uuid) SET search_path = public;
ALTER FUNCTION public.deactivate_spk_atomic(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION public.activate_spk_atomic(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deactivate_spk_atomic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_spk_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_spk_atomic(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.activate_spk_atomic(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.activate_spk_atomic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_spk_atomic(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.deactivate_spk_atomic(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.deactivate_spk_atomic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_spk_atomic(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.deactivate_spk_atomic(p_id_spk uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  v_spk public.spk%rowtype;
  v_sales_status text;
  v_next_status text;
  v_progress_total numeric;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_spk
  from public.spk
  where id_spk = p_id_spk
  for update;

  if not found or not v_spk.is_active then raise exception 'SPK aktif tidak ditemukan'; end if;
  if v_spk.status_spk <> 'AKTIF' then raise exception 'Hanya SPK AKTIF yang dapat ditandai selesai'; end if;

  perform 1 from public.master_kavling where id_kavling = v_spk.id_kavling and status_aktif = true for update;
  if not found then raise exception 'Kavling pada SPK tidak aktif atau tidak ditemukan'; end if;

  select coalesce(sum(progress_berbobot), 0)
    into v_progress_total
  from public.v_progress_kategori_current
  where id_spk = p_id_spk;

  if v_progress_total < 0.99999 then
    raise exception 'SPK belum dapat diselesaikan. Progress aktual baru %%%', round(v_progress_total * 100, 2);
  end if;

  select status_sales into v_sales_status
  from public.sales
  where id_kavling = v_spk.id_kavling and status_aktif = true
  order by created_at desc nulls last
  limit 1;

  v_next_status := case
    when v_sales_status = 'AKAD' then 'SOLD'
    when v_sales_status is not null then 'BOOKING'
    else 'READY_STOCK'
  end;

  update public.spk
  set status_spk = 'SELESAI', is_active = false
  where id_spk = p_id_spk and is_active = true and status_spk = 'AKTIF';
  if not found then raise exception 'SPK berubah sebelum diselesaikan. Silakan coba lagi'; end if;

  update public.master_kavling
  set status_kavling = v_next_status
  where id_kavling = v_spk.id_kavling and status_aktif = true;
  if not found then raise exception 'Gagal memperbarui status kavling'; end if;

  return v_next_status;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.deactivate_spk_atomic(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.deactivate_spk_atomic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_spk_atomic(uuid) TO authenticated;

create table if not exists public.master_bank (
  id_bank text primary key,
  nama_bank text not null,
  status_aktif boolean not null default true,
  keterangan text,
  created_at timestamptz not null default now()
);

create table if not exists public.master_notaris (
  id_notaris text primary key,
  nama_notaris text not null,
  no_izin text,
  no_hp text,
  alamat text,
  status_aktif boolean not null default true,
  keterangan text,
  created_at timestamptz not null default now()
);

alter table public.sales add column if not exists id_bank text references public.master_bank(id_bank);
alter table public.sales add column if not exists id_notaris text references public.master_notaris(id_notaris);
alter table public.sales add column if not exists tgl_akad date;

create table if not exists public.sales_kpr_progress (
  id_progress uuid primary key default gen_random_uuid(),
  id_sales uuid not null references public.sales(id_sales) on delete cascade,
  tahap text not null check (tahap in ('KELENGKAPAN_DATA','SURVEY_BANK','INTERVIEW','SP3K')),
  tanggal_update date not null,
  keterangan text,
  input_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id_sales, tahap)
);

create index if not exists idx_sales_id_bank on public.sales(id_bank);
create index if not exists idx_sales_id_notaris on public.sales(id_notaris);
create index if not exists idx_sales_kpr_progress_sales on public.sales_kpr_progress(id_sales);
create index if not exists idx_sales_kpr_progress_date on public.sales_kpr_progress(tanggal_update desc);

alter table public.master_bank enable row level security;
alter table public.master_notaris enable row level security;
alter table public.sales_kpr_progress enable row level security;

drop policy if exists kavio_auth_all on public.master_bank;
create policy kavio_auth_all on public.master_bank for all to authenticated using (true) with check (true);
drop policy if exists kavio_auth_all on public.master_notaris;
create policy kavio_auth_all on public.master_notaris for all to authenticated using (true) with check (true);
drop policy if exists kavio_auth_all on public.sales_kpr_progress;
create policy kavio_auth_all on public.sales_kpr_progress for all to authenticated using (true) with check (true);

comment on table public.master_bank is 'Master bank untuk pembiayaan KPR Sales';
comment on table public.master_notaris is 'Master notaris untuk proses akad Sales';
comment on table public.sales_kpr_progress is 'Riwayat tahapan proses KPR per Sales';
