import {inspectSurfaces,inspectGroupPairs} from './engine/contact.js';

// Evaluate the assembled model in its normal scene coordinates. The viewer
// must restore an isolated/exploded view before calling this helper.
// A result only describes the named pairs in this pose, never the entire robot.
export function assessPose(model, tool) {
  const mechanisms = model?.mechanisms;
  const report = {
    status: 'unavailable',
    modelVersion: model?.root?.userData?.version ?? null,
    modelOnly: true,
    allPairsChecked: false,
    scope: {
      contactPairs: tool === 'breaker-loader' ? [] : ['active-tool/bucket', 'active-tool/hood'],
      nominalGround: true,
      excluded: 'Приводы, ходовая, остальные пары деталей и другие положения не проверяются.'
    },
    broad: null,
    surfaces: null
  };
  if (typeof mechanisms?.inspectPose !== 'function') {
    return {messages: ['Проверка контактов для этой модели недоступна.'], report};
  }

  model.root?.updateMatrixWorld(true);
  const broad = mechanisms.inspectPose();
  report.broad = broad;
  const activeTool = broad.tool ?? model.root?.userData?.activeWorkTool;
  const hood = model.meshes?.find(mesh => mesh.name.startsWith('Кожух с плоской'));
  // Do not refine a different tool from the one whose current geometry was
  // assessed. If refinement is unavailable, retain an explicitly coarse result.
  function coarse(reason) {
    report.status = 'broad-only';
    report.refinementUnavailable = reason;
    const messages = (broad.alerts || []).map(message => 'Габаритная оценка: ' + message + '.');
    messages.push('Контакт поверхностей не проверен.');
    return {messages, report};
  }
  if (!['gripper', 'breaker-arm', 'breaker-loader'].includes(tool) || tool !== activeTool) {
    return coarse('Tool selection does not match the active model geometry.');
  }
  if (!hood || !Number.isFinite(broad.datum)) {
    return coarse('Required hood geometry or nominal datum is unavailable.');
  }

  let surfaces;
  try {
    surfaces = inspectSurfaces(mechanisms, hood, tool, broad);
  } catch (error) {
    return coarse(error instanceof Error ? error.message : String(error));
  }
  report.surfaces = surfaces;
  const messages = [];
  if (surfaces.ground) {
    messages.push('В модели ниже условной плоскости опоры: ' + surfaces.ground.mesh.split('/').at(-1) + '.');
  }
  let confirmed = false, unresolved = false;
  for (const envelope of surfaces.envelopes) {
    const part = envelope.group === 'bucket' ? 'ковша' : 'кожуха';
    if (envelope.hits.length) {
      confirmed = true;
      messages.push('Подтверждён контакт поверхностей рабочего органа и ' + part + ' в модели.');
    } else if (envelope.unresolved.length) {
      unresolved = true;
      messages.push('Возможен контакт рабочего органа и ' + part + '; зазор не установлен.');
    }
  }
  report.status = surfaces.ground || confirmed ? 'confirmed' : unresolved ? 'unresolved' : 'clear-in-checked-scope';
  if (!messages.length && broad.alerts.length) {
    messages.push(tool === 'breaker-loader'
      ? 'Рабочий орган выше условной плоскости. Контакты остальных узлов этой комплектации не проверены.'
      : 'Предварительное предупреждение не подтвердилось: в проверенных парах поверхностей установлен зазор.');
  }
  return {messages, report};
}

const names1986 = {
  'grapple/bucket':'грейфера и ковша',
  'grapple/hood':'грейфера и арочного кожуха',
  'grapple/deck':'грейфера и настила платформы',
  'grapple/front-equipment':'грейфера и переднего оборудования',
  'bucket/front-equipment':'ковша и переднего оборудования'
};

export function pairs1986(model) {
  const {grab,scoop}=model.mechanisms;
  const hood=model.root.getObjectByName('Арочный кожух');
  const deck=model.root.getObjectByName('Настил платформы');
  const front=model.root.getObjectByName('Оборудование на конце у ковша');
  return [
    {id:'grapple/bucket',a:grab,b:scoop},
    {id:'grapple/hood',a:grab,b:hood},
    {id:'grapple/deck',a:grab,b:deck},
    {id:'grapple/front-equipment',a:grab,b:front},
    {id:'bucket/front-equipment',a:scoop,b:front}
  ];
}

// The 1986 model has a different grapple and loader. Never reuse the 1987
// group names or silently classify an untested machine as collision-free.
export function assess1986Pose(model) {
  const report={status:'unavailable',modelVersion:model?.root?.userData?.version??null,modelOnly:true,allPairsChecked:false,
    scope:{contactPairs:Object.keys(names1986),nominalGround:true,
      excluded:'Стрела, приводы, остальные пары деталей и другие положения не проверяются.'},ground:null,pairs:[]};
  const messages=[];
  if(typeof model?.auditPose!=='function'||!model.mechanisms)return {messages:['Проверка контактов для этой модели недоступна.'],report};
  try{
    model.root.updateMatrixWorld(true);
    const {bucketClearance,grappleClearance}=model.auditPose();
    if(![bucketClearance,grappleClearance].every(Number.isFinite))throw Error('Некорректный просвет');
    report.ground={bucketClearance,grappleClearance,below:Math.min(bucketClearance,grappleClearance)<-.001};
    if(report.ground.below)messages.push('Рабочий орган ниже условной плоскости опоры модели.');
    report.pairs=inspectGroupPairs(pairs1986(model));
    for(const pair of report.pairs){
      if(pair.status==='confirmed')messages.push('Подтверждён контакт поверхностей '+names1986[pair.id]+' в модели.');
      else if(pair.status==='unresolved')messages.push('Возможен контакт '+names1986[pair.id]+'; зазор не установлен.');
    }
    report.status=report.ground.below||report.pairs.some(p=>p.status==='confirmed')?'confirmed':
      report.pairs.some(p=>p.status==='unresolved')?'unresolved':'clear-in-checked-scope';
  }catch(error){
    report.status='unavailable';report.refinementUnavailable=String(error);
    messages.push('Проверка выбранных контактов не завершена.');
  }
  return {messages,report};
}
