import {makeMobot1986} from './models/mobot-ch-hv-1986-research-v7-model.js';
import {makeMobot} from './models/mobot-engineering-v22-model.js';

const library = 'https://elib.biblioatom.ru/data/ovchinnikov_roboty-v-chernobyle_2019/jpg/';
const sktb = 'http://sktbpr.ru/foto-alb/65';
const caption = (file, title, note, source) => ({file:'./media/'+file+'.webp',title,note,source});
export const machines = {
  1986:{
    title:'Мобот-Ч-ХВ',short:'Ч-ХВ',code:'v7',ground:.12,side:1,
    create:T=>makeMobot1986(T),pose:(m,p)=>m.setPose(p),
    initial:{yaw:0,boom:0,grab:0,loader:0,tip:0,track:0},
    joints:[['yaw','Поворот стойки',-180,180],['boom','Подъём стрелы',0,32],['grab','Раскрытие грейфера',0,32],['loader','Подъём погрузчика',0,16],['tip','Наклон ковша',-5,25],['track','Прокрутка гусениц',-100,100]],
    demo:{yaw:46,boom:20,grab:18,loader:16,tip:18,track:75},
    groups:m=>({yaw:m.mechanisms.turntable,boom:m.mechanisms.boom,grab:m.mechanisms.grab,loader:m.mechanisms.loader,tip:m.mechanisms.scoop,track:m.sections['Открытая ходовая']}),
    original:'https://step3dlab.github.io/vr_anapa/mobot-ch-hv-1986-research-v7.html',
    photos:[
      caption('1986-fig6','Первая машина с грейфером','В боковом ракурсе видны гусеничная база, решётчатая стрела и подвес грейфера. Овчинников, Батанов, Мингалеев. «Роботы в Чернобыле», 2019, с. 74, рис. 6.',library+'0074.jpg'),
      caption('1986-fig9','Стрела и грейфер','Второй ракурс использован для сверки силуэта подвеса и челюстей. «Роботы в Чернобыле», 2019, с. 75, рис. 9.',library+'0075.jpg')]
  },
  1987:{
    title:'Мобот-Ч-ХВ-2',short:'Ч-ХВ-2',code:'v22',ground:.14,side:-1,
    create:T=>makeMobot(T,'mobile'),pose:(m,p)=>m.mechanisms.setPose(p),
    initial:{yaw:0,arm:0,wrist:90,claw:7,bucket:12,tip:3,track:0},
    joints:[['yaw','Поворот опоры',-180,180],['arm','Подъём стрелы',-18,25],['claw','Раскрытие схвата',0,24],['wrist','Наклон головки',55,115],['bucket','Подъём погрузчика',-8,36],['tip','Наклон ковша',-25,25],['track','Прокрутка гусениц',0,100]],
    demo:{yaw:65,arm:18,wrist:70,claw:20,bucket:26,tip:5,track:75},
    groups:m=>({yaw:m.mechanisms.turntable,arm:m.mechanisms.arm,claw:m.mechanisms.fingerHead,wrist:m.mechanisms.gripper,bucket:m.mechanisms.bucketLift,tip:m.mechanisms.bucketTilt,track:m.parts.tracks}),
    original:'https://step3dlab.github.io/vr_anapa/mobot-engineering-v22.html',
    photos:[
      caption('1987-before-dispatch','Перед отправкой на ЧАЭС','На боковом снимке видны профиль кожуха, положение стрелы и ковш. Архив СКТБ прикладной робототехники, фото № 2.',sktb),
      caption('1987-front','Двупалый схват','Приёмо-сдаточные испытания. Фронтальный ракурс показывает форму рабочих пластин схвата. Архив СКТБ ПР, фото № 3.',sktb),
      caption('1987-snow-side','Испытания на снегу','Стрела развёрнута над кожухом. Снег частично закрывает нижнюю ветвь гусеницы. Архив СКТБ ПР, фото № 4.',sktb),
      caption('1987-breaker','Испытание отбойного молотка','Сменный молоток установлен на стреле манипулятора. Архив СКТБ ПР, фото № 9.',sktb)]
  }
};
