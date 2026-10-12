-- One approval engine for financial contract changes and cancellation decisions.
insert into public.kavio_role_actions(role,action) values
 ('DIREKTUR','FINANCIAL_APPROVE'),('DIREKTUR','SALES_CONTRACT_READ'),
 ('ADMIN','SALES_CONTRACT_READ'),('MARKETING','SALES_CONTRACT_READ'),('KEUANGAN','SALES_CONTRACT_READ')
on conflict do nothing;

create table public.sales_contract_origin (
 id_sales uuid primary key references public.sales(id_sales) on delete restrict,
 initial_xid text
);
-- Existing records never receive an initial-creation bypass.
insert into public.sales_contract_origin(id_sales) select id_sales from public.sales;
alter table public.sales_contract_origin enable row level security;
revoke all on public.sales_contract_origin from public,anon,authenticated;

create table public.sales_financial_approval (
 id_pengajuan uuid primary key default gen_random_uuid(),
 urutan bigint generated always as identity unique,
 id_sales uuid not null references public.sales(id_sales) on delete restrict,
 jenis text not null check(jenis in ('PERJANJIAN','PEMBATALAN')),
 status text not null default 'DIAJUKAN' check(status in ('DIAJUKAN','APLICANDO','DISETUJUI','DITOLAK','DIBATALKAN')),
 sebelum jsonb not null,sesudah jsonb not null,
 alasan text not null check(length(btrim(alasan)) between 1 and 500),
 diajukan_oleh uuid not null references auth.users(id) on delete restrict,
 diajukan_pada timestamptz not null default now(),
 diputuskan_oleh uuid references auth.users(id) on delete restrict,
 diputuskan_pada timestamptz,catatan_keputusan text,
 check((status in ('DIAJUKAN','DIBATALKAN') and diputuskan_oleh is null) or status not in ('DIAJUKAN','DIBATALKAN'))
);
create unique index sales_financial_approval_pending_idx on public.sales_financial_approval(id_sales,jenis) where status in ('DIAJUKAN','APLICANDO');
create index sales_financial_approval_history_idx on public.sales_financial_approval(id_sales,urutan);
create index sales_financial_approval_submitter_idx on public.sales_financial_approval(diajukan_oleh);
create index sales_financial_approval_decider_idx on public.sales_financial_approval(diputuskan_oleh);
alter table public.sales_financial_approval enable row level security;
create policy sales_financial_approval_read on public.sales_financial_approval for select to authenticated
 using((jenis='PERJANJIAN' and (select public.kavio_can_action('SALES_CONTRACT_READ'))) or (jenis='PEMBATALAN' and (select public.kavio_can_action('PAYMENT_RECEIPT_WRITE'))));
revoke all on public.sales_financial_approval from public,anon,authenticated;
grant select on public.sales_financial_approval to authenticated;

create table public.sales_refund_legacy_paid (
 id_sales uuid primary key references public.sales(id_sales) on delete restrict,
 nominal numeric not null check(nominal>=0),tanggal date not null,
 id_penyelesaian uuid not null references public.sales_cancellation_settlement(id_penyelesaian) on delete restrict
);
-- Preserve known historical payments without inventing Director approval.
insert into public.sales_refund_legacy_paid
 select id_sales,nominal_dikembalikan,tanggal_pengembalian,id_penyelesaian from public.sales_cancellation_settlement where status_pengembalian='SUDAH_DIBAYAR';
alter table public.sales_refund_legacy_paid enable row level security;
create policy sales_refund_legacy_paid_read on public.sales_refund_legacy_paid for select to authenticated using((select public.kavio_can_action('PAYMENT_RECEIPT_WRITE')));
revoke all on public.sales_refund_legacy_paid from public,anon,authenticated;
grant select on public.sales_refund_legacy_paid to authenticated;

