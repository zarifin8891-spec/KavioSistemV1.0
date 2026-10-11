-- Item progress is the source of truth. Category rows remain projections for the shared V2 engine.
create table public.work_detail_progress (
 id_progress_detail uuid primary key default gen_random_uuid(),
 id_detail uuid not null references public.spk_work_detail(id_detail) on delete restrict,
 id_progress uuid not null references public.progress_update(id_progress) on delete restrict,
 tanggal_update date not null,
 progress_periode numeric(8,6) not null check(progress_periode>0 and progress_periode<=1),
 keterangan text,
 id_mandor text not null references public.master_mandor(id_mandor),
 bobot numeric(12,6) not null check(bobot>0 and bobot<=1),
 retensi numeric(3,2) not null check(retensi in (0,.05)),
 upah_item numeric(18,2) not null check(upah_item>=0),
 upah_bruto numeric(18,2) not null check(upah_bruto>=0),
 upah_retensi numeric(18,2) not null check(upah_retensi>=0 and upah_retensi<=upah_bruto),
 upah_netto numeric(18,2) generated always as (upah_bruto-upah_retensi) stored,
 input_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(id_detail,tanggal_update)
);
create index work_detail_progress_parent_idx on public.work_detail_progress(id_progress);
create index work_detail_progress_mandor_idx on public.work_detail_progress(id_mandor);
alter table public.work_detail_progress enable row level security;
create policy work_detail_progress_read on public.work_detail_progress for select to authenticated using ((select public.kavio_is_active_user()));
revoke all on public.work_detail_progress from public,anon,authenticated;
grant select on public.work_detail_progress to authenticated;

create view public.v_spk_work_detail_progress_current with (security_invoker=true) as
select w.id_spk,d.id_detail as id_item,d.id_item as id_kategori,w.nama_pekerjaan as nama_kategori,
 d.urutan,d.nama_pekerjaan,d.volume,d.satuan,d.bobot as bobot_final,d.retensi,d.id_mandor,m.nama_mandor,
 coalesce(sum(p.progress_periode),0) as progress_akumulasi,
 coalesce(sum(p.progress_periode),0)*d.bobot as progress_berbobot,
 max(p.tanggal_update) as tanggal_update_terakhir,
 round(d.bobot*s.total_upah_borongan,-2) as upah_item,
 coalesce(sum(p.upah_bruto),0) as upah_bruto,coalesce(sum(p.upah_retensi),0) as upah_retensi,
 coalesce(sum(p.upah_netto),0) as upah_netto
from public.spk_work_detail d
join public.spk_work_item w on w.id_item=d.id_item
join public.spk s on s.id_spk=w.id_spk
join public.master_mandor m on m.id_mandor=d.id_mandor
left join public.work_detail_progress p on p.id_detail=d.id_detail
group by w.id_spk,d.id_detail,w.id_item,w.nama_pekerjaan,m.nama_mandor,s.total_upah_borongan;
revoke all on public.v_spk_work_detail_progress_current from public,anon;
grant select on public.v_spk_work_detail_progress_current to authenticated;

-- Shared validation must use the V2 parent item for Fasum as well as Kavling.
create or replace function public.validate_progress_relations() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare s public.spk%rowtype;
begin
 select * into s from public.spk where id_spk=new.id_spk for update;
 if not found or not s.is_active or s.status_spk<>'AKTIF' then raise exception 'SPK tidak aktif'; end if;
 if not exists(select 1 from public.spk_work_item where id_spk=new.id_spk and id_item=new.id_item) then raise exception 'Item belum dikonfigurasi pada SPK'; end if;
 if new.tanggal_update<s.tgl_spk or new.tanggal_update>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal progress di luar periode yang diizinkan'; end if;
 return new;
end $$;
create or replace function public.validate_progress_cumulative() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare total numeric;
begin
 select coalesce(sum(progress_periode),0) into total from public.progress_update where id_spk=new.id_spk and id_item=new.id_item and id_progress<>new.id_progress;
 if total+new.progress_periode>1 then raise exception 'Progress kumulatif item melebihi 100%%'; end if;
 return new;
end $$;

