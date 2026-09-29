create or replace function public.kavio_spk_curve_history(p_id_spk text)
returns table (
  tanggal_update date,
  progress_aktual numeric
)
language sql
stable
as $$
  with config as (
    select id_kategori, bobot_final::numeric as bobot_final
    from public.spk_progress_config
    where id_spk::text = p_id_spk
  ),
  daily as (
    select
      pu.tanggal_update::date as tanggal_update,
      pu.id_kategori,
      sum(coalesce(pu.progress_periode, 0))::numeric as progress_periode
    from public.progress_update pu
    where pu.id_spk::text = p_id_spk
    group by pu.tanggal_update::date, pu.id_kategori
  ),
  running as (
    select
      d.tanggal_update,
      d.id_kategori,
      least(
        1::numeric,
        sum(d.progress_periode) over (
          partition by d.id_kategori
          order by d.tanggal_update
          rows between unbounded preceding and current row
        )
      ) as progress_akumulasi
    from daily d
  ),
  dates as (
    select distinct tanggal_update
    from daily
  )
  select
    dt.tanggal_update,
    coalesce(
      sum(
        coalesce((
          select r.progress_akumulasi
          from running r
          where r.id_kategori = c.id_kategori
            and r.tanggal_update <= dt.tanggal_update
          order by r.tanggal_update desc
          limit 1
        ), 0::numeric) * c.bobot_final
      ),
      0::numeric
    )::numeric as progress_aktual
  from dates dt
  cross join config c
  group by dt.tanggal_update
  order by dt.tanggal_update;
$$;

grant execute on function public.kavio_spk_curve_history(text) to authenticated;