create table public.sales_refund_payment (
 id_pembayaran uuid primary key default gen_random_uuid(),request_key uuid not null unique,
 id_sales uuid not null references public.sales(id_sales) on delete restrict,
 id_pengajuan uuid not null references public.sales_financial_approval(id_pengajuan) on delete restrict,
 tanggal date not null,id_bank uuid,
 nominal numeric not null check(nominal>0 and nominal<=1000000000000000 and nominal=round(nominal,2)),
 no_referensi text,keterangan text,
 dibuat_oleh uuid not null references auth.users(id) on delete restrict,
 dibuat_pada timestamptz not null default now()
);
-- Bank IDs use the existing text master key.
alter table public.sales_refund_payment alter column id_bank type text using id_bank::text;
alter table public.sales_refund_payment alter column id_bank set not null;
alter table public.sales_refund_payment add foreign key(id_bank) references public.master_bank(id_bank) on delete restrict;
create index sales_refund_payment_sales_idx on public.sales_refund_payment(id_sales,tanggal);
create index sales_refund_payment_approval_idx on public.sales_refund_payment(id_pengajuan);
create index sales_refund_payment_bank_idx on public.sales_refund_payment(id_bank);
create index sales_refund_payment_actor_idx on public.sales_refund_payment(dibuat_oleh);
alter table public.sales_refund_payment enable row level security;
create policy sales_refund_payment_read on public.sales_refund_payment for select to authenticated using((select public.kavio_can_action('PAYMENT_RECEIPT_WRITE')));
revoke all on public.sales_refund_payment from public,anon,authenticated;
grant select on public.sales_refund_payment to authenticated;

