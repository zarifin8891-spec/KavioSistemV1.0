create or replace function public.create_or_update_spk_atomic(
  p_id_kavling text,p_tgl_spk date,p_tgl_target_selesai date,p_id_kantor text,p_id_mandor text,p_jenis_bobot text,p_config jsonb
) returns jsonb language plpgsql security definer set search_path to 'public'
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

  v_total := 0; v_count := 0;
  for v_item in select value from jsonb_array_elements(p_config)
  loop
    v_kategori := nullif(btrim(coalesce(v_item->>'id_kategori','')),'');
    begin v_bobot := (v_item->>'bobot_final')::numeric;
    exception when others then raise exception 'BOBOT SPK TIDAK VALID'; end;
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
    set tgl_spk=p_tgl_spk,id_tipe=v_kavling.id_tipe,jenis_bobot=p_jenis_bobot,id_kantor=p_id_kantor,id_mandor=p_id_mandor,
        status_spk='AKTIF',tgl_target_selesai=p_tgl_target_selesai,is_active=true
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

create or replace function public.validate_progress_relations()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  v_spk public.spk%rowtype;
begin
  select * into v_spk from public.spk where id_spk = new.id_spk;
  if not found then raise exception 'SPK % tidak ditemukan', new.id_spk; end if;
  if not v_spk.is_active or v_spk.status_spk <> 'AKTIF' then raise exception 'SPK % tidak aktif', new.id_spk; end if;
  if not exists (select 1 from public.spk_progress_config c where c.id_spk = new.id_spk and c.id_kategori = new.id_kategori) then
    raise exception 'Kategori % belum dikonfigurasi pada SPK %', new.id_kategori, new.id_spk;
  end if;
  if new.tanggal_update < v_spk.tgl_spk then raise exception 'Tanggal update tidak boleh sebelum tanggal SPK'; end if;
  if new.tanggal_update > current_date then raise exception 'Tanggal update tidak boleh di masa depan'; end if;
  return new;
end;
$function$;

create or replace function public.validate_sales_business_rules()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if new.status_sales not in ('BOOKING','DP','PROSES_KPR','AKAD','BATAL') then raise exception 'STATUS SALES TIDAK VALID'; end if;
  if new.jenis_pembayaran not in ('KPR','CASH','CASH_BERTAHAP') then raise exception 'JENIS PEMBAYARAN TIDAK VALID'; end if;
  if new.jenis_pembayaran='KPR' and new.id_bank is null then raise exception 'BANK KPR WAJIB DIISI'; end if;
  if new.jenis_pembayaran<>'KPR' and new.id_bank is not null then raise exception 'BANK HANYA DIISI UNTUK KPR'; end if;
  if new.status_sales='AKAD' and (new.tgl_akad is null or new.id_notaris is null or new.target_akad is null) then
    raise exception 'TARGET AKAD, TANGGAL AKAD, DAN NOTARIS WAJIB DIISI UNTUK STATUS AKAD';
  end if;
  if new.status_sales<>'AKAD' and (new.tgl_akad is not null or new.id_notaris is not null) then
    raise exception 'TANGGAL AKAD DAN NOTARIS HANYA DIISI SAAT STATUS AKAD';
  end if;
  if new.tgl_booking is not null and new.target_akad is not null and new.target_akad < new.tgl_booking then
    raise exception 'TARGET AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING';
  end if;
  if new.tgl_booking is not null and new.tgl_akad is not null and new.tgl_akad < new.tgl_booking then
    raise exception 'TANGGAL AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING';
  end if;
  if new.status_sales='BATAL' and new.status_aktif then raise exception 'SALES BATAL TIDAK BOLEH AKTIF'; end if;
  return new;
end;
$function$;

drop trigger if exists trg_validate_sales_business_rules on public.sales;
create trigger trg_validate_sales_business_rules
before insert or update on public.sales
for each row execute function public.validate_sales_business_rules();

create or replace function public.guard_active_spk_weight_config()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  v_id_spk uuid;
  v_status text;
begin
  v_id_spk := coalesce(new.id_spk, old.id_spk);
  select status_spk into v_status from public.spk where id_spk=v_id_spk;
  if v_status is not null and v_status <> 'DRAFT' then raise exception 'Bobot SPK tidak dapat diubah setelah SPK aktif'; end if;
  return coalesce(new,old);
end;
$function$;

