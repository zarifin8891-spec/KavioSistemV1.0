update public.sales set status_sales='PROSES_KPR' where status_sales='PROSES KPR';
update public.sales set jenis_pembayaran='CASH_BERTAHAP' where jenis_pembayaran='CASH BERTAHAP';

alter table public.sales drop constraint if exists sales_status_sales_check;
alter table public.sales add constraint sales_status_sales_check check (status_sales in ('BOOKING','DP','PROSES_KPR','AKAD','BATAL'));

alter table public.sales drop constraint if exists sales_jenis_pembayaran_check;
alter table public.sales add constraint sales_jenis_pembayaran_check check (jenis_pembayaran in ('KPR','CASH','CASH_BERTAHAP'));

alter table public.master_kavling drop constraint if exists master_kavling_status_kavling_check;
alter table public.master_kavling add constraint master_kavling_status_kavling_check check (status_kavling in ('AVAILABLE','BOOKING','BUILDING','READY_STOCK','SOLD','COMPLETED'));

alter table public.spk drop constraint if exists spk_status_spk_check;
alter table public.spk add constraint spk_status_spk_check check (status_spk in ('DRAFT','AKTIF','SELESAI'));

alter table public.spk drop constraint if exists spk_status_active_consistency_check;
alter table public.spk add constraint spk_status_active_consistency_check check ((status_spk = 'AKTIF') = is_active);

alter view public.v_progress_kategori_current set (security_invoker = true);
alter view public.v_progress_summary set (security_invoker = true);
alter view public.v_dashboard_monitor set (security_invoker = true);
alter view public.v_decision_engine set (security_invoker = true);
alter function public.kavio_days_between(date, date) set search_path = public, pg_temp;

create index if not exists ix_kavio_spk_kantor on public.spk (id_kantor);
create index if not exists ix_kavio_spk_tipe on public.spk (id_tipe);
create index if not exists ix_kavio_config_kategori on public.spk_progress_config (id_kategori);
create index if not exists ix_kavio_template_kategori on public.template_progress_tipe (id_kategori);

 drop index if exists public.ix_kavio_progress_spm_tanggal;

