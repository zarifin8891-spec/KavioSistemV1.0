-- Avoid permissive SELECT overlap: retain dedicated active-user read policies,
-- and scope write policies to their actual operation.
drop policy if exists kavio_write_master_material on public.master_material;
create policy kavio_insert_master_material on public.master_material for insert to authenticated
  with check (public.kavio_can_action('MATERIAL_CATALOG_WRITE'));
create policy kavio_update_master_material on public.master_material for update to authenticated
  using (public.kavio_can_action('MATERIAL_CATALOG_WRITE'))
  with check (public.kavio_can_action('MATERIAL_CATALOG_WRITE'));
create policy kavio_delete_master_material on public.master_material for delete to authenticated
  using (public.kavio_can_action('MATERIAL_CATALOG_WRITE'));

drop policy if exists kavio_write_rab_template on public.rab_template;
create policy kavio_insert_rab_template on public.rab_template for insert to authenticated
  with check (public.kavio_can_action('MASTER_WRITE'));
create policy kavio_update_rab_template on public.rab_template for update to authenticated
  using (public.kavio_can_action('MASTER_WRITE'))
  with check (public.kavio_can_action('MASTER_WRITE'));
create policy kavio_delete_rab_template on public.rab_template for delete to authenticated
  using (public.kavio_can_action('MASTER_WRITE'));

drop policy if exists kavio_write_rab_template_item on public.rab_template_item;
create policy kavio_insert_rab_template_item on public.rab_template_item for insert to authenticated
  with check (public.kavio_can_action('MASTER_WRITE'));
create policy kavio_update_rab_template_item on public.rab_template_item for update to authenticated
  using (public.kavio_can_action('MASTER_WRITE'))
  with check (public.kavio_can_action('MASTER_WRITE'));
create policy kavio_delete_rab_template_item on public.rab_template_item for delete to authenticated
  using (public.kavio_can_action('MASTER_WRITE'));

drop policy if exists kavio_write_material_location on public.material_location;
create policy kavio_insert_material_location on public.material_location for insert to authenticated
  with check (public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE'));
create policy kavio_update_material_location on public.material_location for update to authenticated
  using (public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE'))
  with check (public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE'));
create policy kavio_delete_material_location on public.material_location for delete to authenticated
  using (public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE'));

drop policy if exists kavio_write_project_preparation_work on public.project_preparation_work;
create policy kavio_insert_project_preparation_work on public.project_preparation_work for insert to authenticated
  with check (public.kavio_can_action('MATERIAL_CATALOG_WRITE'));
create policy kavio_update_project_preparation_work on public.project_preparation_work for update to authenticated
  using (public.kavio_can_action('MATERIAL_CATALOG_WRITE'))
  with check (public.kavio_can_action('MATERIAL_CATALOG_WRITE'));
create policy kavio_delete_project_preparation_work on public.project_preparation_work for delete to authenticated
  using (public.kavio_can_action('MATERIAL_CATALOG_WRITE'));

drop policy if exists kavio_write_material_request on public.material_request;
create policy kavio_insert_material_request on public.material_request for insert to authenticated
  with check (public.kavio_can_action('MATERIAL_REQUEST_WRITE'));
create policy kavio_update_material_request on public.material_request for update to authenticated
  using (public.kavio_can_action('MATERIAL_REQUEST_WRITE'))
  with check (public.kavio_can_action('MATERIAL_REQUEST_WRITE'));
create policy kavio_delete_material_request on public.material_request for delete to authenticated
  using (public.kavio_can_action('MATERIAL_REQUEST_WRITE'));

drop policy if exists kavio_write_material_request_item on public.material_request_item;
create policy kavio_insert_material_request_item on public.material_request_item for insert to authenticated
  with check (public.kavio_can_action('MATERIAL_REQUEST_WRITE'));
create policy kavio_update_material_request_item on public.material_request_item for update to authenticated
  using (public.kavio_can_action('MATERIAL_REQUEST_WRITE'))
  with check (public.kavio_can_action('MATERIAL_REQUEST_WRITE'));
create policy kavio_delete_material_request_item on public.material_request_item for delete to authenticated
  using (public.kavio_can_action('MATERIAL_REQUEST_WRITE'));

create index if not exists idx_material_request_diminta_oleh on public.material_request(diminta_oleh);
create index if not exists idx_material_request_id_lokasi on public.material_request(id_lokasi);
create index if not exists idx_material_request_id_persiapan on public.material_request(id_persiapan);
create index if not exists idx_material_spk_reconciliation_diajukan_oleh on public.material_spk_reconciliation(diajukan_oleh);
create index if not exists idx_material_spk_reconciliation_diselesaikan_oleh on public.material_spk_reconciliation(diselesaikan_oleh);
create index if not exists idx_material_spk_reconciliation_item_id_lokasi_tujuan on public.material_spk_reconciliation_item(id_lokasi_tujuan);
create index if not exists idx_material_spk_reconciliation_item_id_material on public.material_spk_reconciliation_item(id_material);
create index if not exists idx_material_spk_reconciliation_item_id_spk_tujuan on public.material_spk_reconciliation_item(id_spk_tujuan);
create index if not exists idx_material_stock_location_id_material on public.material_stock_location(id_material);
create index if not exists idx_material_stock_preparation_id_material on public.material_stock_preparation(id_material);
create index if not exists idx_material_stock_spk_id_material on public.material_stock_spk(id_material);
create index if not exists idx_material_transaction_dibuat_oleh on public.material_transaction(dibuat_oleh);
create index if not exists idx_material_transaction_id_lokasi_asal on public.material_transaction(id_lokasi_asal);
create index if not exists idx_material_transaction_id_lokasi_tujuan on public.material_transaction(id_lokasi_tujuan);
create index if not exists idx_material_transaction_id_permintaan on public.material_transaction(id_permintaan);
create index if not exists idx_material_transaction_id_persiapan on public.material_transaction(id_persiapan);
create index if not exists idx_material_transaction_id_rekonsiliasi on public.material_transaction(id_rekonsiliasi);
create index if not exists idx_material_transaction_id_spk_tujuan on public.material_transaction(id_spk_tujuan);
create index if not exists idx_progress_update_id_item on public.progress_update(id_item);
create index if not exists idx_rab_template_created_by on public.rab_template(created_by);
create index if not exists idx_sales_bank_guarantee_item_dibuat_oleh on public.sales_bank_guarantee_item(dibuat_oleh);
create index if not exists idx_sales_cancellation_settlement_diputuskan_oleh on public.sales_cancellation_settlement(diputuskan_oleh);
create index if not exists idx_sales_cash_installment_terms_dibuat_oleh on public.sales_cash_installment_terms(dibuat_oleh);
create index if not exists idx_sales_receipt_diterima_oleh on public.sales_receipt(diterima_oleh);
create index if not exists idx_sales_receipt_id_jaminan on public.sales_receipt(id_jaminan);
create index if not exists idx_spk_work_item_id_kategori_legacy on public.spk_work_item(id_kategori_legacy);
