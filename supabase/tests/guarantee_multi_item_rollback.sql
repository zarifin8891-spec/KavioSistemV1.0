-- Run against the V2 test project as a database administrator.
-- Sets an existing authorized DIREKTUR identity for protected RPCs.
-- Every fixture is rolled back; sequence values may advance.
begin;
select set_config('request.jwt.claim.sub','2d50291d-03e3-46a3-b3d8-c4550bc1bce7',true);
do $test$
declare lot text; lot2 text; bank text; notary text; total numeric; sale uuid; kpr uuid; kpr2 uuid; rc uuid; dp uuid; origin uuid; item uuid; claim uuid; replacement uuid; batch jsonb; before_cash numeric; before_count integer; bal numeric; data jsonb; got_error boolean;
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

 -- The UI passes gross disbursement; the stored receipt remains cash net.
 data:=data||jsonb_build_object('jenis_penerimaan','PENCAIRAN_KPR','nominal_bruto',bal,'jaminan',jsonb_build_array(jsonb_build_object('jenis_item','GLOBAL','nominal_tagihan',bal+1)));
 got_error:=false;begin perform public.post_sales_receipt_v2_atomic(data);exception when others then if sqlerrm like '%khairan%' or sqlerrm like '%melebihi pencairan%' then got_error:=true;else raise;end if;end;
 if not got_error then raise exception 'FAILED held greater than gross';end if;
 if exists(select 1 from public.sales_bank_guarantee_item where id_sales=kpr) then raise exception 'FAILED invalid atomic rollback';end if;
 got_error:=false;begin perform public.post_sales_receipt_v2_atomic(data||jsonb_build_object('nominal_bruto',bal+1,'jaminan','[]'::jsonb));exception when others then if sqlerrm like '%melebihi sisa%' then got_error:=true;else raise;end if;end;
 if not got_error then raise exception 'FAILED gross overbalance';end if;
 -- Exact 100% withholding is valid: cash zero, bank receivable equals gross.
 select id_penerimaan into origin from public.post_sales_receipt_v2_atomic(data||jsonb_build_object('jaminan',jsonb_build_array(jsonb_build_object('jenis_item','GLOBAL','nominal_tagihan',bal))));
 if (select nominal from public.sales_receipt where id_penerimaan=origin)<>0 or (select saldo_piutang from public.v_sales_financial_position where id_sales=kpr)<>0 then raise exception 'FAILED zero cash with full bank receivable';end if;
 perform public.amend_sales_receipt_atomic(origin,'Rollback pending guarantee');
 if (select saldo_piutang from public.v_sales_financial_position where id_sales=kpr)<>bal or exists(select 1 from public.sales_bank_guarantee_item where id_sales=kpr) then raise exception 'FAILED void restores consumer balance';end if;
 -- Four items, then amend before any claim. Values stay gross during correction.
 data:=data||jsonb_build_object('jaminan',jsonb_build_array(jsonb_build_object('jenis_item','IMB','nominal_tagihan',1000000),jsonb_build_object('jenis_item','SERTIFIKAT','nominal_tagihan',1000000),jsonb_build_object('jenis_item','AIR_LISTRIK','nominal_tagihan',1000000),jsonb_build_object('jenis_item','BESTEK','nominal_tagihan',1000000)));
 select id_penerimaan into origin from public.post_sales_receipt_v2_atomic(data);
 origin:=public.amend_sales_receipt_atomic(origin,'Correct same gross',data);
 if (select count(*) from public.sales_bank_guarantee_item where id_sales=kpr)<>4 or (select saldo_piutang from public.v_sales_financial_position where id_sales=kpr)<>0 then raise exception 'FAILED consumer settled via bank transfer';end if;
 if (select nominal from public.sales_receipt where id_penerimaan=origin)<>bal-4000000 then raise exception 'FAILED net cash';end if;
 if (select sum(saldo_piutang_bank) from public.v_sales_bank_receivable where id_sales=kpr)<>4000000 then raise exception 'FAILED bank receivable';end if;
 if (select sum(nilai_mutasi) from public.v_sales_bank_movement where id_penerimaan=origin)<>bal-4000000 or (select count(*) from public.v_sales_bank_movement where id_penerimaan=origin)<>2 then raise exception 'FAILED gross debit / withholding credit';end if;
 select id_jaminan into item from public.sales_bank_guarantee_item where id_sales=kpr and jenis_item='IMB';
 perform public.submit_sales_bank_guarantee_claim_atomic(item,current_date,'TEST CLAIM');
 data:=jsonb_build_object('id_sales',kpr,'jenis_penerimaan','PENCAIRAN_DANA_JAMINAN','tanggal_penerimaan',current_date,'nominal',400000,'id_jaminan',item,'metode_penerimaan','TRANSFER','id_bank_penerimaan',bank);
 select id_penerimaan into claim from public.post_sales_receipt_v2_atomic(data);
 if (select saldo_piutang from public.v_sales_financial_position where id_sales=kpr)<>0 or (select saldo_piutang_bank from public.v_sales_bank_receivable where id_jaminan=item)<>600000 then raise exception 'FAILED partial claim affects bank only';end if;
 perform public.post_sales_receipt_v2_atomic(data||jsonb_build_object('nominal',600000));
 if (select status from public.sales_bank_guarantee_item where id_jaminan=item)<>'DICAIRKAN' or (select saldo_piutang_bank from public.v_sales_bank_receivable where id_jaminan=item)<>0 then raise exception 'FAILED final claim';end if;
 if (select total_pelunasan_konsumen from public.v_sales_financial_position where id_sales=kpr)<>(select total_tagihan from public.v_sales_financial_position where id_sales=kpr) then raise exception 'FAILED double consumer settlement';end if;
 replacement:=public.amend_sales_receipt_atomic(claim,'Correct partial claim',data||jsonb_build_object('nominal',300000));
 if (select saldo_piutang_bank from public.v_sales_bank_receivable where id_jaminan=item)<>100000 then raise exception 'FAILED correction of completed bank claim';end if;
 got_error:=false;begin perform public.amend_sales_receipt_atomic(origin,'Invalid origin delete after claim');exception when others then if (sqlerrm like '%riwayat pencairan%' or sqlerrm like '%sudah diajukan/dicairkan%') then got_error:=true;else raise;end if;end;
 if not got_error then raise exception 'FAILED origin deletion after bank claim';end if;

 -- Multi-item submission and partial collection on the same bank.
 select jsonb_agg(jsonb_build_object('id_jaminan',id_jaminan) order by id_jaminan) into batch
 from (select id_jaminan from public.sales_bank_guarantee_item where id_sales=kpr and status='BELUM_DIAJUKAN' order by id_jaminan limit 2)g;
 if jsonb_array_length(batch)<>2 then raise exception 'FAILED batch fixtures';end if;
 got_error:=false;begin perform public.process_sales_guarantee_batch_atomic(jsonb_build_object('mode','PENGAJUAN','id_bank_kpr','WRONG_BANK','tanggal',current_date,'items',batch));exception when others then if sqlerrm like '%bank yang dipilih%' then got_error:=true;else raise;end if;end;
 if not got_error then raise exception 'FAILED wrong bank accepted';end if;
 got_error:=false;begin perform public.process_sales_guarantee_batch_atomic(jsonb_build_object('mode','PENGAJUAN','id_bank_kpr',bank,'tanggal',current_date,'items',batch||jsonb_build_array(batch->0)));exception when others then if sqlerrm like '%berulang%' then got_error:=true;else raise;end if;end;
 if not got_error then raise exception 'FAILED duplicate accepted';end if;
 perform public.process_sales_guarantee_batch_atomic(jsonb_build_object('mode','PENGAJUAN','id_bank_kpr',bank,'tanggal',current_date,'items',batch));
 if (select count(*) from public.sales_bank_guarantee_item where id_jaminan in (select (i->>'id_jaminan')::uuid from jsonb_array_elements(batch)i) and status='DIAJUKAN_KE_BANK')<>2 then raise exception 'FAILED batch submit';end if;
 select count(*) into before_count from public.sales_receipt where id_sales=kpr;
 select sum(nilai_mutasi) into before_cash from public.v_sales_bank_movement where id_sales=kpr;
 -- First item would succeed; last item exceeds remaining guarantee. All rollback.
 got_error:=false;begin perform public.process_sales_guarantee_batch_atomic(jsonb_build_object('mode','PENCAIRAN','id_bank_kpr',bank,'tanggal',current_date,'id_bank_penerimaan',bank,'metode_penerimaan','TRANSFER','items',jsonb_build_array((batch->0)||jsonb_build_object('nominal',200000),(batch->1)||jsonb_build_object('nominal',1000001))));exception when others then if sqlerrm like '%MELEBIHI NILAI TAGIHAN%' then got_error:=true;else raise;end if;end;
 if not got_error or (select count(*) from public.sales_receipt where id_sales=kpr)<>before_count or (select sum(nilai_mutasi) from public.v_sales_bank_movement where id_sales=kpr)<>before_cash then raise exception 'FAILED batch disbursement atomic rollback';end if;
 perform public.process_sales_guarantee_batch_atomic(jsonb_build_object('mode','PENCAIRAN','id_bank_kpr',bank,'tanggal',current_date,'id_bank_penerimaan',bank,'metode_penerimaan','TRANSFER','items',jsonb_build_array((batch->0)||jsonb_build_object('nominal',200000),(batch->1)||jsonb_build_object('nominal',300000))));
 if (select sum(nilai_mutasi) from public.v_sales_bank_movement where id_sales=kpr)<>before_cash+500000 or (select saldo_piutang from public.v_sales_financial_position where id_sales=kpr)<>0 then raise exception 'FAILED batch bank/consumer balances';end if;

 -- Batch across two different kavlings on one KPR bank.
 select id_kavling into lot from public.master_kavling where status_kavling='AVAILABLE' and harga_jual>10000000 order by id_kavling limit 1;
 kpr2:=public.save_sales_v2_atomic(jsonb_build_object('id_kavling',lot,'nama_konsumen','TEST MULTI KAVLING','status_sales','BOOKING','jenis_pembayaran','KPR','tgl_booking',current_date,'id_bank',bank));
 data:=jsonb_build_object('id_sales',kpr2,'jenis_penerimaan','BOOKING_FEE','tanggal_penerimaan',current_date,'nominal',1000000,'metode_penerimaan','TRANSFER','id_bank_penerimaan',bank);
 perform public.post_sales_receipt_v2_atomic(data);
 perform public.post_sales_receipt_v2_atomic(data||jsonb_build_object('jenis_penerimaan','UANG_MUKA','nominal',1000000));
 perform public.save_sales_v2_atomic(jsonb_build_object('id_sales',kpr2,'nama_konsumen','TEST MULTI KAVLING','status_sales','AKAD','jenis_pembayaran','KPR','id_bank',bank,'id_notaris',notary,'tgl_akad',current_date,'target_akad',current_date));
 select saldo_piutang into bal from public.v_sales_financial_position where id_sales=kpr2;
 perform public.post_sales_receipt_v2_atomic(data||jsonb_build_object('jenis_penerimaan','PENCAIRAN_KPR','nominal_bruto',bal,'jaminan',jsonb_build_array(jsonb_build_object('jenis_item','GLOBAL','nominal_tagihan',1000000))));
 select jsonb_agg(jsonb_build_object('id_jaminan',id_jaminan)) into batch from public.sales_bank_guarantee_item where id_sales in (kpr,kpr2) and status='BELUM_DIAJUKAN';
 if jsonb_array_length(batch)<>2 then raise exception 'FAILED multiple kavling fixtures';end if;
 perform public.process_sales_guarantee_batch_atomic(jsonb_build_object('mode','PENGAJUAN','id_bank_kpr',bank,'tanggal',current_date,'items',batch));
 select jsonb_agg(i||jsonb_build_object('nominal',200000)) into batch from jsonb_array_elements(batch)i;
 perform public.process_sales_guarantee_batch_atomic(jsonb_build_object('mode','PENCAIRAN','id_bank_kpr',bank,'tanggal',current_date,'id_bank_penerimaan',bank,'metode_penerimaan','TRANSFER','items',batch));
 if exists(select 1 from public.v_sales_bank_receivable where id_jaminan in (select (i->>'id_jaminan')::uuid from jsonb_array_elements(batch)i) and saldo_piutang_bank<>800000) or exists(select 1 from public.v_sales_financial_position where id_sales in (kpr,kpr2) and saldo_piutang<>0) then raise exception 'FAILED multiple kavling settlement';end if;
 raise exception using errcode='ZX001',message='ROLLBACK_ALL_SUCCESS';
 exception when sqlstate 'ZX001' then null;
 end;
end $test$;
select 'PASS: guarantee multi-item submission, partial collection, duplicate/mixed-bank rejection and rollback on failed second item; consumer balance unchanged' as verification;
rollback;
