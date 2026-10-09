create extension if not exists pgcrypto;

create table if not exists public.master_tipe_rumah (
  id_tipe text primary key,
  nama_tipe text not null unique,
  luas_tanah_m2 numeric(12,2),
  luas_bangunan_m2 numeric(12,2),
  status_aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.master_kategori_pekerjaan (
  id_kategori text primary key,
  nama_kategori text not null unique,
  urutan integer not null check (urutan > 0),
  status_aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.master_kantor_pelaksana (
  id_kantor text primary key,
  nama_kantor_pelaksana text not null unique,
  penanggung_jawab text,
  no_hp text,
  status_aktif boolean not null default true,
  keterangan text,
  created_at timestamptz not null default now()
);

create table if not exists public.master_mandor (
  id_mandor text primary key,
  nama_mandor text not null,
  id_kantor text not null references public.master_kantor_pelaksana(id_kantor),
  no_hp text,
  status_aktif boolean not null default true,
  keterangan text,
  created_at timestamptz not null default now()
);

create table if not exists public.master_kavling (
  id_kavling text primary key,
  blok text not null,
  no_kavling text not null,
  id_tipe text not null references public.master_tipe_rumah(id_tipe),
  status_kavling text not null,
  status_aktif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (blok, no_kavling)
);

create table if not exists public.template_progress_tipe (
  id_tipe text not null references public.master_tipe_rumah(id_tipe),
  id_kategori text not null references public.master_kategori_pekerjaan(id_kategori),
  bobot_standar numeric(8,6) not null check (bobot_standar >= 0 and bobot_standar <= 1),
  primary key (id_tipe, id_kategori)
);

create table if not exists public.sales (
  id_sales uuid primary key default gen_random_uuid(),
  id_kavling text not null references public.master_kavling(id_kavling),
  nama_konsumen text,
  status_sales text not null,
  jenis_pembayaran text,
  harga_jual numeric(18,2) check (harga_jual is null or harga_jual >= 0),
  tgl_booking date,
  target_akad date,
  status_aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists ux_sales_one_active_per_kavling on public.sales (id_kavling) where status_aktif = true;

create table if not exists public.spm (
  id_spm uuid primary key default gen_random_uuid(),
  id_kavling text not null references public.master_kavling(id_kavling),
  tgl_spm date not null,
  id_tipe text not null references public.master_tipe_rumah(id_tipe),
  jenis_bobot text not null check (jenis_bobot in ('STANDAR','CUSTOM')),
  id_kantor text not null references public.master_kantor_pelaksana(id_kantor),
  id_mandor text not null references public.master_mandor(id_mandor),
  status_spm text not null,
  tgl_target_selesai date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  check (tgl_target_selesai >= tgl_spm)
);

create unique index if not exists ux_spm_one_active_per_kavling on public.spm (id_kavling) where is_active = true;

create table if not exists public.spm_progress_config (
  id_config uuid primary key default gen_random_uuid(),
  id_spm uuid not null references public.spm(id_spm) on delete cascade,
  id_kategori text not null references public.master_kategori_pekerjaan(id_kategori),
  bobot_final numeric(8,6) not null check (bobot_final >= 0 and bobot_final <= 1),
  created_at timestamptz not null default now(),
  unique (id_spm, id_kategori)
);

create table if not exists public.progress_update (
  id_progress uuid primary key default gen_random_uuid(),
  id_spm uuid not null references public.spm(id_spm),
  tanggal_update date not null,
  id_kategori text not null references public.master_kategori_pekerjaan(id_kategori),
  progress_periode numeric(8,6) not null check (progress_periode >= 0 and progress_periode <= 1),
  keterangan text,
  input_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id_spm, tanggal_update, id_kategori)
);

create or replace function public.validate_spm_relations()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.master_kavling k where k.id_kavling = new.id_kavling and k.id_tipe = new.id_tipe) then
    raise exception 'Tipe rumah pada SPM harus sama dengan tipe rumah pada kavling %', new.id_kavling;
  end if;
  if not exists (select 1 from public.master_mandor m where m.id_mandor = new.id_mandor and m.id_kantor = new.id_kantor) then
    raise exception 'Mandor % bukan anggota kantor pelaksana %', new.id_mandor, new.id_kantor;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_spm_relations on public.spm;
create trigger trg_validate_spm_relations before insert or update on public.spm for each row execute function public.validate_spm_relations();

create or replace function public.validate_progress_relations()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.spm_progress_config c where c.id_spm = new.id_spm and c.id_kategori = new.id_kategori) then
    raise exception 'Kategori % belum dikonfigurasi pada SPM %', new.id_kategori, new.id_spm;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_progress_relations on public.progress_update;
create trigger trg_validate_progress_relations before insert or update on public.progress_update for each row execute function public.validate_progress_relations();

create or replace function public.validate_progress_cumulative()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare v_total numeric(10,6);
begin
  select coalesce(sum(p.progress_periode),0) into v_total from public.progress_update p where p.id_spm = new.id_spm and p.id_kategori = new.id_kategori and p.id_progress <> new.id_progress;
  if v_total + new.progress_periode > 1 then
    raise exception 'Progress kumulatif untuk SPM % / kategori % melebihi 100%%', new.id_spm, new.id_kategori;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_progress_cumulative on public.progress_update;
create trigger trg_validate_progress_cumulative before insert or update on public.progress_update for each row execute function public.validate_progress_cumulative();

create or replace function public.validate_activate_spm()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare v_sum numeric(10,6);
begin
  if new.is_active = true then
    select coalesce(sum(c.bobot_final),0) into v_sum from public.spm_progress_config c where c.id_spm = new.id_spm;
    if abs(v_sum - 1) > 0.000001 then
      raise exception 'Bobot final SPM % harus berjumlah 100%%', new.id_spm;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_activate_spm on public.spm;
