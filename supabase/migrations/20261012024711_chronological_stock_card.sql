create or replace view public.v_material_stock_card with(security_invoker=true) as
with entries as (
 select t.*,i.id_item_transaksi,i.id_material,i.jumlah,i.harga_satuan,m.nama_material,m.satuan from public.material_transaction t join public.material_transaction_item i using(id_transaksi) join public.master_material m using(id_material)
), moves as (
 select e.*, 'GUDANG'::text as jenis_lokasi, e.id_lokasi_tujuan::text as pemegang,
 case when e.jenis_transaksi='PEMBATALAN_PEMBELIAN' then 0 else e.jumlah end as masuk,
 case when e.jenis_transaksi='PEMBATALAN_PEMBELIAN' then e.jumlah else 0 end as keluar
 from entries e where e.id_lokasi_tujuan is not null
 union all
 select e.*, 'GUDANG',e.id_lokasi_asal::text,0,e.jumlah from entries e where e.id_lokasi_asal is not null
 union all
 select e.*,'SPK',e.id_spk::text,
 case when e.jenis_transaksi in ('PENERIMAAN_SPK','KELUAR_KE_SPK','PEMAKAIAN_SUPPLIER_LANGSUNG') then e.jumlah else 0 end,
 case when e.jenis_transaksi in ('PEMAKAIAN_DARI_SPK','KEMBALI_KE_GUDANG','TRANSFER_ANTAR_SPK','REKONSILIASI_KELUAR','PEMBATALAN_PEMBELIAN','PEMAKAIAN_SUPPLIER_LANGSUNG') then e.jumlah else 0 end
 from entries e where e.id_spk is not null and e.jenis_transaksi <> 'PEMAKAIAN_LANGSUNG'
 union all
 select e.*,'SPK',e.id_spk_tujuan::text,e.jumlah,0 from entries e where e.id_spk_tujuan is not null
)
select moves.id_item_transaksi,moves.id_transaksi,moves.no_transaksi,moves.tanggal,moves.created_at,moves.jenis_transaksi,moves.id_material,moves.nama_material,moves.satuan,moves.jenis_lokasi,moves.pemegang,
 coalesce(l.nama_lokasi,case when s.jenis_spk='KAVLING' then 'Kavling '||s.id_kavling else s.nama_objek end,moves.pemegang) as nama_lokasi,
 moves.masuk,moves.keluar,moves.harga_satuan,
 sum(moves.masuk-moves.keluar) over(partition by moves.jenis_lokasi,moves.pemegang,moves.id_material order by moves.tanggal,case when moves.masuk>0 then 0 else 1 end,moves.created_at,moves.no_transaksi,moves.id_item_transaksi rows unbounded preceding) as saldo,
 case when moves.masuk>0 then 0 else 1 end as urutan_mutasi
from moves left join public.material_location l on l.id_lokasi::text=moves.pemegang and moves.jenis_lokasi='GUDANG'
left join public.spk s on s.id_spk::text=moves.pemegang and moves.jenis_lokasi='SPK';
revoke all on public.v_material_stock_card from public,anon;
grant select on public.v_material_stock_card to authenticated;

-- Report stored wage accruals; no new payment, retention release or recalculation.
create or replace function public.kavio_wage_report(p_from date,p_to date,p_spk uuid default null,p_mandor text default null)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;
begin
 if p_from is null or p_to is null or p_from>p_to then raise exception 'Periode laporan tidak valid';end if;
 with ledger as (
  select p.*,w.id_spk,s.jenis_spk,s.id_kavling,s.nama_objek,d.nama_pekerjaan,d.volume,d.satuan,w.nama_pekerjaan as nama_kategori,m.nama_mandor
  from public.work_detail_progress p
  join public.spk_work_detail d on d.id_detail=p.id_detail
  join public.spk_work_item w on w.id_item=d.id_item
  join public.spk s on s.id_spk=w.id_spk
  join public.master_mandor m on m.id_mandor=p.id_mandor
  where p.tanggal_update<=p_to and (p_spk is null or w.id_spk=p_spk) and (p_mandor is null or p.id_mandor=p_mandor)
 ), grouped as (
  select id_spk,jenis_spk,id_kavling,nama_objek,id_detail,id_mandor,nama_mandor,nama_pekerjaan,nama_kategori,volume,satuan,
   min(tanggal_update) filter(where tanggal_update>=p_from) as tanggal_awal,
   sum(progress_periode) filter(where tanggal_update>=p_from) as progress_periode,
   sum(progress_periode) as progress_akumulasi,
   max(retensi) as retensi,max(upah_item) as upah_item,
   sum(upah_bruto) filter(where tanggal_update>=p_from) as upah_bruto,
   sum(upah_retensi) filter(where tanggal_update>=p_from) as upah_retensi,
   sum(upah_netto) filter(where tanggal_update>=p_from) as upah_netto
  from ledger group by id_spk,jenis_spk,id_kavling,nama_objek,id_detail,id_mandor,nama_mandor,nama_pekerjaan,nama_kategori,volume,satuan
  having count(*) filter(where tanggal_update>=p_from)>0
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(g) order by tanggal_awal,nama_mandor,jenis_spk,id_kavling,nama_objek,nama_kategori,nama_pekerjaan,id_detail) from grouped g),'[]'::jsonb),
  'totals',jsonb_build_object('upah_bruto',coalesce(sum(upah_bruto),0),'upah_retensi',coalesce(sum(upah_retensi),0),'upah_netto',coalesce(sum(upah_netto),0))) into result from grouped;
 return result;
