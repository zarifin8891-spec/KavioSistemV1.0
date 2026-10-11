// Regression: expose imported source precision and compare item sums without rounding each item.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const ts=require('typescript'),repo=path.resolve(__dirname,'../..'),original=Module._load;
Module._load=function(request,parent,isMain){
 if(request==='react')return {useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useEffect:()=>{}};
 if(request==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 return original.call(this,request,parent,isMain);
};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,file);
try {
 const {weightUnits,workPercent,workWeightIssues,workTotalPercent}=require(repo+'/app/lib/work-detail.ts');
 const Input=require(repo+'/app/components/KavioPercentInput.tsx').default;
 const weights=[.016539,.002415,.023122],sum=weights.reduce((n,w)=>n+weightUnits(w),0)/1000000;
 assert.equal(sum,.042076);assert.equal(workPercent(sum),'4,2076');
 const changed=[];const input=Input({value:1.6539,label:'Bobot',precision:4,onChange:n=>changed.push(n)});
 assert.equal(input.props.value,'1,6539');
 input.props.onChange({target:{value:'1,6546'},currentTarget:{setCustomValidity:()=>{}}});assert.deepEqual(changed,[1.6546]);
 input.props.onChange({target:{value:'1,65467'},currentTarget:{setCustomValidity:()=>{}}});assert.equal(changed.length,1);
 assert.equal(Input({value:1.6539,label:'Progress',onChange:()=>{}}).props.value,'1,65','progress default remains two decimals');
 const groups=[{id_kategori:'roof',nama_kategori:'Atap',bobot:.107005},{id_kategori:'rest',nama_kategori:'Lainnya',bobot:.892959}];
 const details=[{group_id:'roof',bobot:.106998},{group_id:'rest',bobot:.892959}];
 assert(workWeightIssues(groups,details)[0].includes('selisih 0,0007%'));
 const aligned=groups.map(g=>({...g,bobot:details.filter(d=>d.group_id===g.id_kategori).reduce((n,d)=>n+weightUnits(d.bobot),0)/1000000}));
 assert.deepEqual(workWeightIssues(aligned,details),[]);assert.equal(workTotalPercent(aligned),100);
 assert.equal(workTotalPercent([{bobot:.999949}]),99.99,'overall 100% guard remains');
 console.log('PASS: source precision visible/editable, summed item total, exact roof mismatch, alignment, overall rounding, progress precision unchanged');
} finally {Module._load=original;}