drop trigger if exists trg_guard_active_spk_weight_config on public.spk_progress_config;
create trigger trg_guard_active_spk_weight_config
before insert or update or delete on public.spk_progress_config
for each row execute function public.guard_active_spk_weight_config();

create or replace function public.upsert_kpr_progress_atomic(
  p_id_sales uuid,p_tahap text,p_tanggal_update date,p_keterangan text
) returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare v_sales public.sales%rowtype; v_id_progress uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SALES_WRITE') then raise exception 'FORBIDDEN: SALES_WRITE'; end if;
  if p_id_sales is null or p_tahap not in ('KELENGKAPAN_DATA','SURVEY_BANK','INTERVIEW','SP3K') or p_tanggal_update is null then raise exception 'DATA UPDATE KPR TIDAK LENGKAP'; end if;
  select * into v_sales from public.sales where id_sales=p_id_sales for update;
  if not found then raise exception 'DATA SALES TIDAK DITEMUKAN'; end if;
  if v_sales.jenis_pembayaran <> 'KPR' then raise exception 'TRACKING KPR HANYA UNTUK SALES KPR'; end if;
  if not v_sales.status_aktif or v_sales.status_sales='BATAL' then raise exception 'SALES TIDAK AKTIF'; end if;
  if v_sales.tgl_booking is not null and p_tanggal_update < v_sales.tgl_booking then raise exception 'TANGGAL UPDATE KPR TIDAK BOLEH SEBELUM TANGGAL BOOKING'; end if;
  if p_tanggal_update > current_date then raise exception 'TANGGAL UPDATE KPR TIDAK BOLEH DI MASA DEPAN'; end if;
  insert into public.sales_kpr_progress(id_sales,tahap,tanggal_update,keterangan,input_by)
  values(p_id_sales,p_tahap,p_tanggal_update,nullif(btrim(coalesce(p_keterangan,'')),''),auth.uid())
  on conflict(id_sales,tahap)
  do update set tanggal_update=excluded.tanggal_update,keterangan=excluded.keterangan,input_by=excluded.input_by
  returning id_progress into v_id_progress;
  return v_id_progress;
end;
$function$;

create or replace function public.save_sales_biaya_atomic(
  p_id_sales uuid,p_biaya_penambahan_bangunan numeric,p_biaya_notaris numeric,p_biaya_hook numeric,p_biaya_lainnya numeric
) returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_sale uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SALES_WRITE') then raise exception 'FORBIDDEN: SALES_WRITE'; end if;
  if p_id_sales is null then raise exception 'ID SALES TIDAK VALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('sales-cost:' || p_id_sales::text,0));
  select id_sales into v_sale from public.sales where id_sales=p_id_sales for update;
  if not found then raise exception 'DATA SALES TIDAK DITEMUKAN'; end if;
  if coalesce(p_biaya_penambahan_bangunan,0)<0 or coalesce(p_biaya_notaris,0)<0 or coalesce(p_biaya_hook,0)<0 or coalesce(p_biaya_lainnya,0)<0 then
    raise exception 'BIAYA TAMBAHAN TIDAK VALID';
  end if;
  insert into public.sales_biaya_tambahan(id_sales,jenis_biaya,nominal,status_aktif)
  values
    (p_id_sales,'PENAMBAHAN BANGUNAN',coalesce(p_biaya_penambahan_bangunan,0),true),
    (p_id_sales,'NOTARIS',coalesce(p_biaya_notaris,0),true),
    (p_id_sales,'PEMILIHAN LOKASI HOOK',coalesce(p_biaya_hook,0),true),
    (p_id_sales,'BIAYA LAINNYA',coalesce(p_biaya_lainnya,0),true)
  on conflict(id_sales,jenis_biaya)
  do update set nominal=excluded.nominal,status_aktif=true;
  delete from public.sales_biaya_tambahan where id_sales=p_id_sales and nominal=0;
end;
$function$;

create or replace function public.close_sales_atomic(p_id_sales uuid)
returns text language plpgsql security definer set search_path to 'public'
as $function$
declare v_sales public.sales%rowtype; v_next_status text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.kavio_can_action('SALES_WRITE') then raise exception 'FORBIDDEN: SALES_WRITE'; end if;
  if p_id_sales is null then raise exception 'ID SALES TIDAK VALID'; end if;
  select * into v_sales from public.sales where id_sales=p_id_sales for update;
  if not found then raise exception 'DATA SALES TIDAK DITEMUKAN'; end if;
  if not v_sales.status_aktif then raise exception 'SALES SUDAH TIDAK AKTIF'; end if;
  update public.sales
  set status_aktif=false,status_sales=case when v_sales.status_sales='AKAD' then 'AKAD' else 'BATAL' end
  where id_sales=p_id_sales and status_aktif=true;
  if not found then raise exception 'SALES BERUBAH SEBELUM DITUTUP. SILAKAN COBA LAGI'; end if;
  v_next_status := public.kavio_sync_kavling_status(v_sales.id_kavling);
  return coalesce(v_next_status,'AVAILABLE');
