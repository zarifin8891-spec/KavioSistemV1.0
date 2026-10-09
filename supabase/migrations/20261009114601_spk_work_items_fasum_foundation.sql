-- KAVIO V2 foundation: one weighted work-item model for both lot and common-area SPKs.
-- Legacy category/config tables remain available during the application cut-over.

alter table public.spk
  add column if not exists jenis_spk text not null default 'KAVLING',
  add column if not exists nama_objek text,
  alter column id_kavling drop not null,
  alter column id_tipe drop not null;

alter table public.spk
  add constraint spk_jenis_spk_check
    check (jenis_spk in ('KAVLING', 'FASUM')),
  add constraint spk_jenis_objek_check
    check (
      (jenis_spk = 'KAVLING' and id_kavling is not null and id_tipe is not null and nama_objek is null)
      or (jenis_spk = 'FASUM' and id_kavling is null and nama_objek is not null and btrim(nama_objek) <> '')
    );

create table public.spk_work_item (
  id_item uuid primary key default gen_random_uuid(),
  id_spk uuid not null references public.spk(id_spk) on delete cascade,
  urutan integer not null check (urutan > 0),
  nama_pekerjaan text not null check (btrim(nama_pekerjaan) <> ''),
  bobot numeric not null check (bobot >= 0 and bobot <= 1),
  id_kategori_legacy text references public.master_kategori_pekerjaan(id_kategori) on delete restrict,
  created_at timestamptz not null default now(),
  constraint spk_work_item_urutan_unique unique (id_spk, urutan),
  constraint spk_work_item_legacy_unique unique (id_spk, id_kategori_legacy)
);

create index spk_work_item_id_spk_idx on public.spk_work_item(id_spk);

alter table public.progress_update
  add column id_item uuid references public.spk_work_item(id_item) on delete restrict;

-- Snapshot legacy configured categories into the new common work-item structure.
insert into public.spk_work_item (id_spk, urutan, nama_pekerjaan, bobot, id_kategori_legacy)
select
  c.id_spk,
  row_number() over (partition by c.id_spk order by k.urutan, k.id_kategori)::integer,
  k.nama_kategori,
  c.bobot_final,
  c.id_kategori
from public.spk_progress_config c
join public.master_kategori_pekerjaan k on k.id_kategori = c.id_kategori;

update public.progress_update p
set id_item = w.id_item
from public.spk_work_item w
where w.id_spk = p.id_spk
  and w.id_kategori_legacy = p.id_kategori
  and p.id_item is null;

alter table public.spk_work_item enable row level security;

create policy kavio_select_spk_work_item on public.spk_work_item
  for select to authenticated
  using (public.kavio_is_active_user());
create policy kavio_insert_spk_work_item on public.spk_work_item
  for insert to authenticated
  with check (public.kavio_can_action('SPK_WRITE'));
create policy kavio_update_spk_work_item on public.spk_work_item
  for update to authenticated
  using (public.kavio_can_action('SPK_WRITE'))
  with check (public.kavio_can_action('SPK_WRITE'));
create policy kavio_delete_spk_work_item on public.spk_work_item
  for delete to authenticated
  using (public.kavio_can_action('SPK_WRITE'));

grant select, insert, update, delete on public.spk_work_item to authenticated;
revoke all on public.spk_work_item from anon;

comment on column public.spk.jenis_spk is 'Jenis objek pekerjaan: KAVLING atau FASUM.';
comment on column public.spk.nama_objek is 'Nama objek Fasum; wajib hanya untuk SPK jenis FASUM.';
comment on table public.spk_work_item is 'Item pekerjaan berbobot yang dipakai bersama oleh engine Progress SPK Kavling dan Fasum.';
comment on column public.progress_update.id_item is 'Relasi Progress ke item pekerjaan engine bersama V2; terisi melalui backfill untuk data kategori lama.';
