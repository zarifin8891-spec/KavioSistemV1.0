-- The V1 relation trigger assumed every SPK had a kavling. V2 Fasum has
-- independent work items, but keeps the same mandor/office relationship.
create or replace function public.validate_spm_relations() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.jenis_spk='KAVLING' and not exists(select 1 from public.master_kavling k where k.id_kavling=new.id_kavling and k.id_tipe=new.id_tipe) then
  raise exception 'Tipe rumah pada SPK harus sama dengan tipe rumah pada kavling %',new.id_kavling;
 end if;
 if not exists(select 1 from public.master_mandor m where m.id_mandor=new.id_mandor and m.id_kantor=new.id_kantor) then
  raise exception 'Mandor % bukan anggota kantor pelaksana %',new.id_mandor,new.id_kantor;
 end if;
 return new;
end $$;
