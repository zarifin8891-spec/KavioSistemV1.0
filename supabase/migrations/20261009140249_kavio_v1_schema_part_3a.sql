create or replace function public.kavio_get_current_access_context()
returns table (
  role text,
  status_aktif boolean,
  actions text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(p.role, 'USER') as role,
    coalesce(p.status_aktif, true) as status_aktif,
    coalesce(
      array_agg(ra.action order by ra.action) filter (where ra.action is not null),
      '{}'::text[]
    ) as actions
  from (select auth.uid() as user_id) me
  left join public.user_profiles p on p.user_id = me.user_id
  left join public.kavio_role_actions ra on ra.role = p.role
  group by p.role, p.status_aktif;
$$;

revoke all on function public.kavio_get_current_access_context() from public;
grant execute on function public.kavio_get_current_access_context() to authenticated;


create or replace function public.kavio_get_current_access_context()
returns table (
  role text,
  status_aktif boolean,
  actions text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(p.role, 'USER') as role,
    coalesce(p.status_aktif, true) as status_aktif,
    coalesce(
      array_agg(ra.action order by ra.action)
        filter (
          where ra.action is not null
            and coalesce(p.status_aktif, true) = true
        ),
      '{}'::text[]
    ) as actions
  from (select auth.uid() as user_id) me
  left join public.user_profiles p on p.user_id = me.user_id
  left join public.kavio_role_actions ra on ra.role = p.role
  group by p.role, p.status_aktif;
$$;

revoke all on function public.kavio_get_current_access_context() from public;
grant execute on function public.kavio_get_current_access_context() to authenticated;


create or replace function public.kavio_sales_kpi()
returns table (
  total_sales bigint,
  booking bigint,
  dp bigint,
  proses_kpr bigint,
  akad bigint,
  batal bigint,
  aktif bigint
)
language sql
stable
as $$
  select
    count(*)::bigint,
    count(*) filter (where status_sales = 'BOOKING')::bigint,
    count(*) filter (where status_sales = 'DP')::bigint,
    count(*) filter (where status_sales = 'PROSES_KPR')::bigint,
    count(*) filter (where status_sales = 'AKAD')::bigint,
    count(*) filter (where status_sales = 'BATAL')::bigint,
    count(*) filter (where status_aktif = true)::bigint
  from public.sales;
$$;

create or replace function public.kavio_sales_list_page(
  p_status text default null,
  p_tipe text default null,
  p_query text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id_sales text,
  id_kavling text,
  nama_konsumen text,
  hp_konsumen text,
  status_sales text,
  jenis_pembayaran text,
  id_bank text,
  harga_jual numeric,
  tgl_booking date,
  status_aktif boolean,
  created_at timestamptz,
  id_tipe text,
  nama_tipe text,
  nama_bank text,
  harga_jual_dasar numeric,
  total_biaya_tambahan numeric,
  total_harga numeric,
  filtered_count bigint
)
language sql
stable
as $$
  select
    s.id_sales::text,
    s.id_kavling::text,
    s.nama_konsumen::text,
    s.hp_konsumen::text,
    s.status_sales::text,
    s.jenis_pembayaran::text,
    s.id_bank::text,
    s.harga_jual::numeric,
    s.tgl_booking::date,
    s.status_aktif::boolean,
    s.created_at,
    k.id_tipe::text,
    t.nama_tipe::text,
    b.nama_bank::text,
    vh.harga_jual_dasar::numeric,
    vh.total_biaya_tambahan::numeric,
    vh.total_harga::numeric,
    count(*) over()::bigint
  from public.sales s
  left join public.master_kavling k on k.id_kavling = s.id_kavling
  left join public.master_tipe_rumah t on t.id_tipe = k.id_tipe
  left join public.master_bank b on b.id_bank = s.id_bank
  left join public.v_sales_harga vh on vh.id_sales = s.id_sales
  where (nullif(trim(p_status), '') is null or s.status_sales = p_status)
    and (nullif(trim(p_tipe), '') is null or k.id_tipe = p_tipe)
    and (
      nullif(trim(p_query), '') is null
      or s.nama_konsumen ilike '%' || trim(p_query) || '%'
      or s.id_kavling::text ilike '%' || trim(p_query) || '%'
      or coalesce(s.hp_konsumen::text, '') ilike '%' || trim(p_query) || '%'
    )
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.kavio_spk_kpi()
returns table (
  total_spk bigint,
  aktif bigint,
  draft bigint,
  selesai bigint
)
language sql
stable
as $$
  select
    count(*)::bigint,
    count(*) filter (where is_active = true)::bigint,
    count(*) filter (where status_spk = 'DRAFT')::bigint,
    count(*) filter (where status_spk = 'SELESAI')::bigint
  from public.spk;
$$;

grant execute on function public.kavio_sales_kpi() to authenticated;
grant execute on function public.kavio_sales_list_page(text,text,text,integer,integer) to authenticated;
grant execute on function public.kavio_spk_kpi() to authenticated;


create or replace function public.kavio_spk_curve_history(p_id_spk text)
returns table (
  tanggal_update date,
  progress_aktual numeric
)
language sql
stable
as $$
  with config as (
    select id_kategori, bobot_final::numeric as bobot_final
    from public.spk_progress_config
    where id_spk::text = p_id_spk
  ),
  daily as (
    select
      pu.tanggal_update::date as tanggal_update,
      pu.id_kategori,
      sum(coalesce(pu.progress_periode, 0))::numeric as progress_periode
    from public.progress_update pu
    where pu.id_spk::text = p_id_spk
    group by pu.tanggal_update::date, pu.id_kategori
  ),
  running as (
    select
      d.tanggal_update,
      d.id_kategori,
      least(
        1::numeric,
        sum(d.progress_periode) over (
          partition by d.id_kategori
          order by d.tanggal_update
          rows between unbounded preceding and current row
        )
      ) as progress_akumulasi
    from daily d
  ),
  dates as (
    select distinct tanggal_update
    from daily
  )
  select
    dt.tanggal_update,
    coalesce(
      sum(
        coalesce((
          select r.progress_akumulasi
          from running r
          where r.id_kategori = c.id_kategori
            and r.tanggal_update <= dt.tanggal_update
          order by r.tanggal_update desc
          limit 1
        ), 0::numeric) * c.bobot_final
      ),
      0::numeric
    )::numeric as progress_aktual
  from dates dt
  cross join config c
  group by dt.tanggal_update
  order by dt.tanggal_update;
$$;

grant execute on function public.kavio_spk_curve_history(text) to authenticated;



-- Phase 5: evidence-based indexes for current KAVIO access patterns.
create index if not exists idx_siteplan_mapping_version
  on public.siteplan_kavling_mapping (siteplan_version_id);

create index if not exists idx_sales_created_at_desc
  on public.sales (created_at desc);

create index if not exists idx_spk_created_at_desc
  on public.spk (created_at desc);

-- Keep only one identical active-sales uniqueness index.
drop index if exists public.ux_sales_one_active_per_kavling;

-- Avoid evaluating write authorization as a permissive SELECT policy.
drop policy if exists kavio_write_sales on public.sales;
create policy kavio_insert_sales on public.sales
  for insert to authenticated
  with check ((select public.kavio_can_action('SALES_WRITE')));
create policy kavio_update_sales on public.sales
  for update to authenticated
  using ((select public.kavio_can_action('SALES_WRITE')))
  with check ((select public.kavio_can_action('SALES_WRITE')));
create policy kavio_delete_sales on public.sales
  for delete to authenticated
  using ((select public.kavio_can_action('SALES_WRITE')));

drop policy if exists kavio_write_spk on public.spk;
create policy kavio_insert_spk on public.spk
  for insert to authenticated
  with check ((select public.kavio_can_action('SPK_WRITE')));
create policy kavio_update_spk on public.spk
  for update to authenticated
  using ((select public.kavio_can_action('SPK_WRITE')))
  with check ((select public.kavio_can_action('SPK_WRITE')));
create policy kavio_delete_spk on public.spk
  for delete to authenticated
  using ((select public.kavio_can_action('SPK_WRITE')));

drop policy if exists kavio_write_progress on public.progress_update;
create policy kavio_insert_progress on public.progress_update
  for insert to authenticated
  with check ((select public.kavio_can_action('PROGRESS_WRITE')));
create policy kavio_update_progress on public.progress_update
  for update to authenticated
  using ((select public.kavio_can_action('PROGRESS_WRITE')))
  with check ((select public.kavio_can_action('PROGRESS_WRITE')));
create policy kavio_delete_progress on public.progress_update
  for delete to authenticated
  using ((select public.kavio_can_action('PROGRESS_WRITE')));

drop policy if exists kavio_write_spk_config on public.spk_progress_config;
create policy kavio_insert_spk_config on public.spk_progress_config
  for insert to authenticated
  with check ((select public.kavio_can_action('SPK_WRITE')));
create policy kavio_update_spk_config on public.spk_progress_config
  for update to authenticated
  using ((select public.kavio_can_action('SPK_WRITE')))
  with check ((select public.kavio_can_action('SPK_WRITE')));
create policy kavio_delete_spk_config on public.spk_progress_config
  for delete to authenticated
  using ((select public.kavio_can_action('SPK_WRITE')));

drop policy if exists kavio_write_master on public.master_kavling;
create policy kavio_insert_master_kavling on public.master_kavling
  for insert to authenticated
  with check ((select public.kavio_can_action('MASTER_WRITE')));
create policy kavio_update_master_kavling on public.master_kavling
  for update to authenticated
  using ((select public.kavio_can_action('MASTER_WRITE')))
  with check ((select public.kavio_can_action('MASTER_WRITE')));
create policy kavio_delete_master_kavling on public.master_kavling
  for delete to authenticated
  using ((select public.kavio_can_action('MASTER_WRITE')));

-- Fix auth.uid() initplan warning on mapping write policies.
drop policy if exists siteplan_mapping_insert_authenticated on public.siteplan_kavling_mapping;
create policy siteplan_mapping_insert_authenticated on public.siteplan_kavling_mapping
  for insert to authenticated
  with check (
    (select public.kavio_can_action('SITEPLAN_MAP'))
    and updated_by = (select auth.uid())
  );

drop policy if exists siteplan_mapping_update_authenticated on public.siteplan_kavling_mapping;
create policy siteplan_mapping_update_authenticated on public.siteplan_kavling_mapping
  for update to authenticated
  using ((select public.kavio_can_action('SITEPLAN_MAP')))
  with check (
    (select public.kavio_can_action('SITEPLAN_MAP'))
    and updated_by = (select auth.uid())
  );

drop policy if exists siteplan_mapping_delete_authenticated on public.siteplan_kavling_mapping;
create policy siteplan_mapping_delete_authenticated on public.siteplan_kavling_mapping
  for delete to authenticated
  using ((select public.kavio_can_action('SITEPLAN_MAP')));



-- Phase 5 continuation: remove remaining SELECT policy overlap and initplan warnings.

create index if not exists idx_siteplan_mapping_updated_by
  on public.siteplan_kavling_mapping (updated_by);

create index if not exists idx_siteplan_versions_uploaded_by
  on public.siteplan_versions (uploaded_by);

-- Master tables: keep SELECT open to authenticated users, move manager writes
-- to command-specific policies so SELECT no longer evaluates write permission.
do $$
declare
  t text;
begin
  foreach t in array array[
    'master_bank',
    'master_kantor_pelaksana',
    'master_kategori_pekerjaan',
    'master_mandor',
    'master_notaris',
    'master_tipe_rumah',
    'template_progress_tipe'
  ]
  loop
    execute format('drop policy if exists kavio_write_managers on public.%I', t);
    execute format(
      'create policy kavio_insert_managers on public.%I for insert to authenticated with check ((select public.kavio_can_action(''MASTER_WRITE'')))',
      t
    );
    execute format(
      'create policy kavio_update_managers on public.%I for update to authenticated using ((select public.kavio_can_action(''MASTER_WRITE''))) with check ((select public.kavio_can_action(''MASTER_WRITE'')))',
      t
    );
    execute format(
      'create policy kavio_delete_managers on public.%I for delete to authenticated using ((select public.kavio_can_action(''MASTER_WRITE'')))',
      t
    );
  end loop;
end $$;

drop policy if exists kavio_write_sales_biaya on public.sales_biaya_tambahan;
create policy kavio_insert_sales_biaya on public.sales_biaya_tambahan
  for insert to authenticated
  with check ((select public.kavio_can_action('SALES_WRITE')));
create policy kavio_update_sales_biaya on public.sales_biaya_tambahan
  for update to authenticated
  using ((select public.kavio_can_action('SALES_WRITE')))
  with check ((select public.kavio_can_action('SALES_WRITE')));
create policy kavio_delete_sales_biaya on public.sales_biaya_tambahan
  for delete to authenticated
  using ((select public.kavio_can_action('SALES_WRITE')));

drop policy if exists kavio_write_sales_kpr on public.sales_kpr_progress;
create policy kavio_insert_sales_kpr on public.sales_kpr_progress
  for insert to authenticated
  with check ((select public.kavio_can_action('SALES_WRITE')));
create policy kavio_update_sales_kpr on public.sales_kpr_progress
  for update to authenticated
  using ((select public.kavio_can_action('SALES_WRITE')))
  with check ((select public.kavio_can_action('SALES_WRITE')));
create policy kavio_delete_sales_kpr on public.sales_kpr_progress
  for delete to authenticated
  using ((select public.kavio_can_action('SALES_WRITE')));

-- Siteplan versions: ensure auth/user and action checks are initplans.
drop policy if exists siteplan_versions_insert_authenticated on public.siteplan_versions;
create policy siteplan_versions_insert_authenticated on public.siteplan_versions
  for insert to authenticated
  with check (
    (select public.kavio_can_action('SITEPLAN_MAP'))
    and uploaded_by = (select auth.uid())
  );

drop policy if exists siteplan_versions_update_authenticated on public.siteplan_versions;
create policy siteplan_versions_update_authenticated on public.siteplan_versions
  for update to authenticated
  using ((select public.kavio_can_action('SITEPLAN_MAP')))
  with check ((select public.kavio_can_action('SITEPLAN_MAP')));

drop policy if exists siteplan_versions_delete_authenticated on public.siteplan_versions;
create policy siteplan_versions_delete_authenticated on public.siteplan_versions
  for delete to authenticated
  using ((select public.kavio_can_action('SITEPLAN_MAP')));

-- User profiles: preserve self-read and manager-read semantics in one SELECT
-- policy, with manager writes separated by command.
drop policy if exists user_profiles_manager_write on public.user_profiles;
drop policy if exists user_profiles_self_select on public.user_profiles;

create policy user_profiles_select on public.user_profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.kavio_can_action('USER_MANAGE'))
  );

