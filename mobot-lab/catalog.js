import {makeMobot1986} from './models/mobot-ch-hv-1986-research-v7-model.js';
import {makeMobot} from './models/mobot-engineering-v23-model.js';

// Presentation paths are defined per tool. In particular the loader-mounted
// breaker needs a raised loader at both ends of its demonstration.
export const demonstrations = {
  gripper: {
    start:{yaw:0,arm:0,wrist:90,claw:7,bucket:12,tip:3,track:0},
    end:{yaw:65,arm:-15,wrist:78,claw:20,bucket:20,tip:0,track:75}
  },
  'breaker-arm': {
    start:{yaw:-65,arm:22,wrist:60,claw:4,bucket:0,tip:0,track:0},
    end:{yaw:-100,arm:-6,wrist:84,claw:4,bucket:10,tip:0,track:75}
  },
  'breaker-loader': {
    start:{yaw:0,arm:0,wrist:90,claw:4,bucket:36,tip:0,track:0},
    end:{yaw:65,arm:-12,wrist:85,claw:4,bucket:27,tip:-8,track:75}
  }
};
export const machines = {
  1986:{
    title:'Мобот-Ч-ХВ',short:'Ч-ХВ',code:'v7',ground:.12,side:1,
    create:T=>makeMobot1986(T),pose:(m,p)=>m.setPose(p),
    initial:{yaw:0,boom:0,grab:0,loader:0,tip:0,track:0},
    joints:[['yaw','Поворот стойки',-180,180],['boom','Подъём стрелы',0,32],['grab','Раскрытие грейфера',0,32],['loader','Подъём погрузчика',0,16],['tip','Наклон ковша',-5,25],['track','Прокрутка гусениц',-100,100]],
    demo:{yaw:46,boom:20,grab:18,loader:16,tip:18,track:75},
    groups:m=>({body:m.sections['Рама и округлый кожух'],yaw:m.mechanisms.turntable,boom:m.mechanisms.boom,grab:m.mechanisms.grab,loader:m.mechanisms.loader,tip:m.mechanisms.scoop,track:m.sections['Открытая ходовая'],camera:m.sections['Верхний цилиндрический корпус камеры']}),
    original:'https://step3dlab.github.io/vr_anapa/mobot-ch-hv-1986-research-v7.html',
    passport:'./data/1986-passport.json'
  },
  1987:{
    title:'Мобот-Ч-ХВ-2',short:'Ч-ХВ-2',code:'v23',posterCode:'v22',ground:.14,side:-1,
    create:T=>makeMobot(T,'mobile'),pose:(m,p)=>m.mechanisms.setPose(p),
    initial:demonstrations.gripper.start,
    joints:[['yaw','Поворот опоры',-180,180],['arm','Наклон стрелы',-18,25],['claw','Раскрытие схвата',0,24],['wrist','Наклон головки',55,115],['bucket','Подъём погрузчика',-8,36],['tip','Наклон ковша',-25,25],['track','Прокрутка гусениц',0,100]],
    groups:m=>({body:m.parts.body,yaw:m.mechanisms.turntable,arm:m.mechanisms.arm,claw:m.mechanisms.fingerHead,wrist:m.mechanisms.gripper,bucket:m.mechanisms.bucketLift,tip:m.mechanisms.bucketTilt,track:m.parts.tracks,camera:m.mechanisms.cameras,tool:m.root.userData.activeWorkTool==='breaker-loader'?m.mechanisms.breakerLoader:m.mechanisms.breakerArm}),
    original:'https://step3dlab.github.io/vr_anapa/mobot-engineering-v23.html',
    passport:'./data/1987-passport.json',
    previous:'https://step3dlab.github.io/vr_anapa/mobot-engineering-v22.html'
  }
};