create or replace view public.v_decision_engine with (security_invoker = true) as
with progress_base as (
  select s.id_spk,s.id_kavling,s.id_tipe,s.id_kantor,s.id_mandor,s.tgl_spk,s.tgl_target_selesai,s.status_spk,s.is_active,
    coalesce(ps.progress_total,0::numeric) as progress_aktual,
    case when (s.tgl_target_selesai-s.tgl_spk)<=0 then case when current_date>=s.tgl_target_selesai then 1::numeric else 0::numeric end
         else least(1::numeric,greatest(0::numeric,(current_date-s.tgl_spk)::numeric/(s.tgl_target_selesai-s.tgl_spk)::numeric)) end as progress_seharusnya,
    s.tgl_target_selesai-current_date as sisa_hari,
    u.tanggal_update_terakhir,coalesce(u.progress_periode_terakhir,0::numeric) as progress_periode_terakhir,
    case when u.tanggal_update_terakhir is null then null::integer else current_date-u.tanggal_update_terakhir end as hari_sejak_update
  from spk s
  left join v_progress_summary ps on ps.id_spk=s.id_spk
  left join (
    select pu.id_spk,max(pu.tanggal_update) as tanggal_update_terakhir,
      sum(pu.progress_periode) filter (where pu.tanggal_update=md.max_tanggal) as progress_periode_terakhir
    from progress_update pu
    join (select id_spk,max(tanggal_update) as max_tanggal from progress_update group by id_spk) md on md.id_spk=pu.id_spk
    group by pu.id_spk
  ) u on u.id_spk=s.id_spk
), status_base as (
  select p.*,p.progress_aktual-p.progress_seharusnya as gap_progress,
    case when p.status_spk='SELESAI' then 'SELESAI'
         when p.sisa_hari<0 then 'LEWAT TARGET'
         when p.tanggal_update_terakhir is null then 'PERHATIAN'
         when p.hari_sejak_update>14 then 'PERHATIAN'
         when p.sisa_hari<=7 then 'PERHATIAN'
         when (p.progress_aktual-p.progress_seharusnya)<=-0.05 then 'PERHATIAN'
         else 'BERJALAN' end as status_operasional,
    case when (p.progress_aktual-p.progress_seharusnya)<=-0.05 then 'TERTINGGAL'
         when (p.progress_aktual-p.progress_seharusnya)>=0.05 then 'DI DEPAN'
         else 'SESUAI RITME' end as status_ritme,
    case when p.sisa_hari>0 then greatest(0::numeric,(1::numeric-p.progress_aktual)/p.sisa_hari::numeric) else null::numeric end as progress_diperlukan_per_hari
  from progress_base p
), action_base as (
  select s.*,
    case when s.status_operasional='LEWAT TARGET' then 'TINGGI'
         when s.status_operasional='PERHATIAN' and (s.tanggal_update_terakhir is null or s.hari_sejak_update>14) then 'TINGGI'
         when s.status_operasional='PERHATIAN' and s.status_ritme='TERTINGGAL' then 'TINGGI'
         when s.status_operasional='PERHATIAN' and s.sisa_hari<=7 then 'TINGGI'
         when s.status_operasional='PERHATIAN' then 'SEDANG' else 'NORMAL' end as prioritas_tindakan,
    case when s.status_operasional='LEWAT TARGET' then 'SEGERA EVALUASI TARGET & AKSELERASI PEKERJAAN'
         when s.status_operasional='PERHATIAN' and (s.tanggal_update_terakhir is null or s.hari_sejak_update>14) then 'MINTA UPDATE PROGRESS TERBARU'
         when s.status_operasional='PERHATIAN' and s.status_ritme='TERTINGGAL' then 'PERCEPAT PROGRESS / TAMBAH RESOURCE'
         when s.status_operasional='PERHATIAN' and s.sisa_hari<=7 then 'MONITOR HARIAN MENJELANG TARGET'
         when s.status_operasional='PERHATIAN' then 'MONITOR LEBIH DEKAT'
         when s.status_operasional='SELESAI' then 'VERIFIKASI PENYELESAIAN SPK'
         when s.status_ritme='DI DEPAN' then 'PERTAHANKAN RITME PEKERJAAN'
         else 'LANJUTKAN MONITORING' end as action_rekomendasi
  from status_base s
), scored as (
  select a.*,
    case when a.status_operasional='SELESAI' then 98::numeric
         when a.status_operasional='LEWAT TARGET' then greatest(0::numeric,least(40::numeric,40::numeric-least(30::numeric,round(abs(a.gap_progress)*30::numeric))))
         else greatest(0::numeric,least(100::numeric,100::numeric-
           case when a.status_operasional='PERHATIAN' then 20 else 0 end-
           case when a.status_ritme='TERTINGGAL' then least(30::numeric,round(abs(a.gap_progress)*300::numeric)) else 0::numeric end-
           case when a.sisa_hari<=0 then 35 when a.sisa_hari<=7 then 12 when a.sisa_hari<=14 then 5 else 0 end::numeric-
           case when a.tanggal_update_terakhir is null then 18 when a.hari_sejak_update>14 then 20 when a.hari_sejak_update>7 then 8 else 0 end::numeric+
           case when a.status_ritme='DI DEPAN' then 5 else 0 end::numeric)) end::integer as health_score
  from action_base a
), leveled as (
  select s.*,
    case when s.status_operasional='SELESAI' then 'SEHAT'
         when s.status_operasional='LEWAT TARGET' or s.health_score<50 then 'KRITIS'
         when s.health_score<75 then 'WASPADA' else 'SEHAT' end as health_level
  from scored s
)
select id_spk,id_kavling,id_tipe,id_kantor,id_mandor,tgl_spk,tgl_target_selesai,status_spk,is_active,progress_aktual,progress_seharusnya,gap_progress,sisa_hari,tanggal_update_terakhir,progress_periode_terakhir,status_operasional,status_ritme,prioritas_tindakan,action_rekomendasi,hari_sejak_update,progress_diperlukan_per_hari,health_score,health_level,
  case when health_level='SEHAT' then 'Kondisi operasional terkendali.' when health_level='WASPADA' then 'Perlu monitoring lebih dekat.' else 'Perlu tindakan segera.' end as health_description
