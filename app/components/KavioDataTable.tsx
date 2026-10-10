import type {ReactNode} from 'react';

export type KavioTableColumn={key:string;label:string;align?:'left'|'right'|'center';width?:string};

/** One compact table contract for header spacing, column widths and alignment. */
export default function KavioDataTable({columns,children,label,minWidth='760px'}:{
  columns:KavioTableColumn[];children:ReactNode;label:string;minWidth?:string;
}) {
  return <div className="kavio-table-wrap"><table className="kavio-table kavio-data-table" aria-label={label} style={{minWidth}}>
    <colgroup>{columns.map(column=><col key={column.key} style={{width:column.width}}/>)}</colgroup>
    <thead><tr>{columns.map(column=><th key={column.key} scope="col" className={column.align==='right'?'kavio-number':column.align==='center'?'kavio-cell-center':undefined}>{column.label}</th>)}</tr></thead>
    <tbody>{children}</tbody>
  </table></div>;
}
