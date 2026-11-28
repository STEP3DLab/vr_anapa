import {registrations,landmarkDifferences} from '../registrations.js';

export const frames=[
 ['1986-fig6','1986','Рис. 6','Траверса грейфера'],
 ['1986-fig9','1986','Рис. 9','Траверса грейфера'],
 ['1987-before-dispatch','1987','Кадр № 2','Задний угол боковины ковша'],
 ['1987-snow-side','1987','Кадр № 4','Задний угол боковины ковша']
];
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const round=n=>n.toFixed(2);
const clamp=(n,limit)=>Math.max(0,Math.min(n,limit));
export function renderAuditCrops(){
 return frames.map(([id,year,name,label])=>{
  const {overlay}=registrations[id];
  const [photo,model]=['photo','model'].map(kind=>overlay.points.find(p=>p.kind===kind&&p.label===label));
  const {pixels}=landmarkDifferences(overlay).find(p=>p.label===label);
  const w=300,h=230,x=clamp((photo.x+model.x-w)/2,overlay.width-w),y=clamp((photo.y+model.y-h)/2,overlay.height-h);
  const dx=round(photo.x),dy=round(photo.y),mx=round(model.x),my=round(model.y);
  const source='media/'+id+'.webp';
  const url='./?model='+year+'&mode=photo&photo='+id+'&marks=1';
  const distance=pixels.toFixed(1).replace('.',',');
  return `<figure class="audit-crop" id="audit-${id}">
<svg viewBox="${round(x)} ${round(y)} ${w} ${h}" role="img" aria-label="${xml(year+' · '+name+' · '+label+': точка на фото и её проекция из модели, разница '+distance+' пикселя')}">
<image href="./${source}" width="${overlay.width}" height="${overlay.height}"/>
<path d="M ${dx} ${dy} L ${mx} ${my}" fill="none" stroke="#231d18" stroke-width="5"/>
<path d="M ${dx} ${dy} L ${mx} ${my}" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="5 4"/>
<circle cx="${dx}" cy="${dy}" r="7" fill="#ffcf66" stroke="#211906" stroke-width="2"/>
<rect x="${round(model.x-6)}" y="${round(model.y-6)}" width="12" height="12" fill="#73efff" stroke="#002935" stroke-width="2"/>
</svg>
<figcaption><strong>${year} · ${name}: ${distance} px</strong><br>${label}. <a href="${xml(url)}">Открыть полный кадр</a></figcaption>
</figure>`;
 }).join('\n');
}
