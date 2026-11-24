import {icon} from './icons.js';
import {evidence} from './evidence.js';
import {registrations,landmarkDifferences} from './registrations.js';
import {photoKey} from './scene-link.js';

export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const h = escapeHTML;
const $ = id => document.getElementById(id);
const external = (url,label) => '<a href="'+h(url)+'" target="_blank" rel="noopener">'+h(label)+' ↗</a>';

function overlaySVG(overlay) {
  const {width,height,points,lines=[]} = overlay;
  const size = Math.max(width,height)/145;
  const paths = lines.map(line => '<polyline class="'+(line.kind==='model'?'projected':'picked')+'" points="'+
    line.points.map(p=>p.join(',')).join(' ')+'"><title>'+h(line.label)+'</title></polyline>').join('');
  const dots = points.map(p => {
    const title = '<title>'+h(p.label)+'</title>';
    if (p.kind==='model') return '<path class="projected" d="M '+(p.x-size)+' '+p.y+' h '+2*size+' M '+p.x+' '+(p.y-size)+' v '+2*size+'">'+title+'</path>';
    return '<circle class="picked" cx="'+p.x+'" cy="'+p.y+'" r="'+size*.82+'">'+title+'</circle>';
  }).join('');
  return '<svg class="registration" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Архивные ориентиры и проекция модели">'+paths+dots+'</svg>';
}
function photoImage(photo, marked, enlarged) {
  const reg = registrations[photoKey(photo)];
  return '<div class="photo-frame'+(enlarged?' enlarged':'')+'"><img src="'+h(photo.file)+'" alt="'+h(photo.title)+'">'+
    (marked && reg?.overlay ? overlaySVG(reg.overlay) : '')+'</div>';
}
const legend = '<div class="legend"><span><b class="photo-dot">○</b> Точка на снимке</span><span><b class="model-cross">+</b> Проекция архивной позы</span></div>';

function measurements(overlay) {
  const diffs=landmarkDifferences(overlay);
  const num=n=>n.toLocaleString('ru-RU',{maximumFractionDigits:1,minimumFractionDigits:1});
  if(!diffs.length)return '';
  return '<details class="measurements"><summary>Расхождения по ориентирам ('+diffs.length+')</summary>'+
    '<table><caption>Расстояние между отметкой на снимке и проекцией той же точки. Ширина кадра '+overlay.width+' пикс.</caption>'+
    '<thead><tr><th scope="col">Ориентир</th><th scope="col">Пикс.</th><th scope="col">% ширины</th></tr></thead><tbody>'+
    diffs.map(d=>'<tr><th scope="row">'+h(d.label)+'</th><td>'+num(d.pixels)+'</td><td>'+num(d.percentWidth)+'</td></tr>').join('')+
    '</tbody></table></details>';
}

