-- Validate the final percentage with ROUND(total * 100, 2).
-- Do not round individual weights or loosen item/category equality.
-- CREATE OR REPLACE preserves existing permissions and authorization checks.
do $migration$
declare f record; original text; updated text;
begin
 for f in select oid,proname from pg_proc where pronamespace='public'::regnamespace and proname in (
  'validate_work_master_ready','configure_spk_work_atomic','validate_activate_spm',
  'insert_progress_update_atomic','insert_progress_batch_atomic','create_or_update_spk_atomic',
  'create_fasum_spk_atomic','activate_spk_atomic'
 ) loop
  original:=pg_get_functiondef(f.oid);
  updated:=replace(original,
   '(select coalesce(sum(bobot_standar),0) from public.template_progress_tipe where id_tipe=new.id_tipe)<>1',
   'round((select coalesce(sum(bobot_standar),0) from public.template_progress_tipe where id_tipe=new.id_tipe)*100,2)<>100');
  updated:=replace(updated,
   '(select sum(bobot) from public.spk_work_item where id_spk=p_id_spk) is distinct from 1::numeric',
   'round((select sum(bobot) from public.spk_work_item where id_spk=p_id_spk)*100,2) is distinct from 100::numeric');
  updated:=regexp_replace(updated,
   'abs\(v_(sum|total|weight_total|total_bobot)\s*-\s*1\)\s*>\s*0\.0000[0-9]+',
   'round(v_\1*100,2)<>100','g');
  if updated=original then raise exception 'Weight rounding migration did not match %',f.proname; end if;
  execute updated;
 end loop;
end $migration$;
