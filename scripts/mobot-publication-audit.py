"""Verify published deliverables against local bytes; read-only GET requests."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import subprocess, json, tempfile, datetime

ROOT=Path(__file__).resolve().parents[1]
BASE='https://step3dlab.github.io/vr_anapa/'
FILES=[
 'mobot-demo.html','mobot-ch-hv-1986-research-v5.html','mobot-engineering-v20.html',
 'mobot-backup.html','mobot-photo-measure-v2.html','mobot-latest.html','mobot-roof.html',
 'mobot-ch-hv-1986-research-v5-passport.json','mobot-ch-hv-1986-research-v5-qa.json',
 'mobot-engineering-v19-passport.json','mobot-engineering-v19-qa.json',
 'mobot-engineering-v20-passport.json','mobot-engineering-v20-qa.json',
 'mobot-demo-script-2026-11-18.md','mobot-geometry-changes-2026-11-18.md',
 'mobot-archive-audit-2026-11-18.md','mobot-assets/exhibition-v1.js','mobot-assets/exhibition-v1.css',
 'mobot-assets/photo-measure-v2.js','mobot-assets/archive/provenance-2026-11-18.json',
 'mobot-assets/archive/1986-fig6.png','mobot-assets/archive/1986-fig9.png',
 'mobot-assets/archive/1987-before-dispatch.jpg','mobot-assets/archive/1987-front.jpg',
 'mobot-assets/archive/1987-snow-side.jpg','mobot-assets/archive/1987-breaker.jpg',
 'mobot-qa/demo-2026-11-18/1986-model.png','mobot-qa/demo-2026-11-18/1987-model.png',
 'mobot-qa/demo-2026-11-18/1986-side.png','mobot-qa/demo-2026-11-18/1987-side.png'
]
def check(file):
 with tempfile.NamedTemporaryFile() as f:
  r=subprocess.run(['curl','-sS','-L','--max-time','30','-o',f.name,'-w','%{http_code}',BASE+file],text=True,capture_output=True)
  data=Path(f.name).read_bytes();expected=sha256((ROOT/file).read_bytes()).hexdigest();actual=sha256(data).hexdigest()
  return {'path':file,'httpStatus':r.stdout,'bytesMatch':actual==expected,'sha256':actual,'error':r.stderr or None}
with ThreadPoolExecutor(max_workers=8) as pool: checks=list(pool.map(check,FILES))
report={'checked':datetime.datetime.now(datetime.timezone.utc).isoformat(),'base':BASE,'method':'HTTP GET and byte-for-byte SHA256 comparison; separate from browser render test','checks':checks,'allPassed':all(c['httpStatus']=='200' and c['bytesMatch'] for c in checks)}
(ROOT/'mobot-qa/demo-2026-11-18/publication-http.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'files':len(checks),'allPassed':report['allPassed'],'failures':[c for c in checks if c['httpStatus']!='200' or not c['bytesMatch']]},indent=2))
raise SystemExit(0 if report['allPassed'] else 1)