create trigger trg_validate_activate_spm before insert or update on public.spm for each row execute function public.validate_activate_spm();

create or replace view public.v_progress_kategori_current with (security_invoker = true) as
select p.id_spm, s.id_kavling, p.id_kategori, max(p.tanggal_update) as tanggal_update_terakhir,
       round(sum(p.progress_periode),6) as progress_akumulasi, c.bobot_final,
       round(sum(p.progress_periode) * c.bobot_final,6) as progress_berbobot
from public.progress_update p
join public.spm s on s.id_spm = p.id_spm
join public.spm_progress_config c on c.id_spm = p.id_spm and c.id_kategori = p.id_kategori
group by p.id_spm, s.id_kavling, p.id_kategori, c.bobot_final;

create or replace view public.v_progress_summary with (security_invoker = true) as
select s.id_spm, s.id_kavling, s.id_tipe, s.id_kantor, s.id_mandor,
       s.tgl_spm, s.tgl_target_selesai, s.status_spm,
       round(coalesce(sum(v.progress_berbobot),0),6) as progress_total
from public.spm s left join public.v_progress_kategori_current v on v.id_spm = s.id_spm
group by s.id_spm, s.id_kavling, s.id_tipe, s.id_kantor, s.id_mandor, s.tgl_spm, s.tgl_target_selesai, s.status_spm;

create index if not exists ix_kavio_mandor_kantor on public.master_mandor(id_kantor);
create index if not exists ix_kavio_kavling_tipe on public.master_kavling(id_tipe);
create index if not exists ix_kavio_template_tipe on public.template_progress_tipe(id_tipe);
create index if not exists ix_kavio_sales_kavling on public.sales(id_kavling);
create index if not exists ix_kavio_spm_kavling on public.spm(id_kavling);
create index if not exists ix_kavio_spm_mandor on public.spm(id_mandor);
create index if not exists ix_kavio_config_spm on public.spm_progress_config(id_spm);
create index if not exists ix_kavio_progress_spm_tanggal on public.progress_update(id_spm, tanggal_update desc);
create index if not exists ix_kavio_progress_kategori on public.progress_update(id_kategori);
create index if not exists ix_kavio_progress_input_by on public.progress_update(input_by);

alter table public.master_tipe_rumah enable row level security;
alter table public.master_kategori_pekerjaan enable row level security;
alter table public.master_kantor_pelaksana enable row level security;
alter table public.master_mandor enable row level security;
alter table public.master_kavling enable row level security;
alter table public.template_progress_tipe enable row level security;
alter table public.sales enable row level security;
alter table public.spm enable row level security;
alter table public.spm_progress_config enable row level security;
alter table public.progress_update enable row level security;

-- Initial authenticated-only development policies; refine by company/role before production multi-tenant use.
create policy kavio_auth_all on public.master_tipe_rumah for all to authenticated using (true) with check (true);
create policy kavio_auth_all on public.master_kategori_pekerjaan for all to authenticated using (true) with check (true);
create policy kavio_auth_all on public.master_kantor_pelaksana for all to authenticated using (true) with check (true);
create policy kavio_auth_all on public.master_mandor for all to authenticated using (true) with check (true);
create policy kavio_auth_all on public.master_kavling for all to authenticated using (true) with check (true);
create policy kavio_auth_all on public.template_progress_tipe for all to authenticated using (true) with check (true);
create policy kavio_auth_all on public.sales for all to authenticated using (true) with check (true);
create policy kavio_auth_all on public.spm for all to authenticated using (true) with check (true);
create policy kavio_auth_all on public.spm_progress_config for all to authenticated using (true) with check (true);
create policy kavio_auth_all on public.progress_update for all to authenticated using (true) with check (true);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.v_progress_kategori_current, public.v_progress_summary to authenticated;


create or replace view public.v_dashboard_monitor as
select
  k.id_kavling,
  k.blok,
  k.no_kavling,
  tr.nama_tipe,
  k.status_kavling,
  s.id_spm,
  s.tgl_spm,
  s.status_spm,
  s.is_active as spm_aktif,
  kp.nama_kantor_pelaksana,
  m.nama_mandor,
  coalesce(sa.nama_konsumen,'') as nama_konsumen,
  coalesce(sa.status_sales,'BELUM ADA SALES') as status_sales,
  coalesce(ps.progress_total,0) as progress_total,
  coalesce((select max(pu.tanggal_update) from public.progress_update pu where pu.id_spm=s.id_spm), s.tgl_spm) as tanggal_update_terakhir,
  (s.tgl_target_selesai - current_date) as sisa_hari_target,
  case
    when s.is_active = false then 'BELUM AKTIF'
    when coalesce(ps.progress_total,0) >= 1 then 'SELESAI'
    when s.tgl_target_selesai < current_date then 'LEWAT TARGET'
    when (s.tgl_target_selesai - current_date) <= 14 and coalesce(ps.progress_total,0) < 0.90 then 'PERHATIAN'
    else 'BERJALAN'
  end as status_monitor
from public.master_kavling k
join public.master_tipe_rumah tr on tr.id_tipe=k.id_tipe
left join lateral (
  select s1.* from public.spm s1
  where s1.id_kavling=k.id_kavling
  order by s1.is_active desc, s1.tgl_spm desc, s1.created_at desc
  limit 1
) s on true
left join public.master_kantor_pelaksana kp on kp.id_kantor=s.id_kantor
left join public.master_mandor m on m.id_mandor=s.id_mandor
left join lateral (
  select sa1.* from public.sales sa1
  where sa1.id_kavling=k.id_kavling
  order by sa1.status_aktif desc, sa1.created_at desc
  limit 1
) sa on true
left join public.v_progress_summary ps on ps.id_spm=s.id_spm;

