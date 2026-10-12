create policy sales_contract_origin_no_direct_access on public.sales_contract_origin for all to authenticated using(false) with check(false);
create index sales_refund_legacy_paid_source_idx on public.sales_refund_legacy_paid(id_penyelesaian);

