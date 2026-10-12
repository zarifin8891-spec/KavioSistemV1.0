create or replace function public.create_wage_payment_atomic(p_data jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_key uuid;v_kind text;v_date date;v_mandor text;v_bank text;v_items jsonb;entry jsonb;r record;amount numeric;used numeric;total_amount numeric:=0;
begin
 if auth.uid() is null or not public.kavio_can_action('WAGE_PAYMENT_WRITE') then raise exception 'AKSES PEMBAYARAN UPAH DITOLAK';end if;
 v_key:=(p_data->>'request_key')::uuid;v_kind:=p_data->>'jenis';v_date:=(p_data->>'tanggal')::date;v_mandor:=p_data->>'id_mandor';v_bank:=nullif(p_data->>'id_bank','');v_items:=p_data->'items';
 if v_key is null then raise exception 'KUNCI TRANSAKSI WAJIB';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_key::text,0));
 select id_pembayaran into v_id from public.wage_payment where request_key=v_key;
 if found then
  if exists(select 1 from public.wage_payment h where h.id_pembayaran=v_id and (h.jenis is distinct from v_kind or h.id_mandor is distinct from v_mandor)) then raise exception 'KUNCI TRANSAKSI SUDAH DIGUNAKAN';end if;
  return v_id;
 end if;
 if v_kind not in ('UPAH','RETENSI') or v_kind is null or v_date is null or v_date>(now() at time zone 'Asia/Jakarta')::date then raise exception 'JENIS ATAU TANGGAL PEMBAYARAN TIDAK VALID';end if;
 if v_kind='UPAH' and not exists(select 1 from public.master_bank where id_bank=v_bank and status_aktif) then raise exception 'PILIH KAS/BANK AKTIF';end if;
 if v_items is null or jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items) not between 1 and 100 then raise exception 'PILIH MINIMAL SATU TAGIHAN';end if;
 if (select count(*)<>count(distinct value->>'id_progress_detail') from jsonb_array_elements(v_items)) then raise exception 'TAGIHAN TIDAK BOLEH DUPLIKAT';end if;
 -- Locks serialize competing payments and retention reservations for the same accrual.
 perform 1 from public.work_detail_progress where id_progress_detail in(select (value->>'id_progress_detail')::uuid from jsonb_array_elements(v_items)) order by id_progress_detail for update;
 for entry in select value from jsonb_array_elements(v_items) loop
  select * into r from public.v_wage_settlement where id_progress_detail=(entry->>'id_progress_detail')::uuid;
  amount:=(entry->>'nominal')::numeric;
  if not found or r.id_mandor<>v_mandor or r.tanggal_update>v_date or amount is null or amount<=0 or amount<>round(amount,2) or amount in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) then raise exception 'TAGIHAN, MANDOR, TANGGAL ATAU NOMINAL TIDAK VALID';end if;
  if v_kind='UPAH' and amount>r.sisa_upah then raise exception 'NOMINAL MELEBIHI SISA UPAH';end if;
  if v_kind='RETENSI' then
   if not r.retensi_layak then raise exception 'RETENSI MENUNGGU AKAD KAVLING / PENUTUPAN SPK FASUM';end if;
   if r.jenis_spk='KAVLING' and not exists(select 1 from public.sales where id_kavling=r.id_kavling and status_aktif and status_sales='AKAD' and tgl_akad<=v_date) then raise exception 'TANGGAL RETENSI HARUS SETELAH AKAD';end if;
   if amount>r.retensi_tersedia then raise exception 'NOMINAL MELEBIHI RETENSI TERSEDIA ATAU SUDAH DIAJUKAN';end if;
  end if;
  total_amount:=total_amount+amount;
 end loop;
 insert into public.wage_payment(request_key,nomor,tanggal,jenis,id_mandor,id_bank,status,total,keterangan,dibuat_oleh,dibayar_oleh,dibayar_pada)
 values(v_key,'UPH-'||to_char(v_date,'YY')||'/'||lpad(nextval('public.wage_payment_no_seq')::text,6,'0'),v_date,v_kind,v_mandor,case when v_kind='UPAH' then v_bank end,case when v_kind='UPAH' then 'POSTED' else 'DIAJUKAN' end,total_amount,nullif(btrim(p_data->>'keterangan'),''),auth.uid(),case when v_kind='UPAH' then auth.uid() end,case when v_kind='UPAH' then now() end) returning id_pembayaran into v_id;
 insert into public.wage_payment_item select v_id,(value->>'id_progress_detail')::uuid,(value->>'nominal')::numeric from jsonb_array_elements(v_items);
 return v_id;