end $$;
revoke all on function public.kavio_wage_report(date,date,uuid,text) from public,anon;
grant execute on function public.kavio_wage_report(date,date,uuid,text) to authenticated;
create or replace view public.v_sales_financial_position with(security_invoker=true) as select p.*,s.tgl_booking from (WITH costs AS (
         SELECT sales_biaya_tambahan.id_sales,
            COALESCE(sum(sales_biaya_tambahan.nominal) FILTER (WHERE sales_biaya_tambahan.jenis_biaya = ANY (ARRAY['PENAMBAHAN BANGUNAN'::text, 'KELEBIHAN TANAH'::text, 'PEMILIHAN LOKASI HOOK'::text])), 0::numeric) AS tambahan_harga_jual,
            COALESCE(sum(sales_biaya_tambahan.nominal) FILTER (WHERE sales_biaya_tambahan.jenis_biaya = ANY (ARRAY['NOTARIS'::text, 'BIAYA AKAD'::text, 'BIAYA LAINNYA'::text])), 0::numeric) AS biaya_terpisah
           FROM sales_biaya_tambahan
          WHERE sales_biaya_tambahan.status_aktif
          GROUP BY sales_biaya_tambahan.id_sales
        ), receipts AS (
         SELECT v_sales_receipt_financial.id_sales,
            COALESCE(sum(v_sales_receipt_financial.nominal), 0::numeric) AS total_diterima,
            COALESCE(sum(v_sales_receipt_financial.pelunasan_konsumen), 0::numeric) AS total_pelunasan_konsumen,
            COALESCE(sum(v_sales_receipt_financial.pelunasan_konsumen) FILTER (WHERE v_sales_receipt_financial.jenis_penerimaan <> ALL (ARRAY['BIAYA_NOTARIS'::text, 'BIAYA_AKAD'::text])), 0::numeric) AS total_pembayaran_harga_jual
           FROM v_sales_receipt_financial
          WHERE v_sales_receipt_financial.status = 'AKTIF'::text
          GROUP BY v_sales_receipt_financial.id_sales
        )
 SELECT s.id_sales,
    s.id_kavling,
    s.nama_konsumen,
    s.status_sales,
    s.status_aktif,
    s.jenis_pembayaran,
    COALESCE(s.harga_jual, 0::numeric) AS harga_jual_dasar,
    COALESCE(c.tambahan_harga_jual, 0::numeric) AS tambahan_harga_jual,
    COALESCE(s.harga_jual, 0::numeric) + COALESCE(c.tambahan_harga_jual, 0::numeric) AS total_harga_jual,
    COALESCE(c.biaya_terpisah, 0::numeric) AS biaya_terpisah,
    COALESCE(s.harga_jual, 0::numeric) + COALESCE(c.tambahan_harga_jual, 0::numeric) + COALESCE(c.biaya_terpisah, 0::numeric) AS total_tagihan,
    COALESCE(r.total_diterima, 0::numeric) AS total_diterima,
    COALESCE(r.total_pembayaran_harga_jual, 0::numeric) AS total_pembayaran_harga_jual,
        CASE
            WHEN s.status_sales = 'BATAL'::text THEN 0::numeric
            ELSE COALESCE(s.harga_jual, 0::numeric) + COALESCE(c.tambahan_harga_jual, 0::numeric) + COALESCE(c.biaya_terpisah, 0::numeric) - COALESCE(r.total_pelunasan_konsumen, 0::numeric)
        END AS saldo_piutang,
        CASE
            WHEN s.status_sales = 'BATAL'::text THEN 0::numeric
            WHEN (COALESCE(s.harga_jual, 0::numeric) + COALESCE(c.tambahan_harga_jual, 0::numeric)) <= 0::numeric THEN 0::numeric
            ELSE COALESCE(r.total_pembayaran_harga_jual, 0::numeric) / (COALESCE(s.harga_jual, 0::numeric) + COALESCE(c.tambahan_harga_jual, 0::numeric))
        END AS persentase_terbayar,
    COALESCE(r.total_pelunasan_konsumen, 0::numeric) AS total_pelunasan_konsumen
   FROM sales s
     LEFT JOIN costs c ON c.id_sales = s.id_sales
     LEFT JOIN receipts r ON r.id_sales = s.id_sales) p join public.sales s on s.id_sales=p.id_sales;
