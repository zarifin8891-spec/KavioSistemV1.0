
-- Phase 5 continuation: remove remaining SELECT policy overlap and initplan warnings.

create index if not exists idx_siteplan_mapping_updated_by
  on public.siteplan_kavling_mapping (updated_by);

create index if not exists idx_siteplan_versions_uploaded_by
  on public.siteplan_versions (uploaded_by);

-- Master tables: keep SELECT open to authenticated users, move manager writes
-- to command-specific policies so SELECT no longer evaluates write permission.
do $$
declare
  t text;
begin
  foreach t in array array[
    'master_bank',
    'master_kantor_pelaksana',
    'master_kategori_pekerjaan',
    'master_mandor',
    'master_notaris',
    'master_tipe_rumah',
    'template_progress_tipe'
  ]
  loop
    execute format('drop policy if exists kavio_write_managers on public.%I', t);
    execute format(
      'create policy kavio_insert_managers on public.%I for insert to authenticated with check ((select public.kavio_can_action(''MASTER_WRITE'')))',
      t
    );
    execute format(
      'create policy kavio_update_managers on public.%I for update to authenticated using ((select public.kavio_can_action(''MASTER_WRITE''))) with check ((select public.kavio_can_action(''MASTER_WRITE'')))',
      t
    );
    execute format(
      'create policy kavio_delete_managers on public.%I for delete to authenticated using ((select public.kavio_can_action(''MASTER_WRITE'')))',
      t
    );
  end loop;
end $$;

drop policy if exists kavio_write_sales_biaya on public.sales_biaya_tambahan;
create policy kavio_insert_sales_biaya on public.sales_biaya_tambahan
  for insert to authenticated
  with check ((select public.kavio_can_action('SALES_WRITE')));
create policy kavio_update_sales_biaya on public.sales_biaya_tambahan
  for update to authenticated
  using ((select public.kavio_can_action('SALES_WRITE')))
  with check ((select public.kavio_can_action('SALES_WRITE')));
create policy kavio_delete_sales_biaya on public.sales_biaya_tambahan
  for delete to authenticated
  using ((select public.kavio_can_action('SALES_WRITE')));

drop policy if exists kavio_write_sales_kpr on public.sales_kpr_progress;
create policy kavio_insert_sales_kpr on public.sales_kpr_progress
  for insert to authenticated
  with check ((select public.kavio_can_action('SALES_WRITE')));
create policy kavio_update_sales_kpr on public.sales_kpr_progress
  for update to authenticated
  using ((select public.kavio_can_action('SALES_WRITE')))
  with check ((select public.kavio_can_action('SALES_WRITE')));
create policy kavio_delete_sales_kpr on public.sales_kpr_progress
  for delete to authenticated
  using ((select public.kavio_can_action('SALES_WRITE')));

-- Siteplan versions: ensure auth/user and action checks are initplans.
drop policy if exists siteplan_versions_insert_authenticated on public.siteplan_versions;
create policy siteplan_versions_insert_authenticated on public.siteplan_versions
  for insert to authenticated
  with check (
    (select public.kavio_can_action('SITEPLAN_MAP'))
    and uploaded_by = (select auth.uid())
  );

drop policy if exists siteplan_versions_update_authenticated on public.siteplan_versions;
create policy siteplan_versions_update_authenticated on public.siteplan_versions
  for update to authenticated
  using ((select public.kavio_can_action('SITEPLAN_MAP')))
  with check ((select public.kavio_can_action('SITEPLAN_MAP')));

drop policy if exists siteplan_versions_delete_authenticated on public.siteplan_versions;
create policy siteplan_versions_delete_authenticated on public.siteplan_versions
  for delete to authenticated
  using ((select public.kavio_can_action('SITEPLAN_MAP')));

-- User profiles: preserve self-read and manager-read semantics in one SELECT
-- policy, with manager writes separated by command.
drop policy if exists user_profiles_manager_write on public.user_profiles;
drop policy if exists user_profiles_self_select on public.user_profiles;

create policy user_profiles_select on public.user_profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.kavio_can_action('USER_MANAGE'))
  );

create policy user_profiles_manager_insert on public.user_profiles
  for insert to authenticated
  with check ((select public.kavio_can_action('USER_MANAGE')));
create policy user_profiles_manager_update on public.user_profiles
  for update to authenticated
  using ((select public.kavio_can_action('USER_MANAGE')))
  with check ((select public.kavio_can_action('USER_MANAGE')));
create policy user_profiles_manager_delete on public.user_profiles
  for delete to authenticated
  using ((select public.kavio_can_action('USER_MANAGE')));