create policy user_profiles_manager_insert on public.user_profiles
  for insert to authenticated
  with check ((select public.kavio_can_action('USER_MANAGE')));
create policy user_profiles_manager_update on public.user_profiles
  for update to authenticated
  using ((select public.kavio_can_action('USER_MANAGE')))
  with check ((select public.kavio_can_action('USER_MANAGE')));
create policy user_profiles_manager_delete on public.user_profiles
  for delete to authenticated
  using ((select public.kavio_can_action('USER_MANAGE')));


-- Phase 6B: Operational integrity hardening
create or replace function public.set_sales_harga_jual_dasar()
returns trigger language plpgsql set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' or new.id_kavling is distinct from old.id_kavling then
    select mk.harga_jual into new.harga_jual from public.master_kavling mk where mk.id_kavling = new.id_kavling;
    if new.harga_jual is null then new.harga_jual := 0; end if;
  end if;
  return new;
end;
$function$;

create or replace function public.update_sales_atomic(
  p_id_sales uuid,p_nama_konsumen text,p_alamat_konsumen text,p_hp_konsumen text,p_status_sales text,
  p_jenis_pembayaran text,p_id_bank text,p_id_notaris text,p_tgl_akad date,p_target_akad date
) returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_sales public.sales%rowtype; v_kavling public.master_kavling%rowtype; v_existing_akad uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SALES_WRITE') then raise exception 'FORBIDDEN: SALES_WRITE'; end if;
  if p_status_sales not in ('BOOKING','DP','PROSES_KPR','AKAD','BATAL') then raise exception 'STATUS SALES TIDAK VALID'; end if;
  if p_jenis_pembayaran not in ('KPR','CASH','CASH_BERTAHAP') then raise exception 'JENIS PEMBAYARAN TIDAK VALID'; end if;
  if nullif(btrim(coalesce(p_nama_konsumen,'')), '') is null then raise exception 'NAMA KONSUMEN WAJIB DIISI'; end if;
  select * into v_sales from public.sales where id_sales=p_id_sales for update;
  if not found then raise exception 'DATA SALES TIDAK DITEMUKAN'; end if;
  select * into v_kavling from public.master_kavling where id_kavling=v_sales.id_kavling for update;
  if not found or not v_kavling.status_aktif then raise exception 'KAVLING SALES TIDAK AKTIF ATAU TIDAK DITEMUKAN'; end if;
  if v_sales.status_sales='AKAD' and p_status_sales<>'AKAD' then raise exception 'SALES YANG SUDAH AKAD TIDAK DAPAT DIBUKA KEMBALI'; end if;
  if v_sales.status_aktif=false and p_status_sales<>'BATAL' then raise exception 'SALES YANG SUDAH DITUTUP TIDAK DAPAT DIAKTIFKAN KEMBALI. BUAT SALES BARU PADA KAVLING YANG BERSTATUS BATAL.'; end if;
  if v_sales.tgl_booking is not null and p_target_akad is not null and p_target_akad<v_sales.tgl_booking then raise exception 'TARGET AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING'; end if;
  if v_sales.tgl_booking is not null and p_tgl_akad is not null and p_tgl_akad<v_sales.tgl_booking then raise exception 'TANGGAL AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING'; end if;
  if p_jenis_pembayaran='KPR' and nullif(btrim(coalesce(p_id_bank,'')),'') is null then raise exception 'BANK KPR WAJIB DIISI'; end if;
  if p_jenis_pembayaran<>'KPR' and nullif(btrim(coalesce(p_id_bank,'')),'') is not null then raise exception 'BANK HANYA DIISI UNTUK KPR'; end if;
  if p_status_sales='AKAD' and (p_tgl_akad is null or nullif(btrim(coalesce(p_id_notaris,'')),'') is null or p_target_akad is null) then raise exception 'TARGET AKAD, TANGGAL AKAD, DAN NOTARIS WAJIB DIISI UNTUK STATUS AKAD'; end if;
  if p_status_sales<>'AKAD' and p_tgl_akad is not null then raise exception 'TANGGAL AKAD HANYA DIISI SAAT STATUS AKAD'; end if;
  if p_status_sales<>'AKAD' and nullif(btrim(coalesce(p_id_notaris,'')),'') is not null then raise exception 'NOTARIS AKAD HANYA DIISI SAAT STATUS AKAD'; end if;
  if p_status_sales<>'BATAL' then
    select id_sales into v_existing_akad from public.sales where id_kavling=v_sales.id_kavling and status_sales='AKAD' and id_sales<>p_id_sales limit 1;
    if v_existing_akad is not null then raise exception 'KAVLING SUDAH PERNAH AKAD DAN TIDAK DAPAT MEMILIKI SALES BARU'; end if;
  end if;
  update public.sales set
    nama_konsumen=btrim(p_nama_konsumen),
    alamat_konsumen=nullif(btrim(coalesce(p_alamat_konsumen,'')),''),
    hp_konsumen=nullif(btrim(coalesce(p_hp_konsumen,'')),''),
    status_sales=p_status_sales, jenis_pembayaran=p_jenis_pembayaran,
    id_bank=case when p_jenis_pembayaran='KPR' then nullif(btrim(coalesce(p_id_bank,'')),'') else null end,
    id_notaris=case when p_status_sales='AKAD' then nullif(btrim(coalesce(p_id_notaris,'')),'') else null end,
    tgl_akad=case when p_status_sales='AKAD' then p_tgl_akad else null end,
    target_akad=p_target_akad, status_aktif=p_status_sales<>'BATAL'
  where id_sales=p_id_sales;
