import React,{useEffect,useRef,useState} from 'react';
import {createExperience} from './worldEngine';
export default function Experience(){
 const host=useRef<HTMLDivElement>(null),game=useRef<ReturnType<typeof createExperience>|null>(null),dialog=useRef<HTMLDialogElement>(null);
 const [scene,setScene]=useState('hub'),[status,setStatus]=useState('Подготовка пространства…'),[error,setError]=useState('');
 const [entering,setEntering]=useState(false),[help,setHelp]=useState(false),[muted,setMuted]=useState(false),[clean,setClean]=useState(false),[presentation,setPresentation]=useState(false);
 const [paused,setPaused]=useState(false),[xr,setXR]=useState(false),[supported,setSupported]=useState<boolean>(),[phase,setPhase]=useState('hub'),[action,setAction]=useState('Захватить груз'),[hint,setHint]=useState(''),[diagnostics,setDiagnostics]=useState('');
 const hub=scene==='hub',cargo=scene==='cargo',ground=cargo||scene==='robot',busy=action.includes('работает');
 const title=hub?'VR-пространство':cargo?'Полигон Лосинка':scene==='robot'?'Робот-арена':'Дрон-тир';
 async function enterVR(){
  if(entering)return;if(!game.current){setError('3D-сцена не запустилась. Обновите страницу и проверьте сообщение об ошибке.');return;}
  setEntering(true);try{if(xr)await game.current.exitVR();else await game.current.enterVR();setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setEntering(false);}
 }
 useEffect(()=>{
  try{game.current=createExperience(host.current!,{status:setStatus,scene:setScene,presentation:setPresentation,paused:setPaused,xr:setXR,support:setSupported,error:setError,phase:setPhase,action:setAction,hint:setHint,
   diagnostics:new URLSearchParams(location.search).has('diagnostics')?d=>setDiagnostics(`${d.xr?'XR':'Экран'} · ${d.fps} кадр/с · ${d.calls} вызовов · ${d.triangles.toLocaleString('ru')} треуг. · ${d.geometries} геом. / ${d.textures} текстур`):undefined});}
  catch(e){setError('Не удалось запустить 3D: '+String(e));}
  return()=>{game.current?.dispose();game.current=null;};
 },[]);
 useEffect(()=>{game.current?.setHelpOpen(help);if(help)dialog.current?.showModal();else dialog.current?.close();},[help]);
 function newVisitor(){setHelp(false);setClean(false);game.current?.nextVisitor();}
 const readyAction=phase==='training'||phase==='ready'||phase==='ended';
 return <div className={`experience ${hub?'is-hub':'is-game'}${clean?' clean':''}${xr?' xr-active':''}`} onClick={e=>{const target=e.target as HTMLElement;if(e.detail>0&&!target.closest('dialog'))target.closest('button')?.blur();}}>
  <div ref={host} className="world" aria-label="Интерактивная трёхмерная сцена"/>
  <header className="game-header">
   <button className="wordmark" onClick={()=>game.current?.go('hub')} aria-label="Технопарк РГСУ — в холл"><i>Т.</i><span>ТЕХНОПАРК<small>РГСУ / VR-ПРОСТРАНСТВО</small></span></button>
   <div className="header-tools"><span className="live-badge">ВЕРСИЯ 9</span><button aria-pressed={muted} onClick={()=>setMuted(game.current?.toggleSound()??false)}>{muted?'Звук выкл.':'♪ Звук вкл.'}</button><button onClick={()=>setHelp(true)}>Как играть ?</button><button aria-pressed={presentation} onClick={()=>game.current?.setPresentation(!presentation)}>{presentation?'Показ ∞ включён':'Режим показа'}</button><button className="clean-toggle" aria-pressed={clean} onClick={()=>setClean(!clean)}>{clean?'Вернуть интерфейс':'Чистый вид ↗'}</button></div>
  </header>
  {!clean&&<>
   <main className="game-overlay"><div className="eyebrow"><span/>{hub?'ПРОСТРАНСТВО ВОЗМОЖНОСТЕЙ':cargo?'03 / ЛОГИСТИКА':scene==='robot'?'01 / КОНТРОЛЬ':'02 / РЕАКЦИЯ'}</div>
    <h1>{hub?<>Искусство.<br/>Технологии.<br/><em>Вы внутри.</em></>:title}</h1>
    <p>{hub?'Кинетическое «Ядро», три портала и инженерные испытания. Выберите сцену или исследуйте павильон.':cargo?'Доставьте три груза на зелёную базу. За один рейс — один груз.':scene==='robot'?'Соберите 5 энергоячеек, разрушьте 6 блоков и победите «Бульдозер».':'Шесть зарядов. Бронированные цели. Флагман на 40-й секунде.'}</p>
   </main>
   <aside className="game-status"><span className="status-label">{hub?'ЖИВАЯ ИНСТАЛЛЯЦИЯ':title+(presentation?' · ПОКАЗ БЕЗ ТАЙМЕРА':'')}</span><strong>{status}</strong>{cargo&&!paused&&phase!=='ready'&&phase!=='ended'&&<p className="cargo-hint">{hint}</p>}</aside>
   {hub?<section className="portal-cards" aria-label="Выберите испытание">
    {[['robot','01 / КОНТРОЛЬ','Робот-арена','Спиннер · энергоячейки · финальная дуэль'],['drones','02 / РЕАКЦИЯ','Дрон-тир','Точность · серии попаданий · флагман'],['cargo','03 / ЛОГИСТИКА','Полигон Лосинка','Робот 6×6 · захват · доставка грузов']].map(([mode,number,name,desc])=><button key={mode} onClick={()=>game.current?.go(mode as 'robot'|'drones'|'cargo')}><span className="card-number">{number}</span><strong>{name} <b>↗</b></strong><small>{desc}</small></button>)}
   </section>:<div className="round-actions">
    {paused?<button className="start-round" onClick={()=>game.current?.resume()}>▶ Продолжить</button>:readyAction?<button className="start-round" onClick={()=>game.current?.start()}>{phase==='training'?'Начать раунд / пропустить урок →':phase==='ended'?'Ещё один раунд →':'Начать раунд →'}</button>:<button onClick={()=>game.current?.setPaused(true)}>Ⅱ Пауза</button>}
    {readyAction&&<button onClick={()=>{game.current?.resume();game.current?.train();}}>Пройти обучение</button>}
   </div>}
   {ground&&<div className="touch-controls" aria-label="Управление роботом">
    {[['↑','w','Вперёд'],['←','a','Повернуть влево'],['↓','s','Назад'],['→','d','Повернуть вправо']].map(([label,key,name])=><button key={key} aria-label={name} disabled={paused||busy&&cargo} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);game.current?.key(key,true);}} onPointerUp={()=>game.current?.key(key,false)} onPointerCancel={()=>game.current?.key(key,false)} onLostPointerCapture={()=>game.current?.key(key,false)}>{label}</button>)}
    <button className="robot-action" disabled={paused||busy&&cargo} onClick={()=>cargo?game.current?.cargoAction():game.current?.spin()}>{cargo?action:'Спиннер'}</button>
   </div>}
   {scene==='drones'&&<button className="reload" disabled={paused} onClick={()=>game.current?.reload()}>Перезарядка / R</button>}
  </>}
  <footer className="bottom-dock">
   {!clean&&<div className="game-footer"><span>{hub?'WASD — ход · Мышь — осмотр · Q/E — поворот':ground?'W/S — ход · A/D — поворот · Пробел — действие':'Клик по цели — выстрел · R — перезарядка'}</span><nav aria-label="Действия с сеансом">{hub&&<button onClick={()=>game.current?.welcome()}>Появление «Ядра»</button>}<button onClick={newVisitor}>Новый посетитель</button>{!hub&&<><button onClick={()=>{game.current?.resume();game.current?.restart();}}>↻ Сброс</button><button onClick={()=>game.current?.go('hub')}>⌂ Холл</button></>}<a href="?gallery=1">3D-галерея ↗</a></nav></div>}
   <div className="vr-entry"><button disabled={entering} onClick={enterVR}>{entering?'Подключение…':xr?'Выйти из VR':'◉ Войти в VR'}</button><span>{supported===false?'Для VR откройте ссылку в браузере очков':supported?'WEBXR ГОТОВ · ВЕРСИЯ 9':'ПРОВЕРКА WEBXR · ВЕРСИЯ 9'}</span></div>
  </footer>
  {diagnostics&&!clean&&<output data-diagnostics className="diagnostics">{diagnostics}</output>}
  <dialog ref={dialog} className="help-panel" aria-labelledby="help-title" onCancel={e=>{e.preventDefault();setHelp(false);}}><button className="close-help" onClick={()=>setHelp(false)}>Закрыть ×</button><div className="eyebrow">КРАТКИЙ ИНСТРУКТАЖ</div><h2 id="help-title">Всё под рукой.</h2><div className="help-grid"><article><h3>В очках</h3><p>Левый стик — ходьба в холле или управление наземным роботом. Правый стик — поворот наблюдателя на 30°. Луч и курок — выбор портала, кнопки или светового круга телепортации. Пульт задания расположен слева от игровой зоны.</p><p>Правый курок — спиннер, выстрел или захват. Правая боковая кнопка — перезарядка в тире. Левая боковая кнопка — возврат в холл.</p><p>После системного меню или снятия очков игра приостанавливается. Отпустите стики и нажмите «Продолжить» либо правый курок мимо кнопок. Камера не едет вслед за наземным роботом.</p></article><article><h3>Грузы на полигоне</h3><p>Подъедьте передней частью к грузу, пока его кольцо не станет зелёным. Отпустите стик, остановитесь и нажмите правый курок. Манипулятор сам захватит груз и уложит на заднюю платформу. Дождитесь завершения движения стрелы.</p><p>Вернитесь в центр зелёной базы и снова нажмите курок. После выгрузки отправляйтесь за следующим грузом. Бетонные барьеры нужно объезжать; грунт замедляет робота, рампа проезжаема.</p><p>На компьютере W/S или ↑/↓ — ход, A/D или ←/→ — поворот, пробел — действие. В тире клик по цели — выстрел, R — перезарядка. P — пауза, пробел — продолжить. На телефоне есть экранные кнопки.</p></article></div><p className="help-note">«Режим показа» отключает таймеры и запись результатов в рекорды. «Новый посетитель» сбрасывает обучение и задания, сохраняя этот режим. Полигон — демонстрационная планировка, робот — стилизованная модель, не точная CAD-реконструкция. Локальные GLB/STL открываются отдельно в 3D-галерее и не синхронизируются между устройствами.</p><button className="start-round" onClick={()=>setHelp(false)}>Всё понятно →</button></dialog>
  {error&&<div className="game-error" role="alert"><button aria-label="Закрыть сообщение" onClick={()=>setError('')}>×</button>{error}</div>}
 </div>;
}