grant select on public.v_dashboard_monitor to authenticated;

ALTER TABLE spm RENAME TO spk;
ALTER TABLE spk RENAME COLUMN id_spm TO id_spk;
ALTER TABLE spk RENAME COLUMN tgl_spm TO tgl_spk;
ALTER TABLE spk RENAME COLUMN status_spm TO status_spk;
ALTER TABLE spm_progress_config RENAME TO spk_progress_config;
ALTER TABLE spk_progress_config RENAME COLUMN id_spm TO id_spk;
ALTER TABLE progress_update RENAME COLUMN id_spm TO id_spk;

alter table public.spk rename constraint spm_check to spk_check;
alter table public.spk rename constraint spm_jenis_bobot_check to spk_jenis_bobot_check;
alter table public.spk_progress_config rename constraint spm_progress_config_bobot_final_check to spk_progress_config_bobot_final_check;
alter table public.spk_progress_config rename constraint spm_progress_config_id_spm_id_kategori_key to spk_progress_config_id_spk_id_kategori_key;
alter table public.progress_update rename constraint progress_update_id_spm_tanggal_update_id_kategori_key to progress_update_id_spk_tanggal_update_id_kategori_key;

alter view public.v_progress_kategori_current rename column id_spm to id_spk;
alter view public.v_progress_summary rename column id_spm to id_spk;
alter view public.v_progress_summary rename column tgl_spm to tgl_spk;
alter view public.v_progress_summary rename column status_spm to status_spk;
alter view public.v_dashboard_monitor rename column id_spm to id_spk;
alter view public.v_dashboard_monitor rename column tgl_spm to tgl_spk;
alter view public.v_dashboard_monitor rename column status_spm to status_spk;
alter view public.v_dashboard_monitor rename column spm_aktif to spk_aktif;

create or replace view public.v_progress_kategori_current as
select
  p.id_spk,
  s.id_kavling,
  p.id_kategori,
  max(p.tanggal_update) as tanggal_update_terakhir,
  round(least(sum(p.progress_periode), 1::numeric), 6) as progress_akumulasi,
  c.bobot_final,
  round(least(sum(p.progress_periode), 1::numeric) * c.bobot_final, 6) as progress_berbobot
from public.progress_update p
join public.spk s on s.id_spk = p.id_spk
join public.spk_progress_config c on c.id_spk = p.id_spk and c.id_kategori = p.id_kategori
group by p.id_spk, s.id_kavling, p.id_kategori, c.bobot_final;

create or replace view public.v_progress_summary as
select
  s.id_spk,
  s.id_kavling,
  s.id_tipe,
  s.id_kantor,
  s.id_mandor,
  s.tgl_spk,
  s.tgl_target_selesai,
  s.status_spk,
  round(coalesce(sum(v.progress_berbobot), 0::numeric), 6) as progress_total
from public.spk s
left join public.v_progress_kategori_current v on v.id_spk = s.id_spk
group by s.id_spk, s.id_kavling, s.id_tipe, s.id_kantor, s.id_mandor, s.tgl_spk, s.tgl_target_selesai, s.status_spk;

create or replace view public.v_dashboard_monitor as
select
  k.id_kavling,
  k.blok,
  k.no_kavling,
  tr.nama_tipe,
  k.status_kavling,
  s.id_spk,
  s.tgl_spk,
  s.status_spk,
  s.is_active as spk_aktif,
  kp.nama_kantor_pelaksana,
  m.nama_mandor,
  coalesce(sa.nama_konsumen, ''::text) as nama_konsumen,
  coalesce(sa.status_sales, 'BELUM ADA SALES'::text) as status_sales,
  coalesce(ps.progress_total, 0::numeric) as progress_total,
  coalesce((select max(pu.tanggal_update) from public.progress_update pu where pu.id_spk = s.id_spk), s.tgl_spk) as tanggal_update_terakhir,
  s.tgl_target_selesai - current_date as sisa_hari_target,
  case
    when s.is_active = false then 'BELUM AKTIF'::text
    when coalesce(ps.progress_total, 0::numeric) >= 1::numeric then 'SELESAI'::text
    when s.tgl_target_selesai < current_date then 'LEWAT TARGET'::text
    when (s.tgl_target_selesai - current_date) <= 14 and coalesce(ps.progress_total, 0::numeric) < 0.90 then 'PERHATIAN'::text
    else 'BERJALAN'::text
  end as status_monitor
from public.master_kavling k
join public.master_tipe_rumah tr on tr.id_tipe = k.id_tipe
left join lateral (
  select s1.*
  from public.spk s1
  where s1.id_kavling = k.id_kavling
  order by s1.is_active desc, s1.tgl_spk desc, s1.created_at desc
  limit 1
) s on true
left join public.master_kantor_pelaksana kp on kp.id_kantor = s.id_kantor
left join public.master_mandor m on m.id_mandor = s.id_mandor
left join lateral (
  select sa1.*
  from public.sales sa1
  where sa1.id_kavling = k.id_kavling
  order by sa1.status_aktif desc, sa1.created_at desc
  limit 1
) sa on true
left join public.v_progress_summary ps on ps.id_spk = s.id_spk;

create or replace function public.kavio_days_between(from_date date, to_date date)
returns integer
language sql
immutable
as $$
  select (to_date - from_date)::integer;
$$;

