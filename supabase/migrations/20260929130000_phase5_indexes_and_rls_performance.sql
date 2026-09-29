
-- Phase 5: evidence-based indexes for current KAVIO access patterns.
create index if not exists idx_siteplan_mapping_version
  on public.siteplan_kavling_mapping (siteplan_version_id);

create index if not exists idx_sales_created_at_desc
  on public.sales (created_at desc);

create index if not exists idx_spk_created_at_desc
  on public.spk (created_at desc);

-- Keep only one identical active-sales uniqueness index.
drop index if exists public.ux_sales_one_active_per_kavling;

-- Avoid evaluating write authorization as a permissive SELECT policy.
drop policy if exists kavio_write_sales on public.sales;
create policy kavio_insert_sales on public.sales
  for insert to authenticated
  with check ((select public.kavio_can_action('SALES_WRITE')));
create policy kavio_update_sales on public.sales
  for update to authenticated
  using ((select public.kavio_can_action('SALES_WRITE')))
  with check ((select public.kavio_can_action('SALES_WRITE')));
create policy kavio_delete_sales on public.sales
  for delete to authenticated
  using ((select public.kavio_can_action('SALES_WRITE')));

drop policy if exists kavio_write_spk on public.spk;
create policy kavio_insert_spk on public.spk
  for insert to authenticated
  with check ((select public.kavio_can_action('SPK_WRITE')));
create policy kavio_update_spk on public.spk
  for update to authenticated
  using ((select public.kavio_can_action('SPK_WRITE')))
  with check ((select public.kavio_can_action('SPK_WRITE')));
create policy kavio_delete_spk on public.spk
  for delete to authenticated
  using ((select public.kavio_can_action('SPK_WRITE')));

drop policy if exists kavio_write_progress on public.progress_update;
create policy kavio_insert_progress on public.progress_update
  for insert to authenticated
  with check ((select public.kavio_can_action('PROGRESS_WRITE')));
create policy kavio_update_progress on public.progress_update
  for update to authenticated
  using ((select public.kavio_can_action('PROGRESS_WRITE')))
  with check ((select public.kavio_can_action('PROGRESS_WRITE')));
create policy kavio_delete_progress on public.progress_update
  for delete to authenticated
  using ((select public.kavio_can_action('PROGRESS_WRITE')));

drop policy if exists kavio_write_spk_config on public.spk_progress_config;
create policy kavio_insert_spk_config on public.spk_progress_config
  for insert to authenticated
  with check ((select public.kavio_can_action('SPK_WRITE')));
create policy kavio_update_spk_config on public.spk_progress_config
  for update to authenticated
  using ((select public.kavio_can_action('SPK_WRITE')))
  with check ((select public.kavio_can_action('SPK_WRITE')));
create policy kavio_delete_spk_config on public.spk_progress_config
  for delete to authenticated
  using ((select public.kavio_can_action('SPK_WRITE')));

drop policy if exists kavio_write_master on public.master_kavling;
create policy kavio_insert_master_kavling on public.master_kavling
  for insert to authenticated
  with check ((select public.kavio_can_action('MASTER_WRITE')));
create policy kavio_update_master_kavling on public.master_kavling
  for update to authenticated
  using ((select public.kavio_can_action('MASTER_WRITE')))
  with check ((select public.kavio_can_action('MASTER_WRITE')));
create policy kavio_delete_master_kavling on public.master_kavling
  for delete to authenticated
  using ((select public.kavio_can_action('MASTER_WRITE')));

-- Fix auth.uid() initplan warning on mapping write policies.
drop policy if exists siteplan_mapping_insert_authenticated on public.siteplan_kavling_mapping;
create policy siteplan_mapping_insert_authenticated on public.siteplan_kavling_mapping
  for insert to authenticated
  with check (
    (select public.kavio_can_action('SITEPLAN_MAP'))
    and updated_by = (select auth.uid())
  );

drop policy if exists siteplan_mapping_update_authenticated on public.siteplan_kavling_mapping;
create policy siteplan_mapping_update_authenticated on public.siteplan_kavling_mapping
  for update to authenticated
  using ((select public.kavio_can_action('SITEPLAN_MAP')))
  with check (
    (select public.kavio_can_action('SITEPLAN_MAP'))
    and updated_by = (select auth.uid())
  );

drop policy if exists siteplan_mapping_delete_authenticated on public.siteplan_kavling_mapping;
create policy siteplan_mapping_delete_authenticated on public.siteplan_kavling_mapping
  for delete to authenticated
  using ((select public.kavio_can_action('SITEPLAN_MAP')));
