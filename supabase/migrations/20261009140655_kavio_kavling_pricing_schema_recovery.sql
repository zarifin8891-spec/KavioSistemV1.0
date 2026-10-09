alter table public.master_kavling
  add column luas_tanah_standar numeric not null default 0,
  add column luas_tanah_real numeric not null default 0,
  add column kelebihan_tanah numeric generated always as (luas_tanah_real - luas_tanah_standar) stored,
  add column harga_standar numeric not null default 0,
  add column harga_tanah_meter numeric not null default 0,
  add column harga_jual numeric generated always as (harga_standar + ((luas_tanah_real - luas_tanah_standar) * harga_tanah_meter)) stored;