export function createArchive({openModal, closeModal, compare}) {
  let filter = 'all', expanded = false, gallery = null;
  const dialog = $('dialog');
  const archive = Object.entries(evidence);
  function renderCards() {
    const collections = archive.filter(([year])=>filter==='all'||year===filter);
    const entries = collections.flatMap(([year,data]) => data.photos.map((photo,index)=>({year:Number(year),photo,index})));
    const shown = filter==='all' && !expanded ? entries.filter(item=>item.index<2) : entries;
    $('archiveCards').innerHTML = shown.map(({year,photo,index})=>
      '<button class="photo-card" data-gallery="'+year+'" data-index="'+index+'"><span class="archive-thumb"><img loading="lazy" src="'+h(photo.file)+'" alt=""><span>'+icon('expand')+'</span></span>'+
      '<span class="photo-card-copy"><small>'+year+' <b> / </b> '+(year===1986?'Ч-ХВ':'Ч-ХВ-2')+'</small><strong>'+h(photo.title)+'</strong></span></button>').join('');
    $('expandArchive').hidden = filter!=='all' || entries.length<=4;
    $('expandArchive').textContent = expanded ? 'Свернуть архив' : 'Все снимки ('+entries.length+')';
    $('expandArchive').setAttribute('aria-expanded',String(expanded));
  }
  document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{
    filter=button.dataset.filter; expanded=false;
    document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    renderCards();
  });
  $('expandArchive').onclick=()=>{expanded=!expanded;renderCards();if(!expanded)$('archiveTitle').scrollIntoView({block:'start'})};
  $('archiveCards').addEventListener('click',e=>{
    const button=e.target.closest('[data-gallery]');
    if(button) openPhoto(Number(button.dataset.gallery),Number(button.dataset.index));
  });

  function openPhoto(year, index, showMarks=false) {
    const photos=evidence[year].photos;
    index=(index+photos.length)%photos.length;
    const photo=photos[index], reg=registrations[photoKey(photo)];
    const marked=Boolean(showMarks && reg?.overlay);
    gallery={year,index};
    openModal('ФОТОАРХИВ  /  '+year, '<h2>'+h(photo.title)+'</h2>'+
      photoImage(photo,marked,true)+(marked?legend:'')+
      '<div class="gallery-foot"><div class="source-links">'+external(photo.source,'Источник')+' '+external(photo.original,'Полный кадр')+'</div><div class="gallery-nav"><button class="icon" id="prevPhoto" aria-label="Предыдущий снимок">'+icon('left')+'</button><span>'+(index+1)+' / '+photos.length+'</span><button class="icon" id="nextPhoto" aria-label="Следующий снимок">'+icon('right')+'</button></div></div>'+
      '<p>'+h(photo.note)+'</p>'+(marked?'<p class="evidence-note">'+h(reg.note)+'</p>'+measurements(reg.overlay):'')+
      '<div class="photo-actions">'+(reg && '<button id="galleryCompare" class="modal-action">'+icon('box')+'Сверить с 3D</button>' || '')+
      (reg?.overlay?'<button id="galleryMarks" class="secondary" aria-pressed="'+marked+'">'+(marked?'Скрыть разметку':'Показать разметку')+'</button>':'')+'</div>', photo.title);
    $('prevPhoto').onclick=()=>{openPhoto(year,index-1,showMarks);$('prevPhoto').focus()};
    $('nextPhoto').onclick=()=>{openPhoto(year,index+1,showMarks);$('nextPhoto').focus()};
    if ($('galleryMarks')) $('galleryMarks').onclick=()=>{openPhoto(year,index,!marked);$('galleryMarks').focus()};
    if ($('galleryCompare')) $('galleryCompare').onclick=()=>{closeModal();compare(year,index,marked)};
  }
  dialog.addEventListener('close',()=>{gallery=null});
  dialog.addEventListener('keydown',e=>{
    if (!gallery || !dialog.open || e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const target={ArrowLeft:'prevPhoto',ArrowRight:'nextPhoto'}[e.key];
    if (target) { e.preventDefault(); $(target)?.click(); }
  });

  function renderComparison({year,index,marks,live,select,toggle,restore}) {
    const photos=evidence[year].photos, photo=photos[index], reg=registrations[photoKey(photo)];
    const matches=photos.map((p,i)=>({p,i})).filter(({p})=>registrations[photoKey(p)]);
    const panel=$('panel-photo');
    panel.innerHTML='<label class="select-title" for="photoSelect">Архивный ракурс</label><select id="photoSelect">'+
      matches.map(({p,i})=>'<option value="'+i+'"'+(i===index?' selected':'')+'>'+h(p.title)+'</option>').join('')+'</select>'+
      '<button class="photo-zoom" id="photoEnlarge" aria-label="Увеличить архивный снимок">'+photoImage(photo,marks,false)+'<span>'+icon('expand')+'</span></button>'+
      (reg?.overlay?'<label class="overlay-toggle"><input id="overlayToggle" type="checkbox"'+(marks?' checked':'')+'>Разметка на снимке</label>':'')+
      (marks&&reg?.overlay?legend:'')+'<p class="match-note">'+h(reg?.note || photo.note)+'</p>'+
      '<div class="match-actions"><button class="secondary" id="restorePhoto"'+(live&&reg?'':' disabled')+'>'+icon('reset')+'Вернуть позу по снимку</button>'+external(photo.source,'Источник')+'</div>';
    $('photoSelect').onchange=e=>select(Number(e.target.value));
    $('photoEnlarge').onclick=()=>openPhoto(year,index,marks);
    if ($('overlayToggle')) $('overlayToggle').onchange=e=>toggle(e.target.checked);
    $('restorePhoto').onclick=()=>restore();
  }
  renderCards();
  return {renderComparison,openPhoto};
}