-- Direct API mutations cannot edit the projections of detailed progress.
create function public.guard_detail_progress_projection() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare id uuid;
begin
 id:=case when tg_op='DELETE' then old.id_spk else new.id_spk end;
 if current_user in ('authenticated','anon') and exists(select 1 from public.spk where id_spk=id and mode_progress='PERINCIAN') then raise exception 'Progress perincian harus dicatat melalui form item pekerjaan'; end if;
 if tg_op='UPDATE' and current_user in ('authenticated','anon') and exists(select 1 from public.spk where id_spk=old.id_spk and mode_progress='PERINCIAN') then raise exception 'Progress perincian harus dicatat melalui form item pekerjaan'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger guard_detail_progress_projection before insert or update or delete on public.progress_update for each row execute function public.guard_detail_progress_projection();

create function public.insert_work_detail_progress_batch_atomic(p_id_spk uuid,p_tanggal_update date,p_entries jsonb) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.spk%rowtype; entry jsonb; v_detail record; pct numeric; current_progress numeric; gross numeric; retained numeric; wage numeric; parent record; projection uuid; target numeric; previous numeric; inserted integer:=0;
begin
 if auth.uid() is null or not public.kavio_can_action('PROGRESS_WRITE') then raise exception 'FORBIDDEN: PROGRESS_WRITE'; end if;
 select * into s from public.spk where id_spk=p_id_spk for update;
 if not found or not s.is_active or s.status_spk<>'AKTIF' or s.mode_progress<>'PERINCIAN' then raise exception 'SPK perincian tidak aktif'; end if;
 if p_tanggal_update is null or p_tanggal_update<s.tgl_spk or p_tanggal_update>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal progress di luar periode yang diizinkan'; end if;
 if jsonb_typeof(p_entries) is distinct from 'array' or jsonb_array_length(p_entries) not between 1 and 1000 then raise exception 'Isi minimal satu item progress'; end if;
 if (select count(*)<>count(distinct nullif(value->>'id_item','')) from jsonb_array_elements(p_entries)) then raise exception 'Item progress tidak boleh duplikat'; end if;
 for entry in select value from jsonb_array_elements(p_entries) order by value->>'id_item' loop
  select x.*,w.id_spk into v_detail from public.spk_work_detail x join public.spk_work_item w on w.id_item=x.id_item where x.id_detail=(entry->>'id_item')::uuid and w.id_spk=p_id_spk;
  if not found then raise exception 'Item bukan milik SPK yang dipilih'; end if;
  pct:=(entry->>'progress_percent')::numeric;
  if pct is null or pct<=0 or pct>100 or pct<>round(pct,2) then raise exception 'Progress periode harus lebih dari 0 sampai 100%% dengan maksimal dua desimal'; end if;
  select coalesce(sum(progress_periode),0) into current_progress from public.work_detail_progress where id_detail=v_detail.id_detail;
  if current_progress+pct/100>1 then raise exception '%: progress melebihi 100%%. Maksimal tambahan %%%',v_detail.nama_pekerjaan,round((1-current_progress)*100,2); end if;
  if exists(select 1 from public.work_detail_progress where id_detail=v_detail.id_detail and tanggal_update=p_tanggal_update) then raise exception '%: progress pada tanggal tersebut sudah dicatat',v_detail.nama_pekerjaan; end if;
 end loop;
 -- Create one daily projection per touched category, then append item sources.
 for parent in select distinct w.id_item from jsonb_array_elements(p_entries) e join public.spk_work_detail wd on wd.id_detail=(e.value->>'id_item')::uuid join public.spk_work_item w on w.id_item=wd.id_item loop
  if not exists(select 1 from public.progress_update where id_spk=p_id_spk and id_item=parent.id_item and tanggal_update=p_tanggal_update) then
   insert into public.progress_update(id_spk,id_item,tanggal_update,progress_periode,keterangan,input_by) values(p_id_spk,parent.id_item,p_tanggal_update,0,'Dihitung dari perincian pekerjaan',auth.uid());
  end if;
 end loop;
 for entry in select value from jsonb_array_elements(p_entries) loop
  select * into v_detail from public.spk_work_detail where id_detail=(entry->>'id_item')::uuid;
  pct:=(entry->>'progress_percent')::numeric/100;
  select coalesce(sum(progress_periode),0),coalesce(sum(upah_bruto),0),coalesce(sum(upah_retensi),0) into current_progress,gross,retained from public.work_detail_progress where id_detail=v_detail.id_detail;
  wage:=round(v_detail.bobot*s.total_upah_borongan,-2);
  select id_progress into projection from public.progress_update where id_spk=p_id_spk and id_item=v_detail.id_item and tanggal_update=p_tanggal_update;
  insert into public.work_detail_progress(id_detail,id_progress,tanggal_update,progress_periode,keterangan,id_mandor,bobot,retensi,upah_item,upah_bruto,upah_retensi,input_by)
  values(v_detail.id_detail,projection,p_tanggal_update,pct,nullif(btrim(entry->>'keterangan'),''),v_detail.id_mandor,v_detail.bobot,v_detail.retensi,wage,
   round((current_progress+pct)*wage,2)-gross,round((current_progress+pct)*wage*v_detail.retensi,2)-retained,auth.uid());
  inserted:=inserted+1;
 end loop;
 for parent in select distinct w.id_item,w.bobot from jsonb_array_elements(p_entries) e join public.spk_work_detail wd on wd.id_detail=(e.value->>'id_item')::uuid join public.spk_work_item w on w.id_item=wd.id_item loop
  -- Round the cumulative category target, then take its delta to prevent repeated-rounding drift.
  select round(coalesce(sum(p.progress_periode*wd.bobot),0)/parent.bobot,6) into target from public.spk_work_detail wd left join public.work_detail_progress p on p.id_detail=wd.id_detail where wd.id_item=parent.id_item;
  select coalesce(sum(progress_periode),0) into previous from public.progress_update where id_spk=p_id_spk and id_item=parent.id_item and tanggal_update<>p_tanggal_update;
  update public.progress_update set progress_periode=target-previous where id_spk=p_id_spk and id_item=parent.id_item and tanggal_update=p_tanggal_update;
 end loop;
 return inserted;
