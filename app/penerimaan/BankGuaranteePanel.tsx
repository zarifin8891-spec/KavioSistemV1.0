'use client';

import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {submitBankGuaranteeClaim} from './actions';
import KavioActionGate from '../components/KavioActionGate';
import KavioTransactionModal from '../components/KavioTransactionModal';
import KavioFormActions from '../components/KavioFormActions';
import {ReceiptForm,Sale,Account} from './ReceiptEntryPanel';
import {formatKavioMoney} from '../lib/number-format';

type Guarantee={id_bank_kpr?:string|null;id_jaminan:string;id_sales:string;jenis_item:string;nominal_tagihan:number|string;status:string};
type Props={sales:Sale[];items:Guarantee[];accounts:Account[];received:Record<string,number>};

export default function BankGuaranteePanel(props:Props){
  const {sales,items,accounts,received}=props;
  const ready=items.filter(item=>item.status==='DIAJUKAN_KE_BANK'&&Number(item.nominal_tagihan)>(received[item.id_jaminan]??0)&&sales.some(s=>s.id_sales===item.id_sales));
  return <section className="kavio-panel collection-actions">
    <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">DANA JAMINAN</h2><div className="kavio-panel-note">Dana ditahan dicatat bersama pencairan KPR. Ajukan ke bank sebelum mencatat pencairannya.</div></div>
      <KavioActionGate action="PAYMENT_RECEIPT_WRITE"><KavioTransactionModal title="PENCAIRAN DANA JAMINAN" focusIds={['guarantee_receipt_select']}><GuaranteeDisbursementForm {...props} ready={ready}/></KavioTransactionModal></KavioActionGate>
    </div>
    <div className="kavio-panel-body collection-note">{ready.length} item siap dicairkan. Pencairan dapat dicatat bertahap atau sekaligus.</div>
    <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>KAVLING</th><th>KONSUMEN</th><th>BANK KPR</th><th>ITEM</th><th>TAGIHAN</th><th>DITERIMA</th><th>SISA</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>
      {items.map(item=>{
        const sale=sales.find(s=>s.id_sales===item.id_sales);
        const paid=received[item.id_jaminan]??0;
        const due=Number(item.nominal_tagihan)-paid;
        return <tr key={item.id_jaminan}><td>{sale?.id_kavling??'—'}</td><td>{sale?.nama_konsumen??'—'}</td><td>{accounts.find(a=>a.id_bank===item.id_bank_kpr)?.nama_bank??'—'}</td><td>{item.jenis_item.replaceAll('_',' & ')}</td><td>{formatKavioMoney(item.nominal_tagihan)}</td><td>{formatKavioMoney(paid)}</td><td>{formatKavioMoney(due)}</td><td>{item.status.replaceAll('_',' ')}</td><td>
          <KavioActionGate action="PAYMENT_RECEIPT_WRITE">{item.status==='BELUM_DIAJUKAN'?<KavioTransactionModal title="AJUKAN KE BANK" focusIds={[`guarantee_claim:${item.id_jaminan}`]}>
            <form action={submitBankGuaranteeClaim} className="kavio-form collection-form">
              <input name="id_jaminan" type="hidden" value={item.id_jaminan}/><input name="focus" type="hidden" value={`guarantee_claim:${item.id_jaminan}`}/>
              <p className="collection-wide">{sale?.id_kavling} · {item.jenis_item.replaceAll('_',' & ')} · {formatKavioMoney(due)}</p>
              <label className="kavio-field"><span>TANGGAL PENGAJUAN</span><input id={`guarantee_claim:${item.id_jaminan}`} name="tanggal_pengajuan" type="date" required/></label>
              <label className="kavio-field collection-wide"><span>CATATAN</span><input name="keterangan_pengajuan"/></label>
              <KavioFormActions><button type="submit" className="kavio-button">SIMPAN PENGAJUAN</button></KavioFormActions>
            </form>
          </KavioTransactionModal>:due>0&&sale&&<KavioTransactionModal title="PENCAIRAN" focusIds={[`guarantee_receipt:${item.id_jaminan}`]}>
            <ReceiptForm sales={[sale]} accounts={accounts} focus={`guarantee_receipt:${item.id_jaminan}`} guarantee={{id_jaminan:item.id_jaminan,id_sales:item.id_sales,saldo:due}}/>
          </KavioTransactionModal>}</KavioActionGate>
        </td></tr>;
      })}
      {!items.length&&<tr><td colSpan={9} className="kavio-empty">BELUM ADA DANA JAMINAN. INPUT BERSAMA PENCAIRAN KPR PADA TAB PIUTANG.</td></tr>}
    </tbody></table></div>
  </section>;
}

function GuaranteeDisbursementForm({ready,sales,accounts,received,items}:Props&{ready:Guarantee[]}){
  const params=useSearchParams();
  const requested=params.get('jaminan')??'';
  const [selected,setSelected]=useState(requested);
  useEffect(()=>{if(params.get('error')&&requested)setSelected(requested);},[params,requested]);
  const item=ready.find(g=>g.id_jaminan===selected);
  const sale=sales.find(s=>s.id_sales===item?.id_sales);
  return <>
    <div className="kavio-panel-body"><label className="kavio-field"><span>PILIH DANA JAMINAN YANG DICAIRKAN</span><select name="selected_jaminan" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">PILIH KAVLING / ITEM JAMINAN</option>{ready.map(g=><option key={g.id_jaminan} value={g.id_jaminan}>{sales.find(s=>s.id_sales===g.id_sales)?.id_kavling} · {g.jenis_item.replaceAll('_',' & ')} · {formatKavioMoney(Number(g.nominal_tagihan)-(received[g.id_jaminan]??0))}</option>)}</select></label></div>
    {item&&sale?<ReceiptForm key={item.id_jaminan} sales={[sale]} accounts={accounts} focus="guarantee_receipt_select" guarantee={{id_jaminan:item.id_jaminan,id_sales:item.id_sales,saldo:Number(item.nominal_tagihan)-(received[item.id_jaminan]??0)}}/>:<div className="kavio-panel-body"><p>{ready.length?'Pilih dana jaminan untuk mengisi nominal dan Kas/Bank tujuan.':items.some(g=>g.status==='BELUM_DIAJUKAN')?'Dana jaminan belum diajukan. Tutup form dan gunakan tombol Ajukan ke Bank pada item yang akan dicairkan.':'Belum ada dana jaminan yang siap dicairkan. Dana yang ditahan diinput bersama pencairan KPR pada tab Piutang.'}</p><KavioFormActions>{null}</KavioFormActions></div>}
  </>;
}
