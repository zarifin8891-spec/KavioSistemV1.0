-- Exercise the actual completion-screen field names under an authenticated caller.
begin;
select set_config('request.jwt.claim.sub','2d50291d-03e3-46a3-b3d8-c4550bc1bce7',true);
set local role authenticated;
with items as (
 select id_spk,id_item,bobot_final,progress_akumulasi,progress_berbobot
 from public.v_spk_work_item_progress_current
 where id_spk in(select id_spk from public.spk where is_active)
 order by id_spk,id_item
),details as (
 select id_spk,id_item,progress_akumulasi
 from public.v_spk_work_detail_progress_current
 where id_spk in(select id_spk from public.spk where is_active)
 order by id_spk,id_item
)
select (select count(*) from items) parent_rows,(select count(*) from details) detail_rows;
rollback;
