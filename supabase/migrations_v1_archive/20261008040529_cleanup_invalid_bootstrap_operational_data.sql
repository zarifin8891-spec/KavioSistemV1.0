
do $$
declare
  v_sales_count integer;
  v_progress_count integer;
begin
  select count(*)
    into v_sales_count
  from public.sales
  where id_sales in (
    'd78757e3-624a-4b97-adf0-99a74b15e52a'::uuid,
    '9f8df281-1bf5-4410-8020-1c4eb2e90154'::uuid
  )
    and status_sales = 'AKAD'
    and tgl_akad is null
    and id_notaris is null
    and jenis_pembayaran = 'KPR'
    and id_bank is null
    and created_at = '2026-09-07 12:05:14.577422+00'::timestamptz;

  if v_sales_count <> 2 then
    raise exception 'LEGACY CLEANUP ABORTED: expected 2 invalid bootstrap sales, found %', v_sales_count;
  end if;

  select count(*)
    into v_progress_count
  from public.progress_update p
  join public.spk s on s.id_spk = p.id_spk
  where p.id_progress in (
    '5869826e-b0d2-4cd9-b3db-b9cc2860e107'::uuid,
    '30dee1a5-f945-42ff-b5c5-0fc5c4bc91f5'::uuid,
    '90abdaab-af30-4bb1-9302-34e84bf7edf3'::uuid,
    '56e1f6fb-d8ac-49c4-9386-0ce53957d03f'::uuid,
    '6ce0f0c9-5d29-4695-967b-0b10e4d5b7f9'::uuid,
    '19f66e95-ef4a-4dc8-8422-c9d2bffb0b7f'::uuid,
    '13a3d65a-3bb3-4f6c-a572-5d424b9c99df'::uuid
  )
    and p.tanggal_update < s.tgl_spk
    and p.created_at = '2026-09-07 12:05:24.761102+00'::timestamptz;

  if v_progress_count <> 7 then
    raise exception 'LEGACY CLEANUP ABORTED: expected 7 invalid bootstrap progress rows, found %', v_progress_count;
  end if;

  delete from public.progress_update
  where id_progress in (
    '5869826e-b0d2-4cd9-b3db-b9cc2860e107'::uuid,
    '30dee1a5-f945-42ff-b5c5-0fc5c4bc91f5'::uuid,
    '90abdaab-af30-4bb1-9302-34e84bf7edf3'::uuid,
    '56e1f6fb-d8ac-49c4-9386-0ce53957d03f'::uuid,
    '6ce0f0c9-5d29-4695-967b-0b10e4d5b7f9'::uuid,
    '19f66e95-ef4a-4dc8-8422-c9d2bffb0b7f'::uuid,
    '13a3d65a-3bb3-4f6c-a572-5d424b9c99df'::uuid
  );

  delete from public.sales
  where id_sales in (
    'd78757e3-624a-4b97-adf0-99a74b15e52a'::uuid,
    '9f8df281-1bf5-4410-8020-1c4eb2e90154'::uuid
  );
end
$$;
