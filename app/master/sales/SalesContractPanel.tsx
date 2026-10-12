'use client';
import KavioActionGate from '../../components/KavioActionGate';
import KavioTransactionModal from '../../components/KavioTransactionModal';
import KavioFormActions from '../../components/KavioFormActions';
import KavioMoneyField from '../../components/KavioMoneyField';
import KavioFinancialApprovalHistory,{type FinancialProposal} from '../../components/KavioFinancialApprovalHistory';
import SalesPaymentFields from './SalesPaymentFields';
import {submitFinancialProposal} from '../../lib/financial-approval-actions';
export default function SalesContractPanel({id,initial,banks,requests,active}:{id:string;initial:Record<string,string|number|null>;banks:{id_bank:string;nama_bank:string}[];requests:FinancialProposal[];active:boolean}) {
 const fields=[['harga_jual','HARGA JUAL DASAR'],['biaya_penambahan_bangunan','TAMBAHAN BANGUNAN'],['biaya_kelebihan_tanah','KELEBIHAN TANAH'],['biaya_hook','LOKASI HOOK'],['biaya_notaris','NOTARIS'],['biaya_akad','BIAYA AKAD'],['biaya_lainnya','BIAYA LAINNYA']];
 return <KavioActionGate action="SALES_CONTRACT_READ"><section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">REVISI PERJANJIAN SALES</h2><p className="kavio-panel-note">Harga, biaya dan ketentuan pembayaran baru berlaku setelah disetujui Direktur.</p></div>{active&&!requests.some(r=>r.status==='DIAJUKAN')&&<KavioActionGate action="SALES_WRITE"><KavioTransactionModal title="Ajukan Revisi Perjanjian" focusIds={['contract_reason:'+id]}><form action={submitFinancialProposal} className="kavio-form kavio-panel-body"><input type="hidden" name="id_sales" value={id}/><input type="hidden" name="jenis" value="PERJANJIAN"/><input type="hidden" name="focus" value={'contract_reason:'+id}/><SalesPaymentFields payment={String(initial.jenis_pembayaran)} bank={initial.id_bank as string|null} banks={banks} tenor={Number(initial.tenor_bulan)||6} pattern={String(initial.pola_pelunasan??'CICILAN_FLEKSIBEL')}/>{fields.map(([name,label])=><KavioMoneyField key={name} name={name} label={label} initial={Number(initial[name])||0}/>)}<label className="kavio-field kavio-field-wide"><span>ALASAN REVISI</span><input id={'contract_reason:'+id} name="alasan" required maxLength={500}/></label><KavioFormActions><button className="kavio-button">AJUKAN KE DIREKTUR</button></KavioFormActions></form></KavioTransactionModal></KavioActionGate>}</div><KavioFinancialApprovalHistory requests={requests} banks={banks}/></section></KavioActionGate>;
}

