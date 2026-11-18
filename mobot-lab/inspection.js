const article = 'https://elib.biblioatom.ru/data/ovchinnikov_roboty-v-chernobyle_2019/jpg/';
const album = 'https://step3dlab.github.io/vr_anapa/mobot-assets/archive/';
const developer = 'https://sktbpr.ru/content/mrk-mobot-ch-hv-2';

// Each marker follows a small visible part. A pivot or an assembly that also
// contains the tool would put its marker outside the component it identifies.
export const inspections = {
  1986: [
    {
      id: 'boom', title: 'Решётчатая стрела', view: 'iso', joint: 'boom',
      description: 'Две боковые фермы сужаются от высокой поворотной стойки к пальцу подвеса. При подъёме стрелы грейфер остаётся вертикальным.',
      confidence: 'Обводы видны на рис. 6 и 9. Сечения стержней и расположение скрытых раскосов восстановлены приблизительно.',
      source: article + '0075.jpg',
      anchor: model => model.mechanisms.boom.getObjectByName('Продольный пояс стрелы')
    },
    {
      id: 'grab', title: 'Грейфер', view: 'iso', joint: 'grab',
      description: 'Две ковшеобразные челюсти смыкаются вокруг обломка. Над ними видны поперечная траверса, верхний пояс и наружные стержни подвеса.',
      confidence: 'Пропорции открытого участка подвеса проверены по трём кадрам из собрания Батанова. Схема привода челюстей условна.',
      source: 'https://github.com/STEP3DLab/vr_anapa/blob/main/research/mobot/1986/v7/BATANOV.md',
      anchor: model => model.sections['Ковшевая челюсть 1']
    },
    {
      id: 'loader', title: 'Фронтальный ковш', view: 'iso', joint: 'loader',
      description: 'Два наружных рычага поднимают ковш вдоль бортов. Наклон самого ковша меняется отдельно, вокруг боковых пальцев.',
      confidence: 'В техническом описании указаны две степени подвижности. Геометрию тяг и крайние положения задаёт реконструкция.',
      source: article + '0075.jpg',
      anchor: model => model.mechanisms.scoop.getObjectByName('Режущая кромка')
    },
    {
      id: 'track', title: 'Гусеничная ходовая', view: 'side', joint: 'track',
      description: 'На ближнем борту различимы семь нижних катков и два приподнятых крайних колеса. При движении ленты вращаются лицевые диски.',
      confidence: 'Расположение видимых колёс снято с фотографии. Шаг траков и скрытые опоры осей приблизительны.',
      source: article + '0074.jpg',
      anchor: model => model.sections['Борт 1'].getObjectByName('Нижний круговой элемент').parent.getObjectByName('Лицевой диск')
    },
    {
      id: 'camera', title: 'Верхняя телекамера', view: 'side',
      description: 'На вершине стойки различимы цилиндрический корпус, кольцевой пояс и расширение у переднего торца. Корпус поворачивается вместе со стойкой в модели.',
      confidence: 'Две телекамеры упомянуты в описании комплекса. Снимок позволяет восстановить наружный профиль верхнего корпуса.',
      source: article + '0074.jpg',
      anchor: model => model.sections['Верхний цилиндрический корпус камеры'].getObjectByName('Профилированный корпус верхней камеры')
    }
  ],
  1987: [
    {
      id: 'arm', title: 'Стрела манипулятора', view: 'side', joint: 'arm',
      description: 'От поворотной опоры к сменной головке идут продольные элементы стрелы. У головки видны боковые пластины и поперечная ось.',
      confidence: 'Внешний профиль сверяли по фотографиям СКТБ № 2 и 4. Скрытые связи и посадки шарниров восстановлены приблизительно.',
      source: album + '1987-before-dispatch.jpg',
      anchor: model => model.mechanisms.arm.getObjectByName('Верхний продольный элемент стрелы')
    },
    {
      id: 'tool', title: 'Сменный рабочий орган', view: 'iso',
      description: 'Манипулятор мог нести двупалый схват или отбойный молоток. Молоток также устанавливали на погрузчике. Метка следует за выбранным инструментом.',
      confidence: 'Установки описаны разработчиком. Схват и молоток на стреле видны на снимках. Крепление молотка к погрузчику показано условно.',
      source: developer,
      anchor(model) {
        const {fingerHead, breakerArm, breakerLoader} = model.mechanisms;
        return [fingerHead, breakerArm, breakerLoader].find(part => part.visible);
      }
    },
    {
      id: 'loader', title: 'Рычаги погрузчика', view: 'side', joint: 'bucket',
      description: 'Рычаги расположены снаружи гусениц и поднимают переднюю оснастку. В исполнении с ковшом хорошо видна сплошная рабочая кромка.',
      confidence: 'Боковой профиль рычагов и ковша читается на снимке № 2. Точки крепления приводов в модели приблизительны.',
      source: album + '1987-before-dispatch.jpg',
      anchor: model => model.mechanisms.liftPins[0]
    },
    {
      id: 'track', title: 'Гусеничная ходовая', view: 'side', joint: 'track',
      description: 'Семь нижних катков и два приподнятых колеса задают видимый профиль борта. При прокрутке можно проследить движение траков и фланцев катков.',
      confidence: 'Наиболее полный боковой вид даёт фото № 2. На кадре № 4 часть нижней ветви закрыта снегом.',
      source: album + '1987-before-dispatch.jpg',
      anchor: model => model.parts.tracks.getObjectByName('Вращающийся фланец опорного катка')
    },
    {
      id: 'camera', title: 'Телевизионное наблюдение', view: 'iso',
      description: 'Оператор наблюдал за передвижением машины и работой манипулятора. На открытой опоре различимы наружные цилиндрические корпуса.',
      confidence: 'Телевизионное наблюдение описано разработчиком. Ориентация корпусов, оптика и кронштейны в модели приблизительны.',
      source: album + '1987-front.jpg',
      anchor: model => model.mechanisms.cameras.children.find(part => part.isGroup && part.position.z < 0)
    }
  ]
};