end $$;
create or replace function public.transition_wage_payment_atomic(p_id uuid,p_action text,p_tanggal date default null,p_id_bank text default null,p_alasan text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare h public.wage_payment%rowtype;r record;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED';end if;
 if p_action is null or p_action not in ('SETUJUI','CAIRKAN','BATAL') then raise exception 'TINDAKAN TIDAK VALID';end if;
 if p_action='SETUJUI' then
  if not exists(select 1 from public.user_profiles where user_id=auth.uid() and status_aktif and role='DIREKTUR') then raise exception 'HANYA DIREKTUR DAPAT MENYETUJUI RETENSI';end if;
 else
  if not public.kavio_can_action('WAGE_PAYMENT_WRITE') then raise exception 'AKSES PEMBAYARAN UPAH DITOLAK';end if;
 end if;
 select * into h from public.wage_payment where id_pembayaran=p_id for update;
 if not found then raise exception 'DOKUMEN TIDAK DITEMUKAN';end if;
 if p_action='BATAL' then
  if nullif(btrim(p_alasan),'') is null or h.status='BATAL' then raise exception 'ALASAN PEMBATALAN WAJIB / DOKUMEN SUDAH BATAL';end if;
  update public.wage_payment set status='BATAL',dibatalkan_oleh=auth.uid(),dibatalkan_pada=now(),alasan_batal=p_alasan where id_pembayaran=p_id;return p_id;
 end if;
 if h.jenis<>'RETENSI' or (p_action='SETUJUI' and h.status<>'DIAJUKAN') or (p_action='CAIRKAN' and h.status<>'DISETUJUI') or p_action not in ('SETUJUI','CAIRKAN') then raise exception 'STATUS DOKUMEN TIDAK SESUAI';end if;
 perform 1 from public.work_detail_progress p join public.wage_payment_item i using(id_progress_detail) where i.id_pembayaran=p_id order by p.id_progress_detail for update of p;
 for r in select v.*,i.nominal from public.wage_payment_item i join public.v_wage_settlement v using(id_progress_detail) where i.id_pembayaran=p_id loop
  if not r.retensi_layak or r.nominal>r.sisa_retensi then raise exception 'RETENSI BELUM LAYAK ATAU SALDO TIDAK MENCUKUPI';end if;
  if p_action='CAIRKAN' and (p_tanggal is null or p_tanggal<h.tanggal or p_tanggal<r.tanggal_update or p_tanggal>(now() at time zone 'Asia/Jakarta')::date) then raise exception 'TANGGAL PENCAIRAN TIDAK VALID';end if;
  if p_action='CAIRKAN' and r.jenis_spk='KAVLING' and not exists(select 1 from public.sales where id_kavling=r.id_kavling and status_aktif and status_sales='AKAD' and tgl_akad<=p_tanggal) then raise exception 'TANGGAL PENCAIRAN HARUS SETELAH AKAD';end if;
 end loop;
 if p_action='SETUJUI' then update public.wage_payment set status='DISETUJUI',disetujui_oleh=auth.uid(),disetujui_pada=now() where id_pembayaran=p_id;
 else
  if not exists(select 1 from public.master_bank where id_bank=p_id_bank and status_aktif) then raise exception 'PILIH KAS/BANK AKTIF';end if;
  update public.wage_payment set status='POSTED',tanggal=p_tanggal,id_bank=p_id_bank,dibayar_oleh=auth.uid(),dibayar_pada=now() where id_pembayaran=p_id;
 end if;
 return p_id;
end $$;
revoke all on function public.create_wage_payment_atomic(jsonb),public.transition_wage_payment_atomic(uuid,text,date,text,text) from public,anon;
grant execute on function public.create_wage_payment_atomic(jsonb),public.transition_wage_payment_atomic(uuid,text,date,text,text) to authenticated;
