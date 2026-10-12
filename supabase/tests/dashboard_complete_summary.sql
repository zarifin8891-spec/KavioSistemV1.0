-- Creates 1,050 active lots/sales and 60 configured Fasum SPKs, then rolls back.
begin;
select set_config('request.jwt.claim.sub','2d50291d-03e3-46a3-b3d8-c4550bc1bce7',true);
do $test$
declare prefix text:='TEST-AGG-'||substr(gen_random_uuid()::text,1,8); typ text;office text;mandor text;
 before_row record;after_row record;work uuid;item uuid;i integer;expected bigint;avg_all numeric;avg_top numeric;
 today date:=(now() at time zone 'Asia/Jakarta')::date;
begin
 select * into before_row from public.v_dashboard_summary;
 select id_tipe into typ from public.master_tipe_rumah where status_aktif limit 1;
 select id_kantor,id_mandor into office,mandor from public.master_mandor where status_aktif limit 1;
 if typ is null or mandor is null then raise exception 'Aggregate test needs active type and mandor masters';end if;
 insert into public.master_kavling(id_kavling,blok,no_kavling,id_tipe,status_kavling,status_aktif)
 select prefix||'-'||g.n,prefix,g.n::text,typ,'AVAILABLE',g.n<=1050 from generate_series(1,1051) g(n);
 insert into public.sales(id_kavling,nama_konsumen,status_sales,jenis_pembayaran,tgl_booking,status_aktif)
 select prefix||'-'||g.n,prefix,'BOOKING','CASH',today,true from generate_series(1,1050) g(n);
 insert into public.sales(id_kavling,nama_konsumen,status_sales,jenis_pembayaran,tgl_booking,status_aktif)
 values(prefix||'-1',prefix||' historical cancellation','BATAL','CASH',today,false);
 for i in 1..60 loop
  work:=public.create_fasum_spk_atomic(prefix||' Fasum '||i,today-10,case when i<=50 then today-1 else today+30 end,office,mandor,'[{"nama_pekerjaan":"Pekerjaan","bobot":1}]');
  select id_item into item from public.spk_work_item where id_spk=work;
  perform public.configure_spk_work_atomic(work,'KATEGORI',0,jsonb_build_array(jsonb_build_object('id_kategori',item,'bobot',1)),'[]');
  perform public.activate_spk_atomic(work);
  if i>50 then perform public.insert_progress_work_item_batch_atomic(work,today,jsonb_build_array(jsonb_build_object('id_item',item,'progress_percent',50)));end if;
 end loop;
 execute 'set local role authenticated';
 select * into after_row from public.v_dashboard_summary;
 if (after_row.kavling->>'total')::bigint<>(before_row.kavling->>'total')::bigint+1050 then raise exception 'Kavling aggregate truncated or inactive counted';end if;
 if (after_row.sales->>'total')::bigint<>(before_row.sales->>'total')::bigint+1051 or (after_row.sales->>'booking')::bigint<>(before_row.sales->>'booking')::bigint+1050 or (after_row.sales->>'batal')::bigint<>(before_row.sales->>'batal')::bigint+1 then raise exception 'Sales pipeline truncated or historical statuses omitted';end if;
 if (after_row.sales->>'terjual')::bigint<>(before_row.sales->>'terjual')::bigint+1050 then raise exception 'Terjual distinct/lifecycle mismatch';end if;
 select count(*),avg(health_score) into expected,avg_all from public.v_decision_engine where status_spk<>'DRAFT';
 if (after_row.health->>'total')::bigint<>expected or expected<>(before_row.health->>'total')::bigint+60 or abs((after_row.health->>'avg_health')::numeric-avg_all)>.000000001 then raise exception 'Health aggregate not full dataset';end if;
 select avg(health_score) into avg_top from (select health_score from public.v_decision_engine order by health_score,id_spk limit 50) q;
 if abs(avg_all-avg_top)<1 then raise exception 'Fixture does not distinguish full health from worst 50';end if;
 select count(*) into expected from public.v_decision_engine where health_level='SEHAT';
 if (after_row.health->>'sehat')::bigint<>expected then raise exception 'Health distribution truncated';end if;
 select count(*) into expected from public.v_sales_financial_position where status_aktif;
 if expected<1050 then raise exception 'Financial position fixture incomplete';end if;
 execute 'reset role';
end $test$;
rollback;
select 'PASS: >1000 lots/sales, inactive exclusion, historical cancellation, distinct terjual, >50 SPK and full Project Health under authenticated RLS' verification;
