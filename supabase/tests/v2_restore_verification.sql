\set ON_ERROR_STOP on
\pset pager off
-- Read-only data recovery validation. Local restore omits original ownership/grants;
-- this check does not certify Supabase Auth/Storage services or production privileges.
-- Audit views require an authorized caller, even through an admin SQL connection.
-- This identity is the existing V2 test director; no fixture/user is committed.
begin read only;
set local timezone='UTC';
select set_config('request.jwt.claim.sub','2d50291d-03e3-46a3-b3d8-c4550bc1bce7',true);
do $$ begin if not public.kavio_can_action('WAGE_PAYMENT_READ') then raise exception 'Reconciliation requires an authorized V2 finance reader';end if;end $$;
select 'KAVLING' as jenis,count(*) as jumlah from public.master_kavling
union all select 'SALES',count(*) from public.sales
union all select 'SPK',count(*) from public.spk
union all select 'PROGRESS',count(*) from public.progress_update
union all select 'PERINCIAN PROGRESS',count(*) from public.work_detail_progress
union all select 'KUITANSI',count(*) from public.sales_receipt
union all select 'USER LOGIN',count(*) from auth.users
union all select 'PROFIL USER',count(*) from public.user_profiles
union all select 'PEMBAYARAN UPAH',count(*) from public.wage_payment
union all select 'COUNTER NOMOR SPK',count(*) from kavio_internal.spk_number_counter;
with checks as (select jsonb_build_object(
 'duplicate_active_sales',(select count(*) from(select id_kavling from sales where status_aktif and status_sales<>'BATAL' group by id_kavling having count(*)>1)x),
 'duplicate_kavling_spk',(select count(*) from(select id_kavling from spk where jenis_spk='KAVLING' group by id_kavling having count(*)>1)x),
 'active_unconfigured_spk',(select count(*) from spk where is_active and configured_at is null),
 'item_progress_over_100',(select count(*) from(select id_detail,sum(progress_periode) p from work_detail_progress group by id_detail having sum(progress_periode)>1)x),
 'negative_warehouse_stock',(select count(*) from material_stock_location where jumlah<0),
 'negative_spk_stock',(select count(*) from material_stock_spk where jumlah<0),
 'wage_overpayment',(select count(*) from v_wage_settlement where sisa_upah<0 or sisa_retensi<0 or retensi_tersedia<0),
 'wage_header_mismatch',(select count(*) from wage_payment h where total<>(select coalesce(sum(nominal),0) from wage_payment_item i where i.id_pembayaran=h.id_pembayaran)),
 'unapproved_retention_paid',(select count(*) from wage_payment where jenis='RETENSI' and status='POSTED' and disetujui_oleh is null),
 'warehouse_card_mismatch',(select count(*) from material_stock_location s left join lateral(select saldo from v_material_stock_card c where c.jenis_lokasi='GUDANG' and c.pemegang=s.id_lokasi::text and c.id_material=s.id_material order by tanggal desc,urutan_mutasi desc,created_at desc,no_transaksi desc,id_item_transaksi desc limit 1)c on true where s.jumlah<>coalesce(c.saldo,0)),
 'spk_card_mismatch',(select count(*) from material_stock_spk s left join lateral(select saldo from v_material_stock_card c where c.jenis_lokasi='SPK' and c.pemegang=s.id_spk::text and c.id_material=s.id_material order by tanggal desc,urutan_mutasi desc,created_at desc,no_transaksi desc,id_item_transaksi desc limit 1)c on true where s.jumlah<>coalesce(c.saldo,0)),
 'net_bank_receipts_mismatch',(select count(*) from v_sales_bank_receipt_balance where total_uang_masuk<>total_bruto-total_jaminan),
 'consumer_negative_balance',(select count(*) from v_sales_financial_position where status_aktif and status_sales<>'BATAL' and saldo_piutang<0),
 'consumer_equation_mismatch',(select count(*) from v_sales_financial_position where saldo_piutang<>case when status_sales='BATAL' then 0 else total_tagihan-total_pelunasan_konsumen end),
 'bank_negative_balance',(select count(*) from v_sales_bank_receivable where saldo_piutang_bank<0),
 'bank_equation_mismatch',(select count(*) from v_sales_bank_receivable where saldo_piutang_bank<>nominal_tagihan-nominal_diterima),
 'approved_financial_without_decider',(select count(*) from sales_financial_approval where status='DISETUJUI' and (diputuskan_oleh is null or diputuskan_pada is null)),
 'stranded_financial_apply',(select count(*) from sales_financial_approval where status='APLICANDO'),
 'refund_without_approved_decision',(select count(*) from sales_refund_payment p join sales_financial_approval a using(id_pengajuan) where a.jenis<>'PEMBATALAN' or a.status<>'DISETUJUI' or a.id_sales<>p.id_sales),
 'stranded_material_loss_apply',(select count(*) from material_loss_approval where status='APPLYING'),
 'approved_loss_missing_posting',(select count(*) from material_loss_approval a left join material_spk_reconciliation r using(id_rekonsiliasi) where a.status='DISETUJUI' and (r.id_rekonsiliasi is null or r.id_spk<>a.id_spk or a.diputuskan_oleh is null or a.diputuskan_pada is null)),
 'pending_loss_has_posting',(select count(*) from material_loss_approval where status<>'DISETUJUI' and id_rekonsiliasi is not null),
 'refund_overpayment',(select count(*) from v_sales_refund_position where sisa_refund<0)
) reconciliation)
select key as indikator,value::integer as anomali from checks cross join lateral jsonb_each(reconciliation) order by key;
rollback;
