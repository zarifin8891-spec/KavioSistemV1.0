alter table public.sales
  add column if not exists alamat_konsumen text,
  add column if not exists hp_konsumen text;

comment on column public.sales.alamat_konsumen is 'Alamat konsumen dari transaksi sales';
comment on column public.sales.hp_konsumen is 'Nomor HP konsumen dari transaksi sales';
