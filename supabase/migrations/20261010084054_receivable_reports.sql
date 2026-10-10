-- Current bank receivables: one row per retained item, with report identities.
-- Keep all statuses, including fully collected items; receipt engine excludes voids.
create view public.v_sales_bank_receivable_report with(security_invoker=true) as
select g.*,s.id_kavling,s.nama_konsumen,s.status_sales,s.status_aktif,
 b.nama_bank as nama_bank_kpr
from public.v_sales_bank_receivable g
join public.sales s on s.id_sales=g.id_sales
left join public.master_bank b on b.id_bank=g.id_bank_kpr;
revoke all on public.v_sales_bank_receivable_report from public,anon;
grant select on public.v_sales_bank_receivable_report to authenticated;
comment on view public.v_sales_bank_receivable_report is 'Posisi dana jaminan pada bank pemberi KPR, bukan rekening penerimaan. Saldo mengikuti seluruh klaim aktif, termasuk klaim bertahap.';
