export default function KavioReportHeading({company,title,meta,className=''}:{company:{nama_perusahaan?:string|null;logo_data_url?:string|null}|null;title:string;meta:string;className?:string}) {
 return <header className={`kavio-report-heading ${className}`}>{company?.logo_data_url&&<img src={company.logo_data_url} alt="Logo perusahaan"/>}<div><strong>{company?.nama_perusahaan||'KAVIO'}</strong><h2>{title}</h2><p>{meta}</p></div></header>;
}
