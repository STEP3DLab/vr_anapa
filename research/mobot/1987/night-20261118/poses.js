export const initial={yaw:0,arm:0,wrist:90,claw:4,bucket:8,tip:0,track:0};
export const poses=[
  ['Перед отправкой · №2','gripper',{claw:7}],
  ['Стрела над кожухом · №4','gripper',{yaw:180,arm:-1,bucket:0}],
  ['Фронтальный вид схвата · №3','gripper',{yaw:90,claw:14,bucket:0}],
  ['Молоток на стреле · №9','breaker-arm',{yaw:-65,arm:22,wrist:60,bucket:0}],
  ['Молоток на погрузчике · гипотеза','breaker-loader',{bucket:36}],
  ['Подъём ковша','gripper',{yaw:90,bucket:32,tip:-10}]
];

// Control images use the preset order above and the same model transforms.
export const stillNames=['overview','snow-boom','front-gripper','breaker-arm','breaker-loader','raised-bucket'];
