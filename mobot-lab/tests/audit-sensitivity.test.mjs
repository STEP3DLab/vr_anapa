import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapByPair,getAuditSensitivity,renderAuditSensitivity} from './audit-sensitivity.mjs';

test('Pair correction uses only two control anchors and exactly recovers a synthetic planar similarity',()=>{
 const p=(x,y)=>({x,y});
 const controls=[[p(4,5),p(0,0)],[p(4,9),p(2,0)]];
 assert.deepEqual(mapByPair(p(2,3),...controls),p(-2,9));
 assert.throws(()=>mapByPair(p(1,2),controls[0],controls[0]),RangeError);
});
test('Sensitivity keeps both disputed landmarks out of fits and matches the published table',()=>{
 const results=getAuditSensitivity();
 assert.deepEqual(results.map(r=>r.residuals.length),[3,3,1,1]);
 assert.deepEqual(results.map(r=>[r.original,r.shift,...r.residuals].map(x=>Math.round(x))),[[67,57,68,63,84],[124,110,130,132,162],[61,55,52],[114,115,95]]);
 const page=readFileSync(new URL('../geometry-audit.html',import.meta.url),'utf8');
 assert.equal(page.split('<!-- audit-sensitivity:start -->\n')[1]?.split('\n<!-- audit-sensitivity:end -->')[0],renderAuditSensitivity());
 assert.match(page,/Диапазон показывает результаты разных пар, а не доверительный интервал/);
});
