-- Phase 1: editable master drafts, validated publication, immutable SPK snapshots.
alter table public.master_tipe_rumah
 add column total_upah_borongan numeric(18,2) not null default 0 check(total_upah_borongan>=0 and total_upah_borongan<'Infinity'::numeric),
 add column perincian_siap boolean not null default false;
alter table public.company_settings add column mode_progress_default text not null default 'KATEGORI' check(mode_progress_default in ('KATEGORI','PERINCIAN'));
alter table public.spk
 add column mode_progress text not null default 'KATEGORI' check(mode_progress in ('KATEGORI','PERINCIAN')),
 add column total_upah_borongan numeric(18,2) not null default 0 check(total_upah_borongan>=0 and total_upah_borongan<'Infinity'::numeric),
 add column configured_at timestamptz;

create table public.master_work_detail(
 id_detail uuid primary key default gen_random_uuid(),
 id_tipe text not null references public.master_tipe_rumah(id_tipe),
 id_kategori text not null references public.master_kategori_pekerjaan(id_kategori),
 urutan integer not null check(urutan>0),
 nama_pekerjaan text not null check(length(btrim(nama_pekerjaan)) between 1 and 200),
 volume numeric(18,4) not null check(volume>0 and volume<'Infinity'::numeric),
 satuan text not null check(length(btrim(satuan)) between 1 and 30),
 bobot numeric(12,6) not null check(bobot>0 and bobot<=1),
 retensi numeric(3,2) not null default .05 check(retensi in (0,.05)),
 unique(id_tipe,id_kategori,urutan)
);
create table public.spk_work_detail(
 id_detail uuid primary key default gen_random_uuid(),
 id_item uuid not null references public.spk_work_item(id_item) on delete cascade,
 urutan integer not null check(urutan>0),
 nama_pekerjaan text not null check(length(btrim(nama_pekerjaan)) between 1 and 200),
 volume numeric(18,4) not null check(volume>0 and volume<'Infinity'::numeric),
 satuan text not null check(length(btrim(satuan)) between 1 and 30),
 bobot numeric(12,6) not null check(bobot>0 and bobot<=1),
 retensi numeric(3,2) not null check(retensi in (0,.05)),
 id_mandor text not null references public.master_mandor(id_mandor),
 unique(id_item,urutan)
);
create index spk_work_detail_mandor_idx on public.spk_work_detail(id_mandor);
create index master_work_detail_category_idx on public.master_work_detail(id_kategori);
alter table public.master_work_detail enable row level security;
alter table public.spk_work_detail enable row level security;
create policy master_work_detail_read on public.master_work_detail for select to authenticated using ((select public.kavio_can_action('MASTER_WRITE')) or (select public.kavio_can_action('SPK_WRITE')));
create policy spk_work_detail_read on public.spk_work_detail for select to authenticated using ((select public.kavio_is_active_user()));
revoke all on public.master_work_detail,public.spk_work_detail from anon,authenticated;
grant select on public.master_work_detail,public.spk_work_detail to authenticated;

create function public.validate_work_master_ready() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.perincian_siap then
  if new.total_upah_borongan<=0 then raise exception 'Total upah borongan harus lebih dari nol sebelum perincian digunakan'; end if;
  if (select coalesce(sum(bobot_standar),0) from public.template_progress_tipe where id_tipe=new.id_tipe)<>1 then raise exception 'Total bobot kategori harus tepat 100%%'; end if;
  if exists(select 1 from public.template_progress_tipe t where t.id_tipe=new.id_tipe and t.bobot_standar<>(select coalesce(sum(d.bobot),0) from public.master_work_detail d where d.id_tipe=t.id_tipe and d.id_kategori=t.id_kategori)) then raise exception 'Total bobot item harus sama dengan bobot kategori'; end if;
  if exists(select 1 from public.master_work_detail d where d.id_tipe=new.id_tipe and not exists(select 1 from public.template_progress_tipe t where t.id_tipe=d.id_tipe and t.id_kategori=d.id_kategori)) then raise exception 'Item memiliki kategori tanpa bobot'; end if;
 end if;
 return new;
end $$;
create trigger validate_work_master_ready before insert or update on public.master_tipe_rumah for each row execute function public.validate_work_master_ready();
create function public.guard_ready_template_weight() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_type text;
begin
 v_type:=case when tg_op='DELETE' then old.id_tipe else new.id_tipe end;
 perform 1 from public.master_tipe_rumah where id_tipe=v_type for update;
 if exists(select 1 from public.master_tipe_rumah where id_tipe=v_type and perincian_siap) then raise exception 'Perincian tipe sudah siap. Ubah bobot dan item bersama melalui Master Perincian Pekerjaan'; end if;
 if tg_op='UPDATE' and old.id_tipe<>new.id_tipe and exists(select 1 from public.master_tipe_rumah where id_tipe=old.id_tipe and perincian_siap) then raise exception 'Template tipe siap tidak dapat dipindahkan'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger guard_ready_template_weight before insert or update or delete on public.template_progress_tipe for each row execute function public.guard_ready_template_weight();

