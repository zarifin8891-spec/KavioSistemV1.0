const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const ts=require('typescript'),repo=path.resolve(__dirname,'../..');
Module._extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {fasumAutoWeights,fasumTotalWage}=require(repo+'/app/lib/fasum-wages.ts');
const {weightUnits,workPercent,workTotalPercent}=require(repo+'/app/lib/work-detail.ts');
const example=[{volume:48,harga_satuan_upah:20000},{volume:54,harga_satuan_upah:120000}];
assert.equal(fasumTotalWage(example),7440000);
const weights=fasumAutoWeights(example);assert.deepEqual(weights,[.129032,.870968]);assert.equal(workPercent(weights[0]),'12,9032');assert.equal(workTotalPercent(weights.map(bobot=>({bobot}))),100);
const equal=fasumAutoWeights(Array.from({length:3},()=>({volume:1,harga_satuan_upah:100})));
assert.deepEqual(equal,[.333334,.333333,.333333]);assert.equal(equal.reduce((n,w)=>n+weightUnits(w),0),1000000);
assert.deepEqual(fasumAutoWeights([{volume:0,harga_satuan_upah:20000}]),[0]);
for(let length=1;length<=1000;length+=37){const rows=Array.from({length},(_,i)=>({volume:1+(i%29)/100,harga_satuan_upah:100*(i+1)}));const result=fasumAutoWeights(rows);assert.equal(result.reduce((n,w)=>n+weightUnits(w),0),1000000);assert(result.every(w=>w>0));}
console.log('PASS: screenshot values, automatic ratios, exact 100% allocation, deterministic rounding, empty costs, up to 1000 items');
