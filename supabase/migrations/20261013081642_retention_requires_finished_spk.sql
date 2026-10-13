-- Retention is only eligible on finished SPKs; Kavling also retains the akad requirement.
create or replace view public.v_wage_settlement with(security_invoker=true) as
select p.id_progress_detail,p.tanggal_update,p.id_mandor,m.nama_mandor,p.id_detail,d.nama_pekerjaan,w.id_spk,s.jenis_spk,s.id_kavling,s.nama_objek,s.status_spk,
 p.upah_bruto,p.upah_retensi,p.upah_netto,coalesce(a.dibayar_upah,0) dibayar_upah,coalesce(a.dibayar_retensi,0) dibayar_retensi,coalesce(a.dipesan_retensi,0) dipesan_retensi,
 p.upah_netto-coalesce(a.dibayar_upah,0) sisa_upah,p.upah_retensi-coalesce(a.dibayar_retensi,0) sisa_retensi,
 p.upah_retensi-coalesce(a.dipesan_retensi,0) retensi_tersedia,
 s.status_spk='SELESAI' and not s.is_active and (case when s.jenis_spk='FASUM' then true else exists(select 1 from public.sales x where x.id_kavling=s.id_kavling and x.status_aktif and x.status_sales='AKAD' and x.tgl_akad is not null) end) retensi_layak
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
