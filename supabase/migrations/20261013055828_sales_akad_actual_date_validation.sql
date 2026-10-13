CREATE OR REPLACE FUNCTION public.validate_sales_business_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.status_sales not in ('BOOKING','DP','PROSES_KPR','AKAD','BATAL') then raise exception 'STATUS SALES TIDAK VALID'; end if;
  if new.jenis_pembayaran not in ('KPR','CASH','CASH_BERTAHAP') then raise exception 'JENIS PEMBAYARAN TIDAK VALID'; end if;
  if new.jenis_pembayaran='KPR' and new.id_bank is null then raise exception 'BANK KPR WAJIB DIISI'; end if;
  if new.jenis_pembayaran<>'KPR' and new.id_bank is not null then raise exception 'BANK HANYA DIISI UNTUK KPR'; end if;
  if new.status_sales='AKAD' and (new.tgl_akad is null or new.id_notaris is null) then
    raise exception 'TANGGAL AKAD DAN NOTARIS WAJIB DIISI UNTUK STATUS AKAD';
  end if;
  if new.status_sales<>'AKAD' and (new.tgl_akad is not null or new.id_notaris is not null) then
    raise exception 'TANGGAL AKAD DAN NOTARIS HANYA DIISI SAAT STATUS AKAD';
  end if;
  if new.tgl_booking is not null and new.target_akad is not null and new.target_akad < new.tgl_booking then
    raise exception 'TARGET AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING';
  end if;
  if new.tgl_booking is not null and new.tgl_akad is not null and new.tgl_akad < new.tgl_booking then
    raise exception 'TANGGAL AKAD TIDAK BOLEH SEBELUM TANGGAL BOOKING';
  end if;
  if new.status_sales='BATAL' and new.status_aktif then raise exception 'SALES BATAL TIDAK BOLEH AKTIF'; end if;
  return new;
end;
$function$
;