end;
$function$;

create or replace function public.create_sales_atomic(
  p_id_kavling text,p_nama_konsumen text,p_alamat_konsumen text,p_hp_konsumen text,p_status_sales text,
  p_jenis_pembayaran text,p_id_bank text,p_id_notaris text,p_tgl_booking date,p_target_akad date,p_tgl_akad date,
  p_biaya_penambahan_bangunan numeric,p_biaya_notaris numeric,p_biaya_hook numeric,p_biaya_lainnya numeric
) returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare v_kavling public.master_kavling%rowtype; v_id_sales uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SALES_WRITE') then raise exception 'FORBIDDEN: SALES_WRITE'; end if;
  p_id_kavling := btrim(coalesce(p_id_kavling,'')); p_nama_konsumen := btrim(coalesce(p_nama_konsumen,''));
  if p_id_kavling='' or p_nama_konsumen='' then raise exception 'KAVLING DAN NAMA KONSUMEN WAJIB DIISI'; end if;
  if p_status_sales not in ('BOOKING','DP','PROSES_KPR','AKAD') then raise exception 'STATUS SALES BARU TIDAK VALID'; end if;
  if p_jenis_pembayaran not in ('KPR','CASH','CASH_BERTAHAP') then raise exception 'JENIS PEMBAYARAN TIDAK VALID'; end if;
  if coalesce(p_biaya_penambahan_bangunan,0)<0 or coalesce(p_biaya_notaris,0)<0 or coalesce(p_biaya_hook,0)<0 or coalesce(p_biaya_lainnya,0)<0 then raise exception 'BIAYA TAMBAHAN TIDAK VALID'; end if;
  if p_tgl_booking is not null and p_target_akad is not null and p_target_akad<p_tgl_booking then raise exception 'TARGET AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING'; end if;
  if p_tgl_booking is not null and p_tgl_akad is not null and p_tgl_akad<p_tgl_booking then raise exception 'TANGGAL AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING'; end if;
  if p_jenis_pembayaran='KPR' and nullif(btrim(coalesce(p_id_bank,'')),'') is null then raise exception 'BANK KPR WAJIB DIPILIH UNTUK PEMBAYARAN KPR'; end if;
  if p_status_sales='AKAD' and (p_tgl_akad is null or nullif(btrim(coalesce(p_id_notaris,'')),'') is null or p_target_akad is null) then raise exception 'TARGET AKAD, TANGGAL AKAD, DAN NOTARIS WAJIB DIISI UNTUK STATUS AKAD'; end if;
  select * into v_kavling from public.master_kavling where id_kavling=p_id_kavling for update;
  if not found or not v_kavling.status_aktif then raise exception 'KAVLING TIDAK DITEMUKAN ATAU NONAKTIF'; end if;
  if v_kavling.status_kavling not in ('AVAILABLE','BUILDING','READY_STOCK') then raise exception 'KAVLING BERSTATUS % TIDAK DAPAT DIBUATKAN SALES BARU', v_kavling.status_kavling; end if;
  if exists(select 1 from public.sales where id_kavling=p_id_kavling and status_aktif=true) then raise exception 'KAVLING TERSEBUT SUDAH MEMILIKI SALES AKTIF'; end if;
  if exists(select 1 from public.sales where id_kavling=p_id_kavling and status_sales='AKAD') then raise exception 'KAVLING TERSEBUT SUDAH PERNAH AKAD DAN TIDAK DAPAT MEMILIKI SALES BARU'; end if;
  insert into public.sales(id_kavling,nama_konsumen,alamat_konsumen,hp_konsumen,status_sales,jenis_pembayaran,id_bank,id_notaris,tgl_booking,target_akad,tgl_akad,status_aktif)
  values(p_id_kavling,p_nama_konsumen,nullif(btrim(coalesce(p_alamat_konsumen,'')),''),nullif(btrim(coalesce(p_hp_konsumen,'')),''),
    p_status_sales,p_jenis_pembayaran,case when p_jenis_pembayaran='KPR' then nullif(btrim(coalesce(p_id_bank,'')),'') else null end,
    case when p_status_sales='AKAD' then nullif(btrim(coalesce(p_id_notaris,'')),'') else null end,
    p_tgl_booking,p_target_akad,case when p_status_sales='AKAD' then p_tgl_akad else null end,true)
  returning id_sales into v_id_sales;
  if coalesce(p_biaya_penambahan_bangunan,0)>0 then insert into public.sales_biaya_tambahan(id_sales,jenis_biaya,nominal,status_aktif) values(v_id_sales,'PENAMBAHAN BANGUNAN',p_biaya_penambahan_bangunan,true); end if;
  if coalesce(p_biaya_notaris,0)>0 then insert into public.sales_biaya_tambahan(id_sales,jenis_biaya,nominal,status_aktif) values(v_id_sales,'NOTARIS',p_biaya_notaris,true); end if;
  if coalesce(p_biaya_hook,0)>0 then insert into public.sales_biaya_tambahan(id_sales,jenis_biaya,nominal,status_aktif) values(v_id_sales,'PEMILIHAN LOKASI HOOK',p_biaya_hook,true); end if;
  if coalesce(p_biaya_lainnya,0)>0 then insert into public.sales_biaya_tambahan(id_sales,jenis_biaya,nominal,status_aktif) values(v_id_sales,'BIAYA LAINNYA',p_biaya_lainnya,true); end if;
  return v_id_sales;
