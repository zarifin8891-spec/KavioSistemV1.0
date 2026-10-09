-- Optional, reviewed seed import for Contoh_RAB_T36.pdf.
-- Run only after the Material Control migration and T36 master type exist.
-- Three source rows have no printed unit; their unit is explicitly marked TIDAK TERTERA.
-- Duplicate reference code K30081 is intentionally retained as two RAB lines.
-- PDF control totals: 105 rows; Rp 62.984.620.

begin;

create temporary table rab_t36_import_source (
  urutan integer primary key,
  kode text not null,
  nama text not null,
  kategori text not null,
  satuan text not null,
  jenis_item text not null check (jenis_item in ('BAHAN','ALAT_PAKAI_ULANG','UPAH')),
  volume numeric not null check (volume >= 0),
  harga numeric not null check (harga >= 0),
  total_pdf numeric not null check (total_pdf >= 0)
) on commit drop;

insert into rab_t36_import_source values
  (1, 'B30070', 'BENANG SEPEDA', 'ALAT-ALAT', 'BH', 'ALAT_PAKAI_ULANG', 5, 3500, 17500),
  (2, 'C30100', 'CANGKUL CARMEN', 'ALAT-ALAT', 'BH', 'ALAT_PAKAI_ULANG', 1, 60000, 60000),
  (3, 'D30020', 'DORAN', 'ALAT-ALAT', 'BH', 'ALAT_PAKAI_ULANG', 1, 30000, 30000),
  (4, 'E30031', 'EMBER COR', 'ALAT-ALAT', 'BH', 'ALAT_PAKAI_ULANG', 7, 11000, 77000),
  (5, 'L30020', 'LINGGIS', 'ALAT-ALAT', 'BH', 'ALAT_PAKAI_ULANG', 1, 50000, 50000),
  (6, 'R30032', 'RAM ANYAM', 'ALAT-ALAT', 'M', 'ALAT_PAKAI_ULANG', 1.5, 15000, 22500),
  (7, 'S30080', 'SELANG WATERPAS', 'ALAT-ALAT', 'M', 'ALAT_PAKAI_ULANG', 10, 4000, 40000),
  (8, 'S30090', 'SEKOP', 'ALAT-ALAT', 'BH', 'ALAT_PAKAI_ULANG', 1, 75000, 75000),
  (9, 'B30024', 'BATA MERAH', 'BAHAN AGREGAT', 'BH', 'BAHAN', 10500, 550, 5775000),
  (10, 'B30032', 'BATU PASANG', 'BAHAN AGREGAT', 'M3', 'BAHAN', 20, 100000, 2000000),
  (11, 'B30033', 'BATU ALAM/BATU HIJAU', 'BAHAN AGREGAT', 'MTR', 'BAHAN', 0, 4000, 0),
  (12, 'B30053', 'BATU SPLIT 1/2', 'BAHAN AGREGAT', 'M3', 'BAHAN', 3, 180000, 540000),
  (13, 'K30140', 'KALSIUM', 'BAHAN AGREGAT', 'KRG', 'BAHAN', 20, 15000, 300000),
  (14, 'P30032', 'PASIR', 'BAHAN AGREGAT', 'M3', 'BAHAN', 22, 100000, 2200000),
  (15, 'P30033', 'PASIR COR', 'BAHAN AGREGAT', 'M3', 'BAHAN', 4, 180000, 720000),
  (16, 'S30020', 'SEMEN GRESIK/BIMA', 'BAHAN AGREGAT', 'SAK', 'BAHAN', 57, 64500, 3676500),
  (17, 'B30036', 'BAMBU 6M/BALOK KAYU', 'BAHAN KAYU', 'BTG', 'BAHAN', 14, 10000, 140000),
  (18, 'D30010', 'DAUN PINTU', 'BAHAN KAYU', 'BH', 'BAHAN', 4, 350000, 1400000),
  (19, 'D30030', 'DAUN JENDELA TINGGI/JDL ROMBAK', 'BAHAN KAYU', 'BUAH', 'BAHAN', 5, 85000, 425000),
  (20, 'K30044', 'USUK 2M', 'BAHAN KAYU', 'BTG', 'BAHAN', 1, 1300000, 1300000),
  (21, 'K30096', 'KUSEN JENDELA 2 PLG (PDK) 5,85', 'BAHAN KAYU', 'BH', 'BAHAN', 2, 195000, 390000),
  (22, 'K30097', 'KUSEN JENDELA 2 PLG (PJG) 8,15', 'BAHAN KAYU', 'BH', 'BAHAN', 1, 225000, 225000),
  (23, 'K30101', 'KUSEN JENDELA 1 PLG 3,7', 'BAHAN KAYU', 'BH', 'BAHAN', 1, 120000, 120000),
  (24, 'K30102', 'KUSEN PINTU 4,9', 'BAHAN KAYU', 'BH', 'BAHAN', 3, 165000, 495000),
  (25, 'L30051', 'ROSTER KECIL 15/15/LKIBANEN', 'BAHAN KAYU', 'BH', 'BAHAN', 19, 18000, 342000),
  (26, 'P30024', 'PAPAN COR 2,5 M', 'BAHAN KAYU', 'M3', 'BAHAN', 2, 1300000, 2600000),
  (27, 'G30050', 'GRC', 'BAHAN PENUTUP PLAFOND', 'LBR', 'BAHAN', 19, 50000, 950000),
  (28, 'P30034', 'PROFIL SUDUT/KAYU', 'BAHAN PENUTUP PLAFOND', 'BH', 'BAHAN', 88, 5000, 440000),
  (29, 'U30010', 'USUK', 'BAHAN PENUTUP PLAFOND', 'M3', 'BAHAN', 1, 1300000, 1300000),
  (30, 'K30071', 'KERAMIK 20x25 (DINDING WC)', 'BAHAN LANTAI', 'DUS', 'BAHAN', 7, 50000, 350000),
  (31, 'K30073', 'KERAMIK 20x20 (LANTAI WC)', 'BAHAN LANTAI', 'DUS', 'BAHAN', 3, 45000, 135000),
  (32, 'K30075', 'KERAMIK 40x40 (LANTAI)', 'BAHAN LANTAI', 'DUS', 'BAHAN', 36, 45000, 1620000),
  (33, 'K30076', 'KERAMIK 30x30 (DAPUR)', 'BAHAN LANTAI', 'DUS', 'BAHAN', 3, 45000, 135000),
  (34, 'B30041', 'BESI 6 STD', 'BAHAN LOGAM', 'BTG', 'BAHAN', 27, 32000, 864000),
  (35, 'B30052', 'BESI 8 STD/BESI 6 F/Tarikan', 'BAHAN LOGAM', 'LT', 'BAHAN', 60, 48000, 2880000),
  (36, 'B30207', 'BESI 10 STD', 'BAHAN LOGAM', 'LT', 'BAHAN', 0, 80000, 0),
  (37, 'K30032', 'KAWAT BETON', 'BAHAN LOGAM', 'KG', 'BAHAN', 4, 22500, 90000),
  (38, 'P30012', 'PAKU 5"', 'BAHAN LOGAM', 'KG', 'BAHAN', 2.5, 18000, 45000),
  (39, 'P30014', 'PAKU 10"', 'BAHAN LOGAM', 'KG', 'BAHAN', 1, 18000, 18000),
  (40, 'P30019', 'PAKU 7"', 'BAHAN LOGAM', 'KG', 'BAHAN', 4, 18000, 72000),
  (41, 'P3001E', 'PAKU GRC', 'BAHAN LOGAM', 'KG', 'BAHAN', 10, 22000, 220000),
  (42, 'D0022', 'DOP 3"', 'BAHAN PIPA', 'BH', 'BAHAN', 1, 10000, 10000),
  (43, 'K30059', 'KNEE DRAT DALAM 1/2"', 'BAHAN PIPA', 'BH', 'BAHAN', 4, 3000, 12000),
  (44, 'K30060', 'KNEE 1/2"', 'BAHAN PIPA', 'BH', 'BAHAN', 5, 2500, 12500),
  (45, 'K30062', 'KNEE 3"', 'BAHAN PIPA', 'BH', 'BAHAN', 4, 10000, 40000),
  (46, 'K30081', 'KRAN 1/2"', 'BAHAN PIPA', 'BH', 'BAHAN', 3, 7500, 22500),
  (47, 'K30162', 'KNEE 2 1/2"', 'BAHAN PIPA', 'BH', 'BAHAN', 2, 20000, 40000),
  (48, 'K30164', 'KNEE 3/4', 'BAHAN PIPA', 'BH', 'BAHAN', 4, 4000, 16000),
  (49, 'L30012', 'LEM TANGIT', 'BAHAN PIPA', 'BH', 'BAHAN', 5, 12000, 60000),
  (50, 'P30079', 'PVC 1/2" AW', 'BAHAN PIPA', 'LT', 'BAHAN', 5, 25000, 125000),
  (51, 'P30084', 'PVC 2 1/2" AW', 'BAHAN PIPA', 'BH', 'BAHAN', 2, 65000, 130000),
  (52, 'P30086', 'PVC 3/4" AW', 'BAHAN PIPA', 'BH', 'BAHAN', 4, 40000, 160000),
  (53, 'P30088', 'PVC 3" AW', 'BAHAN PIPA', 'LT', 'BAHAN', 7, 90000, 630000),
  (54, 'S30130', 'SILTIF', 'BAHAN PIPA', 'BH', 'BAHAN', 6, 3000, 18000),
  (55, 'S30192', 'SOK DRAT LUAR 1/2', 'BAHAN PIPA', 'BH', 'BAHAN', 1, 20000, 20000),
  (56, 'T30071', 'TEE 1/2"', 'BAHAN PIPA', 'BH', 'BAHAN', 3, 2500, 7500),
  (57, 'T30075', 'TEE 3"', 'BAHAN PIPA', 'TIDAK TERTERA', 'BAHAN', 1, 25000, 25000),
  (58, 'B30055', 'BCP SEDANG 80 CM', 'BAHAN SANITAR', 'BH', 'BAHAN', 1, 150000, 150000),
  (59, 'F30010', 'FLOOR DRAIN', 'BAHAN SANITAR', 'BH', 'BAHAN', 2, 12000, 24000),
  (60, 'K30052', 'KLOSET JONGKOK', 'BAHAN SANITAR', 'BH', 'BAHAN', 1, 120000, 120000),
  (61, 'K30081', 'KRAN 1/2"', 'BAHAN SANITAR', 'BH', 'BAHAN', 4, 20000, 80000),
  (62, 'K30083', 'KRAN BCP/HAND SHOWER', 'BAHAN SANITAR', 'BH', 'BAHAN', 1, 25000, 25000),
  (63, 'P30029', 'PINTU FIBER (WC)', 'BAHAN SANITAR', 'BH', 'BAHAN', 1, 165000, 165000),
  (64, 'P30091', 'POMPA AIR', 'BAHAN SANITAR', 'BH', 'BAHAN', 1, 480000, 480000),
  (65, 'S30196', 'SOKET 3/4"', 'BAHAN SANITAR', 'BH', 'BAHAN', 1, 3000, 3000),
  (66, 'B30061', 'BUBUNG/NOK BETON', 'BAHAN PENUTUP ATAP', 'BH', 'BAHAN', 17, 5300, 90100),
  (67, 'B90001', 'BAJA RINGAN', 'BAHAN PENUTUP ATAP', 'MTR', 'BAHAN', 54.6, 100000, 5460000),
  (68, 'G30060', 'GENTENG BETON', 'BAHAN PENUTUP ATAP', 'BH', 'BAHAN', 550, 4100, 2255000),
  (69, 'L30047', 'LESPANG GRC 4 M/GYPSUM', 'BAHAN PENUTUP ATAP', 'M', 'BAHAN', 5, 50000, 250000),
  (70, 'E30011', 'ENGSEL JENDELA/MATA KUNCI', 'ALAT PENGGANTUNG', 'PSG', 'BAHAN', 5, 13000, 65000),
  (71, 'E30012', 'ENGSEL JENDELA 3"', 'ALAT PENGGANTUNG', 'PSG', 'BAHAN', 4, 20000, 80000),
  (72, 'H30010', 'HAK ANGIN STANDAR', 'ALAT PENGGANTUNG', 'BH', 'BAHAN', 5, 10000, 50000),
  (73, 'K30021', 'KACA POLOS', 'ALAT PENGGANTUNG', 'M2', 'BAHAN', 1.8, 40000, 72000),
  (74, 'K30090', 'KUNCI PINTU', 'ALAT PENGGANTUNG', 'BH', 'BAHAN', 4, 90000, 360000),
  (75, 'S30040', 'SLOT JENDELA', 'ALAT PENGGANTUNG', 'BH', 'BAHAN', 5, 5000, 25000),
  (76, 'B30202', 'BOX MCB', 'ALAT LISTRIK (PENERANGAN)', 'BH', 'BAHAN', 1, 3000, 3000),
  (77, 'D30034', 'KABEL DYNAMIK NYM 2X1.5', 'ALAT LISTRIK (PENERANGAN)', 'M', 'BAHAN', 10, 10000, 100000),
  (78, 'D30035', 'DYNAMIC KABEL NYM 3X1.5', 'ALAT LISTRIK (PENERANGAN)', 'M', 'BAHAN', 35, 12000, 420000),
  (79, 'E30017', 'KABEL ARDE 4MM/STEKER BULAT', 'ALAT LISTRIK (PENERANGAN)', 'METER', 'BAHAN', 3, 26500, 79500),
  (80, 'F30021', 'FITTING LAMPU', 'ALAT LISTRIK (PENERANGAN)', 'BH', 'BAHAN', 10, 9500, 95000),
  (81, 'I30020', 'INBOU', 'ALAT LISTRIK (PENERANGAN)', 'BH', 'BAHAN', 14, 1000, 14000),
  (82, 'M30060', 'MCB', 'ALAT LISTRIK (PENERANGAN)', 'BH', 'BAHAN', 1, 35000, 35000),
  (83, 'P30077', 'PIPA LISTRIK/HAND SHOWERR', 'ALAT LISTRIK (PENERANGAN)', 'LT', 'BAHAN', 12, 9500, 114000),
  (84, 'S30102', 'STOP KONTAK BROCO NEW GEE', 'ALAT LISTRIK (PENERANGAN)', 'BH', 'BAHAN', 6, 15000, 90000),
  (85, 'S30103', 'SAKLAR SINGLE BROCO NEW GEE', 'ALAT LISTRIK (PENERANGAN)', 'BH', 'BAHAN', 4, 12500, 50000),
  (86, 'S30116', 'SAKLAR DOUBLE BROCO NEW GEE', 'ALAT LISTRIK (PENERANGAN)', 'BH', 'BAHAN', 3, 15000, 45000),
  (87, 'S30170', 'SOLATIF', 'ALAT LISTRIK (PENERANGAN)', 'BH', 'BAHAN', 3, 7000, 21000),
  (88, 'S30197', 'KLEM KABEL', 'ALAT LISTRIK (PENERANGAN)', 'BH', 'BAHAN', 4, 5000, 20000),
  (89, 'A30010', 'AMPLAS/BATU ASAHAN', 'BAHAN FINISHING', 'M', 'BAHAN', 20, 10000, 200000),
  (90, 'B30060', 'BAK CAT', 'BAHAN FINISHING', 'BH', 'BAHAN', 2, 10000, 20000),
  (91, 'C30012', 'CAT KAYU', 'BAHAN FINISHING', 'KG', 'BAHAN', 4, 68000, 272000),
  (92, 'C30014', 'CAT MOWILEX CENDANA S.W', 'BAHAN FINISHING', 'TIDAK TERTERA', 'BAHAN', 3, 590000, 1770000),
  (93, 'C30026', 'CAT GENTENG/NO DROP 4KG', 'BAHAN FINISHING', 'KLG', 'BAHAN', 2, 200000, 400000),
  (94, 'K30086', 'KUAS ROLL', 'BAHAN FINISHING', 'BH', 'BAHAN', 2, 25000, 50000),
  (95, 'K30087', 'KUAS 2" / 633 FATA 2"SK', 'BAHAN FINISHING', 'BH', 'BAHAN', 1, 7500, 7500),
  (96, 'K30088', 'KUAS 3"/633 FATA 3"SK', 'BAHAN FINISHING', 'BH', 'BAHAN', 2, 10000, 20000),
  (97, 'K30089', 'KUAS 4"', 'BAHAN FINISHING', 'BH', 'BAHAN', 1, 15000, 15000),
  (98, 'L30011', 'LEM KAYU', 'BAHAN FINISHING', 'KG', 'BAHAN', 5, 12500, 62500),
  (99, 'P30302', 'PLAMIR KAYU', 'BAHAN FINISHING', 'TIDAK TERTERA', 'BAHAN', 20, 13000, 260000),
  (100, 'T30010', 'TERPENTIN', 'BAHAN FINISHING', 'BTL', 'BAHAN', 3, 10000, 30000),
  (101, 'U30021', 'UPAH BORONGAN', 'UPAH', 'M', 'UPAH', 36, 371945, 13390020),
  (102, 'U30022', 'UPAH PEMASANGAN LISTRIK', 'UPAH', 'TITIK', 'UPAH', 20, 18000, 360000),
  (103, 'U30023', 'UPAH SUMUR BOR', 'UPAH', 'TITIK', 'UPAH', 1, 0, 0),
  (104, 'U30024', 'UPAH BAJA RINGAN', 'UPAH', 'METER', 'UPAH', 54.6, 15000, 819000),
  (105, 'U30025', 'UPAH PENGECATAN', 'UPAH', 'UNIT', 'UPAH', 1, 1000000, 1000000);

