(() => {
  'use strict';

  const TOPICS = [
    ['Наука','физика и явления'],['Космос','планеты и Вселенная'],['Жизнь','биология и эволюция'],['Человек','память и мышление'],
    ['Технологии','инженерия и цифровой мир'],['История','время и цивилизации'],['Математика','числа и парадоксы'],['Искусство','идеи и культура']
  ];

  const CARDS = [
    {id:'venus',topic:'Космос',level:1,type:'Парадокс',title:'На Венере сутки длиннее года.',summary:'Один оборот Венеры вокруг оси занимает около 243 земных суток, а вокруг Солнца — около 225.',detail:'Венера вращается очень медленно и в направлении, противоположном большинству планет.',memory:'243 > 225: день Венеры длиннее её года.',source:'NASA — Venus',url:'https://science.nasa.gov/venus/facts/',q:'Что длится дольше на Венере?',answers:['Сутки','Год','Одинаково'],correct:0,visual:['243','суток: вращение вокруг оси']},
    {id:'sun',topic:'Космос',level:1,type:'Масштаб',title:'Свет от Солнца идёт к Земле чуть больше 8 минут.',summary:'Среднее расстояние Земля—Солнце — около 150 млн км.',detail:'Из-за конечной скорости света мы видим Солнце не «прямо сейчас», а с задержкой примерно восемь минут.',memory:'Солнце, которое вы видите, — примерно 8 минут назад.',source:'NASA — Sun',url:'https://science.nasa.gov/sun/facts/',q:'Сколько примерно идёт свет от Солнца до Земли?',answers:['8 секунд','8 минут','8 часов'],correct:1,visual:['8:20','примерное время пути света']},
    {id:'iss',topic:'Космос',level:1,type:'Жизнь на орбите',title:'На МКС можно увидеть около 16 рассветов за сутки.',summary:'Станция делает оборот вокруг Земли примерно за 90 минут.',detail:'Экипаж многократно проходит через освещённую и теневую стороны Земли, поэтому земной ритм дня и ночи там не возникает сам собой.',memory:'90 минут на круг → около 16 орбит в сутки.',source:'NASA — ISS',url:'https://www.nasa.gov/international-space-station/',q:'Почему на МКС так много рассветов?',answers:['Солнце мерцает','МКС быстро облетает Землю','Земля вращается быстрее'],correct:1,visual:['16×','рассвет за земные сутки']},
    {id:'octopus',topic:'Жизнь',level:1,type:'Анатомия',title:'У осьминога три сердца.',summary:'Два прокачивают кровь через жабры, третье — по остальному телу.',detail:'Кровь осьминога использует гемоцианин с медью, поэтому имеет голубоватый оттенок.',memory:'2 сердца — жабрам, 1 — всему телу.',source:'Smithsonian Ocean',url:'https://ocean.si.edu/ocean-life/invertebrates/octopuses-and-squids',q:'Сколько сердец у осьминога?',answers:['1','2','3'],correct:2,visual:['3','сердца в одной системе']},
    {id:'giraffe',topic:'Жизнь',level:1,type:'Сравнение',title:'У человека и жирафа обычно одинаковое число шейных позвонков — семь.',summary:'Разница не в количестве, а в длине отдельных позвонков.',detail:'У большинства млекопитающих сохраняется базовый план из семи шейных позвонков.',memory:'Жираф: не больше позвонков, а длиннее каждый.',source:'Britannica — Giraffe',url:'https://www.britannica.com/animal/giraffe',q:'Сколько шейных позвонков обычно у жирафа?',answers:['7','12','24'],correct:0,visual:['7 = 7','жираф и человек']},
    {id:'fungi',topic:'Жизнь',level:2,type:'Эволюция',title:'Грибы эволюционно ближе к животным, чем к растениям.',summary:'Грибы и животные входят в одну крупную ветвь эукариот — Opisthokonta.',detail:'Это означает, что общий предок грибов и животных жил позже, чем их общий предок с растениями.',memory:'Гриб ≠ растение: его ближайшая крупная ветвь — животные.',source:'UC Museum of Paleontology',url:'https://ucmp.berkeley.edu/fungi/fungi.html',q:'К какой группе грибы эволюционно ближе?',answers:['К животным','К растениям','Одинаково'],correct:0,visual:['↗','грибы + животные: более близкая ветвь']},
    {id:'recall',topic:'Человек',level:1,type:'Учёба',title:'Попытка вспомнить часто полезнее простого перечитывания.',summary:'Активное извлечение информации из памяти укрепляет последующее запоминание.',detail:'Короткий вопрос после материала — не только проверка, но и отдельный акт обучения.',memory:'Не перечитай ещё раз — попробуй воспроизвести без подсказки.',source:'Roediger & Karpicke',url:'https://pubmed.ncbi.nlm.nih.gov/16507066/',q:'Что обычно сильнее укрепляет долгую память?',answers:['Ещё одно перечитывание','Попытка воспроизвести','Смена шрифта'],correct:1,visual:['→ ? → ✓','прочитал → вспомнил → закрепил']},
    {id:'spacing',topic:'Человек',level:1,type:'Память',title:'Повторения лучше разносить во времени.',summary:'Материал, повторённый с интервалами, обычно удерживается дольше, чем повторённый подряд.',detail:'Оптимальный интервал зависит от того, на какой срок вы хотите запомнить материал.',memory:'Для памяти пауза — часть обучения.',source:'Cepeda et al.',url:'https://pubmed.ncbi.nlm.nih.gov/19076480/',q:'Что обычно лучше для долгой памяти?',answers:['Все повторения подряд','Повторения с интервалами','Только одно чтение'],correct:1,visual:['1 → 3 → 7','дни между успешными повторениями']},
    {id:'multitask',topic:'Человек',level:1,type:'Миф',title:'«Многозадачность» для сложных задач часто означает быстрое переключение внимания.',summary:'Каждое переключение имеет цену: время на восстановление контекста и дополнительные ошибки.',detail:'Две требовательные к вниманию задачи обычно конкурируют за ограниченные ресурсы.',memory:'Две сложные задачи → не параллельно, а туда‑сюда.',source:'APA — Multitasking',url:'https://www.apa.org/research/action/multitask',q:'Что часто происходит при двух сложных задачах сразу?',answers:['Мозг удваивает мощность','Мы быстро переключаемся','Ошибки исчезают'],correct:1,visual:['A ⇄ B','частое переключение вместо параллельности']},
    {id:'qr',topic:'Технологии',level:1,type:'Происхождение',title:'QR‑код придумали для отслеживания деталей на производстве.',summary:'Denso Wave разработала QR Code в 1994 году для автомобильной промышленности.',detail:'Двумерный код позволял хранить больше данных и быстро считываться на производственном потоке.',memory:'QR родился на заводе, а не в рекламе.',source:'DENSO WAVE',url:'https://www.qrcode.com/en/history/',q:'Для чего изначально создавали QR‑код?',answers:['Для меню ресторанов','Для отслеживания деталей','Для банков'],correct:1,visual:['1994','производство → массовая технология']},
    {id:'web',topic:'Технологии',level:1,type:'Различие',title:'Всемирная паутина и интернет — не одно и то же.',summary:'Интернет — сеть сетей. Web — один из сервисов поверх неё.',detail:'Тим Бернерс‑Ли предложил World Wide Web в CERN в 1989 году, объединив URL, HTTP и HTML.',memory:'Интернет — инфраструктура. Web — способ ей пользоваться.',source:'CERN — Birth of the Web',url:'https://home.cern/science/computing/birth-web',q:'Что точнее?',answers:['Web и интернет — синонимы','Web работает поверх интернета','Интернет появился после Web'],correct:1,visual:['Internet ⟶ Web','сеть → один из сервисов']},
    {id:'gps',topic:'Технологии',level:3,type:'Физика в кармане',title:'GPS должен учитывать теорию относительности.',summary:'Часы на спутниках идут с другой скоростью из‑за движения и более слабой гравитации.',detail:'Система заранее корректирует частоты спутниковых часов, иначе навигационная ошибка быстро росла бы.',memory:'Навигатор работает точнее благодаря Эйнштейну.',source:'NIST — Relativity and GPS',url:'https://www.nist.gov/pml/time-and-frequency-division/popular-links/time-frequency-z/relativity-and-gps',q:'Почему GPS учитывает относительность?',answers:['Спутники быстрее передают интернет','Спутниковые часы идут иначе','Для батареи'],correct:1,visual:['Δt','маленькая ошибка времени → большая ошибка позиции']},
    {id:'cleopatra',topic:'История',level:1,type:'Хронология',title:'Клеопатра жила ближе к нашему времени, чем к строительству Великой пирамиды.',summary:'Пирамида Хеопса была построена примерно в XXVI веке до н.э., Клеопатра VII жила в I веке до н.э.',detail:'Для самой Клеопатры пирамиды уже были глубокой древностью.',memory:'Для Клеопатры пирамиды были старше, чем она для нас.',source:'Britannica — Cleopatra',url:'https://www.britannica.com/biography/Cleopatra-queen-of-Egypt',q:'Что было ближе по времени к Клеопатре?',answers:['Пирамида Хеопса','XXI век','Одинаково'],correct:1,visual:['≈2500 лет','пирамида → Клеопатра']},
    {id:'oxford',topic:'История',level:1,type:'Хронология',title:'Преподавание в Оксфорде началось раньше, чем возникла империя ацтеков.',summary:'Обучение в Оксфорде документировано с XI века.',detail:'Школьная история часто выглядит последовательностью эпох, хотя многие общества и институты существовали одновременно.',memory:'Оксфорд старше ацтекской империи.',source:'University of Oxford',url:'https://www.ox.ac.uk/about/organisation/history',q:'Что появилось раньше?',answers:['Оксфордское преподавание','Империя ацтеков','Одновременно'],correct:0,visual:['XI век','начало преподавания в Оксфорде']},
    {id:'ultramarine',topic:'Искусство',level:1,type:'Материал',title:'Натуральный ультрамарин когда-то был одним из самых дорогих пигментов.',summary:'Его получали из лазурита, который в Европу везли издалека.',detail:'Насыщенный синий берегли для важных элементов картины; ситуацию изменил синтетический ультрамарин.',memory:'Синий когда-то был ещё и финансовым решением.',source:'The Met',url:'https://www.metmuseum.org/art/collection/search/30766',q:'Почему натуральный ультрамарин был дорогим?',answers:['Редкий лазурит','Он светился','Нельзя хранить'],correct:0,visual:['lapis → blue','камень → дорогой пигмент']},
    {id:'ice',topic:'Наука',level:1,type:'Почему?',title:'Лёд плавает потому, что твёрдая вода менее плотная, чем жидкая.',summary:'При замерзании молекулы воды выстраиваются в более открытую кристаллическую структуру.',detail:'Для большинства веществ твёрдая фаза плотнее жидкой. Вода — важное исключение.',memory:'Замерзая, вода расширяется.',source:'USGS — Water density',url:'https://www.usgs.gov/special-topics/water-science-school/science/water-density',q:'Почему лёд плавает?',answers:['Он горячее','Он менее плотный','В нём нет молекул'],correct:1,visual:['ρ↓','твёрдая вода менее плотная']},
    {id:'birthday',topic:'Математика',level:2,type:'Парадокс',title:'В группе из 23 человек шанс совпадения дней рождения уже больше 50%.',summary:'Сравнивается не один человек со всеми, а множество возможных пар.',detail:'При 23 людях получается 253 пары — число сравнений растёт очень быстро.',memory:'23 человека → уже больше половины шанса.',source:'MathWorld — Birthday Problem',url:'https://mathworld.wolfram.com/BirthdayProblem.html',q:'Сколько примерно людей нужно для шанса >50%?',answers:['23','100','183'],correct:0,visual:['23 → 253','человека → возможные пары']},
    {id:'nines',topic:'Математика',level:2,type:'Провокация',title:'0,999… — это ровно 1.',summary:'Бесконечная десятичная запись 0,999… является другой записью того же вещественного числа.',detail:'Например: 1/3 = 0,333…, умножаем обе части на 3 и получаем 1 = 0,999….',memory:'0,999… и 1 — одна точка на числовой прямой.',source:'MathWorld — Repeating Decimal',url:'https://mathworld.wolfram.com/RepeatingDecimal.html',q:'Чему равно 0,999…?',answers:['Чуть меньше 1','Ровно 1','Зависит от округления'],correct:1,visual:['0,999… = 1','две записи одного числа']}
  ];

  const KEY = 'learnflow-v3';
  const OLD_KEY = 'learnflow-live-v2';
  const DAY = 86400000;
  const defaultState = {
    onboarded:false, topics:[], depth:'balanced', goal:10, weights:{}, liked:[], saved:[], known:[], hidden:[], learned:[],
    mode:'for', quizCorrect:0, quizTotal:0, reviews:{}, streak:0, lastActiveDay:null, daily:{date:null,count:0}, goalCelebrated:null,
    views:{}, dwell:{}, sessionLearned:0
  };

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const todayKey = () => new Date().toISOString().slice(0,10);
  const yesterdayKey = () => new Date(Date.now()-DAY).toISOString().slice(0,10);
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let state = loadState();
  let feedSlides = [], activeSlide = null, activeSince = 0, currentIndex = 0, viewTimer = null, toastTimer = null, deferredInstall = null;

  function loadState(){
    try{
      const direct = JSON.parse(localStorage.getItem(KEY) || 'null');
      if(direct) return normalize({...defaultState,...direct});
      const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
      if(old){
        return normalize({...defaultState,onboarded:!!old.on,topics:old.topics||[],depth:old.depth||'balanced',weights:old.w||{},liked:old.liked||[],saved:old.saved||[],known:old.known||[],hidden:old.hidden||[],learned:old.learned||[],quizCorrect:old.quizC||0,quizTotal:old.quizT||0,mode:old.mode||'for'});
      }
    }catch(e){}
    return normalize({...defaultState});
  }

  function normalize(s){
    TOPICS.forEach(([t]) => { if(typeof s.weights[t] !== 'number') s.weights[t] = 1; });
    if(!s.daily || s.daily.date !== todayKey()) s.daily = {date:todayKey(),count:0};
    s.goal = clamp(Number(s.goal)||10,3,30);
    s.reviews = s.reviews || {};
    s.views = s.views || {};
    s.dwell = s.dwell || {};
    return s;
  }

  function save(){
    localStorage.setItem(KEY, JSON.stringify(state));
    updateChrome();
  }

  function updateChrome(){
    const daily = state.daily.date === todayKey() ? state.daily.count : 0;
    const pct = clamp((daily/state.goal)*100,0,100);
    const fill = $('#goalFill'); if(fill) fill.style.width = pct+'%';
    const label = $('#goalLabel'); if(label) label.textContent = daily+' / '+state.goal+' сегодня';
    const streak = $('#streak'); if(streak) streak.textContent = '🔥 '+state.streak;
    const due = dueReviews().length; const reviewBadge = $('#reviewBadge'); if(reviewBadge) reviewBadge.textContent = due ? '↺ '+due : '↺';
  }

  function toast(text){
    const t = $('#toast'); if(!t) return;
    t.textContent = text; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),1500);
  }

  function markLearned(id){
    const first = !state.learned.includes(id);
    if(first){
      state.learned.push(id);
      state.sessionLearned += 1;
      if(state.daily.date !== todayKey()) state.daily={date:todayKey(),count:0};
      state.daily.count += 1;
      updateStreak();
      if(!state.reviews[id]) scheduleReview(id,'new');
      save();
      maybeCelebrateGoal();
    }
  }

  function updateStreak(){
    const today = todayKey();
    if(state.lastActiveDay === today) return;
    if(state.lastActiveDay === yesterdayKey()) state.streak += 1;
    else state.streak = 1;
    state.lastActiveDay = today;
  }

  function scheduleReview(id, rating){
    const old = state.reviews[id] || {reps:0,interval:0,ease:2.3,due:Date.now()};
    let reps=old.reps, interval=old.interval, ease=old.ease;
    if(rating==='new'){ reps=0; interval=1; }
    if(rating==='again'){ reps=0; interval=0.007; ease=Math.max(1.4,ease-.18); }
    if(rating==='hard'){ reps+=1; interval=Math.max(1, interval ? interval*1.45 : 1); ease=Math.max(1.4,ease-.08); }
    if(rating==='good'){ reps+=1; interval = reps===1 ? 1 : reps===2 ? 3 : Math.max(4,interval*ease); ease=Math.min(2.8,ease+.03); }
    state.reviews[id] = {reps,interval,ease,due:Date.now()+interval*DAY};
  }

  function dueReviews(){
    const now=Date.now();
    return Object.entries(state.reviews).filter(([,r])=>r && r.due<=now).map(([id])=>CARDS.find(c=>c.id===id)).filter(Boolean);
  }

  function recommendationReason(card){
    if(state.mode==='explore') return 'Показано для расширения кругозора';
    if(state.topics.includes(card.topic)) return 'Потому что вы выбрали тему «'+card.topic+'»';
    if((state.weights[card.topic]||1)>1.7) return 'Потому что вы задерживались на похожих знаниях';
    return 'Новая тема: 1 из 5 карточек расширяет ленту';
  }

  function score(card){
    const levelPref = state.depth==='light' ? (card.level===1?1.1:-.7) : state.depth==='deep' ? (card.level>=2?1.0:.15) : (card.level===2?.8:.55);
    const interest = state.topics.includes(card.topic) ? 2.5 : 0;
    const weight = state.weights[card.topic] || 1;
    const novelty = state.views[card.id] ? Math.max(-1,-state.views[card.id]*.15) : .5;
    return interest+weight+levelPref+novelty+Math.random()*.85;
  }

  function rankedCards(){
    const target = location.hash.startsWith('#fact=') ? decodeURIComponent(location.hash.slice(6)) : null;
    let available = CARDS.filter(c=>!state.hidden.includes(c.id)).slice();
    if(state.mode==='explore') available.sort(()=>Math.random()-.5);
    else {
      available.sort((a,b)=>score(b)-score(a));
      const core=available.filter(c=>state.topics.includes(c.topic));
      const discovery=available.filter(c=>!state.topics.includes(c.topic));
      const mixed=[]; let i=0,j=0;
      while(mixed.length<available.length){
        if(mixed.length && mixed.length%5===4 && j<discovery.length) mixed.push(discovery[j++]);
        else if(i<core.length) mixed.push(core[i++]);
        else if(j<discovery.length) mixed.push(discovery[j++]);
        else break;
      }
      available=mixed;
    }
    if(target){const idx=available.findIndex(c=>c.id===target);if(idx>0)available.unshift(...available.splice(idx,1));}
    return available;
  }

  function renderApp(){
    $('#app').innerHTML = `
      <div class="app">
        <header class="topbar">
          <button class="brand" id="homeBtn" aria-label="В начало"><span class="logo">L</span><span class="brand-name">LearnFlow</span></button>
          <div class="top-actions"><div class="pill" id="streak">🔥 0</div><button class="icon-btn" id="settingsBtn" aria-label="Настройки">⚙</button></div>
        </header>
        <div class="goalbar"><div class="goal-track"><div class="goal-fill" id="goalFill"></div></div><div class="goal-label" id="goalLabel"></div></div>
        <div class="modebar"><button class="mode" data-mode="for">Для вас</button><button class="mode" data-mode="explore">Открытия</button><button class="mode" data-mode="quiz">Быстрый тест</button></div>
        <main class="feed-wrap"><section class="feed" id="feed" aria-live="polite"></section></main>
        <nav class="bottomnav"><button class="active" id="feedNav"><b>⌂</b>Лента</button><button id="reviewNav"><b id="reviewBadge">↺</b>Повторить</button><button id="savedNav"><b>▱</b>Сохранено</button><button id="progressNav"><b>▥</b>Прогресс</button></nav>
        <div class="backdrop hidden" id="backdrop"></div>
        <section class="sheet" id="sheet" role="dialog" aria-modal="true"><div class="handle"></div><div class="sheet-head"><div><div class="eyebrow" id="sheetEyebrow">Раздел</div><h2 id="sheetTitle">Заголовок</h2></div><button class="sheet-close" id="sheetClose" aria-label="Закрыть">×</button></div><div class="sheet-body" id="sheetBody"></div></section>
        <div class="toast" id="toast"></div>
      </div>`;
    bindChrome();
    updateChrome();
    setMode(state.mode || 'for', false);
    renderFeed();
    if(!state.onboarded) showOnboarding();
  }

  function renderFeed(){
    const feed=$('#feed'); if(!feed) return;
    let html='';
    if(state.mode==='quiz'){
      const pool=(dueReviews().length?dueReviews():state.learned.map(id=>CARDS.find(c=>c.id===id)).filter(Boolean));
      const cards=(pool.length?pool:rankedCards()).slice(0,10);
      cards.forEach((c,i)=>html+=quizHTML(c,i+1,true));
    }else{
      const cards=rankedCards();
      cards.forEach((c,i)=>{
        html+=cardHTML(c);
        if((i+1)%5===0 && i<cards.length-1) html+=quizHTML(cards[Math.max(0,i-2)],Math.floor((i+1)/5),false);
      });
    }
    feed.innerHTML=html;
    bindFeed();
    feedSlides=$$('.slide');
    observeSlides();
    updateChrome();
  }

  function cardHTML(c){
    const liked=state.liked.includes(c.id), saved=state.saved.includes(c.id), known=state.known.includes(c.id);
    return `<article class="slide" data-id="${esc(c.id)}" data-topic="${esc(c.topic)}">
      <div class="card">
        <div class="card-head"><span class="tag">${esc(c.topic)}</span><span class="micro">≈ 15 сек · уровень ${c.level}</span></div>
        <div class="card-body">
          <div class="eyebrow">${esc(c.type)}</div>
          <h1 class="title">${esc(c.title)}</h1>
          <p class="summary">${esc(c.summary)}</p>
          <div class="visual"><div class="big">${esc(c.visual[0])}</div><div class="vtext">${esc(c.visual[1])}</div></div>
          <div class="detail" id="detail-${esc(c.id)}"><div class="detail-main">${esc(c.detail)}</div><div class="memory"><b>Запомнить:</b> ${esc(c.memory)}</div><div class="source">Источник: <a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.source)} ↗</a></div><div class="reason">${esc(recommendationReason(c))}</div></div>
        </div>
        <div class="card-foot"><button class="learn-btn" data-expand="${esc(c.id)}">Разобрать ↓</button><div class="actions">
          <button class="action ${liked?'active':''}" data-like="${esc(c.id)}" aria-label="Нравится">♡</button>
          <button class="action ${saved?'active':''}" data-save="${esc(c.id)}" aria-label="Сохранить">☆</button>
          <button class="action known ${known?'active':''}" data-known="${esc(c.id)}" aria-label="Уже знаю">✓</button>
          <button class="action share" data-more="${esc(c.id)}" aria-label="Ещё">•••</button>
        </div></div>
      </div>
    </article>`;
  }

  function quizHTML(c,n,reviewMode){
    return `<article class="slide" data-quiz="${esc(c.id)}"><div class="card quiz-card"><div class="quiz-num">${String(n).padStart(2,'0')}</div><div class="eyebrow">${reviewMode?'Активное воспроизведение':'Проверка памяти'} · ${esc(c.topic)}</div><h2 class="quiz-title">${esc(c.q)}</h2><div class="answers">${c.answers.map((a,i)=>`<button class="answer" data-answer="${i}">${String.fromCharCode(65+i)}. ${esc(a)}</button>`).join('')}</div><div class="feedback"></div></div></article>`;
  }

  function bindChrome(){
    $('#homeBtn').onclick=()=>{closeSheet(); $('#feed').scrollTo({top:0,behavior:'smooth'});};
    $('#settingsBtn').onclick=showSettings;
    $('#feedNav').onclick=()=>{closeSheet(); $('#feed').scrollTo({top:0,behavior:'smooth'});};
    $('#reviewNav').onclick=showReview;
    $('#savedNav').onclick=showSaved;
    $('#progressNav').onclick=showProgress;
    $('#sheetClose').onclick=closeSheet;
    $('#backdrop').onclick=closeSheet;
    $$('.mode').forEach(b=>b.onclick=()=>setMode(b.dataset.mode,true));
  }

  function setMode(mode,rerender=true){
    state.mode=mode;
    $$('.mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    if(rerender){save();renderFeed();$('#feed').scrollTop=0;toast(mode==='for'?'Персональная лента':mode==='explore'?'Больше неожиданных тем':'Тест без подсказок');}
  }

  function bindFeed(){
    $$('[data-expand]').forEach(b=>b.onclick=()=>{
      const id=b.dataset.expand, d=$('#detail-'+CSS.escape(id)), c=CARDS.find(x=>x.id===id); if(!d||!c)return;
      d.classList.toggle('open'); b.textContent=d.classList.contains('open')?'Свернуть ↑':'Разобрать ↓';
      if(d.classList.contains('open')){state.weights[c.topic]+=0.35;markLearned(id);save();}
    });
    $$('[data-like]').forEach(b=>b.onclick=()=>toggleLike(b.dataset.like,b));
    $$('[data-save]').forEach(b=>b.onclick=()=>toggleSaved(b.dataset.save,b));
    $$('[data-known]').forEach(b=>b.onclick=()=>toggleKnown(b.dataset.known,b));
    $$('[data-more]').forEach(b=>b.onclick=()=>showCardMenu(b.dataset.more));
    $$('[data-quiz]').forEach(q=>q.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>answerQuiz(q,b)));
  }

  function toggleLike(id,b){
    const c=CARDS.find(x=>x.id===id),i=state.liked.indexOf(id); if(!c)return;
    if(i>=0){state.liked.splice(i,1);state.weights[c.topic]-=1;}else{state.liked.push(id);state.weights[c.topic]+=1.5;markLearned(id);}
    b.classList.toggle('active');save();toast(i>=0?'Убрано из понравившихся':'Похожего станет больше');
  }
  function toggleSaved(id,b){
    const i=state.saved.indexOf(id); if(i>=0)state.saved.splice(i,1);else{state.saved.push(id);markLearned(id);}
    b.classList.toggle('active');save();toast(i>=0?'Удалено':'Сохранено для повторения');
  }
  function toggleKnown(id,b){
    const c=CARDS.find(x=>x.id===id),i=state.known.indexOf(id); if(!c)return;
    if(i>=0)state.known.splice(i,1);else{state.known.push(id);state.weights[c.topic]-=.08;}
    b.classList.toggle('active');save();toast('Сложность ленты учтена');
  }

  function answerQuiz(q,b){
    if(q.dataset.done) return;
    q.dataset.done='1';
    const c=CARDS.find(x=>x.id===q.dataset.quiz), ans=Number(b.dataset.answer); if(!c)return;
    state.quizTotal += 1; const ok=ans===c.correct; if(ok) state.quizCorrect += 1;
    q.querySelectorAll('[data-answer]').forEach(x=>{if(Number(x.dataset.answer)===c.correct)x.classList.add('correct');else x.classList.add('dim');});
    q.querySelector('.feedback').innerHTML=(ok?'<b>Верно.</b> ':'<b>Не совсем.</b> ')+esc(c.memory);
    markLearned(c.id); scheduleReview(c.id,ok?'good':'again'); save();
  }

  function observeSlides(){
    if(viewTimer) clearTimeout(viewTimer);
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(e=>{
        if(!e.isIntersecting || e.intersectionRatio<.72) return;
        if(activeSlide && activeSlide!==e.target) recordDwell(activeSlide);
        activeSlide=e.target; activeSince=Date.now(); currentIndex=feedSlides.indexOf(e.target);
        if(e.target.dataset.id){
          const id=e.target.dataset.id; state.views[id]=(state.views[id]||0)+1; save();
          clearTimeout(viewTimer); viewTimer=setTimeout(()=>{if(activeSlide===e.target)markLearned(id);},5000);
        }
      });
    },{root:$('#feed'),threshold:[.72]});
    feedSlides.forEach(s=>observer.observe(s));
  }

  function recordDwell(slide){
    if(!slide || !slide.dataset.id || !activeSince) return;
    const ms=Date.now()-activeSince, id=slide.dataset.id, c=CARDS.find(x=>x.id===id); if(!c)return;
    state.dwell[id]=(state.dwell[id]||0)+ms;
    if(ms<1300) state.weights[c.topic]-=.04;
    else if(ms>7000) state.weights[c.topic]+=.05;
  }

  function showCardMenu(id){
    const c=CARDS.find(x=>x.id===id); if(!c)return;
    openSheet('Карточка','Что сделать?',`<div class="menu-grid">
      <button class="menu-btn" id="shareCard"><b>Поделиться</b><small>Ссылка откроет этот факт</small></button>
      <button class="menu-btn" id="whyCard"><b>Почему это здесь?</b><small>${esc(recommendationReason(c))}</small></button>
      <button class="menu-btn" id="lessCard"><b>Меньше этой темы</b><small>Ослабить «${esc(c.topic)}»</small></button>
      <button class="menu-btn danger" id="hideCard"><b>Скрыть карточку</b><small>Не показывать снова</small></button>
    </div>`);
    $('#shareCard').onclick=()=>shareCard(c);
    $('#whyCard').onclick=()=>toast(recommendationReason(c));
    $('#lessCard').onclick=()=>{state.weights[c.topic]-=.75;save();closeSheet();renderFeed();toast('Тема ослаблена');};
    $('#hideCard').onclick=()=>{if(!state.hidden.includes(id))state.hidden.push(id);save();closeSheet();renderFeed();toast('Карточка скрыта');};
  }

  async function shareCard(c){
    const url=location.origin+location.pathname+'#fact='+encodeURIComponent(c.id);
    const text=c.title+' — LearnFlow';
    try{
      if(navigator.share) await navigator.share({title:'LearnFlow',text,url});
      else {await navigator.clipboard.writeText(url);toast('Ссылка скопирована');}
    }catch(e){}
  }

  function openSheet(ey,title,html){
    $('#sheetEyebrow').textContent=ey; $('#sheetTitle').textContent=title; $('#sheetBody').innerHTML=html;
    $('#backdrop').classList.remove('hidden'); requestAnimationFrame(()=>$('#sheet').classList.add('open'));
  }
  function closeSheet(){ $('#sheet')?.classList.remove('open'); setTimeout(()=>$('#backdrop')?.classList.add('hidden'),240); }

  function showSaved(){
    const list=state.saved.map(id=>CARDS.find(c=>c.id===id)).filter(Boolean);
    openSheet('Библиотека','Сохранено',list.length?list.map(c=>`<button class="row" data-open-card="${esc(c.id)}" style="display:block;width:100%;text-align:left;background:#fff"><small>${esc(c.topic)} · ${esc(c.type)}</small><strong>${esc(c.title)}</strong><p>${esc(c.memory)}</p></button>`).join(''):'<div class="row">Нажмите ☆ на карточке — знание появится здесь и попадёт в повторение.</div>');
    $$('[data-open-card]').forEach(b=>b.onclick=()=>{location.hash='fact='+b.dataset.openCard;closeSheet();state.mode='for';renderFeed();$('#feed').scrollTop=0;});
  }

  function showReview(){
    const due=dueReviews();
    const fallback=state.learned.slice(-6).reverse().map(id=>CARDS.find(c=>c.id===id)).filter(Boolean);
    const list=due.length?due:fallback;
    openSheet('Интервальное повторение',due.length?'Пора вспомнить':'Тренировка памяти',list.length?list.map(c=>`<div class="row review-card" data-review="${esc(c.id)}"><small>${esc(c.topic)} ${due.includes(c)?'· срок наступил':'· тренировочный режим'}</small><strong>${esc(c.q)}</strong><div><button class="learn-btn reveal" style="margin-top:10px">Показать ответ</button></div><div class="review-answer"><b>${esc(c.answers[c.correct])}</b><p>${esc(c.memory)}</p><div class="review-actions"><button class="rate" data-rate="again">Не помню · 10 мин</button><button class="rate" data-rate="hard">Трудно</button><button class="rate good" data-rate="good">Помню</button></div></div></div>`).join(''):'<div class="row">Изучите несколько карточек — здесь появится очередь повторения.</div>');
    $$('.review-card').forEach(row=>{
      row.querySelector('.reveal').onclick=()=>row.classList.add('revealed');
      row.querySelectorAll('[data-rate]').forEach(b=>b.onclick=()=>{scheduleReview(row.dataset.review,b.dataset.rate);save();row.remove();toast(b.dataset.rate==='good'?'Интервал увеличен':b.dataset.rate==='hard'?'Повторим раньше':'Вернём через 10 минут');});
    });
  }

  function showProgress(){
    const acc=state.quizTotal?Math.round(state.quizCorrect/state.quizTotal*100):0;
    const sorted=TOPICS.map(([t])=>[t,state.weights[t]||1]).sort((a,b)=>b[1]-a[1]);
    const max=Math.max(...sorted.map(x=>x[1]),1);
    openSheet('Ваши данные','Прогресс',`<div class="stats"><div class="stat"><small>Изучено</small><b>${state.learned.length}</b></div><div class="stat"><small>Серия</small><b>${state.streak}</b></div><div class="stat"><small>Точность</small><b>${acc}%</b></div></div><div class="row" style="margin-top:12px"><small>Сегодня</small><strong>${state.daily.count} из ${state.goal} знаний</strong><p>${dueReviews().length} карточек сейчас требуют повторения.</p></div><div class="topic-bars">${sorted.map(([t,w])=>`<div class="topicbar"><span>${esc(t)}</span><span class="bar"><i style="width:${clamp((w/max)*100,4,100)}%"></i></span><b>${Math.round(w*10)/10}</b></div>`).join('')}</div>`);
  }

  function showSettings(){
    const installButton=deferredInstall?'<button class="menu-btn" id="installBtn"><b>Установить приложение</b><small>Добавить LearnFlow на устройство</small></button>':'';
    openSheet('LearnFlow','Настройки',`<div class="row"><small>Дневная цель</small><strong><span id="goalValue">${state.goal}</span> знаний в день</strong><input id="goalRange" type="range" min="3" max="30" value="${state.goal}" style="width:100%;margin-top:12px"></div><div class="menu-grid">${installButton}<button class="menu-btn" id="editInterests"><b>Интересы</b><small>${state.topics.length} тем выбрано</small></button><button class="menu-btn" id="exportData"><b>Экспорт прогресса</b><small>Скачать локальные данные JSON</small></button><button class="menu-btn danger" id="resetData"><b>Сбросить профиль</b><small>Удалить локальный прогресс</small></button></div><div class="row" style="margin-top:10px"><small>Как работает лента</small><p>Лайки, раскрытие объяснения, сохранения, длительность просмотра и отметка «уже знаю» меняют вес тем. Примерно каждая пятая карточка специально выходит за пределы привычных интересов.</p></div>`);
    $('#goalRange').oninput=e=>{$('#goalValue').textContent=e.target.value;state.goal=Number(e.target.value);save();};
    $('#editInterests').onclick=()=>{closeSheet();showOnboarding(true);};
    $('#exportData').onclick=exportData;
    $('#resetData').onclick=()=>{if(confirm('Сбросить весь локальный прогресс LearnFlow?')){localStorage.removeItem(KEY);localStorage.removeItem(OLD_KEY);location.reload();}};
    if($('#installBtn')) $('#installBtn').onclick=async()=>{deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;closeSheet();};
  }

  function exportData(){
    const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='learnflow-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function showOnboarding(edit=false){
    const wrap=document.createElement('div');wrap.className='onboard';wrap.id='onboarding';
    wrap.innerHTML=`<div class="onbox"><div class="onhead"><span class="logo">L</span><span class="step" id="onStep">1 / 3</span></div><section class="onpanel" id="on1"><div class="eyebrow">Персональная лента</div><h1>Что вам действительно интересно?</h1><p class="lead">Выберите минимум 3 темы. Это только старт: дальше LearnFlow будет учиться по вашему поведению.</p><div class="chips" id="topicChips"></div><button class="primary" id="onNext1">Продолжить</button></section><section class="onpanel hidden" id="on2"><div class="eyebrow">Глубина</div><h1>Как объяснять?</h1><p class="lead">Сложность отдельных карточек всё равно будет подстраиваться по мере использования.</p><div class="choices"><button class="choice" data-depth="light"><strong>Легко</strong><small>Факт и простая причина</small></button><button class="choice" data-depth="balanced"><strong>Сбалансированно</strong><small>Факт → механизм → вывод</small></button><button class="choice" data-depth="deep"><strong>Глубже</strong><small>Больше нюансов и сложных карточек</small></button></div><button class="primary" id="onNext2">Продолжить</button></section><section class="onpanel hidden" id="on3"><div class="eyebrow">Ритм</div><h1>Сколько знаний в день?</h1><p class="lead">Лучше короткая ежедневная сессия, чем редкие марафоны. Цель можно изменить позже.</p><div class="choices"><button class="choice" data-goal="5"><strong>5 знаний</strong><small>≈ 2–3 минуты</small></button><button class="choice" data-goal="10"><strong>10 знаний</strong><small>≈ 5 минут</small></button><button class="choice" data-goal="20"><strong>20 знаний</strong><small>≈ 10 минут</small></button></div><button class="primary" id="finishOn">${edit?'Сохранить настройки':'Начать учиться →'}</button></section></div>`;
    document.body.appendChild(wrap);
    const selected=new Set(state.topics);
    TOPICS.forEach(([t,sub])=>{const b=document.createElement('button');b.className='chip'+(selected.has(t)?' active':'');b.innerHTML=`<strong>${esc(t)}</strong><small>${esc(sub)}</small>`;b.onclick=()=>{selected.has(t)?selected.delete(t):selected.add(t);b.classList.toggle('active');$('#onNext1').disabled=selected.size<3;};$('#topicChips').appendChild(b);});
    $('#onNext1').disabled=selected.size<3;
    $$('.choice[data-depth]').forEach(b=>{b.classList.toggle('active',b.dataset.depth===state.depth);b.onclick=()=>{$$('.choice[data-depth]').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.depth=b.dataset.depth;};});
    $$('.choice[data-goal]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.goal)===state.goal);b.onclick=()=>{$$('.choice[data-goal]').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.goal=Number(b.dataset.goal);};});
    $('#onNext1').onclick=()=>{state.topics=[...selected];$('#on1').classList.add('hidden');$('#on2').classList.remove('hidden');$('#onStep').textContent='2 / 3';};
    $('#onNext2').onclick=()=>{$('#on2').classList.add('hidden');$('#on3').classList.remove('hidden');$('#onStep').textContent='3 / 3';};
    $('#finishOn').onclick=()=>{state.topics=[...selected];state.onboarded=true;state.topics.forEach(t=>state.weights[t]=Math.max(state.weights[t]||1,2.2));save();wrap.remove();renderFeed();};
  }

  function maybeCelebrateGoal(){
    if(state.daily.count<state.goal || state.goalCelebrated===todayKey()) return;
    state.goalCelebrated=todayKey();save();
    const o=document.createElement('div');o.className='goal-done';o.innerHTML=`<div class="goal-card"><div class="goal-icon">✓</div><div class="eyebrow" style="justify-content:center">Цель дня выполнена</div><h2>${state.goal} знаний сегодня</h2><p>Новые карточки никуда не исчезают, но полезнее остановиться на минуту и позже вернуться к повторению.</p><div class="goal-actions"><button class="primary" id="goalReview">Повторить изученное</button><button id="goalContinue">Продолжить ленту</button></div></div>`;document.body.appendChild(o);
    $('#goalReview').onclick=()=>{o.remove();showReview();};$('#goalContinue').onclick=()=>o.remove();
  }

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeSheet();return;}
    if($('#sheet')?.classList.contains('open') || $('#onboarding')) return;
    if(e.key==='ArrowDown' && feedSlides[currentIndex+1]) feedSlides[currentIndex+1].scrollIntoView({behavior:'smooth'});
    if(e.key==='ArrowUp' && feedSlides[currentIndex-1]) feedSlides[currentIndex-1].scrollIntoView({behavior:'smooth'});
    if(e.key===' ' && activeSlide?.dataset.id){e.preventDefault();const b=activeSlide.querySelector('[data-expand]');if(b)b.click();}
  });

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});
  window.addEventListener('hashchange',()=>{if(state.onboarded){state.mode='for';renderFeed();$('#feed').scrollTop=0;}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)recordDwell(activeSlide);});
  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

  renderApp();
})();