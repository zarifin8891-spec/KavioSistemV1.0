-- Permanent document numbers; UUID remains the relational primary key.
begin;
lock table public.spk in share row exclusive mode;
create schema if not exists kavio_internal;
revoke all on schema kavio_internal from public, anon, authenticated;
create table if not exists kavio_internal.spk_number_counter(tahun integer primary key, terakhir bigint not null check(terakhir>0));
alter table kavio_internal.spk_number_counter enable row level security;
revoke all on kavio_internal.spk_number_counter from public,anon,authenticated;
alter table public.spk add column if not exists no_spk text;
with ranked as (
 select id_spk,extract(year from tgl_spk)::integer tahun,row_number() over(partition by extract(year from tgl_spk) order by created_at,id_spk) nomor from public.spk
) update public.spk s set no_spk='SPK'||right(r.tahun::text,2)||'-'||lpad(r.nomor::text,greatest(3,length(r.nomor::text)),'0') from ranked r where s.id_spk=r.id_spk and s.no_spk is null;
insert into kavio_internal.spk_number_counter(tahun,terakhir)
select extract(year from tgl_spk)::integer,max(split_part(no_spk,'-',2)::bigint) from public.spk group by extract(year from tgl_spk)
on conflict(tahun) do update set terakhir=greatest(kavio_internal.spk_number_counter.terakhir,excluded.terakhir);
alter table public.spk alter column no_spk set not null;
create unique index if not exists spk_no_spk_unique on public.spk(no_spk);
create or replace function kavio_internal.assign_spk_number() returns trigger language plpgsql security definer set search_path='' as $$
declare y integer; n bigint;
begin
 if tg_op='UPDATE' then
  if new.no_spk is distinct from old.no_spk then raise exception 'Nomor SPK tidak dapat diubah.'; end if;
  return new;
 end if;
 if auth.uid() is null and current_setting('role') not in ('none','postgres','service_role') then raise exception 'Sesi pengguna diperlukan.'; end if;
 y:=extract(year from new.tgl_spk)::integer;
 if y is null then raise exception 'Tanggal SPK diperlukan untuk nomor SPK.'; end if;
 insert into kavio_internal.spk_number_counter(tahun,terakhir) values(y,1)
 on conflict(tahun) do update set terakhir=kavio_internal.spk_number_counter.terakhir+1 returning terakhir into n;
 new.no_spk:='SPK'||right(y::text,2)||'-'||lpad(n::text,greatest(3,length(n::text)),'0');
 return new;
end $$;
revoke all on function kavio_internal.assign_spk_number() from public,anon,authenticated;
drop trigger if exists assign_spk_document_number on public.spk;
create trigger assign_spk_document_number before insert or update of no_spk on public.spk for each row execute function kavio_internal.assign_spk_number();
notify pgrst,'reload schema';
commit;
