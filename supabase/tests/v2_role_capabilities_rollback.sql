-- Capability matrix regression. All temporary identities are rolled back.
-- Does not simulate browser login or certify every RPC / table policy.
begin;
do $test$
declare
 actor uuid; role_name text; action_name text; allowed boolean; checks integer:=0;
 expected jsonb:='{"DIREKTUR": ["MASTER_WRITE", "SALES_WRITE", "SPK_WRITE", "PROGRESS_WRITE", "SITEPLAN_MAP", "USER_MANAGE", "MATERIAL_CATALOG_WRITE", "MATERIAL_WAREHOUSE_WRITE", "MATERIAL_REQUEST_WRITE", "MATERIAL_USE_WRITE", "PAYMENT_PLAN_WRITE", "PAYMENT_RECEIPT_WRITE", "WAGE_PAYMENT_WRITE", "WAGE_PAYMENT_READ", "RETENTION_APPROVE", "FINANCIAL_APPROVE", "MATERIAL_LOSS_APPROVE", "SALES_CONTRACT_READ"], "ADMIN": ["MASTER_WRITE", "SALES_WRITE", "SPK_WRITE", "PROGRESS_WRITE", "SITEPLAN_MAP", "USER_MANAGE", "MATERIAL_CATALOG_WRITE", "MATERIAL_WAREHOUSE_WRITE", "MATERIAL_REQUEST_WRITE", "MATERIAL_USE_WRITE", "PAYMENT_PLAN_WRITE", "PAYMENT_RECEIPT_WRITE", "WAGE_PAYMENT_WRITE", "WAGE_PAYMENT_READ", "SALES_CONTRACT_READ"], "MARKETING": ["SALES_WRITE", "SALES_CONTRACT_READ"], "PELAKSANA": ["SPK_WRITE", "PROGRESS_WRITE", "MATERIAL_REQUEST_WRITE", "MATERIAL_USE_WRITE"], "GUDANG": ["MATERIAL_WAREHOUSE_WRITE", "MATERIAL_REQUEST_WRITE", "MATERIAL_USE_WRITE"], "KEUANGAN": ["PAYMENT_PLAN_WRITE", "PAYMENT_RECEIPT_WRITE", "WAGE_PAYMENT_WRITE", "WAGE_PAYMENT_READ", "SALES_CONTRACT_READ"], "USER": []}'::jsonb;
begin
 for role_name in select jsonb_object_keys(expected) loop
  actor:=gen_random_uuid();
  insert into auth.users(id,email) values(actor,'access-test-'||actor::text||'@example.invalid');
  insert into public.user_profiles(user_id,role,status_aktif,nama) values(actor,role_name,true,'TEST ACCESS') on conflict(user_id) do update set role=excluded.role,status_aktif=true;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  execute 'set local role authenticated';
  for action_name in select jsonb_array_elements_text('["MASTER_WRITE", "SALES_WRITE", "SPK_WRITE", "PROGRESS_WRITE", "SITEPLAN_MAP", "USER_MANAGE", "MATERIAL_CATALOG_WRITE", "MATERIAL_WAREHOUSE_WRITE", "MATERIAL_REQUEST_WRITE", "MATERIAL_USE_WRITE", "PAYMENT_PLAN_WRITE", "PAYMENT_RECEIPT_WRITE", "WAGE_PAYMENT_WRITE", "WAGE_PAYMENT_READ", "RETENTION_APPROVE", "FINANCIAL_APPROVE", "MATERIAL_LOSS_APPROVE", "SALES_CONTRACT_READ"]'::jsonb) loop
   allowed:=(expected->role_name) ? action_name;
   if public.kavio_can_action(action_name) is distinct from allowed then raise exception 'Capability mismatch: % / %',role_name,action_name;end if;
   checks:=checks+1;
  end loop;
  if public.kavio_can_action('UNKNOWN_ACTION') then raise exception 'Unknown capability allowed';end if;
  execute 'reset role';
  update public.user_profiles set status_aktif=false where user_id=actor;
  execute 'set local role authenticated';
  for action_name in select jsonb_array_elements_text('["MASTER_WRITE", "SALES_WRITE", "SPK_WRITE", "PROGRESS_WRITE", "SITEPLAN_MAP", "USER_MANAGE", "MATERIAL_CATALOG_WRITE", "MATERIAL_WAREHOUSE_WRITE", "MATERIAL_REQUEST_WRITE", "MATERIAL_USE_WRITE", "PAYMENT_PLAN_WRITE", "PAYMENT_RECEIPT_WRITE", "WAGE_PAYMENT_WRITE", "WAGE_PAYMENT_READ", "RETENTION_APPROVE", "FINANCIAL_APPROVE", "MATERIAL_LOSS_APPROVE", "SALES_CONTRACT_READ"]'::jsonb) loop
   if public.kavio_can_action(action_name) then raise exception 'Inactive user allowed: % / %',role_name,action_name;end if;
   checks:=checks+1;
  end loop;
  execute 'reset role';
 end loop;
 perform set_config('request.jwt.claim.sub','',true);
 execute 'set local role authenticated';
 if public.kavio_can_action('MASTER_WRITE') then raise exception 'Missing identity allowed';end if;
 execute 'reset role';
 execute 'set local role anon';
 if has_function_privilege(current_user,'public.kavio_can_action(text)','EXECUTE') then raise exception 'Anonymous capability RPC executable';end if;
 execute 'reset role';
 raise notice 'PASS: % capability checks; unknown/inactive/missing identity/anonymous denied',checks;
end $test$;
rollback;
select 'PASS: 252 capability checks across seven active and inactive roles; all fixture identities rolled back' verification;
