-- V2 audit A01: one explicit read capability for payment history, debt and proofs.
insert into public.kavio_role_actions(role,action) values
 ('DIREKTUR','WAGE_PAYMENT_READ'),('ADMIN','WAGE_PAYMENT_READ'),('KEUANGAN','WAGE_PAYMENT_READ')
on conflict do nothing;

alter policy wage_payment_read on public.wage_payment
 using ((select public.kavio_can_action('WAGE_PAYMENT_READ')));
alter policy wage_payment_item_read on public.wage_payment_item
 using ((select public.kavio_can_action('WAGE_PAYMENT_READ')));

-- A settlement LEFT JOIN must not present hidden payments as zero paid.
create or replace view public.v_wage_settlement with(security_invoker=true) as
select p.id_progress_detail,p.tanggal_update,p.id_mandor,m.nama_mandor,p.id_detail,d.nama_pekerjaan,w.id_spk,s.jenis_spk,s.id_kavling,s.nama_objek,s.status_spk,
 p.upah_bruto,p.upah_retensi,p.upah_netto,coalesce(a.dibayar_upah,0) dibayar_upah,coalesce(a.dibayar_retensi,0) dibayar_retensi,coalesce(a.dipesan_retensi,0) dipesan_retensi,
 p.upah_netto-coalesce(a.dibayar_upah,0) sisa_upah,p.upah_retensi-coalesce(a.dibayar_retensi,0) sisa_retensi,
 p.upah_retensi-coalesce(a.dipesan_retensi,0) retensi_tersedia,
 case when s.jenis_spk='FASUM' then s.status_spk='SELESAI' else exists(select 1 from public.sales x where x.id_kavling=s.id_kavling and x.status_aktif and x.status_sales='AKAD' and x.tgl_akad is not null) end retensi_layak
from public.work_detail_progress p join public.spk_work_detail d using(id_detail)
join public.spk_work_item w on w.id_item=d.id_item join public.spk s on s.id_spk=w.id_spk
join public.master_mandor m on m.id_mandor=p.id_mandor
left join lateral(
 select sum(i.nominal) filter(where h.jenis='UPAH' and h.status='POSTED') dibayar_upah,
 sum(i.nominal) filter(where h.jenis='RETENSI' and h.status='POSTED') dibayar_retensi,
 sum(i.nominal) filter(where h.jenis='RETENSI' and h.status<>'BATAL') dipesan_retensi
 from public.wage_payment_item i join public.wage_payment h using(id_pembayaran)
 where i.id_progress_detail=p.id_progress_detail
)a on true
where (select public.kavio_can_action('WAGE_PAYMENT_READ'));
revoke all on public.v_wage_settlement from public,anon;
grant select on public.v_wage_settlement to authenticated;

-- V2 audit A06: aggregate before API pagination; retain existing KPI definitions.
-- Security invoker applies each source table's RLS to the requesting user.
create view public.v_dashboard_summary with(security_invoker=true) as
with kavling_counts as (
 select count(*) total,
 count(*) filter(where status_kavling='AVAILABLE') available,
 count(*) filter(where status_kavling='BOOKING') booking,
 count(*) filter(where status_kavling='BUILDING') building,
 count(*) filter(where status_kavling='READY_STOCK') ready_stock,
 count(*) filter(where status_kavling='SIAP_AKAD') siap_akad,
 count(*) filter(where status_kavling='SOLD') sold
 from public.master_kavling where status_aktif
), sales_counts as (
 select count(*) total,
 count(*) filter(where status_sales='BOOKING') booking,
 count(*) filter(where status_sales='DP') dp,
 count(*) filter(where status_sales='PROSES_KPR') proses_kpr,
 count(*) filter(where status_sales='AKAD') akad,
 count(*) filter(where status_sales='BATAL') batal,
 count(distinct id_kavling) filter(where (status_aktif and status_sales<>'BATAL') or status_sales='AKAD') terjual
 from public.sales
), health_counts as (
 select count(*) total,
 coalesce(avg(progress_aktual),0) avg_progress,
 coalesce(avg(health_score),0) avg_health,
 count(*) filter(where health_level='SEHAT') sehat,
 count(*) filter(where health_level='WASPADA') waspada,
 count(*) filter(where health_level='KRITIS') kritis
 from public.v_decision_engine where status_spk<>'DRAFT'
)
select to_jsonb(k) kavling,to_jsonb(s) sales,to_jsonb(h) health
from kavling_counts k cross join sales_counts s cross join health_counts h
where (select public.kavio_is_active_user());
revoke all on public.v_dashboard_summary from public,anon;
grant select on public.v_dashboard_summary to authenticated;

