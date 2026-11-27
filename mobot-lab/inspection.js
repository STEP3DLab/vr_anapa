const article = 'https://elib.biblioatom.ru/data/ovchinnikov_roboty-v-chernobyle_2019/jpg/';
const album = 'https://step3dlab.github.io/vr_anapa/mobot-assets/archive/';
const developer = 'https://sktbpr.ru/content/mrk-mobot-ch-hv-2';

// Each marker follows a small visible part. A pivot or an assembly that also
// contains the tool would put its marker outside the component it identifies.
// Selection describes the whole inspectable assembly, independently of its
// marker. Some 1987 actuators live outside their named group, so use the part
// ownership carried by every mesh instead of moving or reparenting geometry.
function partMeshes(model, id) {
  const selected = [];
  model.root.traverse(node => {
    if (node.isMesh && node.userData.part === id) selected.push(node);
  });
  return selected;
}

export const inspections = {
  1986: [
    {
      id: 'body', title: 'Корпус и округлый кожух', view: 'side',
      description: 'Низкая платформа связывает гусеничные борта. Со стороны грейфера находится кожух с арочным боковым очертанием.',
      confidence: 'Форма кожуха видна на рис. 6 и 9. В описании кабелеукладчик находится внутри корпуса, но содержимое именно этого кожуха не установлено. Поперечины, крепления и размеры условны.',
      source: article + '0074.jpg',
      anchor: model => model.sections['Рама и округлый кожух'].getObjectByName('Арочный кожух'),
      selection: model => model.sections['Рама и округлый кожух']
    },
    {
      id: 'mast', title: 'Поворотная стойка', view: 'iso', joint: 'yaw',
      description: 'Высокая открытая стойка с широким основанием несёт решётчатую стрелу. В модели стойка поворачивается вместе с манипулятором.',
      confidence: 'На рис. 6 и 9 манипулятор по-разному ориентирован относительно шасси. Разделение поворотных частей, опорная плита, ось и пределы поворота восстановлены приблизительно.',
      source: article + '0075.jpg',
      anchor: model => model.mechanisms.turntable.getObjectByName('Поворотное основание'),
      selection: model => model.mechanisms.turntable.children.filter(node =>
        node !== model.mechanisms.boom && node !== model.sections['Верхний цилиндрический корпус камеры'])
    },
    {
      id: 'boom', title: 'Решётчатая стрела', view: 'iso', joint: 'boom',
      description: 'Две боковые фермы сужаются от высокой поворотной стойки к пальцу подвеса. При подъёме стрелы грейфер в модели остаётся вертикальным.',
      confidence: 'Обводы и пространственная связь двух ферм видны на рис. 6 и 9. Сечения, разбивка на панели, расположение пальцев и наклон стрелы восстановлены приблизительно.',
      source: article + '0075.jpg',
      anchor: model => model.mechanisms.boom.getObjectByName('Продольный пояс стрелы'),
      selection: model => model.mechanisms.boom.children.filter(node => node !== model.mechanisms.grab)
    },
    {
      id: 'grab', title: 'Грейфер', view: 'iso', joint: 'grab',
      description: 'Две ковшеобразные челюсти смыкаются вокруг обломка. Над ними видны поперечная траверса, верхний пояс и наружные стержни подвеса.',
      confidence: 'Пропорции открытого участка подвеса проверены по трём кадрам из собрания Батанова. Четыре симметричных стержня, скрытые связи, оси и привод челюстей остаются гипотезами.',
      source: 'https://github.com/STEP3DLab/vr_anapa/blob/main/research/mobot/1986/v7/BATANOV.md',
      anchor: model => model.sections['Ковшевая челюсть 1'],
      selection: model => model.mechanisms.grab
    },
    {
      id: 'loader', title: 'Фронтальный ковш', view: 'iso', joint: 'loader',
      description: 'Два наружных рычага поднимают ковш вдоль бортов. Наклон самого ковша меняется отдельно, вокруг боковых пальцев.',
      confidence: 'В техническом описании указаны две степени подвижности. Геометрию тяг и крайние положения задаёт реконструкция.',
      source: article + '0075.jpg',
      anchor: model => model.mechanisms.scoop.getObjectByName('Режущая кромка'),
      selection: model => model.mechanisms.loader
    },
    {
      id: 'track', title: 'Гусеничная ходовая', view: 'side', joint: 'track',
      description: 'На ближнем борту различимы семь нижних катков и два приподнятых крайних колеса. При движении ленты вращаются лицевые диски.',
      confidence: 'Число видимых нижних катков и светлые кромки дисков сверены по рис. 6 и 9. Полиуретановые траки указаны в описании. Шаг и профиль траков, скрытые опоры и дальний борт условны.',
      source: article + '0074.jpg',
      anchor: model => model.sections['Борт 1'].getObjectByName('Нижний круговой элемент').parent.getObjectByName('Лицевой диск'),
      selection: model => model.sections['Открытая ходовая']
    },
    {
      id: 'camera', title: 'Верхняя телекамера', view: 'side',
      description: 'На вершине стойки различимы цилиндрический корпус, кольцевой пояс и расширение у переднего торца. Корпус поворачивается вместе со стойкой в модели.',
      confidence: 'Две телекамеры упомянуты в описании комплекса. Наружный профиль верхнего корпуса виден на рис. 6; крепления и скрытая оптика приблизительны. Назначение светлых дисков у ковша не установлено.',
      source: article + '0074.jpg',
      anchor: model => model.sections['Верхний цилиндрический корпус камеры'].getObjectByName('Профилированный корпус верхней камеры'),
      selection: model => model.sections['Верхний цилиндрический корпус камеры']
    }
  ],
  1987: [
    {
      id: 'body', title: 'Рама и защитный кожух', view: 'side',
      description: 'Низкая рама соединяет гусеничные борта. На платформе расположен защитный кожух со скруглёнными плечами и уплощённой верхней частью.',
      confidence: 'Обводы кожуха видны на фотографиях СКТБ № 2 и 4. Сечения, ширина, число поперечин и соединения рамы с бортами восстановлены приблизительно.',
      source: album + '1987-before-dispatch.jpg',
      anchor: model => model.parts.body.getObjectByName('Кожух с плоской вершиной и скруглёнными плечами'),
      selection: model => model.parts.body
    },
    {
      id: 'turret', title: 'Поворотная опора', view: 'iso', joint: 'yaw',
      description: 'Под основанием стрелы расположена открытая опора с боковыми стойками. Она связывает манипулятор с платформой.',
      confidence: 'Открытая опора различима на фотографиях СКТБ № 2 и 4. Ось вращения, посадки и задние поперечины не установлены; в модели их геометрия условна.',
      source: album + '1987-before-dispatch.jpg',
      anchor: model => model.mechanisms.armFixed,
      selection: model => partMeshes(model, 'turret')
    },
    {
      id: 'arm', title: 'Стрела манипулятора', view: 'side', joint: 'arm',
      description: 'От поворотной опоры к сменной головке идут продольные элементы стрелы. У головки видны боковые пластины и поперечная ось.',
      confidence: 'Продольные и наклонные элементы, наружные рёбра и концевые щёки видны на снимках. Поперечные связи, внутренние пролёты и пальцы привода условны. В модели привод следует за подвижными точками крепления.',
      source: album + '1987-before-dispatch.jpg',
      anchor: model => model.mechanisms.arm.getObjectByName('Верхний продольный элемент стрелы'),
      selection: model => partMeshes(model, 'arm')
    },
    {
      id: 'tool', title: 'Сменный рабочий орган', view: 'iso',
      description: 'Манипулятор мог нести двупалый схват или отбойный молоток. Молоток также устанавливали на погрузчике. Метка следует за выбранным инструментом.',
      confidence: 'Установки описаны разработчиком. Схват и молоток на стреле видны на снимках. Крепление молотка к погрузчику показано условно.',
      source: developer,
      anchor(model) {
        const {fingerHead, breakerArm, breakerLoader} = model.mechanisms;
        return [fingerHead, breakerArm, breakerLoader].find(part => part.visible);
      },
      selection: model => model.root.userData.activeWorkTool === 'breaker-loader'
        ? model.mechanisms.breakerLoader : model.mechanisms.gripper
    },
    {
      id: 'loader', title: 'Рычаги погрузчика', view: 'side', joint: 'bucket',
      description: 'Рычаги расположены снаружи гусениц и поднимают переднюю оснастку. В исполнении с ковшом хорошо видна сплошная рабочая кромка.',
      confidence: 'Внешние рычаги и цельная рабочая кромка видны на снимках № 2 и 4. Продольный профиль ковша, глубокие участки полости, положение оси и крепления приводов приблизительны.',
      source: album + '1987-before-dispatch.jpg',
      anchor: model => model.mechanisms.liftPins[0],
      selection: model => partMeshes(model, 'bucket')
    },
    {
      id: 'track', title: 'Гусеничная ходовая', view: 'side', joint: 'track',
      description: 'Семь нижних катков и два приподнятых колеса задают видимый профиль борта. При прокрутке можно проследить движение траков и фланцев катков.',
      confidence: 'Наиболее полный боковой вид даёт фото № 2; на № 4 низ ленты закрыт снегом. Точный профиль траков, схема балансиров и невидимый борт условны. Материал траков именно Ч-ХВ-2 отдельно не установлен.',
      source: album + '1987-before-dispatch.jpg',
      anchor: model => model.parts.tracks.getObjectByName('Вращающийся фланец опорного катка'),
      selection: model => model.parts.tracks
    },
    {
      id: 'camera', title: 'Телевизионное наблюдение', view: 'iso',
      description: 'Оператор наблюдал за передвижением машины и работой манипулятора. На открытой опоре различимы наружные цилиндрические корпуса.',
      confidence: 'Телевизионное наблюдение описано разработчиком. Назначение каждого видимого цилиндра, положение камер, объективы и кронштейны в модели приблизительны.',
      source: album + '1987-front.jpg',
      anchor: model => model.mechanisms.cameras.children.find(part => part.isGroup && part.position.z < 0),
      selection: model => model.mechanisms.cameras
    }
  ]
};
