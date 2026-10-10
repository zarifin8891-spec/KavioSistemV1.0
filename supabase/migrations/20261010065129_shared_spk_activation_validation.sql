-- Validate the shared V2 work-item engine for both Kavling and Fasum.
create or replace function public.validate_activate_spm() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_sum numeric;
begin
 if new.is_active then
  select coalesce(sum(bobot),0) into v_sum from public.spk_work_item where id_spk=new.id_spk;
  if abs(v_sum-1)>0.000001 then raise exception 'Bobot final SPK % harus berjumlah 100%%',new.id_spk; end if;
 end if;
 return new;
end $$;
