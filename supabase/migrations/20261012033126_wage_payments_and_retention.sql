-- Wage settlement references immutable progress accruals, not recomputed master prices.
insert into public.kavio_role_actions(role,action) values ('ADMIN','WAGE_PAYMENT_WRITE'),('DIREKTUR','WAGE_PAYMENT_WRITE'),('KEUANGAN','WAGE_PAYMENT_WRITE'),('DIREKTUR','RETENTION_APPROVE') on conflict do nothing;
create sequence public.wage_payment_no_seq;
create table public.wage_payment (
 id_pembayaran uuid primary key default gen_random_uuid(),request_key uuid not null unique,
 nomor text not null unique,tanggal date not null,jenis text not null check(jenis in ('UPAH','RETENSI')),
 id_mandor text not null references public.master_mandor(id_mandor) on delete restrict,
 id_bank text references public.master_bank(id_bank) on delete restrict,
 status text not null check(status in ('DIAJUKAN','DISETUJUI','POSTED','BATAL')),
 total numeric(18,2) not null check(total>0),keterangan text,
 dibuat_oleh uuid not null references auth.users(id),dibuat_pada timestamptz not null default now(),
 disetujui_oleh uuid references auth.users(id),disetujui_pada timestamptz,
 dibayar_oleh uuid references auth.users(id),dibayar_pada timestamptz,
 dibatalkan_oleh uuid references auth.users(id),dibatalkan_pada timestamptz,alasan_batal text,
 check(status<>'POSTED' or (id_bank is not null and dibayar_oleh is not null)),
 check(jenis<>'RETENSI' or status not in ('DISETUJUI','POSTED') or disetujui_oleh is not null)
);
create table public.wage_payment_item (
 id_pembayaran uuid not null references public.wage_payment(id_pembayaran) on delete restrict,
 id_progress_detail uuid not null references public.work_detail_progress(id_progress_detail) on delete restrict,
 nominal numeric(18,2) not null check(nominal>0),primary key(id_pembayaran,id_progress_detail)
);
create index wage_payment_mandor_idx on public.wage_payment(id_mandor,tanggal);
create index wage_payment_bank_idx on public.wage_payment(id_bank);
create index wage_payment_item_progress_idx on public.wage_payment_item(id_progress_detail);
alter table public.wage_payment enable row level security;
alter table public.wage_payment_item enable row level security;
create policy wage_payment_read on public.wage_payment for select to authenticated using(public.kavio_is_active_user());
create policy wage_payment_item_read on public.wage_payment_item for select to authenticated using(public.kavio_is_active_user());
revoke all on public.wage_payment,public.wage_payment_item from public,anon,authenticated;
grant select on public.wage_payment,public.wage_payment_item to authenticated;
create view public.v_wage_settlement with(security_invoker=true) as
select p.id_progress_detail,p.tanggal_update,p.id_mandor,m.nama_mandor,p.id_detail,d.nama_pekerjaan,w.id_spk,s.jenis_spk,s.id_kavling,s.nama_objek,s.status_spk,
 p.upah_bruto,p.upah_retensi,p.upah_netto,coalesce(a.dibayar_upah,0) dibayar_upah,coalesce(a.dibayar_retensi,0) dibayar_retensi,coalesce(a.dipesan_retensi,0) dipesan_retensi,
 p.upah_netto-coalesce(a.dibayar_upah,0) sisa_upah,p.upah_retensi-coalesce(a.dibayar_retensi,0) sisa_retensi,
 p.upah_retensi-coalesce(a.dipesan_retensi,0) retensi_tersedia,
 case when s.jenis_spk='FASUM' then s.status_spk='SELESAI' else exists(select 1 from public.sales x where x.id_kavling=s.id_kavling and x.status_aktif and x.status_sales='AKAD' and x.tgl_akad is not null) end retensi_layak
from public.work_detail_progress p join public.spk_work_detail d using(id_detail) join public.spk_work_item w on w.id_item=d.id_item join public.spk s on s.id_spk=w.id_spk join public.master_mandor m on m.id_mandor=p.id_mandor
left join lateral(select sum(i.nominal) filter(where h.jenis='UPAH' and h.status='POSTED') dibayar_upah,sum(i.nominal) filter(where h.jenis='RETENSI' and h.status='POSTED') dibayar_retensi,sum(i.nominal) filter(where h.jenis='RETENSI' and h.status<>'BATAL') dipesan_retensi from public.wage_payment_item i join public.wage_payment h using(id_pembayaran) where i.id_progress_detail=p.id_progress_detail)a on true;
grant select on public.v_wage_settlement to authenticated;
create view public.v_wage_bank_movement with(security_invoker=true) as select id_pembayaran,nomor,tanggal,id_bank,total as pengeluaran,jenis from public.wage_payment where status='POSTED';
grant select on public.v_wage_bank_movement to authenticated;
create or replace function public.create_wage_payment_atomic(p_data jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_key uuid;v_kind text;v_date date;v_mandor text;v_bank text;v_items jsonb;entry jsonb;r record;amount numeric;used numeric;total_amount numeric:=0;
begin
 if auth.uid() is null or not public.kavio_can_action('WAGE_PAYMENT_WRITE') then raise exception 'AKSES PEMBAYARAN UPAH DITOLAK';end if;
 v_key:=(p_data->>'request_key')::uuid;v_kind:=p_data->>'jenis';v_date:=(p_data->>'tanggal')::date;v_mandor:=p_data->>'id_mandor';v_bank:=nullif(p_data->>'id_bank','');v_items:=p_data->'items';
 if v_key is null then raise exception 'KUNCI TRANSAKSI WAJIB';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_key::text,0));
 select id_pembayaran into v_id from public.wage_payment where request_key=v_key;
 if found then return v_id;end if;
 if v_kind not in ('UPAH','RETENSI') or v_kind is null or v_date is null or v_date>(now() at time zone 'Asia/Jakarta')::date then raise exception 'JENIS ATAU TANGGAL PEMBAYARAN TIDAK VALID';end if;
 if v_kind='UPAH' and not exists(select 1 from public.master_bank where id_bank=v_bank and status_aktif) then raise exception 'PILIH KAS/BANK AKTIF';end if;
 if v_items is null or jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items)=0 then raise exception 'PILIH MINIMAL SATU TAGIHAN';end if;
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
create view public.v_wage_payment_detail with(security_invoker=true) as select i.id_pembayaran,i.id_progress_detail,i.nominal,p.tanggal_update,d.nama_pekerjaan,p.upah_bruto,p.upah_retensi,p.upah_netto,s.jenis_spk,s.id_kavling,s.nama_objek from public.wage_payment_item i join public.work_detail_progress p using(id_progress_detail) join public.spk_work_detail d using(id_detail) join public.spk_work_item w on w.id_item=d.id_item join public.spk s on s.id_spk=w.id_spk;
grant select on public.v_wage_payment_detail to authenticated;
