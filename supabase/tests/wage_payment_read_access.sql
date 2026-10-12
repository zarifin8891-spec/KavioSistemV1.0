-- Requires operational masters and at least one wage accrual/payment fixture.
-- Uses existing source IDs only as references; every new user/payment is rolled back.
begin;
do $test$
declare actor uuid; seed uuid:=gen_random_uuid(); source public.wage_payment%rowtype;
 roles text[]:=array['DIREKTUR','ADMIN','KEUANGAN','MARKETING','PELAKSANA','GUDANG','USER'];
 role_name text; allowed boolean; seen bigint; failed boolean;
begin
 select * into source from public.wage_payment h where h.id_bank is not null and exists(select 1 from public.wage_payment_item i where i.id_pembayaran=h.id_pembayaran) limit 1;
 if source.id_pembayaran is null then raise exception 'Read-access test needs an existing wage payment with detail';end if;
 insert into public.wage_payment(id_pembayaran,request_key,nomor,tanggal,jenis,id_mandor,id_bank,status,total,dibuat_oleh,dibayar_oleh)
 values(seed,gen_random_uuid(),'TEST-READ-'||seed::text,source.tanggal,'UPAH',source.id_mandor,source.id_bank,'POSTED',source.total,source.dibuat_oleh,source.dibuat_oleh);
 insert into public.wage_payment_item(id_pembayaran,id_progress_detail,nominal)
 select seed,id_progress_detail,nominal from public.wage_payment_item where id_pembayaran=source.id_pembayaran;
 foreach role_name in array roles loop
  actor:=gen_random_uuid();
  insert into auth.users(id,email) values(actor,'read-test-'||actor::text||'@example.invalid');
  insert into public.user_profiles(user_id,role,status_aktif,nama) values(actor,role_name,true,'TEST READ') on conflict(user_id) do update set role=excluded.role,status_aktif=true;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  execute 'set local role authenticated';
  allowed:=role_name in ('DIREKTUR','ADMIN','KEUANGAN');
  if public.kavio_can_action('WAGE_PAYMENT_READ') is distinct from allowed then raise exception 'Read capability mismatch: %',role_name;end if;
  select count(*) into seen from public.wage_payment where id_pembayaran=seed;
  if (seen>0) is distinct from allowed then raise exception 'Header read mismatch: %',role_name;end if;
  select count(*) into seen from public.wage_payment_item where id_pembayaran=seed;
  if (seen>0) is distinct from allowed then raise exception 'Item read mismatch: %',role_name;end if;
  select count(*) into seen from public.v_wage_payment_detail where id_pembayaran=seed;
  if (seen>0) is distinct from allowed then raise exception 'Proof view read mismatch: %',role_name;end if;
  select count(*) into seen from public.v_wage_bank_movement where id_pembayaran=seed;
  if (seen>0) is distinct from allowed then raise exception 'Bank view read mismatch: %',role_name;end if;
  select count(*) into seen from public.v_wage_settlement;
  if (seen>0) is distinct from allowed then raise exception 'Settlement read mismatch: %',role_name;end if;
  failed:=false;begin update public.wage_payment set keterangan='FORBIDDEN' where id_pembayaran=seed;exception when insufficient_privilege then failed:=true;end;
  if not failed then raise exception 'Direct update permitted: %',role_name;end if;
  failed:=false;begin delete from public.wage_payment_item where id_pembayaran=seed;exception when insufficient_privilege then failed:=true;end;
  if not failed then raise exception 'Direct delete permitted: %',role_name;end if;
  failed:=false;begin insert into public.wage_payment_item(id_pembayaran,id_progress_detail,nominal) values(seed,gen_random_uuid(),1);exception when insufficient_privilege then failed:=true;end;
  if not failed then raise exception 'Direct insert permitted: %',role_name;end if;
  execute 'reset role';
 end loop;
 -- Inactive users lose financial access even when their role normally grants it.
 update public.user_profiles set role='DIREKTUR',status_aktif=false where user_id=actor;
 execute 'set local role authenticated';
 if public.kavio_can_action('WAGE_PAYMENT_READ') or exists(select 1 from public.wage_payment where id_pembayaran=seed) or exists(select 1 from public.v_wage_settlement) then raise exception 'Inactive director read permitted';end if;
 execute 'reset role';
 execute 'set local role anon';
 failed:=false;begin perform 1 from public.wage_payment;exception when insufficient_privilege then failed:=true;end;
 if not failed then raise exception 'Anonymous table read granted';end if;
 failed:=false;begin perform 1 from public.v_wage_settlement;exception when insufficient_privilege then failed:=true;end;
 if not failed then raise exception 'Anonymous settlement read granted';end if;
 execute 'reset role';
end $test$;
rollback;
select 'PASS: seven roles, inactive/anon, payment header/detail/proof/cash/settlement, direct writes denied' verification;