do $rab_t36$
declare
  v_id_tipe text;
  v_id_rab uuid;
  v_count integer;
  v_source_count integer;
  v_source_total numeric;
begin
  -- This project's type key is expected to be T36. Change this exact key only
  -- if the project's master_tipe_rumah uses a different ID for Type 36.
  v_id_tipe := 'T36';
  if not exists (select 1 from public.master_tipe_rumah where id_tipe = v_id_tipe and status_aktif) then
    raise exception 'TIPE RUMAH T36 AKTIF TIDAK DITEMUKAN. Sesuaikan v_id_tipe dengan ID Type 36 pada master proyek.';
  end if;

  select count(*), coalesce(sum(total_pdf),0) into v_source_count, v_source_total from rab_t36_import_source;
  if v_source_count <> 105 or v_source_total <> 62984620 then
    raise exception 'VALIDASI SUMBER RAB GAGAL: jumlah baris atau total PDF tidak sesuai.';
  end if;
  if exists (select 1 from rab_t36_import_source where volume * harga <> total_pdf) then
    raise exception 'VALIDASI TOTAL PER BARIS RAB GAGAL.';
  end if;

  insert into public.master_material(kode_referensi,nama_material,kategori,satuan,jenis_item,status_aktif)
  select distinct on (lower(btrim(nama)), kategori, satuan, jenis_item)
    kode, nama, kategori, satuan, jenis_item, true
  from rab_t36_import_source s
  where not exists (
    select 1 from public.master_material mm
    where lower(btrim(mm.nama_material))=lower(btrim(s.nama))
      and mm.kategori=s.kategori and mm.satuan=s.satuan and mm.jenis_item=s.jenis_item
  )
  order by lower(btrim(nama)), kategori, satuan, jenis_item, urutan
  on conflict do nothing;

  -- The catalog has no unique natural key by design. Reuse an existing exact
  -- catalog match; reference codes are deliberately not used as unique keys.
  insert into public.rab_template(id_tipe,nama_template,versi,status_aktif)
  values(v_id_tipe,'RAB Standar Type 36 (Contoh_RAB_T36.pdf)','2026-10-09',true)
  on conflict (id_tipe,versi) do nothing;
  select id_rab into v_id_rab from public.rab_template where id_tipe=v_id_tipe and versi='2026-10-09';
  if v_id_rab is null then raise exception 'TEMPLATE RAB T36 GAGAL DIBUAT.'; end if;

  select count(*) into v_count from public.rab_template_item where id_rab=v_id_rab;
  if v_count not in (0,105) then
    raise exception 'TEMPLATE RAB T36 SUDAH BERISI % BARIS; hentikan impor untuk menghindari campuran data.', v_count;
  end if;

  insert into public.rab_template_item(id_rab,urutan,id_material,kode_snapshot,nama_snapshot,kategori_snapshot,satuan_snapshot,volume,harga_standar)
  select v_id_rab, s.urutan, m.id_material, s.kode, s.nama, s.kategori, s.satuan, s.volume, s.harga
  from rab_t36_import_source s
  cross join lateral (
    select mm.id_material
    from public.master_material mm
    where lower(btrim(mm.nama_material))=lower(btrim(s.nama))
      and mm.kategori=s.kategori and mm.satuan=s.satuan and mm.jenis_item=s.jenis_item
    order by mm.created_at, mm.id_material
    limit 1
  ) m
  on conflict (id_rab,urutan) do nothing;

  select count(*) into v_count from public.rab_template_item where id_rab=v_id_rab;
  if v_count <> 105 then raise exception 'IMPOR RAB T36 TIDAK LENGKAP: tersimpan % dari 105 baris.', v_count; end if;
  raise notice 'RAB Type 36 siap: 105 baris; total PDF Rp 62.984.620.';
end;
$rab_t36$;

commit;
