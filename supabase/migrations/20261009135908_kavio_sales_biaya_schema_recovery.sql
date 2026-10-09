
create table public.sales_biaya_tambahan (
  id_biaya uuid primary key default gen_random_uuid(),
  id_sales uuid not null references public.sales(id_sales) on delete cascade,
  jenis_biaya text not null,
  keterangan text,
  nominal numeric not null default 0 check (nominal >= 0),
  status_aktif boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_sales_biaya_tambahan_id_sales on public.sales_biaya_tambahan(id_sales);
alter table public.sales_biaya_tambahan enable row level security;