end;
$function$;

create or replace function public.insert_progress_update_atomic(
  p_id_spk uuid,p_id_kategori text,p_tanggal_update date,p_progress_percent numeric,p_keterangan text
) returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare v_spk public.spk%rowtype; v_total_bobot numeric; v_count_bobot integer; v_current numeric; v_id_progress uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('PROGRESS_WRITE') then raise exception 'FORBIDDEN: PROGRESS_WRITE'; end if;
  if p_id_spk is null or nullif(btrim(coalesce(p_id_kategori,'')),'') is null or p_tanggal_update is null then raise exception 'SPK, KATEGORI, DAN TANGGAL WAJIB DIISI'; end if;
  if p_progress_percent is null or p_progress_percent<0 or p_progress_percent>100 then raise exception 'PROGRESS PERIODE HARUS 0-100%%'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id_spk::text || ':' || p_id_kategori,0));
  select * into v_spk from public.spk where id_spk=p_id_spk for update;
  if not found or not v_spk.is_active or v_spk.status_spk<>'AKTIF' then raise exception 'SPK TIDAK AKTIF ATAU TIDAK DITEMUKAN'; end if;
  if p_tanggal_update<v_spk.tgl_spk then raise exception 'TANGGAL UPDATE TIDAK BOLEH SEBELUM TANGGAL SPK'; end if;
  if p_tanggal_update>current_date then raise exception 'TANGGAL UPDATE TIDAK BOLEH DI MASA DEPAN'; end if;
  if not exists(select 1 from public.spk_progress_config where id_spk=p_id_spk and id_kategori=p_id_kategori) then raise exception 'KATEGORI TERSEBUT TIDAK TERDAFTAR PADA KONFIGURASI SPK'; end if;
  select count(*),coalesce(sum(bobot_final),0) into v_count_bobot,v_total_bobot from public.spk_progress_config where id_spk=p_id_spk;
  if v_count_bobot=0 or abs(v_total_bobot-1)>0.00001 then raise exception 'KONFIGURASI BOBOT SPK TIDAK VALID. TOTAL SAAT INI %%%',round(v_total_bobot*100,2); end if;
  if exists(select 1 from public.progress_update where id_spk=p_id_spk and id_kategori=p_id_kategori and tanggal_update=p_tanggal_update) then raise exception 'PROGRESS UNTUK KATEGORI DAN TANGGAL TERSEBUT SUDAH ADA'; end if;
  select coalesce(sum(progress_periode),0) into v_current from public.progress_update where id_spk=p_id_spk and id_kategori=p_id_kategori;
  if v_current>=0.999999 then raise exception 'KATEGORI TERSEBUT SUDAH MENCAPAI 100%%'; end if;
  if v_current+(p_progress_percent/100.0)>1.000001 then raise exception 'PROGRESS KUMULATIF MELEBIHI 100%%. SAAT INI %%%',round(v_current*100,2); end if;
  insert into public.progress_update(id_spk,tanggal_update,id_kategori,progress_periode,keterangan,input_by)
  values(p_id_spk,p_tanggal_update,p_id_kategori,p_progress_percent/100.0,nullif(btrim(coalesce(p_keterangan,'')),''),auth.uid())
  returning id_progress into v_id_progress;
  return v_id_progress;
