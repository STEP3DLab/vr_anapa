import {inspectSurfaces} from './engine/contact.js';

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
