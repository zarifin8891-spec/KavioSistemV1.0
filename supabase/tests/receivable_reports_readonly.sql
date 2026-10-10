-- Read-only regression: report must preserve all item balances and identities.
begin;
select set_config('request.jwt.claim.sub','2d50291d-03e3-46a3-b3d8-c4550bc1bce7',true);
set local role authenticated;
do $$
declare b record;k record;
begin
 if (select count(*) from public.v_sales_bank_receivable_report)<>(select count(*) from public.v_sales_bank_receivable) then raise exception 'Report dropped or duplicated guarantee items';end if;
 if exists(select 1 from public.v_sales_bank_receivable_report r join public.v_sales_bank_receivable g using(id_jaminan)
 where r.id_bank_kpr is distinct from g.id_bank_kpr or r.nominal_diterima is distinct from g.nominal_diterima or r.saldo_piutang_bank is distinct from g.saldo_piutang_bank) then raise exception 'Report changed bank/balance';end if;
 for b in select distinct id_bank_kpr from public.v_sales_bank_receivable loop
  for k in select distinct jenis_item from public.v_sales_bank_receivable where id_bank_kpr=b.id_bank_kpr loop
   if (select count(*) from public.v_sales_bank_receivable_report where id_bank_kpr=b.id_bank_kpr and jenis_item=k.jenis_item)<>(select count(*) from public.v_sales_bank_receivable where id_bank_kpr=b.id_bank_kpr and jenis_item=k.jenis_item) then raise exception 'Incorrect report bank/item filtering';end if;
  end loop;
 end loop;
 if exists(select 1 from public.v_sales_financial_position where status_aktif and status_sales<>'BATAL' and abs(total_tagihan-total_pelunasan_konsumen-saldo_piutang)>0.000001) then raise exception 'Consumer financial balance does not reconcile';end if;
end;$$;
select 'PASS: invoker report preserves all guarantee items, bank/kind filters and consumer settlement balances' as verification;
rollback;
