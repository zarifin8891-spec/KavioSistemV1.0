-- Visible supplier identity; UUID foreign keys remain unchanged.
create sequence public.supplier_code_seq;
alter table public.master_pemasok add column kode_pemasok text not null
 default ('PMS-' || lpad(nextval('public.supplier_code_seq')::text,6,'0'));
create unique index master_pemasok_kode_unique on public.master_pemasok(kode_pemasok);
alter table public.master_pemasok add constraint master_pemasok_kode_nonempty check (btrim(kode_pemasok)<>'');
revoke all on sequence public.supplier_code_seq from public,anon;
grant usage on sequence public.supplier_code_seq to authenticated;
comment on column public.master_pemasok.kode_pemasok is 'ID pemasok yang terlihat, dibuat otomatis. id_pemasok UUID tetap menjadi kunci relasi transaksi.';