create or replace view public.v_decision_engine as
select
  s.id_spk,
  s.id_kavling,
  s.id_tipe,
  s.id_kantor,
  s.id_mandor,
  s.tgl_spk,
  s.tgl_target_selesai,
  s.status_spk,
  s.is_active,
  coalesce(ps.progress_total, 0::numeric) as progress_aktual,
  case
    when (s.tgl_target_selesai - s.tgl_spk) <= 0 then
      case when current_date >= s.tgl_target_selesai then 1::numeric else 0::numeric end
    else least(1::numeric, greatest(0::numeric,
      (current_date - s.tgl_spk)::numeric / (s.tgl_target_selesai - s.tgl_spk)::numeric
    ))
  end as progress_seharusnya,
  coalesce(ps.progress_total, 0::numeric) -
  case
    when (s.tgl_target_selesai - s.tgl_spk) <= 0 then
      case when current_date >= s.tgl_target_selesai then 1::numeric else 0::numeric end
    else least(1::numeric, greatest(0::numeric,
      (current_date - s.tgl_spk)::numeric / (s.tgl_target_selesai - s.tgl_spk)::numeric
    ))
  end as gap_progress,
  (s.tgl_target_selesai - current_date)::integer as sisa_hari,
  u.tanggal_update_terakhir,
  coalesce(u.progress_periode_terakhir, 0::numeric) as progress_periode_terakhir,
  case
    when s.status_spk = 'SELESAI' or coalesce(ps.progress_total, 0::numeric) >= 0.999999 then 'SELESAI'
    when current_date > s.tgl_target_selesai then 'LEWAT TARGET'
    when (s.tgl_target_selesai - current_date) <= 7 then 'PERHATIAN'
    when u.tanggal_update_terakhir is null then 'PERHATIAN'
    when current_date - u.tanggal_update_terakhir > 14 then 'PERHATIAN'
    when coalesce(ps.progress_total, 0::numeric) -
      case
        when (s.tgl_target_selesai - s.tgl_spk) <= 0 then
          case when current_date >= s.tgl_target_selesai then 1::numeric else 0::numeric end
        else least(1::numeric, greatest(0::numeric,
          (current_date - s.tgl_spk)::numeric / (s.tgl_target_selesai - s.tgl_spk)::numeric
        ))
      end <= -0.05 then 'PERHATIAN'
    else 'BERJALAN'
  end as status_operasional,
  case
    when coalesce(ps.progress_total, 0::numeric) -
      case
        when (s.tgl_target_selesai - s.tgl_spk) <= 0 then
          case when current_date >= s.tgl_target_selesai then 1::numeric else 0::numeric end
        else least(1::numeric, greatest(0::numeric,
          (current_date - s.tgl_spk)::numeric / (s.tgl_target_selesai - s.tgl_spk)::numeric
        ))
      end <= -0.05 then 'TERTINGGAL'
    when coalesce(ps.progress_total, 0::numeric) -
      case
        when (s.tgl_target_selesai - s.tgl_spk) <= 0 then
          case when current_date >= s.tgl_target_selesai then 1::numeric else 0::numeric end
        else least(1::numeric, greatest(0::numeric,
          (current_date - s.tgl_spk)::numeric / (s.tgl_target_selesai - s.tgl_spk)::numeric
        ))
      end >= 0.05 then 'DI DEPAN'
    else 'SESUAI RITME'
  end as status_ritme
from public.spk s
left join public.v_progress_summary ps on ps.id_spk = s.id_spk
left join (
  select
    pu.id_spk,
    max(pu.tanggal_update) as tanggal_update_terakhir,
    sum(pu.progress_periode) filter (where pu.tanggal_update = max_dates.max_tanggal) as progress_periode_terakhir
  from public.progress_update pu
  join (
    select id_spk, max(tanggal_update) as max_tanggal
    from public.progress_update
    group by id_spk
  ) max_dates on max_dates.id_spk = pu.id_spk
  group by pu.id_spk
) u on u.id_spk = s.id_spk;

create index if not exists idx_progress_update_spk_date
  on public.progress_update (id_spk, tanggal_update desc);

create index if not exists idx_spk_active_target
  on public.spk (is_active, tgl_target_selesai);


