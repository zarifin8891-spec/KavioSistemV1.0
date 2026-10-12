do $$ declare body text;updated text;
begin
 select pg_get_functiondef('public.kavio_normalize_contract(jsonb,jsonb)'::regprocedure) into body;
 updated:=replace(body,'if kind not in (','if kind is null or kind not in (');
 if updated=body then raise exception 'Contract kind validation anchor missing';end if;
 execute updated;
 select pg_get_functiondef('public.kavio_validate_financial_proposal(text,uuid,jsonb,jsonb)'::regprocedure) into body;
 updated:=replace(body,'if p_after->>''keputusan'' not in (','if nullif(p_after->>''keputusan'','''') is null or p_after->>''keputusan'' not in (');
 if updated=body then raise exception 'Refund decision validation anchor missing';end if;
 execute updated;
 select pg_get_functiondef('public.submit_sales_financial_approval(uuid,text,jsonb,text)'::regprocedure) into body;
 updated:=replace(body,'if auth.uid() is null or p_jenis not in (','if auth.uid() is null or p_jenis is null or p_jenis not in (');
 if updated=body then raise exception 'Approval kind validation anchor missing';end if;
 execute updated;
end $$;