end;
$function$;

create or replace function public.activate_spk_atomic(p_id_spk uuid)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_spk public.spk%rowtype; v_kavling public.master_kavling%rowtype; v_other_active uuid; v_weight_total numeric; v_weight_count integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SPK_WRITE') then raise exception 'FORBIDDEN: SPK_WRITE'; end if;
  select * into v_spk from public.spk where id_spk=p_id_spk for update;
  if not found then raise exception 'SPK tidak ditemukan'; end if;
  if v_spk.status_spk<>'DRAFT' or v_spk.is_active then raise exception 'SPK tidak berada pada status DRAFT yang valid'; end if;
  select * into v_kavling from public.master_kavling where id_kavling=v_spk.id_kavling for update;
  if not found or not v_kavling.status_aktif then raise exception 'Kavling pada SPK tidak aktif atau tidak ditemukan'; end if;
  if v_kavling.status_kavling not in ('AVAILABLE','BOOKING') then raise exception 'Kavling berstatus % tidak siap untuk SPK',v_kavling.status_kavling; end if;
  select id_spk into v_other_active from public.spk where id_kavling=v_spk.id_kavling and is_active=true and id_spk<>p_id_spk limit 1;
  if v_other_active is not null then raise exception 'Kavling tersebut sudah memiliki SPK aktif lain'; end if;
  select count(*),coalesce(sum(bobot_final),0) into v_weight_count,v_weight_total from public.spk_progress_config where id_spk=p_id_spk;
  if v_weight_count=0 or abs(v_weight_total-1)>0.00001 then raise exception 'SPK tidak dapat diaktifkan. Total bobot harus 100%%, saat ini %%%',round(v_weight_total*100,2); end if;
  update public.spk set status_spk='AKTIF',is_active=true where id_spk=p_id_spk and status_spk='DRAFT' and is_active=false;
  if not found then raise exception 'SPK berubah sebelum aktivasi. Silakan coba lagi'; end if;
