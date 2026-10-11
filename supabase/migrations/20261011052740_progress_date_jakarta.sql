-- The shared category RPCs use the same project date as the detailed engine and form.
do $migration$
declare f record; original text; updated text;
begin
 for f in select oid from pg_proc where pronamespace='public'::regnamespace and proname in ('insert_progress_work_item_batch_atomic','insert_progress_update_atomic','insert_progress_batch_atomic') loop
  original:=pg_get_functiondef(f.oid);
  updated:=regexp_replace(original,'(p_tanggal_update\s*>\s*)current_date',E'\\1(now() at time zone ''Asia/Jakarta'')::date','g');
  if updated=original then raise exception 'Progress date guard not matched'; end if;
  execute updated;
 end loop;
end $migration$;