create or replace view public.v_decision_engine as
with progress_base as (
  select
    s.id_spk,
    s.id_kavling,
    s.id_tipe,
    s.id_kantor,
    s.id_mandor,
    s.tgl_spk,
    s.tgl_target_selesai,
    s.status_spk,
    s.is_active,
    coalesce(ps.progress_total, 0::numeric) as progress_aktual,
    case
      when (s.tgl_target_selesai - s.tgl_spk) <= 0 then
        case when current_date >= s.tgl_target_selesai then 1::numeric else 0::numeric end
      else least(1::numeric, greatest(0::numeric,
        (current_date - s.tgl_spk)::numeric /
        (s.tgl_target_selesai - s.tgl_spk)::numeric
      ))
    end as progress_seharusnya,
    (s.tgl_target_selesai - current_date)::integer as sisa_hari,
    u.tanggal_update_terakhir,
    coalesce(u.progress_periode_terakhir, 0::numeric) as progress_periode_terakhir
  from public.spk s
  left join public.v_progress_summary ps on ps.id_spk = s.id_spk
  left join (
    select
      pu.id_spk,
      max(pu.tanggal_update) as tanggal_update_terakhir,
      sum(pu.progress_periode) filter (where pu.tanggal_update = max_dates.max_tanggal) as progress_periode_terakhir
    from public.progress_update pu
    join (
      select id_spk, max(tanggal_update) as max_tanggal
      from public.progress_update
      group by id_spk
    ) max_dates on max_dates.id_spk = pu.id_spk
    group by pu.id_spk
  ) u on u.id_spk = s.id_spk
),
status_base as (
  select
    p.*,
    p.progress_aktual - p.progress_seharusnya as gap_progress,
    case
      when p.status_spk = 'SELESAI' or p.progress_aktual >= 0.999999 then 'SELESAI'
      when p.sisa_hari < 0 then 'LEWAT TARGET'
      when p.tanggal_update_terakhir is null then 'PERHATIAN'
      when current_date - p.tanggal_update_terakhir > 14 then 'PERHATIAN'
      when p.sisa_hari <= 7 then 'PERHATIAN'
      when p.progress_aktual - p.progress_seharusnya <= -0.05 then 'PERHATIAN'
      else 'BERJALAN'
    end as status_operasional,
    case
      when p.progress_aktual - p.progress_seharusnya <= -0.05 then 'TERTINGGAL'
      when p.progress_aktual - p.progress_seharusnya >= 0.05 then 'DI DEPAN'
      else 'SESUAI RITME'
    end as status_ritme
  from progress_base p
),
action_base as (
  select
    s.*,
    case
      when s.status_operasional = 'LEWAT TARGET' then 'TINGGI'
      when s.status_operasional = 'PERHATIAN' and (s.tanggal_update_terakhir is null or current_date - s.tanggal_update_terakhir > 14) then 'TINGGI'
      when s.status_operasional = 'PERHATIAN' and s.status_ritme = 'TERTINGGAL' then 'TINGGI'
      when s.status_operasional = 'PERHATIAN' and s.sisa_hari <= 7 then 'TINGGI'
      when s.status_operasional = 'PERHATIAN' then 'SEDANG'
      else 'NORMAL'
    end as prioritas_tindakan,
    case
      when s.status_operasional = 'LEWAT TARGET' then 'SEGERA EVALUASI TARGET & AKSELERASI PEKERJAAN'
      when s.status_operasional = 'PERHATIAN' and (s.tanggal_update_terakhir is null or current_date - s.tanggal_update_terakhir > 14) then 'MINTA UPDATE PROGRESS TERBARU'
      when s.status_operasional = 'PERHATIAN' and s.status_ritme = 'TERTINGGAL' then 'PERCEPAT PROGRESS / TAMBAH RESOURCE'
      when s.status_operasional = 'PERHATIAN' and s.sisa_hari <= 7 then 'MONITOR HARIAN MENJELANG TARGET'
      when s.status_operasional = 'PERHATIAN' then 'MONITOR LEBIH DEKAT'
      when s.status_operasional = 'SELESAI' then 'VERIFIKASI PENYELESAIAN SPK'
      when s.status_ritme = 'DI DEPAN' then 'PERTAHANKAN RITME PEKERJAAN'
      else 'LANJUTKAN MONITORING'
    end as action_rekomendasi
  from status_base s
)
select
  id_spk,
  id_kavling,
  id_tipe,
  id_kantor,
  id_mandor,
  tgl_spk,
  tgl_target_selesai,
  status_spk,
  is_active,
  progress_aktual,
  progress_seharusnya,
  gap_progress,
  sisa_hari,
  tanggal_update_terakhir,
  progress_periode_terakhir,
  status_operasional,
  status_ritme,
  prioritas_tindakan,
  action_rekomendasi
from action_base;

comment on view public.v_decision_engine is 'Single source of truth for KAVIO operational monitoring, pace, priority, and recommended action.';

drop view if exists public.v_decision_engine;

