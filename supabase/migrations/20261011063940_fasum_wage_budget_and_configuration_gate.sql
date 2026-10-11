-- Additive V2 change: existing SPK snapshots and operational history stay intact.
alter table public.spk_work_item
 add column volume numeric(14,4) check(volume>0),
 add column satuan text check(length(btrim(satuan)) between 1 and 30),
 add column harga_satuan_upah numeric(18,2) check(harga_satuan_upah>0),
 add column keterangan text check(length(keterangan)<=500),
 add column total_upah_rencana numeric(18,2) generated always as (round(volume*harga_satuan_upah,-2)) stored;
alter table public.spk_work_item add constraint fasum_wage_fields_complete check(
 (volume is null and satuan is null and harga_satuan_upah is null) or
 (volume is not null and satuan is not null and harga_satuan_upah is not null));

create function public.create_fasum_spk_with_wages_atomic(p_nama_objek text,p_tgl_spk date,p_tgl_target_selesai date,p_id_kantor text,p_id_mandor text,p_items jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; id uuid; position integer:=0; qty numeric; rate numeric; wage numeric:=0;
begin
 if auth.uid() is null or not public.kavio_can_action('SPK_WRITE') then raise exception 'FORBIDDEN: SPK_WRITE'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 1000 then raise exception 'Isi item pekerjaan Fasum'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  qty:=(item->>'volume')::numeric; rate:=(item->>'harga_satuan_upah')::numeric;
  if qty is null or qty<=0 or qty>9999999999 or qty<>round(qty,4) or rate is null or rate<=0 or rate>999999999999 or rate<>round(rate,2) or length(btrim(coalesce(item->>'satuan',''))) not between 1 and 30 or length(coalesce(item->>'keterangan',''))>500 then raise exception 'Volume, satuan, harga satuan upah, atau keterangan Fasum tidak valid'; end if;
  wage:=wage+round(qty*rate,-2);
 end loop;
 if wage<=0 or wage>9999999999999999 then raise exception 'Total upah Fasum harus lebih dari nol dan dalam batas yang diizinkan'; end if;
 -- Reuse the existing authorized shared engine inside this same transaction.
 id:=public.create_fasum_spk_atomic(p_nama_objek,p_tgl_spk,p_tgl_target_selesai,p_id_kantor,p_id_mandor,p_items);
 for item in select value from jsonb_array_elements(p_items) loop
  position:=position+1;
  update public.spk_work_item set volume=(item->>'volume')::numeric,satuan=btrim(item->>'satuan'),harga_satuan_upah=(item->>'harga_satuan_upah')::numeric,keterangan=nullif(btrim(item->>'keterangan'),'') where id_spk=id and urutan=position;
 end loop;
 update public.spk set total_upah_borongan=wage,configured_at=null where id_spk=id;
 return id;
end $$;
revoke all on function public.create_fasum_spk_with_wages_atomic(text,date,date,text,text,jsonb) from public,anon;
grant execute on function public.create_fasum_spk_with_wages_atomic(text,date,date,text,text,jsonb) to authenticated;

create function public.ensure_spk_configured_before_activation() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.is_active and not old.is_active and new.configured_at is null then raise exception 'Simpan konfigurasi SPK terlebih dahulu sebelum AKTIFKAN'; end if;
 return new;
end $$;
create trigger ensure_spk_configured_before_activation before update on public.spk for each row execute function public.ensure_spk_configured_before_activation();
revoke all on function public.ensure_spk_configured_before_activation() from public,anon;

-- Editing draft parents/items invalidates previously saved configuration.
create function public.invalidate_spk_work_configuration() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare id uuid;
begin
 if tg_table_name='spk_work_detail' then
  select id_spk into id from public.spk_work_item where id_item=case when tg_op='DELETE' then old.id_item else new.id_item end;
 else id:=case when tg_op='DELETE' then old.id_spk else new.id_spk end; end if;
 update public.spk set configured_at=null where id_spk=id and status_spk='DRAFT' and not is_active and configured_at is not null;
 return null;
end $$;
create trigger invalidate_spk_parent_configuration after insert or update or delete on public.spk_work_item for each row execute function public.invalidate_spk_work_configuration();
create trigger invalidate_spk_detail_configuration after insert or update or delete on public.spk_work_detail for each row execute function public.invalidate_spk_work_configuration();
revoke all on function public.invalidate_spk_work_configuration() from public,anon;

-- Preserve wage-budget provenance when saving a Fasum configuration.
do $$ declare original text; updated text;
begin
 select pg_get_functiondef('public.configure_spk_work_atomic(uuid,text,numeric,jsonb,jsonb)'::regprocedure) into original;
 updated:=replace(original,'if p_mode is null or',
 'if s.jenis_spk=''FASUM'' and exists(select 1 from public.spk_work_item where id_spk=p_id_spk and harga_satuan_upah is not null) and p_total_upah is distinct from (select sum(total_upah_rencana) from public.spk_work_item where id_spk=p_id_spk) then raise exception ''Total upah Fasum harus sesuai rincian volume dan harga satuan upah''; end if;
 if p_mode is null or');
 if updated=original then raise exception 'Fasum configuration validation not matched'; end if;
 execute updated;
end $$;
