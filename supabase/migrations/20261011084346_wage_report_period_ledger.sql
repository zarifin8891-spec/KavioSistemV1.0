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
   sum(progress_periode) filter(where tanggal_update>=p_from) as progress_periode,
   sum(progress_periode) as progress_akumulasi,
   max(retensi) as retensi,max(upah_item) as upah_item,
   sum(upah_bruto) filter(where tanggal_update>=p_from) as upah_bruto,
   sum(upah_retensi) filter(where tanggal_update>=p_from) as upah_retensi,
   sum(upah_netto) filter(where tanggal_update>=p_from) as upah_netto
  from ledger group by id_spk,jenis_spk,id_kavling,nama_objek,id_detail,id_mandor,nama_mandor,nama_pekerjaan,nama_kategori,volume,satuan
  having count(*) filter(where tanggal_update>=p_from)>0
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(g) order by nama_mandor,jenis_spk,id_kavling,nama_objek,nama_kategori,nama_pekerjaan,id_detail) from grouped g),'[]'::jsonb),
  'totals',jsonb_build_object('upah_bruto',coalesce(sum(upah_bruto),0),'upah_retensi',coalesce(sum(upah_retensi),0),'upah_netto',coalesce(sum(upah_netto),0))) into result from grouped;
 return result;
end $$;
revoke all on function public.kavio_wage_report(date,date,uuid,text) from public,anon;
grant execute on function public.kavio_wage_report(date,date,uuid,text) to authenticated;
