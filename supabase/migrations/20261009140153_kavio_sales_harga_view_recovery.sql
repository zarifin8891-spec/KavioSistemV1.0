create or replace view public.v_sales_harga as
select
  s.id_sales,
  s.id_kavling,
  s.harga_jual as harga_jual_dasar,
  coalesce(sum(case when b.status_aktif then b.nominal else 0::numeric end), 0::numeric)::numeric(18,2) as total_biaya_tambahan,
  (coalesce(s.harga_jual, 0::numeric) + coalesce(sum(case when b.status_aktif then b.nominal else 0::numeric end), 0::numeric))::numeric(18,2) as total_harga
from public.sales s
left join public.sales_biaya_tambahan b on b.id_sales = s.id_sales
group by s.id_sales, s.id_kavling, s.harga_jual;