from leveled;

CREATE OR REPLACE VIEW public.v_decision_engine WITH (security_invoker = true) AS
WITH progress_base AS (
  SELECT s.id_spk,s.id_kavling,s.id_tipe,s.id_kantor,s.id_mandor,s.tgl_spk,s.tgl_target_selesai,s.status_spk,s.is_active,
    COALESCE(ps.progress_total,0::numeric) AS progress_aktual,
    CASE WHEN (s.tgl_target_selesai-s.tgl_spk)<=0 THEN CASE WHEN CURRENT_DATE>=s.tgl_target_selesai THEN 1::numeric ELSE 0::numeric END
         ELSE LEAST(1::numeric,GREATEST(0::numeric,(CURRENT_DATE-s.tgl_spk)::numeric/(s.tgl_target_selesai-s.tgl_spk)::numeric)) END AS progress_seharusnya,
    s.tgl_target_selesai-CURRENT_DATE AS sisa_hari,u.tanggal_update_terakhir,COALESCE(u.progress_periode_terakhir,0::numeric) AS progress_periode_terakhir,
    CASE WHEN u.tanggal_update_terakhir IS NULL THEN NULL::integer ELSE CURRENT_DATE-u.tanggal_update_terakhir END AS hari_sejak_update
  FROM spk s
  LEFT JOIN v_progress_summary ps ON ps.id_spk=s.id_spk
  LEFT JOIN (SELECT pu.id_spk,max(pu.tanggal_update) AS tanggal_update_terakhir,
      sum(pu.progress_periode) FILTER (WHERE pu.tanggal_update=md.max_tanggal) AS progress_periode_terakhir
    FROM progress_update pu
    JOIN (SELECT progress_update.id_spk,max(progress_update.tanggal_update) AS max_tanggal FROM progress_update GROUP BY progress_update.id_spk) md ON md.id_spk=pu.id_spk
    GROUP BY pu.id_spk) u ON u.id_spk=s.id_spk
  WHERE s.status_spk IN ('AKTIF','SELESAI')
), status_base AS (
  SELECT p.*,p.progress_aktual-p.progress_seharusnya AS gap_progress,
    CASE WHEN p.status_spk='SELESAI' THEN 'SELESAI' WHEN p.sisa_hari<0 THEN 'LEWAT TARGET' WHEN p.tanggal_update_terakhir IS NULL THEN 'PERHATIAN' WHEN p.hari_sejak_update>14 THEN 'PERHATIAN' WHEN p.sisa_hari<=7 THEN 'PERHATIAN' WHEN (p.progress_aktual-p.progress_seharusnya)<=-0.05 THEN 'PERHATIAN' ELSE 'BERJALAN' END AS status_operasional,
    CASE WHEN (p.progress_aktual-p.progress_seharusnya)<=-0.05 THEN 'TERTINGGAL' WHEN (p.progress_aktual-p.progress_seharusnya)>=0.05 THEN 'DI DEPAN' ELSE 'SESUAI RITME' END AS status_ritme,
    CASE WHEN p.sisa_hari>0 THEN GREATEST(0::numeric,(1::numeric-p.progress_aktual)/p.sisa_hari::numeric) ELSE NULL::numeric END AS progress_diperlukan_per_hari
  FROM progress_base p
), action_base AS (
  SELECT s.*,
    CASE WHEN s.status_operasional='LEWAT TARGET' THEN 'TINGGI' WHEN s.status_operasional='PERHATIAN' AND (s.tanggal_update_terakhir IS NULL OR s.hari_sejak_update>14) THEN 'TINGGI' WHEN s.status_operasional='PERHATIAN' AND s.status_ritme='TERTINGGAL' THEN 'TINGGI' WHEN s.status_operasional='PERHATIAN' AND s.sisa_hari<=7 THEN 'TINGGI' WHEN s.status_operasional='PERHATIAN' THEN 'SEDANG' ELSE 'NORMAL' END AS prioritas_tindakan,
    CASE WHEN s.status_operasional='LEWAT TARGET' THEN 'SEGERA EVALUASI TARGET & AKSELERASI PEKERJAAN' WHEN s.status_operasional='PERHATIAN' AND (s.tanggal_update_terakhir IS NULL OR s.hari_sejak_update>14) THEN 'MINTA UPDATE PROGRESS TERBARU' WHEN s.status_operasional='PERHATIAN' AND s.status_ritme='TERTINGGAL' THEN 'PERCEPAT PROGRESS / TAMBAH RESOURCE' WHEN s.status_operasional='PERHATIAN' AND s.sisa_hari<=7 THEN 'MONITOR HARIAN MENJELANG TARGET' WHEN s.status_operasional='PERHATIAN' THEN 'MONITOR LEBIH DEKAT' WHEN s.status_operasional='SELESAI' THEN 'VERIFIKASI PENYELESAIAN SPK' WHEN s.status_ritme='DI DEPAN' THEN 'PERTAHANKAN RITME PEKERJAAN' ELSE 'LANJUTKAN MONITORING' END AS action_rekomendasi
  FROM status_base s
), scored AS (
  SELECT a.*,
    CASE WHEN a.status_operasional='SELESAI' THEN 98 WHEN a.status_operasional='LEWAT TARGET' THEN GREATEST(0::numeric,LEAST(40::numeric,40::numeric-LEAST(30::numeric,round(abs(a.gap_progress)*30::numeric))))
      ELSE GREATEST(0::numeric,LEAST(100::numeric,100::numeric-CASE WHEN a.status_operasional='PERHATIAN' THEN 20 ELSE 0 END::numeric-CASE WHEN a.status_ritme='TERTINGGAL' THEN LEAST(30::numeric,round(abs(a.gap_progress)*300::numeric)) ELSE 0::numeric END-CASE WHEN a.sisa_hari<=0 THEN 35 WHEN a.sisa_hari<=7 THEN 12 WHEN a.sisa_hari<=14 THEN 5 ELSE 0 END::numeric-CASE WHEN a.tanggal_update_terakhir IS NULL THEN 18 WHEN a.hari_sejak_update>14 THEN 20 WHEN a.hari_sejak_update>7 THEN 8 ELSE 0 END::numeric+CASE WHEN a.status_ritme='DI DEPAN' THEN 5 ELSE 0 END::numeric)) END::integer AS health_score
  FROM action_base a
), leveled AS (
  SELECT s.*,CASE WHEN s.status_operasional='SELESAI' THEN 'SEHAT' WHEN s.status_operasional='LEWAT TARGET' OR s.health_score<50 THEN 'KRITIS' WHEN s.health_score<75 THEN 'WASPADA' ELSE 'SEHAT' END AS health_level
  FROM scored s
)
SELECT id_spk,id_kavling,id_tipe,id_kantor,id_mandor,tgl_spk,tgl_target_selesai,status_spk,is_active,progress_aktual,progress_seharusnya,gap_progress,sisa_hari,tanggal_update_terakhir,progress_periode_terakhir,status_operasional,status_ritme,prioritas_tindakan,action_rekomendasi,hari_sejak_update,progress_diperlukan_per_hari,health_score,health_level,
  CASE WHEN health_level='SEHAT' THEN 'Kondisi operasional terkendali.' WHEN health_level='WASPADA' THEN 'Perlu monitoring lebih dekat.' ELSE 'Perlu tindakan segera.' END AS health_description
