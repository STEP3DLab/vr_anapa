import ts from '../technopark-vr/node_modules/typescript/lib/typescript.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const input=execFileSync('git',['show','93651f6eca07a87f621cb46671bfc79d3b9a1bf1:technopark-vr/src/worldEngine.ts'],{cwd:root,encoding:'utf8'});
const original=ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(ts.createSourceFile('worldEngine.ts',input,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS));
const sha=s=>createHash('sha256').update(s).digest('hex');
assert.equal(sha(original),'ac21588433bc45fb0fcabcc8eb4ac9a38dde2a27faef076fe646943284e0eb9a');
const patch=readFileSync(new URL('./vr-v9-engine.patch',import.meta.url),'utf8');
const chunks=[...patch.matchAll(/^@@ (\d+) (\d+)\n/gm)],lines=original.match(/[^\n]*\n|[^\n]+$/g);
for(let i=chunks.length-1;i>=0;i--){const m=chunks[i],replacement=patch.slice(m.index+m[0].length,chunks[i+1]?.index??patch.length);lines.splice(Number(m[1]),Number(m[2])-Number(m[1]),replacement);}
const result=lines.join('');
assert.equal(sha(result),'a8ef94b14052accf094294a6b0698784d9d9af3f58038ded9627c3da8f1c6b35');
writeFileSync(root+'technopark-vr/src/worldEngine.ts',result);
console.log('Applied and SHA-256 verified the v9 engine audit patch.');
