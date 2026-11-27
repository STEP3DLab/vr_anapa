import {research,projectVersions} from './research.js';
import {escapeHTML as h} from './archive.js';

const link=(url,label)=>'<a href="'+h(url)+'" target="_blank" rel="noopener">'+h(label)+'</a>';
const list=items=>'<ul>'+items.map(item=>'<li>'+h(item)+'</li>').join('')+'</ul>';

export function researchPassport(year) {
  const data=research[year];
  return '<h3>Что включено в модель</h3>'+list(data.changes)+
    '<h3>Что ещё требует подтверждения</h3>'+list(data.openQuestions)+
    '<div class="source-links"><a href="'+h(data.passport)+'" download>Скачать подробный паспорт · JSON · '+h(data.version)+'</a></div>';
}

export function setupResearch({openModal,openPassport,selectModel}) {
  const host=document.getElementById('researchContent');
  host.innerHTML='<div class="research-grid">'+[1986,1987].map(year=>{
    const data=research[year];
    return '<article class="research-card"><p class="mini">'+year+' · '+data.version+'</p><h3>'+(year===1986?'Мобот-Ч-ХВ':'Мобот-Ч-ХВ-2')+'</h3><p>'+h(data.summary)+'</p>'+
      '<div class="research-actions"><button class="secondary" data-research-passport="'+year+'">Паспорт и достоверность</button><button class="text-btn" data-research-model="'+year+'">Открыть модель</button></div>'+
      '<details><summary>Источники и фотопроверка</summary><ul class="research-links">'+data.sources.map(item=>'<li>'+link(item.url,item.label)+'</li>').join('')+'</ul></details>'+
      '<details><summary>Результаты проверок</summary><ul class="research-links">'+data.checks.map(item=>'<li>'+link(item.url,item.label)+'<p>'+h(item.scope)+'</p></li>').join('')+'</ul></details></article>';
  }).join('')+'</div>'+
    '<div class="download-panel"><div><p class="overline">РЕДАКТИРУЕМЫЕ ИСХОДНИКИ</p><h3>Материалы для дальнейшей работы</h3><p>Архивные фотографии, четыре Blender-сцены и автономная фотосверка. Исследовательские исходники сохранены отдельно от актуальных моделей на сайте.</p></div>'+
    '<div class="download-grid"><a class="download-card" href="./downloads/?file=mobot-research-sources.zip" target="_blank" rel="noopener"><strong>Модели и фотосверка</strong><span>4 файла Blender · HTML · пояснения</span><b>ZIP · 14,2 МБ</b></a>'+
    '<a class="download-card" href="./downloads/?file=mobot-photo-archive-20261114.zip" target="_blank" rel="noopener"><strong>Архив фотографий</strong><span>79 изображений · реестр · PDF-атлас</span><b>ZIP · 29,9 МБ</b></a></div>'+
    '<p class="evidence-note">Blender-сцены относятся к более раннему этапу: их масштаб и часть механизмов условны. Для первого робота в них использованы отдельные решения второго. На сайте остаются принятые v7 и v23.</p>'+
    '<div class="source-links">'+link('./downloads/README-RU.txt','Состав и ограничения исходников')+' '+link('./downloads/manifest.json','Файлы и контрольные суммы')+'</div></div>'+
    '<details class="consolidation-details"><summary>Как объединены прежние проекты</summary><p>Основной проект — эта лаборатория. Полезные инструменты работают с актуальными моделями; архивные версии сохранены для прослеживания решений.</p><div class="version-list">'+
    projectVersions.map(item=>'<article><span class="mini">'+h(item.role)+'</span><h4>'+link(item.url,item.title)+'</h4><p>'+h(item.decision)+'</p></article>').join('')+'</div></details>';
  for(const button of host.querySelectorAll('[data-research-passport]'))button.onclick=()=>openPassport(+button.dataset.researchPassport);
  for(const button of host.querySelectorAll('[data-research-model]'))button.onclick=()=>{
    const year=+button.dataset.researchModel,workbench=document.getElementById('workbench');
    selectModel(year);workbench.scrollIntoView({block:'start'});
    workbench.querySelector('[data-year="'+year+'"]')?.focus({preventScroll:true});
  };
}
