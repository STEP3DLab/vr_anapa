// Measurements are in the coordinate system of their source study. The WebP
// copies retain the full frame, with a small rounding of the output aspect ratio.
function overlay([width, height], [studyWidth, studyHeight], landmarks, outlines = []) {
  const scale = ([x, y]) => [x * width / studyWidth, y * height / studyHeight];
  const points = [];
  for (const [label, photo, model] of landmarks) {
    for (const [kind, position] of [['photo', photo], ['model', model]]) {
      if (!position) continue;
      const [x, y] = scale(position);
      points.push({x, y, label, kind});
    }
  }
  const lines = outlines.map(([label, coordinates]) => ({
    label, kind: 'model', points: coordinates.map(scale)
  }));
  return {width, height, points, lines};
}

// 1986: research/mobot/1986/v7/{landmarks.json,registration/registration.json,
// archive-camera.mjs,anchors.mjs,final-hanger.mjs}. Projections are from the
// current v7 geometry, including the revised hood and grapple suspension.
// 1987: research/mobot/1987/night-20261118/{poses.js,deck-camera.js,
// hood-views.json,hood-results.json,boom-pose.json,bucket-cheek.json,
// jaw-opening.json,breaker-photo.json}. The references for two local tool
// registrations differ from the deck-based camera for photographs 2 and 4.
export const registrations = {
  '1986-fig6': {
    pose: {yaw: 33.882, boom: 0, grab: 4, loader: 0, tip: 0, track: 0},
    tool: 'gripper', view: 'side',
    direction: [0.214206, 0.110229, 0.970549],
    up: [-0.107791, 0.990211, -0.088672],
    note: 'Ракурс подобран по шасси. Сравните высоту траверсы грейфера и верх кожуха. Угол раскрытия челюстей задан для показа.',
    overlay: overlay([1277, 1000], [1456, 1140], [
      ['Оголовок стрелы', [271, 260], [271.06, 259.83]],
      ['Траверса грейфера', [293, 467], [259.07, 398.55]],
      ['Верх кожуха', [439, 633], [445.32, 627.75]],
      ['Седьмой нижний каток', [790, 993], [769.69, 966.48]]
    ])
  },
  '1986-fig9': {
    pose: {yaw: 110.863, boom: 32, grab: 28, loader: 0, tip: 0, track: 0},
    tool: 'gripper', view: 'iso',
    direction: [0.610953, 0.088044, -0.786756],
    up: [0.072561, 0.983386, 0.166395],
    note: 'Стрела развёрнута к ковшу. Палец подвеса частично закрыт. Расхождение у траверсы показывает, насколько её положение зависит от принятой геометрии подвеса и позы.',
    overlay: overlay([738, 1000], [864, 1170], [
      ['Оголовок стрелы', [244, 80], [243.81, 91.32]],
      ['Траверса грейфера', [243, 345], [226.17, 200.63]],
      ['Верх кожуха', [729, 718], [720.20, 688.44]],
      ['Третий нижний каток', [660, 958], [678.52, 923.74]]
    ])
  },
  '1987-before-dispatch': {
    pose: {yaw: 0, arm: 0, wrist: 90, claw: 7, bucket: 12, tip: 3, track: 0},
    tool: 'gripper', view: 'side',
    direction: [-0.106764, 0.213015, -0.971198],
    up: [0.015870, 0.977022, 0.212548],
    note: 'На снимке № 2 машина перед отправкой. Ракурс подобран по видимым кромкам платформы. В этой позе сопоставлены оголовок, кожух и верхний задний угол боковины ковша.',
    overlay: overlay([1280, 968], [1000, 756], [
      ['Палец оголовка', [835, 106], [823.27, 109.35]],
      ['Верх кожуха', [213, 482], [213, 485.90]],
      ['Задний угол боковины ковша', [747, 470], [700.45, 459.54]]
    ])
  },
  '1987-snow-side': {
    pose: {yaw: 180, arm: -1, wrist: 90, claw: 4, bucket: 0, tip: 0, track: 0},
    tool: 'gripper', view: 'side',
    direction: [-0.061313, 0.100011, -0.993095],
    up: [0.008592, 0.994983, 0.099671],
    note: 'На снимке № 4 стрела повёрнута над кожухом. Ракурс подобран по платформе. Для сверки ковша взят верхний задний угол боковины, поскольку снег закрывает режущую кромку.',
    overlay: overlay([1280, 917], [1000, 716], [
      ['Палец оголовка', [104, 95], [117.30, 82.00]],
      ['Верх кожуха', [185, 391], [185, 372.74]],
      ['Задний угол боковины ковша', [719, 477], [638.03, 440.26]]
    ])
  },
  '1987-front': {
    pose: {yaw: 90, arm: 0, wrist: 90, claw: 14, bucket: 0, tip: 0, track: 0},
    tool: 'gripper', view: 'side',
    note: 'На снимке № 3 схват обращён к наблюдателю. Контуры модели совмещены по трём углам правой на снимке губки. Левая губка позволяет проверить раскрытие.',
    overlay: overlay([1280, 947], [1000, 740], [
      ['Правый верхний наружный угол', [647, 548]],
      ['Правый верхний внутренний угол', [556, 578]],
      ['Правый нижний наружный угол', [630, 653]],
      ['Левый верхний наружный угол', [343, 558], [348.91, 554.64]],
      ['Левый верхний внутренний угол', [436, 583], [435.73, 580.68]],
      ['Левый нижний внутренний угол', [435, 685], [428.41, 678.75]]
    ], [
      ['Контур левой губки', [[428.41, 678.75], [350.26, 659.23], [343.72, 624.13], [348.91, 554.64], [435.73, 580.68], [428.41, 678.75]]],
      ['Контур правой губки', [[641.81, 617.49], [630, 653], [548.68, 676.07], [556, 578], [647, 548], [641.81, 617.49]]]
    ])
  },
  '1987-breaker': {
    pose: {yaw: -65, arm: 22, wrist: 60, claw: 4, bucket: 0, tip: 0, track: 0},
    tool: 'breaker-arm', view: 'iso',
    direction: [-3.1, 1.65, -5.5],
    note: 'На снимке № 9 молоток закреплён на стреле. Его профиль совмещён по видимой оси ствола и зубила. Пространственное положение машины показано приблизительно.',
    overlay: overlay([1280, 838], [1000, 1346 * 1000 / 2056], [
      ['Начало измеренного участка ствола', [743.50, 458.23]],
      ['Утолщение ствола', [798.37, 510.81]],
      ['Конец зубила', [856.85, 566.86]]
    ], [
      ['Одна кромка профиля молотка', [[750.71, 452.15], [799.60, 499.41], [802.28, 498.06], [812.50, 507.62], [809.19, 512.53], [834.46, 536.74], [834.10, 538.57], [856.95, 565.31]]],
      ['Другая кромка профиля молотка', [[737.73, 465.69], [787.03, 512.53], [785.79, 515.27], [795.79, 525.07], [800.54, 521.55], [825.81, 545.77], [827.62, 545.33], [855.31, 567.02]]]
    ])
  }
};

// Compare only landmarks explicitly observed in the image and projected by the model.
export function landmarkDifferences(overlay) {
  const projected=new Map(overlay.points.filter(p=>p.kind==='model').map(p=>[p.label,p]));
  return overlay.points.filter(p=>p.kind==='photo'&&projected.has(p.label)).map(photo=>{
    const model=projected.get(photo.label);
    const pixels=Math.hypot(model.x-photo.x,model.y-photo.y);
    return {label:photo.label,pixels,percentWidth:pixels*100/overlay.width};
  });
}
