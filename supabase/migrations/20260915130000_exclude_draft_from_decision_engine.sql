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
