create or replace function public.kavio_sales_kpi()
returns table (
  total_sales bigint,
  booking bigint,
  dp bigint,
  proses_kpr bigint,
  akad bigint,
  batal bigint,
  aktif bigint
)
language sql
stable
as $$
  select
    count(*)::bigint,
    count(*) filter (where status_sales = 'BOOKING')::bigint,
    count(*) filter (where status_sales = 'DP')::bigint,
    count(*) filter (where status_sales = 'PROSES_KPR')::bigint,
    count(*) filter (where status_sales = 'AKAD')::bigint,
    count(*) filter (where status_sales = 'BATAL')::bigint,
    count(*) filter (where status_aktif = true)::bigint
  from public.sales;
$$;

create or replace function public.kavio_sales_list_page(
  p_status text default null,
  p_tipe text default null,
  p_query text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id_sales text,
  id_kavling text,
  nama_konsumen text,
  hp_konsumen text,
  status_sales text,
  jenis_pembayaran text,
  id_bank text,
  harga_jual numeric,
  tgl_booking date,
  status_aktif boolean,
  created_at timestamptz,
  id_tipe text,
  nama_tipe text,
  nama_bank text,
  harga_jual_dasar numeric,
  total_biaya_tambahan numeric,
  total_harga numeric,
  filtered_count bigint
)
language sql
stable
as $$
  select
    s.id_sales::text,
    s.id_kavling::text,
    s.nama_konsumen::text,
    s.hp_konsumen::text,
    s.status_sales::text,
    s.jenis_pembayaran::text,
    s.id_bank::text,
    s.harga_jual::numeric,
    s.tgl_booking::date,
    s.status_aktif::boolean,
    s.created_at,
    k.id_tipe::text,
    t.nama_tipe::text,
    b.nama_bank::text,
    vh.harga_jual_dasar::numeric,
    vh.total_biaya_tambahan::numeric,
    vh.total_harga::numeric,
    count(*) over()::bigint
  from public.sales s
  left join public.master_kavling k on k.id_kavling = s.id_kavling
  left join public.master_tipe_rumah t on t.id_tipe = k.id_tipe
  left join public.master_bank b on b.id_bank = s.id_bank
  left join public.v_sales_harga vh on vh.id_sales = s.id_sales
  where (nullif(trim(p_status), '') is null or s.status_sales = p_status)
    and (nullif(trim(p_tipe), '') is null or k.id_tipe = p_tipe)
    and (
      nullif(trim(p_query), '') is null
      or s.nama_konsumen ilike '%' || trim(p_query) || '%'
      or s.id_kavling::text ilike '%' || trim(p_query) || '%'
      or coalesce(s.hp_konsumen::text, '') ilike '%' || trim(p_query) || '%'
    )
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.kavio_spk_kpi()
returns table (
  total_spk bigint,
  aktif bigint,
  draft bigint,
  selesai bigint
)
language sql
stable
as $$
  select
    count(*)::bigint,
    count(*) filter (where is_active = true)::bigint,
    count(*) filter (where status_spk = 'DRAFT')::bigint,
    count(*) filter (where status_spk = 'SELESAI')::bigint
  from public.spk;
$$;

grant execute on function public.kavio_sales_kpi() to authenticated;
grant execute on function public.kavio_sales_list_page(text,text,text,integer,integer) to authenticated;
grant execute on function public.kavio_spk_kpi() to authenticated;
