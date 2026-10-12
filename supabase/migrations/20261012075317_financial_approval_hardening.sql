-- Unchanged UPSERTs must remain available to normal lifecycle edits.
create or replace function public.guard_sales_contract_financial_write() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare id uuid;changed boolean:=true;
begin
 if tg_table_name='sales' then
  if old.id_kavling is distinct from new.id_kavling or old.tgl_booking is distinct from new.tgl_booking then raise exception 'KAVLING DAN TANGGAL BOOKING PERJANJIAN TIDAK DAPAT DIPINDAHKAN';end if;
  id:=new.id_sales;changed:=row(old.harga_jual,old.jenis_pembayaran,old.id_bank) is distinct from row(new.harga_jual,new.jenis_pembayaran,new.id_bank);
 else
  id:=case when tg_op='DELETE' then old.id_sales else new.id_sales end;
  if tg_op='UPDATE' and old.id_sales is distinct from new.id_sales then raise exception 'DATA PERJANJIAN TIDAK DAPAT DIPINDAHKAN';end if;
  if tg_table_name='sales_cash_installment_terms' then
   if tg_op='UPDATE' then changed:=row(old.tenor_bulan,old.pola_pelunasan) is distinct from row(new.tenor_bulan,new.pola_pelunasan);
   elsif tg_op='INSERT' then changed:=not exists(select 1 from public.sales_cash_installment_terms where id_sales=id and tenor_bulan=new.tenor_bulan and pola_pelunasan=new.pola_pelunasan);end if;
  else
   if tg_op='UPDATE' then changed:=row(old.jenis_biaya,old.nominal,old.status_aktif) is distinct from row(new.jenis_biaya,new.nominal,new.status_aktif);
   elsif tg_op='INSERT' then changed:=not exists(select 1 from public.sales_biaya_tambahan where id_sales=id and jenis_biaya=new.jenis_biaya and nominal=new.nominal and status_aktif=new.status_aktif);end if;
  end if;
 end if;
 if changed and not public.kavio_contract_write_allowed(id) then raise exception 'PERUBAHAN PERJANJIAN HARUS DIAJUKAN DAN DISETUJUI DIREKTUR';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
alter table public.sales_financial_approval add column dibatalkan_oleh uuid references auth.users(id) on delete restrict,add column dibatalkan_pada timestamptz;
create index sales_financial_approval_canceller_idx on public.sales_financial_approval(dibatalkan_oleh);
do $$ declare body text;
begin
 select pg_get_functiondef('public.transition_sales_financial_approval(uuid,text,text)'::regprocedure) into body;
 body:=replace(body,'begin'||chr(10)||' select * into a',
 'begin'||chr(10)||' if auth.uid() is null or not public.kavio_is_active_user() or p_aksi is null or p_aksi not in (''BATAL'',''SETUJUI'',''TOLAK'') then raise exception ''AKSI / AKSES PENGAJUAN TIDAK VALID'';end if;'||chr(10)||' select * into a');
 body:=replace(body,'set status=''DIBATALKAN'',catatan_keputusan=', 'set status=''DIBATALKAN'',dibatalkan_oleh=auth.uid(),dibatalkan_pada=now(),catatan_keputusan=');
 execute body;
end $$;

