import { build } from 'esbuild';
await build({entryPoints:['src/main.tsx'],bundle:true,outfile:'app.js',format:'esm',minify:true,target:['es2022'],jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