end;
$function$;

create or replace function public.deactivate_spk_atomic(p_id_spk uuid)
returns text language plpgsql security definer set search_path to 'public'
as $function$
declare v_spk public.spk%rowtype; v_next_status text; v_progress_total numeric;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SPK_WRITE') then raise exception 'FORBIDDEN: SPK_WRITE'; end if;
  select * into v_spk from public.spk where id_spk=p_id_spk for update;
  if not found or not v_spk.is_active then raise exception 'SPK aktif tidak ditemukan'; end if;
  if v_spk.status_spk<>'AKTIF' then raise exception 'Hanya SPK AKTIF yang dapat ditandai selesai'; end if;
  perform 1 from public.master_kavling where id_kavling=v_spk.id_kavling and status_aktif=true for update;
  if not found then raise exception 'Kavling pada SPK tidak aktif atau tidak ditemukan'; end if;
  select coalesce(sum(progress_berbobot),0) into v_progress_total from public.v_progress_kategori_current where id_spk=p_id_spk;
  if v_progress_total<0.99999 then raise exception 'SPK belum dapat diselesaikan. Progress aktual baru %%%',round(v_progress_total*100,2); end if;
  update public.spk set status_spk='SELESAI',is_active=false where id_spk=p_id_spk and is_active=true and status_spk='AKTIF';
  if not found then raise exception 'SPK berubah sebelum diselesaikan. Silakan coba lagi'; end if;
  v_next_status := public.kavio_sync_kavling_status(v_spk.id_kavling);
  return coalesce(v_next_status,'READY_STOCK');
end;
$function$;

revoke all on function public.kavio_sync_kavling_status(text) from public, anon, authenticated;
grant execute on function public.kavio_sync_kavling_status(text) to service_role;
revoke all on function public.update_sales_atomic(uuid,text,text,text,text,text,text,text,date,date) from public, anon;
grant execute on function public.update_sales_atomic(uuid,text,text,text,text,text,text,text,date,date) to authenticated, service_role;
revoke all on function public.activate_spk_atomic(uuid) from public, anon;
grant execute on function public.activate_spk_atomic(uuid) to authenticated, service_role;
revoke all on function public.deactivate_spk_atomic(uuid) from public, anon;
grant execute on function public.deactivate_spk_atomic(uuid) to authenticated, service_role;
revoke all on function public.create_sales_atomic(text,text,text,text,text,text,text,text,date,date,date,numeric,numeric,numeric,numeric) from public, anon;
grant execute on function public.create_sales_atomic(text,text,text,text,text,text,text,text,date,date,date,numeric,numeric,numeric,numeric) to authenticated, service_role;
revoke all on function public.insert_progress_update_atomic(uuid,text,date,numeric,text) from public, anon;
grant execute on function public.insert_progress_update_atomic(uuid,text,date,numeric,text) to authenticated, service_role;