FROM leveled;

create or replace function public.kavio_test_progress_scenario(p_id_spk uuid, p_id_kategori text, p_tanggal date, p_progress_periode numeric, p_keterangan text default null) returns uuid language plpgsql security invoker set search_path = public as $$ declare v_id uuid; begin if p_progress_periode < 0 or p_progress_periode > 1 then raise exception 'progress_periode harus 0 sampai 1'; end if; insert into public.progress_update (id_spk,tanggal_update,id_kategori,progress_periode,keterangan,input_by) select p_id_spk,p_tanggal,p_id_kategori,p_progress_periode,p_keterangan,auth.uid() where exists (select 1 from public.spk_progress_config c where c.id_spk=p_id_spk and c.id_kategori=p_id_kategori) returning id_progress into v_id; if v_id is null then raise exception 'SPK/kategori tidak valid atau tidak terdaftar'; end if; return v_id; end; $$;

create or replace function public.activate_spk_atomic(p_id_spk uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spk public.spk%rowtype;
  v_kavling public.master_kavling%rowtype;
  v_other_active uuid;
  v_weight_total numeric;
  v_weight_count integer;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_spk
  from public.spk
  where id_spk = p_id_spk
  for update;

  if not found then raise exception 'SPK tidak ditemukan'; end if;
  if v_spk.status_spk <> 'DRAFT' or v_spk.is_active then raise exception 'SPK tidak berada pada status DRAFT yang valid'; end if;

  select * into v_kavling
  from public.master_kavling
  where id_kavling = v_spk.id_kavling
  for update;

  if not found or not v_kavling.status_aktif then raise exception 'Kavling pada SPK tidak aktif atau tidak ditemukan'; end if;
  if v_kavling.status_kavling not in ('AVAILABLE','BOOKING') then raise exception 'Kavling berstatus % tidak siap untuk SPK', v_kavling.status_kavling; end if;

  select id_spk into v_other_active
  from public.spk
  where id_kavling = v_spk.id_kavling and is_active = true and id_spk <> p_id_spk
  limit 1;
  if v_other_active is not null then raise exception 'Kavling tersebut sudah memiliki SPK aktif lain'; end if;

  select count(*), coalesce(sum(bobot_final),0)
    into v_weight_count, v_weight_total
  from public.spk_progress_config
  where id_spk = p_id_spk;

  if v_weight_count = 0 or abs(v_weight_total - 1) > 0.00001 then
    raise exception 'SPK tidak dapat diaktifkan. Total bobot harus 100%%, saat ini %%%', round(v_weight_total * 100, 2);
  end if;

  update public.spk
  set status_spk = 'AKTIF', is_active = true
  where id_spk = p_id_spk and status_spk = 'DRAFT' and is_active = false;

  if not found then raise exception 'SPK berubah sebelum aktivasi. Silakan coba lagi'; end if;

  update public.master_kavling
  set status_kavling = 'BUILDING'
  where id_kavling = v_spk.id_kavling and status_aktif = true;

  if not found then raise exception 'Gagal mengubah status kavling menjadi BUILDING'; end if;
end;
$$;

create or replace function public.deactivate_spk_atomic(p_id_spk uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spk public.spk%rowtype;
  v_sales_status text;
  v_next_status text;
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
$$;

revoke all on function public.activate_spk_atomic(uuid) from public;
revoke all on function public.deactivate_spk_atomic(uuid) from public;
grant execute on function public.activate_spk_atomic(uuid) to authenticated;
grant execute on function public.deactivate_spk_atomic(uuid) to authenticated;
