-- Both object types feed the same progress summary and Decision Engine.
create or replace view public.v_progress_summary with(security_invoker=true) as
select s.id_spk,s.id_kavling,s.id_tipe,s.id_kantor,s.id_mandor,s.tgl_spk,s.tgl_target_selesai,s.status_spk,
 round(coalesce(sum(v.progress_berbobot),0),6) as progress_total
from public.spk s left join public.v_spk_work_item_progress_current v on v.id_spk=s.id_spk
group by s.id_spk,s.id_kavling,s.id_tipe,s.id_kantor,s.id_mandor,s.tgl_spk,s.tgl_target_selesai,s.status_spk;

do $$ declare original text; updated text;
begin
 original:=pg_get_viewdef('public.v_decision_engine'::regclass,true);
 updated:=replace(original,'pu.progress_periode * c.bobot_final','pu.progress_periode * c.bobot');
 updated:=replace(updated,'JOIN spk_progress_config c ON c.id_spk = pu.id_spk AND c.id_kategori = pu.id_kategori','JOIN spk_work_item c ON c.id_spk = pu.id_spk AND c.id_item = pu.id_item');
 if updated=original or position('JOIN spk_progress_config c' in updated)>0 then raise exception 'Shared monitoring source not matched'; end if;
 execute 'create or replace view public.v_decision_engine with(security_invoker=true) as '||updated;
end $$;
