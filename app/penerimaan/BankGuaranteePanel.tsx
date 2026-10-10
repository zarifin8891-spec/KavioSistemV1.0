'use client';

import GuaranteeBatchForm,{GuaranteeProps as Props} from './GuaranteeBatchForm';
import KavioActionGate from '../components/KavioActionGate';
import KavioTransactionModal from '../components/KavioTransactionModal';
import {formatKavioMoney} from '../lib/number-format';



export default function BankGuaranteePanel(props:Props){
  const {sales,items,accounts,received}=props;
  const ready=items.filter(item=>item.status==='DIAJUKAN_KE_BANK'&&Number(item.nominal_tagihan)>(received[item.id_jaminan]??0)&&sales.some(s=>s.id_sales===item.id_sales));
  return <section className="kavio-panel collection-actions">
    <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">DANA JAMINAN</h2><div className="kavio-panel-note">Dana ditahan dicatat bersama pencairan KPR. Ajukan ke bank sebelum mencatat pencairannya.</div></div>
      <KavioActionGate action="PAYMENT_RECEIPT_WRITE"><div className="kavio-master-row-actions"><KavioTransactionModal title="PENGAJUAN DANA JAMINAN" focusIds={['guarantee_batch_claim']}><GuaranteeBatchForm {...props} mode="PENGAJUAN" focus="guarantee_batch_claim"/></KavioTransactionModal><KavioTransactionModal title="PENCAIRAN DANA JAMINAN" focusIds={['guarantee_receipt_select']}><GuaranteeBatchForm {...props} mode="PENCAIRAN" focus="guarantee_receipt_select"/></KavioTransactionModal></div></KavioActionGate>
    </div>
    <div className="kavio-panel-body collection-note">{ready.length} item siap dicairkan. Pencairan dapat dicatat bertahap atau sekaligus.</div>
    <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>KAVLING</th><th>KONSUMEN</th><th>BANK KPR</th><th>ITEM</th><th>TAGIHAN</th><th>DITERIMA</th><th>SISA</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>
      {items.map(item=>{
        const sale=sales.find(s=>s.id_sales===item.id_sales);
        const paid=received[item.id_jaminan]??0;
        const due=Number(item.nominal_tagihan)-paid;
        return <tr key={item.id_jaminan}><td>{sale?.id_kavling??'—'}</td><td>{sale?.nama_konsumen??'—'}</td><td>{accounts.find(a=>a.id_bank===item.id_bank_kpr)?.nama_bank??'—'}</td><td>{item.jenis_item.replaceAll('_',' & ')}</td><td>{formatKavioMoney(item.nominal_tagihan)}</td><td>{formatKavioMoney(paid)}</td><td>{formatKavioMoney(due)}</td><td>{item.status.replaceAll('_',' ')}</td><td>
          <KavioActionGate action="PAYMENT_RECEIPT_WRITE">{item.status==='BELUM_DIAJUKAN'?<KavioTransactionModal title="AJUKAN KE BANK" focusIds={[`guarantee_claim:${item.id_jaminan}`]}>
            <GuaranteeBatchForm {...props} mode="PENGAJUAN" initialId={item.id_jaminan} focus={`guarantee_claim:${item.id_jaminan}`}/>
          </KavioTransactionModal>:due>0&&sale&&<KavioTransactionModal title="PENCAIRAN" focusIds={[`guarantee_receipt:${item.id_jaminan}`]}>
            <GuaranteeBatchForm {...props} mode="PENCAIRAN" initialId={item.id_jaminan} focus={`guarantee_receipt:${item.id_jaminan}`}/>
          </KavioTransactionModal>}</KavioActionGate>
        </td></tr>;
      })}
      {!items.length&&<tr><td colSpan={9} className="kavio-empty">BELUM ADA DANA JAMINAN. INPUT BERSAMA PENCAIRAN KPR PADA TAB PIUTANG.</td></tr>}
    </tbody></table></div>
  </section>;
}
