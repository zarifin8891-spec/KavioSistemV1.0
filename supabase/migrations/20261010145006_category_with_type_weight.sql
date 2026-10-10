-- Save category identity and the selected house type's weight as one transaction.
create function public.save_master_category_weight_atomic(p_id_kategori text,p_nama text,p_urutan integer,p_id_tipe text,p_bobot numeric,p_create boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ready boolean; v_old_weight numeric;
begin
 if auth.uid() is null or not public.kavio_can_action('MASTER_WRITE') then raise exception 'FORBIDDEN: MASTER_WRITE'; end if;
 p_id_kategori:=nullif(btrim(p_id_kategori),''); p_nama:=nullif(btrim(p_nama),''); p_id_tipe:=nullif(btrim(p_id_tipe),'');
 if p_id_kategori is null or p_nama is null or length(p_nama)>200 or p_urutan is null or p_urutan<1 or p_create is null then raise exception 'ID, nama kategori, dan urutan positif wajib diisi'; end if;
 if p_bobot is null or p_bobot<0 or p_bobot>1 then raise exception 'Bobot harus antara 0 dan 100%%'; end if;
 if p_id_tipe is not null then
  select perincian_siap into v_ready from public.master_tipe_rumah where id_tipe=p_id_tipe and status_aktif for update;
  if not found then raise exception 'Tipe rumah tidak aktif atau tidak ditemukan'; end if;
 elsif p_bobot<>0 then raise exception 'Pilih tipe rumah terlebih dahulu untuk menyimpan bobot'; end if;
 if p_create then
  insert into public.master_kategori_pekerjaan(id_kategori,nama_kategori,urutan,status_aktif) values(p_id_kategori,p_nama,p_urutan,true);
 else
  update public.master_kategori_pekerjaan set nama_kategori=p_nama,urutan=p_urutan where id_kategori=p_id_kategori;
  if not found then raise exception 'Kategori tidak ditemukan'; end if;
 end if;
 if p_id_tipe is not null then
  select bobot_standar into v_old_weight from public.template_progress_tipe where id_tipe=p_id_tipe and id_kategori=p_id_kategori;
  -- An untouched percentage retains the original precision and ready status.
  if v_old_weight is distinct from p_bobot then
   if v_ready then update public.master_tipe_rumah set perincian_siap=false where id_tipe=p_id_tipe; end if;
   insert into public.template_progress_tipe(id_tipe,id_kategori,bobot_standar) values(p_id_tipe,p_id_kategori,p_bobot)
   on conflict(id_tipe,id_kategori) do update set bobot_standar=excluded.bobot_standar;
   if v_ready then
    -- The existing ready validator checks both exact category totals and item sums.
    begin update public.master_tipe_rumah set perincian_siap=true where id_tipe=p_id_tipe;
    exception when others then raise exception 'Bobot kategori belum sesuai perincian siap: %. Sesuaikan bobot dan item bersama melalui Master Perincian Pekerjaan',sqlerrm; end;
   end if;
  end if;
 end if;
end $$;
revoke all on function public.save_master_category_weight_atomic(text,text,integer,text,numeric,boolean) from public,anon;
grant execute on function public.save_master_category_weight_atomic(text,text,integer,text,numeric,boolean) to authenticated;