end $$;
revoke all on function public.insert_work_detail_progress_batch_atomic(uuid,date,jsonb) from public,anon;
grant execute on function public.insert_work_detail_progress_batch_atomic(uuid,date,jsonb) to authenticated;

-- Open activation only after an entire immutable configuration has been saved.
do $migration$
declare original text; updated text; f record;
begin
 select pg_get_functiondef('public.guard_spk_work_snapshot()'::regprocedure) into original;
 updated:=replace(original,
  'if new.is_active and new.mode_progress=''PERINCIAN'' then raise exception ''Konfigurasi perincian dapat disimpan sebagai DRAFT. Aktivasi menunggu fitur input progress perincian''; end if;',
  'if new.is_active and new.mode_progress=''PERINCIAN'' then
   if new.configured_at is null or new.total_upah_borongan<=0 then raise exception ''Simpan konfigurasi perincian dan total upah sebelum aktivasi''; end if;
   if exists(select 1 from public.spk_work_item w where w.id_spk=new.id_spk and w.bobot<>(select coalesce(sum(d.bobot),0) from public.spk_work_detail d where d.id_item=w.id_item)) then raise exception ''Bobot item harus sama dengan bobot kategori sebelum aktivasi''; end if;
   if exists(select 1 from public.spk_work_detail d join public.spk_work_item w on w.id_item=d.id_item left join public.master_mandor m on m.id_mandor=d.id_mandor where w.id_spk=new.id_spk and not coalesce(m.status_aktif,false)) then raise exception ''Mandor item harus aktif sebelum aktivasi''; end if;
  end if;');
 if updated=original then raise exception 'Activation guard not matched'; end if;
 execute updated;
 -- Legacy category RPCs cannot bypass the item ledger.
 for f in select oid from pg_proc where pronamespace='public'::regnamespace and proname in ('insert_progress_work_item_batch_atomic','insert_progress_update_atomic','insert_progress_batch_atomic') loop
  original:=pg_get_functiondef(f.oid);
  updated:=regexp_replace(original,'(begin\s*)',E'\\1\n  if exists(select 1 from public.spk where id_spk=p_id_spk and mode_progress=''PERINCIAN'') then raise exception ''Gunakan input progress perincian untuk SPK ini''; end if;\n');
  if updated=original then raise exception 'Legacy progress guard not matched'; end if;
  execute updated;
 end loop;
end $migration$;

-- A detailed SPK is complete only when every source item is 100%, including templates
-- whose final weight is 100.00% after rounding (e.g. 99.9964%). Material reconciliation remains mandatory.
do $migration$
declare original text; updated text;
begin
 select pg_get_functiondef('public.deactivate_spk_atomic(uuid)'::regprocedure) into original;
 updated:=replace(original,'if v_progress_total < 0.99999 then',
 'if (v_spk.mode_progress=''PERINCIAN'' and exists(select 1 from public.v_spk_work_detail_progress_current where id_spk=p_id_spk and progress_akumulasi<1)) or (v_spk.mode_progress<>''PERINCIAN'' and v_progress_total < 0.99999) then');
 if updated=original then raise exception 'Completion guard not matched'; end if;
 execute updated;
end $migration$;
