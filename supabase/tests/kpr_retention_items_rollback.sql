-- Run against the V2 test project as a database administrator.
-- Sets an existing authorized DIREKTUR identity for protected RPCs.
-- Every fixture is rolled back; sequence values may advance.
begin;
select set_config('request.jwt.claim.sub','2d50291d-03e3-46a3-b3d8-c4550bc1bce7',true);
do $test$
declare lot text; lot2 text; bank text; notary text; total numeric; sale uuid; kpr uuid; rc uuid; dp uuid; origin uuid; item uuid; claim uuid; replacement uuid; bal numeric; data jsonb; got_error boolean;
begin
 begin
 select id_kavling into lot from public.master_kavling where status_kavling='AVAILABLE' and harga_jual>1000000 order by id_kavling limit 1;
 select id_kavling into lot2 from public.master_kavling where status_kavling='AVAILABLE' and harga_jual>1000000 and id_kavling<>lot order by id_kavling limit 1;
 select id_bank into bank from public.master_bank where status_aktif and is_kpr limit 1;
 select id_notaris into notary from public.master_notaris where status_aktif limit 1;
 data:=jsonb_build_object('id_kavling',lot,'nama_konsumen','TEST ROLLBACK CASH','status_sales','BOOKING','jenis_pembayaran','CASH_BERTAHAP','tgl_booking',current_date,'tenor_bulan',1,'pola_pelunasan','CICILAN_FLEKSIBEL');
 sale:=public.save_sales_v2_atomic(data);
 if (select tenor_bulan from public.sales_cash_installment_terms where id_sales=sale)<>1 then raise exception 'FAILED tenor1'; end if;
 perform public.save_sales_v2_atomic(data||jsonb_build_object('id_sales',sale,'tenor_bulan',12));
 if (select tenor_bulan from public.sales_cash_installment_terms where id_sales=sale)<>12 then raise exception 'FAILED tenor12'; end if;
 got_error:=false;begin perform public.save_sales_v2_atomic(data||jsonb_build_object('id_sales',sale,'tenor_bulan',13));exception when others then if sqlerrm like '%tenor%' then got_error:=true;else raise;end if;end;
 if not got_error then raise exception 'FAILED tenor13 accepted';end if;
 data:=jsonb_build_object('id_sales',sale,'jenis_penerimaan','BOOKING_FEE','tanggal_penerimaan',current_date,'nominal',1000000,'metode_penerimaan','TRANSFER','id_bank_penerimaan',bank);
 got_error:=false;begin perform public.post_sales_receipt_v2_atomic(data-'id_bank_penerimaan');exception when others then if sqlerrm like '%Kas/Bank%' then got_error:=true;else raise;end if;end;
 if not got_error then raise exception 'FAILED missing account accepted';end if;
 select id_penerimaan into rc from public.post_sales_receipt_v2_atomic(data);
 replacement:=public.amend_sales_receipt_atomic(rc,'Koreksi booking',data||jsonb_build_object('nominal',2000000));
 if (select status from public.sales_receipt where id_penerimaan=rc)<>'BATAL' or (select koreksi_dari from public.sales_receipt where id_penerimaan=replacement)<>rc then raise exception 'FAILED audit correction';end if;
 if (select total_diterima from public.v_sales_financial_position where id_sales=sale)<>2000000 then raise exception 'FAILED sum includes void';end if;
 select id_penerimaan into dp from public.post_sales_receipt_v2_atomic(data||jsonb_build_object('jenis_penerimaan','UANG_MUKA','nominal',3000000));
 got_error:=false;begin perform public.amend_sales_receipt_atomic(replacement,'Invalid delete');exception when others then if sqlerrm like '%Booking fee%' then got_error:=true;else raise;end if;end;
 if not got_error then raise exception 'FAILED prerequisite booking delete';end if;
 perform public.amend_sales_receipt_atomic(dp,'Delete DP');
 perform public.amend_sales_receipt_atomic(replacement,'Delete booking');
 if (select total_diterima from public.v_sales_financial_position where id_sales=sale)<>0 then raise exception 'FAILED void balance';end if;
 kpr:=public.save_sales_v2_atomic(jsonb_build_object('id_kavling',lot2,'nama_konsumen','TEST ROLLBACK KPR','status_sales','BOOKING','jenis_pembayaran','KPR','tgl_booking',current_date,'id_bank',bank));
 data:=data||jsonb_build_object('id_sales',kpr);
 perform public.post_sales_receipt_v2_atomic(data);
 perform public.post_sales_receipt_v2_atomic(data||jsonb_build_object('jenis_penerimaan','UANG_MUKA','nominal',10000000));
 perform public.save_sales_v2_atomic(jsonb_build_object('id_sales',kpr,'nama_konsumen','TEST ROLLBACK KPR','status_sales','AKAD','jenis_pembayaran','KPR','id_bank',bank,'id_notaris',notary,'tgl_akad',current_date,'target_akad',current_date));
 select saldo_piutang into bal from public.v_sales_financial_position where id_sales=kpr;
 got_error:=false;begin perform public.post_sales_receipt_v2_atomic(data||jsonb_build_object('jenis_penerimaan','PENCAIRAN_KPR','nominal',bal,'jaminan',jsonb_build_array(jsonb_build_object('jenis_item','GLOBAL','nominal_tagihan',1000000))));exception when others then if sqlerrm like '%melebihi sisa%' then got_error:=true;else raise;end if;end;
 if not got_error then raise exception 'FAILED KPR retention overbalance';end if;
 if exists(select 1 from public.sales_bank_guarantee_item where id_sales=kpr) then raise exception 'FAILED atomic rollback retention';end if;

 select id_penerimaan into origin from public.post_sales_receipt_v2_atomic(data||jsonb_build_object('jenis_penerimaan','PENCAIRAN_KPR','nominal',bal-4000000,'jaminan',jsonb_build_array(jsonb_build_object('jenis_item','IMB','nominal_tagihan',1000000),jsonb_build_object('jenis_item','SERTIFIKAT','nominal_tagihan',1000000),jsonb_build_object('jenis_item','AIR_LISTRIK','nominal_tagihan',1000000),jsonb_build_object('jenis_item','BESTEK','nominal_tagihan',1000000))));
 if (select count(*) from public.sales_bank_guarantee_item where id_sales=kpr)<>4 or (select saldo_piutang from public.v_sales_financial_position where id_sales=kpr)<>4000000 then raise exception 'FAILED four retained guarantees';end if;
 raise exception using errcode='ZX001',message='ROLLBACK_ALL_SUCCESS';
 exception when sqlstate 'ZX001' then null;
 end;
end $test$;
select 'PASS: post-AKAD KPR receipt with four retained items, cash net of retention, atomic rollback on overbalance' as verification;
rollback;
