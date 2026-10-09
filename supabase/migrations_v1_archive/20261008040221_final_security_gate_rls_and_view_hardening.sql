
create or replace function public.kavio_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.user_id = auth.uid()
      and p.status_aktif = true
  );
$$;

revoke all on function public.kavio_is_active_user() from public;
revoke all on function public.kavio_is_active_user() from anon;
grant execute on function public.kavio_is_active_user() to authenticated;

create or replace function public.kavio_get_current_access()
returns table (
  role text,
  status_aktif boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(p.role, 'USER') as role,
    coalesce(p.status_aktif, false) as status_aktif
  from (select auth.uid() as user_id) me
  left join public.user_profiles p on p.user_id = me.user_id;
$$;

revoke all on function public.kavio_get_current_access() from public;
revoke all on function public.kavio_get_current_access() from anon;
grant execute on function public.kavio_get_current_access() to authenticated;

alter policy kavio_select_authenticated on public.master_bank
  using ((select public.kavio_is_active_user()));
alter policy kavio_select_authenticated on public.master_kantor_pelaksana
  using ((select public.kavio_is_active_user()));
alter policy kavio_select_authenticated on public.master_kategori_pekerjaan
  using ((select public.kavio_is_active_user()));
alter policy kavio_select_authenticated on public.master_kavling
  using ((select public.kavio_is_active_user()));
alter policy kavio_select_authenticated on public.master_mandor
  using ((select public.kavio_is_active_user()));
alter policy kavio_select_authenticated on public.master_notaris
  using ((select public.kavio_is_active_user()));
alter policy kavio_select_authenticated on public.master_tipe_rumah
  using ((select public.kavio_is_active_user()));
alter policy kavio_select_progress on public.progress_update
  using ((select public.kavio_is_active_user()));
alter policy kavio_select_sales on public.sales
  using ((select public.kavio_is_active_user()));
alter policy kavio_select_sales_biaya on public.sales_biaya_tambahan
  using ((select public.kavio_is_active_user()));
alter policy kavio_select_sales_kpr on public.sales_kpr_progress
  using ((select public.kavio_is_active_user()));
alter policy siteplan_mapping_select_authenticated on public.siteplan_kavling_mapping
  using ((select public.kavio_is_active_user()));
alter policy siteplan_versions_select_authenticated on public.siteplan_versions
  using ((select public.kavio_is_active_user()));
alter policy kavio_select_spk on public.spk
  using ((select public.kavio_is_active_user()));
alter policy kavio_select_spk_config on public.spk_progress_config
  using ((select public.kavio_is_active_user()));
alter policy kavio_select_authenticated on public.template_progress_tipe
  using ((select public.kavio_is_active_user()));

alter view public.v_decision_engine set (security_invoker = true);
alter view public.v_sales_harga set (security_invoker = true);

revoke all on table public.v_dashboard_monitor from public;
revoke all on table public.v_dashboard_monitor from anon;
grant select on table public.v_dashboard_monitor to authenticated;
revoke all on table public.v_decision_engine from public;
revoke all on table public.v_decision_engine from anon;
grant select on table public.v_decision_engine to authenticated;
revoke all on table public.v_progress_kategori_current from public;
revoke all on table public.v_progress_kategori_current from anon;
grant select on table public.v_progress_kategori_current to authenticated;
revoke all on table public.v_progress_summary from public;
revoke all on table public.v_progress_summary from anon;
grant select on table public.v_progress_summary to authenticated;
revoke all on table public.v_sales_harga from public;
revoke all on table public.v_sales_harga from anon;
grant select on table public.v_sales_harga to authenticated;

alter function public.kavio_sales_kpi() set search_path = public;
alter function public.kavio_sales_list_page(text,text,text,integer,integer) set search_path = public;
alter function public.kavio_spk_kpi() set search_path = public;
alter function public.kavio_spk_curve_history(text) set search_path = public;

revoke all on function public.kavio_sales_kpi() from public;
revoke all on function public.kavio_sales_kpi() from anon;
grant execute on function public.kavio_sales_kpi() to authenticated;
revoke all on function public.kavio_sales_list_page(text,text,text,integer,integer) from public;
revoke all on function public.kavio_sales_list_page(text,text,text,integer,integer) from anon;
grant execute on function public.kavio_sales_list_page(text,text,text,integer,integer) to authenticated;
revoke all on function public.kavio_spk_kpi() from public;
revoke all on function public.kavio_spk_kpi() from anon;
grant execute on function public.kavio_spk_kpi() to authenticated;
revoke all on function public.kavio_spk_curve_history(text) from public;
revoke all on function public.kavio_spk_curve_history(text) from anon;
grant execute on function public.kavio_spk_curve_history(text) to authenticated;

revoke all on function public.kavio_guard_kavling_status() from public;
revoke all on function public.kavio_guard_kavling_status() from anon;
revoke all on function public.kavio_guard_kavling_status() from authenticated;
revoke all on function public.kavio_sync_kavling_from_sales() from public;
revoke all on function public.kavio_sync_kavling_from_sales() from anon;
revoke all on function public.kavio_sync_kavling_from_sales() from authenticated;
revoke all on function public.kavio_sync_kavling_from_spk() from public;
revoke all on function public.kavio_sync_kavling_from_spk() from anon;
revoke all on function public.kavio_sync_kavling_from_spk() from authenticated;
