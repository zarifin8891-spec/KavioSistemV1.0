create or replace function public.kavio_spk_kpi_by_kind()
returns table(jenis_spk text,total_spk bigint,aktif bigint,draft bigint,selesai bigint)
language sql stable security invoker set search_path=public as $$
 select jenis_spk::text,count(*)::bigint,
 count(*) filter(where is_active=true)::bigint,
 count(*) filter(where status_spk='DRAFT')::bigint,
 count(*) filter(where status_spk='SELESAI')::bigint
 from public.spk group by jenis_spk;
$$;
revoke all on function public.kavio_spk_kpi_by_kind() from public,anon;
grant execute on function public.kavio_spk_kpi_by_kind() to authenticated;

create or replace function public.kavio_spk_curve_history(p_id_spk text)
returns table(tanggal_update date,progress_aktual numeric)
language sql stable security invoker set search_path=public as $$
 with daily as (
 select p.tanggal_update::date as tanggal_update,
 sum(p.progress_periode*w.bobot)::numeric as contribution
 from public.progress_update p
 join public.spk_work_item w on w.id_spk=p.id_spk and w.id_item=p.id_item
 where p.id_spk::text=p_id_spk group by p.tanggal_update::date
 )
 select d.tanggal_update,
 sum(d.contribution) over(order by d.tanggal_update rows between unbounded preceding and current row)::numeric
 from daily d order by d.tanggal_update;
$$;
revoke all on function public.kavio_spk_curve_history(text) from public,anon;
grant execute on function public.kavio_spk_curve_history(text) to authenticated;