create view public.v_decision_engine as
with progress_base as (
  select s.id_spk, s.id_kavling, s.id_tipe, s.id_kantor, s.id_mandor,
    s.tgl_spk, s.tgl_target_selesai, s.status_spk, s.is_active,
    coalesce(ps.progress_total, 0::numeric) as progress_aktual,
    case when (s.tgl_target_selesai - s.tgl_spk) <= 0 then
      case when current_date >= s.tgl_target_selesai then 1::numeric else 0::numeric end
    else least(1::numeric, greatest(0::numeric,
      (current_date - s.tgl_spk)::numeric / (s.tgl_target_selesai - s.tgl_spk)::numeric)) end as progress_seharusnya,
    (s.tgl_target_selesai - current_date)::integer as sisa_hari,
    u.tanggal_update_terakhir,
    coalesce(u.progress_periode_terakhir, 0::numeric) as progress_periode_terakhir
  from public.spk s
  left join public.v_progress_summary ps on ps.id_spk = s.id_spk
  left join (
    select pu.id_spk, max(pu.tanggal_update) as tanggal_update_terakhir,
      sum(pu.progress_periode) filter (where pu.tanggal_update = md.max_tanggal) as progress_periode_terakhir
    from public.progress_update pu
    join (select id_spk, max(tanggal_update) as max_tanggal from public.progress_update group by id_spk) md on md.id_spk = pu.id_spk
    group by pu.id_spk
  ) u on u.id_spk = s.id_spk
), status_base as (
  select p.*, p.progress_aktual - p.progress_seharusnya as gap_progress,
    case
      when p.status_spk = 'SELESAI' or p.progress_aktual >= 0.999999 then 'SELESAI'
      when p.sisa_hari < 0 then 'LEWAT TARGET'
      when p.tanggal_update_terakhir is null then 'PERHATIAN'
      when (current_date - p.tanggal_update_terakhir) > 14 then 'PERHATIAN'
      when p.sisa_hari <= 7 then 'PERHATIAN'
      when (p.progress_aktual - p.progress_seharusnya) <= -0.05 then 'PERHATIAN'
      else 'BERJALAN'
    end as status_operasional,
    case when (p.progress_aktual - p.progress_seharusnya) <= -0.05 then 'TERTINGGAL'
      when (p.progress_aktual - p.progress_seharusnya) >= 0.05 then 'DI DEPAN'
      else 'SESUAI RITME' end as status_ritme
  from progress_base p
), action_base as (
  select s.*,
    case
      when s.status_operasional = 'LEWAT TARGET' then 'TINGGI'
      when s.status_operasional = 'PERHATIAN' and (s.tanggal_update_terakhir is null or current_date - s.tanggal_update_terakhir > 14) then 'TINGGI'
      when s.status_operasional = 'PERHATIAN' and s.status_ritme = 'TERTINGGAL' then 'TINGGI'
      when s.status_operasional = 'PERHATIAN' and s.sisa_hari <= 7 then 'TINGGI'
      when s.status_operasional = 'PERHATIAN' then 'SEDANG'
      else 'NORMAL' end as prioritas_tindakan,
    case
      when s.status_operasional = 'LEWAT TARGET' then 'SEGERA EVALUASI TARGET & AKSELERASI PEKERJAAN'
      when s.status_operasional = 'PERHATIAN' and (s.tanggal_update_terakhir is null or current_date - s.tanggal_update_terakhir > 14) then 'MINTA UPDATE PROGRESS TERBARU'
      when s.status_operasional = 'PERHATIAN' and s.status_ritme = 'TERTINGGAL' then 'PERCEPAT PROGRESS / TAMBAH RESOURCE'
      when s.status_operasional = 'PERHATIAN' and s.sisa_hari <= 7 then 'MONITOR HARIAN MENJELANG TARGET'
      when s.status_operasional = 'PERHATIAN' then 'MONITOR LEBIH DEKAT'
      when s.status_operasional = 'SELESAI' then 'VERIFIKASI PENYELESAIAN SPK'
      when s.status_ritme = 'DI DEPAN' then 'PERTAHANKAN RITME PEKERJAAN'
      else 'LANJUTKAN MONITORING' end as action_rekomendasi
  from status_base s
)
select a.id_spk, a.id_kavling, a.id_tipe, a.id_kantor, a.id_mandor,
  a.tgl_spk, a.tgl_target_selesai, a.status_spk, a.is_active,
  a.progress_aktual, a.progress_seharusnya, a.gap_progress,
  a.sisa_hari, a.tanggal_update_terakhir, a.progress_periode_terakhir,
  case when a.tanggal_update_terakhir is null then null::integer else (current_date - a.tanggal_update_terakhir)::integer end as hari_sejak_update,
  case when a.sisa_hari > 0 and a.progress_aktual < 1 then greatest(0::numeric, (1::numeric - a.progress_aktual) / a.sisa_hari::numeric) else 0::numeric end as progress_diperlukan_per_hari,
  a.status_operasional, a.status_ritme, a.prioritas_tindakan, a.action_rekomendasi
from action_base a;

drop view if exists public.v_decision_engine;
create view public.v_decision_engine as
with progress_base as (
  select s.id_spk,s.id_kavling,s.id_tipe,s.id_kantor,s.id_mandor,s.tgl_spk,s.tgl_target_selesai,s.status_spk,s.is_active,
    coalesce(ps.progress_total,0::numeric) as progress_aktual,
    case when (s.tgl_target_selesai-s.tgl_spk)<=0 then case when current_date>=s.tgl_target_selesai then 1::numeric else 0::numeric end else least(1::numeric,greatest(0::numeric,(current_date-s.tgl_spk)::numeric/(s.tgl_target_selesai-s.tgl_spk)::numeric)) end as progress_seharusnya,
    (s.tgl_target_selesai-current_date)::integer as sisa_hari,u.tanggal_update_terakhir,coalesce(u.progress_periode_terakhir,0::numeric) as progress_periode_terakhir,
    case when u.tanggal_update_terakhir is null then null::integer else (current_date-u.tanggal_update_terakhir)::integer end as hari_sejak_update
  from public.spk s left join public.v_progress_summary ps on ps.id_spk=s.id_spk
  left join (select pu.id_spk,max(pu.tanggal_update) as tanggal_update_terakhir,sum(pu.progress_periode) filter(where pu.tanggal_update=max_dates.max_tanggal) as progress_periode_terakhir from public.progress_update pu join (select id_spk,max(tanggal_update) as max_tanggal from public.progress_update group by id_spk) max_dates on max_dates.id_spk=pu.id_spk group by pu.id_spk) u on u.id_spk=s.id_spk
), status_base as (
  select p.*,p.progress_aktual-p.progress_seharusnya as gap_progress,
    case when p.status_spk='SELESAI' or p.progress_aktual>=0.999999 then 'SELESAI' when p.sisa_hari<0 then 'LEWAT TARGET' when p.tanggal_update_terakhir is null then 'PERHATIAN' when p.hari_sejak_update>14 then 'PERHATIAN' when p.sisa_hari<=7 then 'PERHATIAN' when p.progress_aktual-p.progress_seharusnya<=-0.05 then 'PERHATIAN' else 'BERJALAN' end as status_operasional,
    case when p.progress_aktual-p.progress_seharusnya<=-0.05 then 'TERTINGGAL' when p.progress_aktual-p.progress_seharusnya>=0.05 then 'DI DEPAN' else 'SESUAI RITME' end as status_ritme,
    case when p.sisa_hari>0 then greatest(0::numeric,(1::numeric-p.progress_aktual)/p.sisa_hari::numeric) else null::numeric end as progress_diperlukan_per_hari
  from progress_base p
), action_base as (
  select s.*,
    case when s.status_operasional='LEWAT TARGET' then 'TINGGI' when s.status_operasional='PERHATIAN' and (s.tanggal_update_terakhir is null or s.hari_sejak_update>14) then 'TINGGI' when s.status_operasional='PERHATIAN' and s.status_ritme='TERTINGGAL' then 'TINGGI' when s.status_operasional='PERHATIAN' and s.sisa_hari<=7 then 'TINGGI' when s.status_operasional='PERHATIAN' then 'SEDANG' else 'NORMAL' end as prioritas_tindakan,
    case when s.status_operasional='LEWAT TARGET' then 'SEGERA EVALUASI TARGET & AKSELERASI PEKERJAAN' when s.status_operasional='PERHATIAN' and (s.tanggal_update_terakhir is null or s.hari_sejak_update>14) then 'MINTA UPDATE PROGRESS TERBARU' when s.status_operasional='PERHATIAN' and s.status_ritme='TERTINGGAL' then 'PERCEPAT PROGRESS / TAMBAH RESOURCE' when s.status_operasional='PERHATIAN' and s.sisa_hari<=7 then 'MONITOR HARIAN MENJELANG TARGET' when s.status_operasional='PERHATIAN' then 'MONITOR LEBIH DEKAT' when s.status_operasional='SELESAI' then 'VERIFIKASI PENYELESAIAN SPK' when s.status_ritme='DI_DEPAN' then 'PERTAHANKAN RITME PEKERJAAN' else 'LANJUTKAN MONITORING' end as action_rekomendasi
  from status_base s
), scored as (
  select a.*,
    case when a.status_operasional='SELESAI' then 98 else greatest(0,least(100,100-case when a.status_operasional='PERHATIAN' then 20 else 0 end-case when a.status_ritme='TERTINGGAL' then least(30,round(abs(a.gap_progress)*300)) else 0 end-case when a.sisa_hari<0 then 20 when a.sisa_hari<=7 then 12 when a.sisa_hari<=14 then 5 else 0 end-case when a.tanggal_update_terakhir is null then 18 when a.hari_sejak_update>14 then 20 when a.hari_sejak_update>7 then 8 else 0 end+case when a.status_ritme='DI DEPAN' then 5 else 0 end)) end::integer as health_score
  from action_base a
), leveled as (
  select s.*,case when s.health_score>=75 then 'SEHAT' when s.health_score>=50 then 'WASPADA' else 'KRITIS' end as health_level from scored s
)
select id_spk,id_kavling,id_tipe,id_kantor,id_mandor,tgl_spk,tgl_target_selesai,status_spk,is_active,progress_aktual,progress_seharusnya,gap_progress,sisa_hari,tanggal_update_terakhir,progress_periode_terakhir,status_operasional,status_ritme,prioritas_tindakan,action_rekomendasi,hari_sejak_update,progress_diperlukan_per_hari,health_score,health_level,
  case when health_level='SEHAT' then 'Kondisi operasional terkendali.' when health_level='WASPADA' then 'Perlu monitoring lebih dekat.' else 'Perlu tindakan segera.' end as health_description