end;
$function$;

revoke all on function public.upsert_kpr_progress_atomic(uuid,text,date,text) from public,anon;
grant execute on function public.upsert_kpr_progress_atomic(uuid,text,date,text) to authenticated,service_role;
revoke all on function public.save_sales_biaya_atomic(uuid,numeric,numeric,numeric,numeric) from public,anon;
grant execute on function public.save_sales_biaya_atomic(uuid,numeric,numeric,numeric,numeric) to authenticated,service_role;
revoke all on function public.close_sales_atomic(uuid) from public,anon;
grant execute on function public.close_sales_atomic(uuid) to authenticated,service_role;

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


alter table public.user_profiles
  alter column status_aktif set default false;

insert into public.user_profiles (
  user_id,
  nama,
  role,
  status_aktif,
  created_at,
  updated_at
)
select
  u.id,
  null,
  'USER',
  false,
  now(),
  now()
from auth.users u
left join public.user_profiles p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;

create or replace function public.kavio_provision_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (
    user_id,
    nama,
    role,
    status_aktif,
    created_at,
    updated_at
  )
  values (
    new.id,
    null,
    'USER',
    false,
    now(),
    now()
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.kavio_provision_auth_user_profile() from public;
revoke all on function public.kavio_provision_auth_user_profile() from anon;
revoke all on function public.kavio_provision_auth_user_profile() from authenticated;
grant execute on function public.kavio_provision_auth_user_profile() to supabase_auth_admin;

drop trigger if exists kavio_on_auth_user_created on auth.users;

create trigger kavio_on_auth_user_created
after insert on auth.users
for each row
execute function public.kavio_provision_auth_user_profile();

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
    coalesce(p.status_aktif, false) as status_aktif,
    coalesce(
      array_agg(ra.action order by ra.action)
        filter (
          where ra.action is not null
            and p.status_aktif is true
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

create or replace function public.kavio_list_users()
returns table (
  user_id uuid,
  email text,
  nama text,
  role text,
  status_aktif boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
stable
as $$
begin
  if not public.kavio_is_manager() then
    raise exception 'Akses ditolak';
  end if;

  return query
  select
    u.id,
    u.email,
    p.nama,
    coalesce(p.role, 'USER'),
    coalesce(p.status_aktif, false),
    u.created_at,
    u.last_sign_in_at
  from auth.users u
  left join public.user_profiles p on p.user_id = u.id
  order by u.created_at;
end;
$$;

revoke all on function public.kavio_list_users() from public;
grant execute on function public.kavio_list_users() to authenticated;



revoke execute on function public.kavio_can_action(text) from anon;
revoke execute on function public.kavio_get_current_access() from anon;
revoke execute on function public.kavio_get_current_access_context() from anon;
revoke execute on function public.kavio_is_manager() from anon;
revoke execute on function public.kavio_list_users() from anon;
revoke execute on function public.kavio_upsert_user_profile(uuid,text,text,boolean) from anon;

revoke execute on function public.kavio_guard_last_manager() from anon;
revoke execute on function public.kavio_guard_last_manager() from authenticated;



create or replace function public.kavio_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.user_id = auth.uid()
      and p.status_aktif = true
  );
$$;

revoke all on function public.kavio_is_active_user() from public;
revoke all on function public.kavio_is_active_user() from anon;
grant execute on function public.kavio_is_active_user() to authenticated;

create or replace function public.kavio_get_current_access()
returns table (
  role text,
  status_aktif boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(p.role, 'USER') as role,
    coalesce(p.status_aktif, false) as status_aktif
  from (select auth.uid() as user_id) me
  left join public.user_profiles p on p.user_id = me.user_id;
$$;

revoke all on function public.kavio_get_current_access() from public;
revoke all on function public.kavio_get_current_access() from anon;
grant execute on function public.kavio_get_current_access() to authenticated;

alter policy kavio_select_authenticated
  on public.master_bank
  using ((select public.kavio_is_active_user()));

alter policy kavio_select_authenticated
  on public.master_kantor_pelaksana
  using ((select public.kavio_is_active_user()));

alter policy kavio_select_authenticated
  on public.master_kategori_pekerjaan
  using ((select public.kavio_is_active_user()));

alter policy kavio_select_authenticated
  on public.master_kavling
  using ((select public.kavio_is_active_user()));

alter policy kavio_select_authenticated
  on public.master_mandor
  using ((select public.kavio_is_active_user()));

alter policy kavio_select_authenticated
  on public.master_notaris
  using ((select public.kavio_is_active_user()));

alter policy kavio_select_authenticated
  on public.master_tipe_rumah
  using ((select public.kavio_is_active_user()));

alter policy kavio_select_progress
  on public.progress_update
  using ((select public.kavio_is_active_user()));

alter policy kavio_select_sales
  on public.sales
  using ((select public.kavio_is_active_user()));

alter policy kavio_select_sales_biaya
  on public.sales_biaya_tambahan
  using ((select public.kavio_is_active_user()));

alter policy kavio_select_sales_kpr
  on public.sales_kpr_progress
  using ((select public.kavio_is_active_user()));

alter policy siteplan_mapping_select_authenticated
  on public.siteplan_kavling_mapping
  using ((select public.kavio_is_active_user()));

alter policy siteplan_versions_select_authenticated
  on public.siteplan_versions
  using ((select public.kavio_is_active_user()));

alter policy kavio_select_spk
  on public.spk
  using ((select public.kavio_is_active_user()));

alter policy kavio_select_spk_config
  on public.spk_progress_config
  using ((select public.kavio_is_active_user()));

alter policy kavio_select_authenticated
  on public.template_progress_tipe
  using ((select public.kavio_is_active_user()));

alter view public.v_decision_engine set (security_invoker = true);
alter view public.v_sales_harga set (security_invoker = true);

revoke all on table public.v_dashboard_monitor from public;
revoke all on table public.v_dashboard_monitor from anon;
grant select on table public.v_dashboard_monitor to authenticated;

revoke all on table public.v_decision_engine from public;
revoke all on table public.v_decision_engine from anon;
grant select on table public.v_decision_engine to authenticated;

revoke all on table public.v_progress_kategori_current from public;
revoke all on table public.v_progress_kategori_current from anon;
grant select on table public.v_progress_kategori_current to authenticated;

revoke all on table public.v_progress_summary from public;
revoke all on table public.v_progress_summary from anon;
grant select on table public.v_progress_summary to authenticated;

revoke all on table public.v_sales_harga from public;
revoke all on table public.v_sales_harga from anon;
grant select on table public.v_sales_harga to authenticated;

alter function public.kavio_sales_kpi() set search_path = public;
alter function public.kavio_sales_list_page(text,text,text,integer,integer) set search_path = public;
alter function public.kavio_spk_kpi() set search_path = public;
alter function public.kavio_spk_curve_history(text) set search_path = public;

revoke all on function public.kavio_sales_kpi() from public;
revoke all on function public.kavio_sales_kpi() from anon;
grant execute on function public.kavio_sales_kpi() to authenticated;

revoke all on function public.kavio_sales_list_page(text,text,text,integer,integer) from public;
revoke all on function public.kavio_sales_list_page(text,text,text,integer,integer) from anon;
grant execute on function public.kavio_sales_list_page(text,text,text,integer,integer) to authenticated;

revoke all on function public.kavio_spk_kpi() from public;
revoke all on function public.kavio_spk_kpi() from anon;
grant execute on function public.kavio_spk_kpi() to authenticated;

revoke all on function public.kavio_spk_curve_history(text) from public;
revoke all on function public.kavio_spk_curve_history(text) from anon;
grant execute on function public.kavio_spk_curve_history(text) to authenticated;

revoke all on function public.kavio_guard_kavling_status() from public;
revoke all on function public.kavio_guard_kavling_status() from anon;
revoke all on function public.kavio_guard_kavling_status() from authenticated;

revoke all on function public.kavio_sync_kavling_from_sales() from public;
revoke all on function public.kavio_sync_kavling_from_sales() from anon;
revoke all on function public.kavio_sync_kavling_from_sales() from authenticated;

revoke all on function public.kavio_sync_kavling_from_spk() from public;
revoke all on function public.kavio_sync_kavling_from_spk() from anon;
revoke all on function public.kavio_sync_kavling_from_spk() from authenticated;