create function public.save_work_master_atomic(p_id_tipe text,p_total_upah numeric,p_categories jsonb,p_details jsonb,p_publish boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r jsonb; v_category text;
begin
 if auth.uid() is null or not public.kavio_can_action('MASTER_WRITE') then raise exception 'FORBIDDEN: MASTER_WRITE'; end if;
 perform 1 from public.master_tipe_rumah where id_tipe=p_id_tipe and status_aktif for update;
 if not found then raise exception 'Tipe rumah tidak aktif atau tidak ditemukan'; end if;
 if p_total_upah is null or p_total_upah<0 or p_total_upah>9999999999999999 or p_publish is null then raise exception 'Total upah atau status simpan tidak valid'; end if;
 if jsonb_typeof(p_categories) is distinct from 'array' or jsonb_array_length(p_categories)=0 or jsonb_typeof(p_details) is distinct from 'array' then raise exception 'Kategori dan item pekerjaan tidak valid'; end if;
 update public.master_tipe_rumah set perincian_siap=false where id_tipe=p_id_tipe;
 delete from public.master_work_detail where id_tipe=p_id_tipe;
 delete from public.template_progress_tipe where id_tipe=p_id_tipe;
 for r in select value from jsonb_array_elements(p_categories) loop
  v_category:=r->>'id_kategori';
  if not exists(select 1 from public.master_kategori_pekerjaan where id_kategori=v_category and status_aktif) then raise exception 'Kategori pekerjaan tidak aktif'; end if;
  insert into public.template_progress_tipe(id_tipe,id_kategori,bobot_standar) values(p_id_tipe,v_category,(r->>'bobot')::numeric);
 end loop;
 for r in select value from jsonb_array_elements(p_details) loop
  if not exists(select 1 from public.template_progress_tipe where id_tipe=p_id_tipe and id_kategori=r->>'group_id') then raise exception 'Kategori item tidak ditemukan'; end if;
  insert into public.master_work_detail(id_tipe,id_kategori,urutan,nama_pekerjaan,volume,satuan,bobot,retensi)
  values(p_id_tipe,r->>'group_id',(r->>'urutan')::integer,btrim(r->>'nama_pekerjaan'),(r->>'volume')::numeric,btrim(r->>'satuan'),(r->>'bobot')::numeric,(r->>'retensi')::numeric);
 end loop;
 update public.master_tipe_rumah set total_upah_borongan=p_total_upah,perincian_siap=p_publish where id_tipe=p_id_tipe;
end $$;
revoke all on function public.save_work_master_atomic(text,numeric,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.save_work_master_atomic(text,numeric,jsonb,jsonb,boolean) to authenticated;

create function public.guard_spk_work_snapshot() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare s public.spk%rowtype; v_spk uuid;
begin
 if tg_table_name='spk' then
  if tg_op='INSERT' then
   new.mode_progress:=coalesce((select mode_progress_default from public.company_settings where id=true),'KATEGORI');
   if new.jenis_spk='KAVLING' then new.total_upah_borongan:=coalesce((select total_upah_borongan from public.master_tipe_rumah where id_tipe=new.id_tipe),0); end if;
  elsif (old.status_spk<>'DRAFT' or old.is_active or exists(select 1 from public.progress_update where id_spk=old.id_spk)) and (new.mode_progress,new.total_upah_borongan,new.configured_at) is distinct from (old.mode_progress,old.total_upah_borongan,old.configured_at) then
   raise exception 'Konfigurasi SPK berjalan atau berhistori tidak dapat diubah';
  end if;
  -- Detailed progress and payroll are intentionally implemented in phase 2.
  if new.is_active and new.mode_progress='PERINCIAN' then raise exception 'Konfigurasi perincian dapat disimpan sebagai DRAFT. Aktivasi menunggu fitur input progress perincian'; end if;
  return new;
 end if;
 if tg_table_name='spk_work_detail' then
  select id_spk into v_spk from public.spk_work_item where id_item=case when tg_op='DELETE' then old.id_item else new.id_item end;
 else v_spk:=case when tg_op='DELETE' then old.id_spk else new.id_spk end; end if;
 select * into s from public.spk where id_spk=v_spk for update;
 if found and (s.status_spk<>'DRAFT' or s.is_active or exists(select 1 from public.progress_update where id_spk=v_spk)) then raise exception 'Rincian dan bobot SPK berjalan atau berhistori tidak dapat diubah'; end if;
 if tg_op='UPDATE' then
  if tg_table_name='spk_work_detail' then
   if new.id_item<>old.id_item then raise exception 'Item snapshot tidak dapat dipindahkan'; end if;
  elsif new.id_spk<>old.id_spk then raise exception 'Kategori snapshot tidak dapat dipindahkan'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger guard_spk_work_snapshot before insert or update on public.spk for each row execute function public.guard_spk_work_snapshot();
create trigger guard_spk_work_parent before insert or update or delete on public.spk_work_item for each row execute function public.guard_spk_work_snapshot();
create trigger guard_spk_work_detail before insert or update or delete on public.spk_work_detail for each row execute function public.guard_spk_work_snapshot();

create function public.configure_spk_work_atomic(p_id_spk uuid,p_mode text,p_total_upah numeric,p_parents jsonb,p_details jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.spk%rowtype; r jsonb; v_parent uuid;
begin
 if auth.uid() is null or not public.kavio_can_action('SPK_WRITE') then raise exception 'FORBIDDEN: SPK_WRITE'; end if;
 select * into s from public.spk where id_spk=p_id_spk for update;
 if not found then raise exception 'SPK tidak ditemukan'; end if;
 if s.status_spk<>'DRAFT' or s.is_active or exists(select 1 from public.progress_update where id_spk=p_id_spk) then raise exception 'Konfigurasi hanya dapat diubah pada SPK DRAFT tanpa progress'; end if;
 if p_mode is null or p_mode not in ('KATEGORI','PERINCIAN') or p_total_upah is null or p_total_upah<0 or p_total_upah>9999999999999999 or (p_mode='PERINCIAN' and p_total_upah<=0) then raise exception 'Mode atau total upah SPK tidak valid'; end if;
 if jsonb_typeof(p_parents) is distinct from 'array' or jsonb_typeof(p_details) is distinct from 'array' then raise exception 'Data kategori dan perincian tidak valid'; end if;
 if (select count(*) from jsonb_array_elements(p_parents))<>(select count(*) from public.spk_work_item where id_spk=p_id_spk) or (select count(distinct value->>'id_kategori') from jsonb_array_elements(p_parents))<>jsonb_array_length(p_parents) then raise exception 'Kategori SPK harus lengkap dan tidak boleh berulang'; end if;
 delete from public.spk_work_detail where id_item in (select id_item from public.spk_work_item where id_spk=p_id_spk);
 for r in select value from jsonb_array_elements(p_parents) loop
  v_parent:=(r->>'id_kategori')::uuid;
  if not exists(select 1 from public.spk_work_item where id_item=v_parent and id_spk=p_id_spk) or (r->>'bobot')::numeric is null or (r->>'bobot')::numeric<0 or (r->>'bobot')::numeric>1 then raise exception 'Kategori atau bobot SPK tidak valid'; end if;
  if s.jenis_spk='KAVLING' then
   update public.spk_progress_config set bobot_final=(r->>'bobot')::numeric where id_spk=p_id_spk and id_kategori=(select id_kategori_legacy from public.spk_work_item where id_item=v_parent);
   if not found then raise exception 'Konfigurasi kategori SPK tidak ditemukan'; end if;
  else update public.spk_work_item set bobot=(r->>'bobot')::numeric where id_item=v_parent; end if;
 end loop;
 if (select sum(bobot) from public.spk_work_item where id_spk=p_id_spk) is distinct from 1::numeric then raise exception 'Total bobot kategori SPK harus tepat 100%%'; end if;
 if p_mode='PERINCIAN' then
  for r in select value from jsonb_array_elements(p_details) loop
   v_parent:=(r->>'group_id')::uuid;
   if not exists(select 1 from public.spk_work_item where id_item=v_parent and id_spk=p_id_spk) then raise exception 'Item bukan milik SPK yang dipilih'; end if;
   if not exists(select 1 from public.master_mandor where id_mandor=r->>'id_mandor' and status_aktif) then raise exception 'Mandor item tidak aktif atau belum dipilih'; end if;
   insert into public.spk_work_detail(id_item,urutan,nama_pekerjaan,volume,satuan,bobot,retensi,id_mandor)
   values(v_parent,(r->>'urutan')::integer,btrim(r->>'nama_pekerjaan'),(r->>'volume')::numeric,btrim(r->>'satuan'),(r->>'bobot')::numeric,(r->>'retensi')::numeric,r->>'id_mandor');
  end loop;
  if exists(select 1 from public.spk_work_item w where w.id_spk=p_id_spk and w.bobot<>(select coalesce(sum(d.bobot),0) from public.spk_work_detail d where d.id_item=w.id_item)) then raise exception 'Total bobot item harus sama dengan bobot kategori SPK'; end if;
 end if;
 update public.spk set mode_progress=p_mode,total_upah_borongan=p_total_upah,configured_at=now() where id_spk=p_id_spk;
end $$;
revoke all on function public.configure_spk_work_atomic(uuid,text,numeric,jsonb,jsonb) from public,anon;
grant execute on function public.configure_spk_work_atomic(uuid,text,numeric,jsonb,jsonb) to authenticated;
-- Editing a draft must remain a draft; activation has its own explicit command.
do $$ declare v_def text; begin
 select pg_get_functiondef(oid) into v_def from pg_proc where proname='create_or_update_spk_atomic';
 v_def:=replace(v_def,'status_spk=''AKTIF'',tgl_target_selesai=p_tgl_target_selesai,is_active=true','status_spk=''DRAFT'',tgl_target_selesai=p_tgl_target_selesai,is_active=false');
 v_def:=replace(v_def,'v_status := ''AKTIF'';','v_status := ''DRAFT'';');
 execute v_def;
end $$;