from leveled;

create or replace function public.validate_progress_cumulative()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare v_total numeric(10,6);
begin
  select coalesce(sum(p.progress_periode),0) into v_total
  from public.progress_update p
  where p.id_spk = new.id_spk
    and p.id_kategori = new.id_kategori
    and p.id_progress <> new.id_progress;
  if v_total + new.progress_periode > 1 then
    raise exception 'Progress kumulatif untuk SPK % / kategori % melebihi 100%%', new.id_spk, new.id_kategori;
  end if;
  return new;
end;
$$;

create or replace function public.validate_progress_relations()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
begin
  if not exists (select 1 from public.spk_progress_config c where c.id_spk = new.id_spk and c.id_kategori = new.id_kategori) then
    raise exception 'Kategori % belum dikonfigurasi pada SPK %', new.id_kategori, new.id_spk;
  end if;
  return new;
end;
$$;

create or replace function public.validate_activate_spm()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare v_sum numeric(10,6);
begin
  if new.is_active = true then
    select coalesce(sum(c.bobot_final),0) into v_sum from public.spk_progress_config c where c.id_spk = new.id_spk;
    if abs(v_sum - 1) > 0.000001 then
      raise exception 'Bobot final SPK % harus berjumlah 100%%', new.id_spk;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.validate_spm_relations()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
begin
  if not exists (select 1 from public.master_kavling k where k.id_kavling = new.id_kavling and k.id_tipe = new.id_tipe) then
    raise exception 'Tipe rumah pada SPK harus sama dengan tipe rumah pada kavling %', new.id_kavling;
  end if;
  if not exists (select 1 from public.master_mandor m where m.id_mandor = new.id_mandor and m.id_kantor = new.id_kantor) then
    raise exception 'Mandor % bukan anggota kantor pelaksana %', new.id_mandor, new.id_kantor;
  end if;
  return new;
end;
$$;

update public.progress_update set tanggal_update = tanggal_update - 14 where tanggal_update > current_date;