create function public.kavio_contract_snapshot(p_id_sales uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('harga_jual',coalesce(s.harga_jual,0),'jenis_pembayaran',s.jenis_pembayaran,'id_bank',s.id_bank,'tgl_booking',s.tgl_booking,'status_sales',s.status_sales,'status_aktif',s.status_aktif,
 'tenor_bulan',t.tenor_bulan,'pola_pelunasan',t.pola_pelunasan,
 'biaya_penambahan_bangunan',coalesce(c.penambahan,0),'biaya_kelebihan_tanah',coalesce(c.tanah,0),'biaya_hook',coalesce(c.hook,0),
 'biaya_notaris',coalesce(c.notaris,0),'biaya_akad',coalesce(c.akad,0),'biaya_lainnya',coalesce(c.lainnya,0))
 from public.sales s left join public.sales_cash_installment_terms t using(id_sales)
 left join lateral(select
 sum(nominal) filter(where jenis_biaya='PENAMBAHAN BANGUNAN') penambahan,
 sum(nominal) filter(where jenis_biaya='KELEBIHAN TANAH') tanah,
 sum(nominal) filter(where jenis_biaya='PEMILIHAN LOKASI HOOK') hook,
 sum(nominal) filter(where jenis_biaya='NOTARIS') notaris,
 sum(nominal) filter(where jenis_biaya='BIAYA AKAD') akad,
 sum(nominal) filter(where jenis_biaya='BIAYA LAINNYA') lainnya
 from public.sales_biaya_tambahan where id_sales=s.id_sales and status_aktif)c on true where s.id_sales=p_id_sales;
$$;
create function public.kavio_refund_paid(p_id_sales uuid) returns numeric language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select nominal from public.sales_refund_legacy_paid where id_sales=p_id_sales),0)+coalesce((select sum(nominal) from public.sales_refund_payment where id_sales=p_id_sales),0);
$$;
create function public.kavio_cancellation_snapshot(p_id_sales uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('settlement',(select to_jsonb(x) from public.sales_cancellation_settlement x where id_sales=p_id_sales),
 'diterima',(select coalesce(sum(nominal),0) from public.sales_receipt where id_sales=p_id_sales and status='AKTIF'),
 'dikembalikan',public.kavio_refund_paid(p_id_sales));
$$;
create function public.kavio_financial_apply_allowed(p_id_sales uuid,p_kind text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.sales_financial_approval a join public.user_profiles p on p.user_id=auth.uid() and p.role='DIREKTUR' and p.status_aktif
 where a.id_pengajuan::text=current_setting('kavio.financial_apply',true) and a.id_sales=p_id_sales and a.jenis=p_kind and a.status='APLICANDO' and a.diputuskan_oleh=auth.uid());
$$;
create function public.kavio_contract_write_allowed(p_id_sales uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.sales_contract_origin where id_sales=p_id_sales and initial_xid=pg_current_xact_id()::text)
 or public.kavio_financial_apply_allowed(p_id_sales,'PERJANJIAN');
$$;
revoke all on function public.kavio_contract_snapshot(uuid),public.kavio_refund_paid(uuid),public.kavio_cancellation_snapshot(uuid),public.kavio_financial_apply_allowed(uuid,text),public.kavio_contract_write_allowed(uuid) from public,anon,authenticated;

create function public.capture_sales_contract_origin() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin insert into public.sales_contract_origin(id_sales,initial_xid) values(new.id_sales,pg_current_xact_id()::text);return null;end $$;
create trigger capture_sales_contract_origin after insert on public.sales for each row execute function public.capture_sales_contract_origin();
revoke all on function public.capture_sales_contract_origin() from public,anon,authenticated;

create function public.guard_sales_contract_financial_write() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare id uuid;changed boolean:=true;
begin
 if tg_table_name='sales' then
  if old.id_kavling is distinct from new.id_kavling or old.tgl_booking is distinct from new.tgl_booking then raise exception 'KAVLING DAN TANGGAL BOOKING PERJANJIAN TIDAK DAPAT DIPINDAHKAN';end if;
  id:=new.id_sales;
  changed:=row(old.harga_jual,old.jenis_pembayaran,old.id_bank) is distinct from row(new.harga_jual,new.jenis_pembayaran,new.id_bank);
 else
  id:=case when tg_op='DELETE' then old.id_sales else new.id_sales end;
  if tg_op='UPDATE' and old.id_sales is distinct from new.id_sales then raise exception 'DATA PERJANJIAN TIDAK DAPAT DIPINDAHKAN';end if;
  if tg_op='UPDATE' then
   if tg_table_name='sales_cash_installment_terms' then changed:=row(old.tenor_bulan,old.pola_pelunasan) is distinct from row(new.tenor_bulan,new.pola_pelunasan);
   else changed:=row(old.jenis_biaya,old.nominal,old.status_aktif) is distinct from row(new.jenis_biaya,new.nominal,new.status_aktif);end if;
  end if;
 end if;
 if changed and not public.kavio_contract_write_allowed(id) then raise exception 'PERUBAHAN PERJANJIAN HARUS DIAJUKAN DAN DISETUJUI DIREKTUR';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger guard_sales_contract_financial_write before update on public.sales for each row execute function public.guard_sales_contract_financial_write();
create trigger guard_sales_cost_financial_write before insert or update or delete on public.sales_biaya_tambahan for each row execute function public.guard_sales_contract_financial_write();
create trigger guard_sales_terms_financial_write before insert or update or delete on public.sales_cash_installment_terms for each row execute function public.guard_sales_contract_financial_write();
revoke all on function public.guard_sales_contract_financial_write() from public,anon,authenticated;
alter policy sales_cash_terms_read on public.sales_cash_installment_terms using((select public.kavio_can_action('PAYMENT_PLAN_WRITE')) or (select public.kavio_can_action('PAYMENT_RECEIPT_WRITE')) or (select public.kavio_can_action('SALES_WRITE')));

create function public.kavio_normalize_contract(p_before jsonb,p_changes jsonb) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare r jsonb:=p_before;v jsonb:=p_before||p_changes;key text;amount numeric;kind text:=v->>'jenis_pembayaran';
begin
 if kind not in ('KPR','CASH','CASH_BERTAHAP') then raise exception 'JENIS PEMBAYARAN TIDAK VALID';end if;
 foreach key in array array['harga_jual','biaya_penambahan_bangunan','biaya_kelebihan_tanah','biaya_hook','biaya_notaris','biaya_akad','biaya_lainnya'] loop
  amount:=(v->>key)::numeric;
  if amount is null or amount not between 0 and 1000000000000000 or amount<>round(amount,2) then raise exception 'NILAI PERJANJIAN TIDAK VALID: %',key;end if;
  r:=jsonb_set(r,array[key],to_jsonb(amount));
 end loop;
 r:=r||jsonb_build_object('jenis_pembayaran',kind,'id_bank',case when kind='KPR' then nullif(v->>'id_bank','') end,
 'tenor_bulan',case when kind='CASH_BERTAHAP' then (v->>'tenor_bulan')::integer end,'pola_pelunasan',case when kind='CASH_BERTAHAP' then v->>'pola_pelunasan' end);
 if kind='CASH_BERTAHAP' and ((r->>'tenor_bulan')::integer not between 1 and 12 or r->>'tenor_bulan' is null or coalesce(r->>'pola_pelunasan','') not in ('CICILAN_FLEKSIBEL','LUNAS_DI_AKHIR')) then raise exception 'TENOR CASH BERTAHAP HARUS 1-12 BULAN';end if;
 if kind='KPR' and not exists(select 1 from public.master_bank where id_bank=r->>'id_bank' and status_aktif and is_kpr) then raise exception 'BANK KPR TIDAK VALID';end if;
 return r;
end $$;
revoke all on function public.kavio_normalize_contract(jsonb,jsonb) from public,anon,authenticated;

create function public.kavio_validate_financial_proposal(p_kind text,p_id_sales uuid,p_before jsonb,p_after jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare received numeric;paid numeric;total numeric;refund numeric;held numeric;
begin
 if p_kind='PERJANJIAN' then
  if not exists(select 1 from public.sales where id_sales=p_id_sales and status_aktif and status_sales<>'BATAL') then raise exception 'REVISI HANYA UNTUK SALES AKTIF';end if;
  if p_before->>'jenis_pembayaran' is distinct from p_after->>'jenis_pembayaran' and exists(select 1 from public.sales_receipt where id_sales=p_id_sales) then raise exception 'JENIS PEMBAYARAN TIDAK DAPAT DIUBAH SETELAH ADA PENERIMAAN';end if;
  if p_before->>'id_bank' is distinct from p_after->>'id_bank' and exists(select 1 from public.sales_receipt where id_sales=p_id_sales and status='AKTIF' and jenis_penerimaan='PENCAIRAN_KPR') then raise exception 'BANK KPR TIDAK DAPAT DIUBAH SETELAH PENCAIRAN';end if;
  total:=(p_after->>'harga_jual')::numeric+(p_after->>'biaya_penambahan_bangunan')::numeric+(p_after->>'biaya_kelebihan_tanah')::numeric+(p_after->>'biaya_hook')::numeric+(p_after->>'biaya_notaris')::numeric+(p_after->>'biaya_akad')::numeric+(p_after->>'biaya_lainnya')::numeric;
  select coalesce(sum(pelunasan_konsumen),0) into paid from public.v_sales_receipt_financial where id_sales=p_id_sales and status='AKTIF';
  if total>1000000000000000 or total+0.005<paid then raise exception 'TOTAL PERJANJIAN TIDAK BOLEH DI BAWAH PELUNASAN KONSUMEN';end if;
 else
  if not exists(select 1 from public.sales where id_sales=p_id_sales and status_sales='BATAL') then raise exception 'PENYELESAIAN HANYA UNTUK SALES BATAL';end if;
  refund:=(p_after->>'nominal_dikembalikan')::numeric;held:=(p_after->>'nominal_ditahan')::numeric;
  if p_after->>'keputusan' not in ('BOOKING_FEE_DIKEMBALIKAN','BOOKING_FEE_DIHANGUSKAN','DIKEMBALIKAN_SEBAGIAN','TANPA_PENGEMBALIAN') then raise exception 'KEPUTUSAN PEMBATALAN TIDAK VALID';end if;
  if refund is null or held is null or refund not between 0 and 1000000000000000 or held not between 0 and 1000000000000000 or refund<>round(refund,2) or held<>round(held,2) then raise exception 'NOMINAL PEMBATALAN TIDAK VALID';end if;
  select coalesce(sum(nominal),0) into received from public.sales_receipt where id_sales=p_id_sales and status='AKTIF';
  if refund+held>received+0.005 then raise exception 'REFUND DAN DANA DITAHAN MELEBIHI PENERIMAAN AKTIF';end if;
  if refund+0.005<public.kavio_refund_paid(p_id_sales) then raise exception 'KEPUTUSAN TIDAK BOLEH DI BAWAH REFUND YANG SUDAH DIBAYAR';end if;
 end if;
end $$;
revoke all on function public.kavio_validate_financial_proposal(text,uuid,jsonb,jsonb) from public,anon,authenticated;

create function public.submit_sales_financial_approval(p_id_sales uuid,p_jenis text,p_data jsonb,p_alasan text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare before_data jsonb;after_data jsonb;id uuid;
begin
 if auth.uid() is null or p_jenis not in ('PERJANJIAN','PEMBATALAN') or not public.kavio_can_action(case when p_jenis='PERJANJIAN' then 'SALES_WRITE' else 'PAYMENT_RECEIPT_WRITE' end) then raise exception 'AKSES PENGAJUAN KEUANGAN DITOLAK';end if;
 perform 1 from public.sales where id_sales=p_id_sales for update;if not found then raise exception 'SALES TIDAK DITEMUKAN';end if;
 if nullif(btrim(p_alasan),'') is null or length(p_alasan)>500 or p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'DATA DAN ALASAN PENGAJUAN WAJIB VALID';end if;
 if exists(select 1 from public.sales_financial_approval where id_sales=p_id_sales and jenis=p_jenis and status in ('DIAJUKAN','APLICANDO')) then raise exception 'MASIH ADA PENGAJUAN MENUNGGU KEPUTUSAN DIREKTUR';end if;
 if p_jenis='PERJANJIAN' then
  before_data:=public.kavio_contract_snapshot(p_id_sales);after_data:=public.kavio_normalize_contract(before_data,p_data);
  if before_data=after_data then raise exception 'BELUM ADA PERUBAHAN PERJANJIAN';end if;
 else
  before_data:=public.kavio_cancellation_snapshot(p_id_sales);
  after_data:=jsonb_build_object('keputusan',p_data->>'keputusan','nominal_dikembalikan',(p_data->>'nominal_dikembalikan')::numeric,'nominal_ditahan',(p_data->>'nominal_ditahan')::numeric);
 end if;
 perform public.kavio_validate_financial_proposal(p_jenis,p_id_sales,before_data,after_data);
 insert into public.sales_financial_approval(id_sales,jenis,sebelum,sesudah,alasan,diajukan_oleh) values(p_id_sales,p_jenis,before_data,after_data,btrim(p_alasan),auth.uid()) returning id_pengajuan into id;
 return id;
end $$;
revoke all on function public.submit_sales_financial_approval(uuid,text,jsonb,text) from public,anon;
grant execute on function public.submit_sales_financial_approval(uuid,text,jsonb,text) to authenticated;

create function public.transition_sales_financial_approval(p_id_pengajuan uuid,p_aksi text,p_catatan text default null) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.sales_financial_approval%rowtype;s public.sales%rowtype;current_data jsonb;paid numeric;
begin
 select * into a from public.sales_financial_approval where id_pengajuan=p_id_pengajuan;
 if not found then raise exception 'PENGAJUAN TIDAK DITEMUKAN';end if;
 select * into s from public.sales where id_sales=a.id_sales for update;
 select * into a from public.sales_financial_approval where id_pengajuan=p_id_pengajuan for update;
 if a.status<>'DIAJUKAN' then raise exception 'STATUS PENGAJUAN SUDAH BERUBAH';end if;
 if p_aksi='BATAL' then
  if auth.uid() is null or not public.kavio_can_action(case when a.jenis='PERJANJIAN' then 'SALES_WRITE' else 'PAYMENT_RECEIPT_WRITE' end) then raise exception 'AKSES PEMBATALAN PENGAJUAN DITOLAK';end if;
  if nullif(btrim(p_catatan),'') is null or length(p_catatan)>500 then raise exception 'ALASAN PEMBATALAN WAJIB DIISI';end if;
  update public.sales_financial_approval set status='DIBATALKAN',catatan_keputusan=btrim(p_catatan),diputuskan_pada=now() where id_pengajuan=a.id_pengajuan;return 'DIBATALKAN';
 end if;
 if auth.uid() is null or not public.kavio_can_action('FINANCIAL_APPROVE') or not exists(select 1 from public.user_profiles where user_id=auth.uid() and role='DIREKTUR' and status_aktif) then raise exception 'HANYA DIREKTUR DAPAT MEMUTUSKAN PENGAJUAN';end if;
 if p_aksi='TOLAK' then
  if nullif(btrim(p_catatan),'') is null or length(p_catatan)>500 then raise exception 'ALASAN PENOLAKAN WAJIB DIISI';end if;
  update public.sales_financial_approval set status='DITOLAK',diputuskan_oleh=auth.uid(),diputuskan_pada=now(),catatan_keputusan=btrim(p_catatan) where id_pengajuan=a.id_pengajuan;return 'DITOLAK';
 end if;
 if p_aksi<>'SETUJUI' then raise exception 'AKSI PENGAJUAN TIDAK VALID';end if;
 current_data:=case when a.jenis='PERJANJIAN' then public.kavio_contract_snapshot(a.id_sales) else public.kavio_cancellation_snapshot(a.id_sales) end;
 if current_data is distinct from a.sebelum then raise exception 'DATA DASAR BERUBAH. BATALKAN DAN AJUKAN ULANG';end if;
 perform public.kavio_validate_financial_proposal(a.jenis,a.id_sales,a.sebelum,a.sesudah);
 update public.sales_financial_approval set status='APLICANDO',diputuskan_oleh=auth.uid(),diputuskan_pada=now(),catatan_keputusan=nullif(btrim(p_catatan),'') where id_pengajuan=a.id_pengajuan;
 perform set_config('kavio.financial_apply',a.id_pengajuan::text,true);
 if a.jenis='PERJANJIAN' then
  update public.sales set harga_jual=(a.sesudah->>'harga_jual')::numeric where id_sales=a.id_sales;
  perform public.update_sales_atomic(a.id_sales,s.nama_konsumen,s.alamat_konsumen,s.hp_konsumen,s.status_sales,a.sesudah->>'jenis_pembayaran',a.sesudah->>'id_bank',s.id_notaris,s.tgl_akad,s.target_akad);
  if a.sesudah->>'jenis_pembayaran'='CASH_BERTAHAP' then
   insert into public.sales_cash_installment_terms(id_sales,tenor_bulan,pola_pelunasan,dibuat_oleh) values(a.id_sales,(a.sesudah->>'tenor_bulan')::integer,a.sesudah->>'pola_pelunasan',auth.uid())
   on conflict(id_sales) do update set tenor_bulan=excluded.tenor_bulan,pola_pelunasan=excluded.pola_pelunasan,diperbarui_pada=now();
  else delete from public.sales_cash_installment_terms where id_sales=a.id_sales;end if;
  perform public.save_sales_biaya_atomic(a.id_sales,(a.sesudah->>'biaya_penambahan_bangunan')::numeric,(a.sesudah->>'biaya_kelebihan_tanah')::numeric,(a.sesudah->>'biaya_notaris')::numeric,(a.sesudah->>'biaya_akad')::numeric,(a.sesudah->>'biaya_hook')::numeric,(a.sesudah->>'biaya_lainnya')::numeric);
  if public.kavio_contract_snapshot(a.id_sales) is distinct from a.sesudah then raise exception 'HASIL REVISI PERJANJIAN TIDAK SESUAI PENGAJUAN';end if;
 else
  paid:=public.kavio_refund_paid(a.id_sales);
  insert into public.sales_cancellation_settlement(id_sales,keputusan,nominal_dikembalikan,nominal_ditahan,alasan,status_pengembalian,tanggal_pengembalian,diputuskan_oleh)
  values(a.id_sales,a.sesudah->>'keputusan',(a.sesudah->>'nominal_dikembalikan')::numeric,(a.sesudah->>'nominal_ditahan')::numeric,a.alasan,
  case when (a.sesudah->>'nominal_dikembalikan')::numeric=0 then 'TIDAK_ADA' when paid>=(a.sesudah->>'nominal_dikembalikan')::numeric then 'SUDAH_DIBAYAR' else 'BELUM_DIBAYAR' end,
  case when paid>0 and paid>=(a.sesudah->>'nominal_dikembalikan')::numeric then coalesce((select max(tanggal) from public.sales_refund_payment where id_sales=a.id_sales),(select tanggal from public.sales_refund_legacy_paid where id_sales=a.id_sales)) end,auth.uid())
  on conflict(id_sales) do update set keputusan=excluded.keputusan,nominal_dikembalikan=excluded.nominal_dikembalikan,nominal_ditahan=excluded.nominal_ditahan,alasan=excluded.alasan,status_pengembalian=excluded.status_pengembalian,tanggal_pengembalian=excluded.tanggal_pengembalian,diputuskan_oleh=excluded.diputuskan_oleh,dibuat_pada=now();
 end if;
 perform set_config('kavio.financial_apply','',true);
 update public.sales_financial_approval set status='DISETUJUI' where id_pengajuan=a.id_pengajuan;
 return 'DISETUJUI';
end $$;
revoke all on function public.transition_sales_financial_approval(uuid,text,text) from public,anon;
grant execute on function public.transition_sales_financial_approval(uuid,text,text) to authenticated;

-- Legacy endpoint can submit a proposal; it can no longer mark a refund paid.
create or replace function public.save_sales_cancellation_settlement_atomic(p_id_sales uuid,p_keputusan text,p_nominal_dikembalikan numeric,p_nominal_ditahan numeric,p_alasan text,p_status_pengembalian text default 'BELUM_DIBAYAR',p_tanggal_pengembalian date default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_status_pengembalian='SUDAH_DIBAYAR' or p_tanggal_pengembalian is not null then raise exception 'REFUND HARUS DISETUJUI DIREKTUR LALU DICATAT MELALUI PEMBAYARAN REFUND';end if;
 return public.submit_sales_financial_approval(p_id_sales,'PEMBATALAN',jsonb_build_object('keputusan',p_keputusan,'nominal_dikembalikan',p_nominal_dikembalikan,'nominal_ditahan',p_nominal_ditahan),p_alasan);
end $$;

create function public.post_sales_refund_payment_atomic(p_data jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.sales_financial_approval%rowtype;existing public.sales_refund_payment%rowtype;
 id uuid;sid uuid:=(p_data->>'id_sales')::uuid;key uuid:=(p_data->>'request_key')::uuid;bank text:=p_data->>'id_bank';date_paid date:=(p_data->>'tanggal')::date;
 amount numeric:=(p_data->>'nominal')::numeric;received numeric;paid numeric;
begin
 if auth.uid() is null or not public.kavio_can_action('PAYMENT_RECEIPT_WRITE') then raise exception 'AKSES PEMBAYARAN REFUND DITOLAK';end if;
 perform 1 from public.sales where id_sales=sid and status_sales='BATAL' for update;if not found then raise exception 'REFUND HANYA UNTUK SALES BATAL';end if;
 if key is null or date_paid is null or date_paid>(now() at time zone 'Asia/Jakarta')::date or amount is null or amount not between 0.01 and 1000000000000000 or amount<>round(amount,2) or not exists(select 1 from public.master_bank where id_bank=bank and status_aktif) then raise exception 'TANGGAL, NOMINAL, KAS/BANK DAN KUNCI REFUND WAJIB VALID';end if;
 select * into existing from public.sales_refund_payment where request_key=key;
 if found then
  if row(existing.id_sales,existing.id_pengajuan,existing.tanggal,existing.id_bank,existing.nominal,coalesce(existing.no_referensi,''),coalesce(existing.keterangan,'')) is distinct from row(sid,(p_data->>'id_pengajuan')::uuid,date_paid,bank,amount,coalesce(p_data->>'no_referensi',''),coalesce(p_data->>'keterangan','')) then raise exception 'KUNCI REFUND SUDAH DIGUNAKAN UNTUK DATA BERBEDA';end if;
  return existing.id_pembayaran;
 end if;
 select * into a from public.sales_financial_approval where id_sales=sid and jenis='PEMBATALAN' and status='DISETUJUI' order by urutan desc limit 1;
 if not found or a.id_pengajuan is distinct from (p_data->>'id_pengajuan')::uuid then raise exception 'REFUND MEMERLUKAN KEPUTUSAN TERBARU YANG DISETUJUI DIREKTUR';end if;
 paid:=public.kavio_refund_paid(sid);
 select coalesce(sum(nominal),0) into received from public.sales_receipt where id_sales=sid and status='AKTIF';
 if (a.sesudah->>'nominal_dikembalikan')::numeric+(a.sesudah->>'nominal_ditahan')::numeric>received+0.005 then raise exception 'PENERIMAAN BERUBAH. PERBARUI KEPUTUSAN REFUND';end if;
 if paid+amount>(a.sesudah->>'nominal_dikembalikan')::numeric+0.005 then raise exception 'PEMBAYARAN MELEBIHI SISA REFUND YANG DISETUJUI';end if;
 insert into public.sales_refund_payment(request_key,id_sales,id_pengajuan,tanggal,id_bank,nominal,no_referensi,keterangan,dibuat_oleh)
 values(key,sid,a.id_pengajuan,date_paid,bank,amount,nullif(btrim(p_data->>'no_referensi'),''),nullif(btrim(p_data->>'keterangan'),''),auth.uid()) returning id_pembayaran into id;
 update public.sales_cancellation_settlement set status_pengembalian=case when paid+amount>=(a.sesudah->>'nominal_dikembalikan')::numeric then 'SUDAH_DIBAYAR' else 'BELUM_DIBAYAR' end,
 tanggal_pengembalian=case when paid+amount>=(a.sesudah->>'nominal_dikembalikan')::numeric then date_paid end where id_sales=sid;
 return id;
end $$;
revoke all on function public.post_sales_refund_payment_atomic(jsonb) from public,anon;
grant execute on function public.post_sales_refund_payment_atomic(jsonb) to authenticated;

create function public.guard_sales_refund_receipt_balance() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid:=case when tg_op='DELETE' then old.id_sales else new.id_sales end;received numeric;
begin
 select coalesce(sum(nominal),0) into received from public.sales_receipt where id_sales=sid and status='AKTIF';
 if public.kavio_refund_paid(sid)>received+0.005 then raise exception 'KOREKSI PENERIMAAN TIDAK BOLEH DI BAWAH REFUND YANG SUDAH DIBAYAR';end if;
 return null;
end $$;
create constraint trigger guard_sales_refund_receipt_balance after insert or update or delete on public.sales_receipt deferrable initially deferred for each row execute function public.guard_sales_refund_receipt_balance();
revoke all on function public.guard_sales_refund_receipt_balance() from public,anon,authenticated;

create view public.v_sales_refund_position with(security_invoker=true) as
select s.id_sales,a.id_pengajuan,c.nominal_dikembalikan,c.nominal_ditahan,c.status_pengembalian,
 coalesce(l.nominal,0)+coalesce(p.nominal,0) nominal_dibayar,
 case when a.id_pengajuan is not null then c.nominal_dikembalikan-coalesce(l.nominal,0)-coalesce(p.nominal,0) end sisa_refund,
 l.id_sales is not null histori_legacy
from public.sales s left join public.sales_cancellation_settlement c using(id_sales)
left join lateral(select id_pengajuan from public.sales_financial_approval where id_sales=s.id_sales and jenis='PEMBATALAN' and status='DISETUJUI' order by urutan desc limit 1)a on true
left join public.sales_refund_legacy_paid l using(id_sales)
left join lateral(select sum(nominal) nominal from public.sales_refund_payment where id_sales=s.id_sales)p on true
where s.status_sales='BATAL' and (select public.kavio_can_action('PAYMENT_RECEIPT_WRITE'));
create view public.v_sales_refund_bank_movement with(security_invoker=true) as
select id_pembayaran,id_sales,tanggal,id_bank,nominal as pengeluaran,-nominal as nilai_mutasi from public.sales_refund_payment;
revoke all on public.v_sales_refund_position,public.v_sales_refund_bank_movement from public,anon;
grant select on public.v_sales_refund_position,public.v_sales_refund_bank_movement to authenticated;

