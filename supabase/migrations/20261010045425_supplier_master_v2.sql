-- V2 supplier catalog. Historical names remain transaction snapshots.
create table public.master_pemasok (
  id_pemasok uuid primary key default gen_random_uuid(),
  nama_pemasok text not null check (btrim(nama_pemasok) <> ''),
  kontak text,
  telepon text,
  alamat text,
  keterangan text,
  status_aktif boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index master_pemasok_nama_unique on public.master_pemasok(lower(btrim(nama_pemasok)));
alter table public.master_pemasok enable row level security;
revoke all on public.master_pemasok from public, anon, authenticated;
grant select, insert, update on public.master_pemasok to authenticated;
create policy pemasok_read on public.master_pemasok for select to authenticated
  using ((select public.kavio_is_active_user()));
create policy pemasok_insert on public.master_pemasok for insert to authenticated
  with check ((select public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE')));
create policy pemasok_update on public.master_pemasok for update to authenticated
  using ((select public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE')))
  with check ((select public.kavio_can_action('MATERIAL_WAREHOUSE_WRITE')));

alter table public.material_transaction add column id_pemasok uuid references public.master_pemasok(id_pemasok) on delete restrict;
create index material_transaction_pemasok_idx on public.material_transaction(id_pemasok) where id_pemasok is not null;

-- Existing atomic RPCs receive the selected supplier's validated name. Link it
-- to the catalog in the same insert, retaining the original display name.
create function public.kavio_link_transaction_supplier()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if nullif(btrim(new.nama_pemasok), '') is not null then
    select p.id_pemasok into new.id_pemasok from public.master_pemasok p
    where lower(btrim(p.nama_pemasok)) = lower(btrim(new.nama_pemasok)) and p.status_aktif;
    if new.id_pemasok is null then
      raise exception 'Pemasok tidak tersedia atau nonaktif. Pilih dari Master Pemasok.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.kavio_link_transaction_supplier() from public, anon;
create trigger material_transaction_supplier_link before insert on public.material_transaction
for each row execute function public.kavio_link_transaction_supplier();