create or replace view public.v_decision_engine as
with progress_base as (
  select
    s.id_spk,
    s.id_kavling,
    s.id_tipe,
    s.id_kantor,
    s.id_mandor,
    s.tgl_spk,
    s.tgl_target_selesai,
    s.status_spk,
    s.is_active,
    coalesce(ps.progress_total, 0::numeric) as progress_aktual,
    case
      when (s.tgl_target_selesai - s.tgl_spk) <= 0 then
        case when current_date >= s.tgl_target_selesai then 1::numeric else 0::numeric end
      else least(1::numeric, greatest(0::numeric,
        (current_date - s.tgl_spk)::numeric / (s.tgl_target_selesai - s.tgl_spk)::numeric
      ))
    end as progress_seharusnya,
    (s.tgl_target_selesai - current_date)::integer as sisa_hari,
    u.tanggal_update_terakhir,
    coalesce(u.progress_periode_terakhir, 0::numeric) as progress_periode_terakhir,
    case when u.tanggal_update_terakhir is null then null::integer else current_date - u.tanggal_update_terakhir end as hari_sejak_update
  from public.spk s
  left join public.v_progress_summary ps on ps.id_spk = s.id_spk
  left join (
    select pu.id_spk, max(pu.tanggal_update) as tanggal_update_terakhir,
      sum(pu.progress_periode) filter (where pu.tanggal_update = md.max_tanggal) as progress_periode_terakhir
    from public.progress_update pu
    join (
      select id_spk, max(tanggal_update) as max_tanggal
      from public.progress_update
      group by id_spk
    ) md on md.id_spk = pu.id_spk
    group by pu.id_spk
  ) u on u.id_spk = s.id_spk
),
status_base as (
  select p.*,
    p.progress_aktual - p.progress_seharusnya as gap_progress,
    case
      when p.status_spk = 'SELESAI' or p.progress_aktual >= 0.999999 then 'SELESAI'
      when p.sisa_hari < 0 then 'LEWAT TARGET'
      when p.tanggal_update_terakhir is null then 'PERHATIAN'
      when p.hari_sejak_update > 14 then 'PERHATIAN'
      when p.sisa_hari <= 7 then 'PERHATIAN'
      when (p.progress_aktual - p.progress_seharusnya) <= -0.05 then 'PERHATIAN'
      else 'BERJALAN'
    end as status_operasional,
    case
      when (p.progress_aktual - p.progress_seharusnya) <= -0.05 then 'TERTINGGAL'
      when (p.progress_aktual - p.progress_seharusnya) >= 0.05 then 'DI DEPAN'
      else 'SESUAI RITME'
    end as status_ritme,
    case when p.sisa_hari > 0 then greatest(0::numeric, (1::numeric - p.progress_aktual) / p.sisa_hari::numeric) else null::numeric end as progress_diperlukan_per_hari
  from progress_base p
),
action_base as (
  select s.*,
    case
      when s.status_operasional = 'LEWAT TARGET' then 'TINGGI'
      when s.status_operasional = 'PERHATIAN' and (s.tanggal_update_terakhir is null or s.hari_sejak_update > 14) then 'TINGGI'
      when s.status_operasional = 'PERHATIAN' and s.status_ritme = 'TERTINGGAL' then 'TINGGI'
      when s.status_operasional = 'PERHATIAN' and s.sisa_hari <= 7 then 'TINGGI'
      when s.status_operasional = 'PERHATIAN' then 'SEDANG'
      else 'NORMAL'
    end as prioritas_tindakan,
    case
      when s.status_operasional = 'LEWAT TARGET' then 'SEGERA EVALUASI TARGET & AKSELERASI PEKERJAAN'
      when s.status_operasional = 'PERHATIAN' and (s.tanggal_update_terakhir is null or s.hari_sejak_update > 14) then 'MINTA UPDATE PROGRESS TERBARU'
      when s.status_operasional = 'PERHATIAN' and s.status_ritme = 'TERTINGGAL' then 'PERCEPAT PROGRESS / TAMBAH RESOURCE'
      when s.status_operasional = 'PERHATIAN' and s.sisa_hari <= 7 then 'MONITOR HARIAN MENJELANG TARGET'
      when s.status_operasional = 'PERHATIAN' then 'MONITOR LEBIH DEKAT'
      when s.status_operasional = 'SELESAI' then 'VERIFIKASI PENYELESAIAN SPK'
      when s.status_ritme = 'DI_DEPAN' then 'PERTAHANKAN RITME PEKERJAAN'
      else 'LANJUTKAN MONITORING'
    end as action_rekomendasi
  from status_base s
),
scored as (
  select a.*,
    case
      when a.status_operasional = 'SELESAI' then 98
      when a.status_operasional = 'LEWAT TARGET' then greatest(0, least(40,
        40 - least(30, round(abs(a.gap_progress) * 30))
      ))
      else greatest(0, least(100,
        100
        - case when a.status_operasional = 'PERHATIAN' then 20 else 0 end
        - case when a.status_ritme = 'TERTINGGAL' then least(30, round(abs(a.gap_progress) * 300)) else 0 end
        - case when a.sisa_hari <= 0 then 35 when a.sisa_hari <= 7 then 12 when a.sisa_hari <= 14 then 5 else 0 end
        - case when a.tanggal_update_terakhir is null then 18 when a.hari_sejak_update > 14 then 20 when a.hari_sejak_update > 7 then 8 else 0 end
        + case when a.status_ritme = 'DI_DEPAN' then 5 else 0 end
      ))
    end::integer as health_score
  from action_base a
),
leveled as (
  select s.*,
    case
      when s.status_operasional = 'SELESAI' then 'SEHAT'
      when s.status_operasional = 'LEWAT TARGET' or s.health_score < 50 then 'KRITIS'
      when s.health_score < 75 then 'WASPADA'
      else 'SEHAT'
    end as health_level
  from scored s
)
select
  id_spk, id_kavling, id_tipe, id_kantor, id_mandor, tgl_spk, tgl_target_selesai,
  status_spk, is_active, progress_aktual, progress_seharusnya, gap_progress, sisa_hari,
  tanggal_update_terakhir, progress_periode_terakhir, status_operasional, status_ritme,
  prioritas_tindakan, action_rekomendasi, hari_sejak_update, progress_diperlukan_per_hari,
  health_score, health_level,
  case when health_level = 'SEHAT' then 'Kondisi operasional terkendali.'
       when health_level = 'WASPADA' then 'Perlu monitoring lebih dekat.'
       else 'Perlu tindakan segera.' end as health_description
from leveled;
