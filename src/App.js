// import logo from './logo.svg';
// import './App.css';

// function App() {
//   return (
//     <div className="App">
//       <header className="App-header">
//         <img src={logo} className="App-logo" alt="logo" />
//         <p>
//           Edit <code>src/App.js</code> and save to reload.
//         </p>
//         <a
//           className="App-link"
//           href="https://reactjs.org"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           Learn React
//         </a>
//       </header>
//     </div>
//   );
// }

// export default App;




import React, { useEffect, useRef, useState, useCallback } from "react";

import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// Размеры поля в пикселях
const W = 920, H = 919;
const CELL = 50; // размер ячейки сетки в пикселях
const MARGIN = 12;

const GRASS_N   = 45;
const EAT_R     = 15; // радиус потребления травы

// Радиусы обнаружения
// const PRED_DETECT = 140; // Радиус обзора хищника
// const HERB_DETECT = 120; // Радиус обзора травоядного

const CATCH_R  = 13;   // радиус досягаемости хищников
const TURN_RATE = 6.5; // рад/сек - макс. скорость поворота

const LOW_PRED=2;         // хищников «мало»
const CRIT_HERB=3;        // травоядных «почти нет»
const RESPAWN_DELAY=9;    // сек до появления мигрантов-хищников
const STOP_PRED=5;        // при таком кол-ве хищников миграция травоядных прекращается
const REGROW_INTERVAL=5;  // сек между появлениями одной особи травоядного

const HERB={detectR:130,fleeBase:65,fleeBonus:60,wanderSpd:30,hungerRate:3.2,fatigueFlee:26,fatigueRest:16,starveTime:6,eatHungerDrop:22,reproRadius:32,reproThreshold:62,reproCooldown:13,max:18};
const PRED={detectR:150,huntBase:48,huntBonus:72,wanderSpd:24,hungerRate:2.3,fatigueHunt:21,fatigueRest:13,starveTime:9,eatHungerDrop:62,reproRadius:36,reproThreshold:58,reproCooldown:21,max:10};

// Случайное число в [a, b)
const rand = (a, b) => a + Math.random() * (b - a);
const dist  = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sat  =  e=>clamp(100-e.hunger*0.8-e.fatigue*0.4,0,100);

const SPEED = {
  herb: 55,  // px/с для травоядных
  pred: 70,  // px/с для хищников
};

// Параметры блуждания
const WANDER = {
  minInterval: 0.7, // мин. секунд между сменами направления
  maxInterval: 2.5, // макс. секунд
  maxTurn:     1.4, // макс. отклонение за одну смену
};

const normAngle = (r) => {
  while (r >  Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
};

function turnToward(e, targetAngle, dt) {
  const diff = normAngle(targetAngle - e.angle);   // кратчайшее угловое расстояние
  const step = TURN_RATE * dt;                      // макс. шаг за кадр
  e.angle += clamp(diff, -step, step);              
}

function advance(e, spd, dt) {
  const nx = e.x + Math.cos(e.angle)*spd*dt, ny = e.y + Math.sin(e.angle)*spd*dt;
  if (nx < MARGIN || nx > W-MARGIN) e.angle = Math.PI - e.angle;
  if (ny < MARGIN || ny > H-MARGIN) e.angle = -e.angle;
  e.x = clamp(e.x + Math.cos(e.angle)*spd*dt, MARGIN, W-MARGIN);
  e.y = clamp(e.y + Math.sin(e.angle)*spd*dt, MARGIN, H-MARGIN);
}

let _id = 1;
// Общие атрибуты животного
function makeAnimal(kind) {
  return {
    id: _id++,
    kind,                    // 'herb' - травоядное, 'pred' - хищник
    x: rand(30, W - 30),    // случайная позиция X (на небольшом расстоянии от границы)
    y: rand(30, H - 30),    // случайная позиция Y
    angle: rand(-Math.PI, Math.PI), // направление взгляда объектов
    wanderTimer: rand(WANDER.minInterval, WANDER.maxInterval),
    hunger: rand(10, 35),  // изначально небольшой голод
    starveT: 0,            // счётчик нахождения травы при голоде
    fatigue: rand(0, 8), // усталость
    alive: true,
    state: "wander",
    reproCD: rand(0, 5),
  };
}

const makeGrass = () => ({
  x:      rand(20, W-20),
  y:      rand(20, H-20),
  growth: rand(0.3, 1.0), // изначально трава частично выросшая
});

// Инициализация популяции
function createPopulation(nH = 6, nP = 5) {
  _id = 1;
  return {
    herbivores: Array.from({ length: nH }, () => makeAnimal("herb")), // 6 травоядных
    predators:  Array.from({ length: nP }, () => makeAnimal("pred")), // 5 хищников
    grass:      Array.from({ length: GRASS_N }, makeGrass),
    uiAccum: 0,
    log:[],
    predRespawnTimer:0,   // накапливает время с момента падения < LOW_PRED
    herbRecovering:false, // флаг режима восстановления травоядных
    herbRegrowTimer:0,    // время до следующего появления особи
    time: 0,
    chartAccum: 0,

  };
}

// spawnNearBorder - вычисляет позицию у случайной стороны поля.
// side 0 = верхний край, 1 = нижний, 2 = левый, 3 = правый.

function spawnNearBorder(){
  const side=Math.floor(rand(0,4)), m=rand(15,35);
  if(side===0)return{x:rand(0,W),y:m};
  if(side===1)return{x:rand(0,W),y:H-m};
  if(side===2)return{x:m,y:rand(0,H)};
  return{x:W-m,y:rand(0,H)};
}

// Трава медленно отрастает
function stepGrass(pop, dt, params) {
  const rate = params?.grassGrowth ?? 0.04;
  for (const g of pop.grass) {
    g.growth = clamp(g.growth + rate * dt, 0, 1);
    // полное восстановление с 0 до 1 занимает 1/0.04 = 25 секунд
  }
}

// Полоска голода над животным
function drawHungerBar(ctx, e) {
  const bw = 18, x = e.x - bw / 2, y = e.y - 17;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(x, y, bw, 3); // фоновая полоска
  // Цвет меняется с ростом голода
  ctx.fillStyle = e.hunger > 70 ? "#e05030" : e.hunger > 40 ? "#d8a030" : "#60a060";
  ctx.fillRect(x, y, bw * (e.hunger / 100), 3); // заполнение пропорционально голоду
}

function drawFatigueBar(ctx, e) { // усталость под полоской голода
  const bw=18, x=e.x-bw/2, y=e.y-13;
  ctx.fillStyle="rgba(0,0,0,0.3)"; ctx.fillRect(x,y,bw,2);
  ctx.fillStyle=`rgba(120,160,220,${0.5+e.fatigue/100*0.5})`;
  ctx.fillRect(x,y,bw*(e.fatigue/100),2);
}

// Шаг симуляции
// dt - сколько реального времени прошло с прошлого кадра (в секундах).
// Скорость задаётся в px/сек, поэтому смещение = speed * dt.
// Т.е. если speed=60, dt=0.016, то смещение=0.96px за кадр при 60fps.

// Травоядные
function stepHerbivores(pop, dt, params) {
  const detectR = params?.herbDetect ?? 120;
  for (const h of pop.herbivores) {
    if (!h.alive) continue;

    // Голод растёт независимо от поведения
    h.hunger = clamp(h.hunger + 3 * dt, 0, 100);
    h.fatigue = clamp(h.fatigue +  0 * dt, 0, 100); // накапливается только при беге

    let nearPred=null, pd=Infinity;
    for (const p of pop.predators) {
      if (!p.alive) continue;
      const d=dist(h,p);
      if(d<detectR&&d<pd) {
        pd=d;
        nearPred=p;
      }
    }

    if (nearPred) {
      h.state="fleeing";
      // Плавный поворот в противоположную сторону от хищника
      turnToward(h, Math.atan2(h.y-nearPred.y, h.x-nearPred.x), dt);
      // Скорость бега снижается с усталостью
      const spd = 65 + 60 * (1 - h.fatigue / 100);
      advance(h, spd, dt);
      h.fatigue = clamp(h.fatigue + 26*dt, 0, 100); // если существо бежит - усталость растёт
    } else {
      let best=null, bd=Infinity;
      for (const g of pop.grass) {
        if(g.growth<0.2) continue; const d=dist(h,g); if(d<bd){bd=d;best=g;}
      }
      if (best && bd > EAT_R) {
        h.state="grazing";
        turnToward(h, Math.atan2(best.y-h.y,best.x-h.x), dt); // плавный поворот к траве
        advance(h, 34, dt);
        h.fatigue = clamp(h.fatigue - 16*dt, 0, 100); // если существо в состоянии покоя - усталость падает
      } else if (best) {
        h.state="eating";
        best.growth=clamp(best.growth-0.9*dt,0,1); h.hunger=clamp(h.hunger-22*dt,0,100);
        h.fatigue=clamp(h.fatigue-16*dt,0,100);
      } else {
        h.state="wander";
        h.wanderTimer-=dt;
        if(h.wanderTimer<=0){h.angle+=rand(-1.2,1.2);h.wanderTimer=rand(0.8,2);}
        advance(h,26,dt); h.fatigue=clamp(h.fatigue-16*dt,0,100);
      }
    }

    // Голодная смерть через 6 секунд при полной полоске голода
    if (h.hunger >= 100) { 
      h.starveT += dt; 
      if (h.starveT > 6) {
        h.alive = false; 
        pop.log.push({kind:"death",text:`Травоядное №${h.id} погибло от голода`});
      }
    }
    else h.starveT = 0;
  }
  pop.herbivores = pop.herbivores.filter(h => h.alive);
}

// Шаг: хищники
function stepPredators(pop, dt, params) {
  const detectR = params?.predDetect ?? 150;
  for (const p of pop.predators) {
    if (!p.alive) continue;
    p.hunger = clamp(p.hunger + 2.3*dt, 0, 100);

    let target=null, td=Infinity;
    for (const h of pop.herbivores) {
      if(!h.alive) continue;
      const d=dist(p,h);
      if(d<detectR&&d<td) {
        td=d;
        target=h;
      }
    }

    if (target) {
      p.state="hunting";
      // Плавный поворот к жертве
      turnToward(p, Math.atan2(target.y-p.y,target.x-p.x), dt);
      // Скорость охоты: голоднее -> быстрее; уставший -> медленнее
      const spd = (48 + (p.hunger/100)*72) * (1 - p.fatigue/100*0.5);
      advance(p, spd, dt);
      p.fatigue = clamp(p.fatigue + 21*dt, 0, 100);

      // Охота
      if (dist(p, target) < CATCH_R) {
        target.alive = false;
        p.hunger = clamp(p.hunger - 62, 0, 100);
      }
    } else {
      p.state="wander";
      p.wanderTimer-=dt;
      if(p.wanderTimer<=0){p.angle+=rand(-1,1);p.wanderTimer=rand(1,2.5);}
      advance(p,28,dt); p.fatigue=clamp(p.fatigue-13*dt,0,100);
    }

    if(p.hunger>=100){
      p.starveT+=dt;
      if(p.starveT>9) {
        p.alive=false;
        pop.log.push({kind:"death",text:`Хищник №${p.id} погиб от голода`});
      }
    }
    else p.starveT=0;
  }
  pop.predators  = pop.predators.filter(p=>p.alive);
  pop.herbivores = pop.herbivores.filter(h=>h.alive);
}

function repro(pop,list,P,label){
  if(list.length>=P.max)return;
  for(let i=0;i<list.length;i++){
    const a=list[i];
    if(!a.alive||a.reproCD>0||sat(a)<P.reproThreshold)continue;
    for(let j=i+1;j<list.length;j++){
      const b=list[j];
      if(!b.alive||b.reproCD>0||sat(b)<P.reproThreshold)continue;
      if(dist(a,b)>P.reproRadius)continue;
      const c=makeAnimal(a.kind);
      c.x=(a.x+b.x)/2;
      c.y=(a.y+b.y)/2;
      c.hunger=15;
      c.fatigue=0;
      c.reproCD=P.reproCooldown;
      list.push(c);a.reproCD=P.reproCooldown;
      b.reproCD=P.reproCooldown;
      pop.log.push({kind:"birth",text:`Родилось ${label} №${c.id}`});return;
    }
  }
}

// stepRespawns - механизмы восстановления популяции (мигрирование)
// Вызывается после очистки массивов от умерших существ
function stepRespawns(pop,dt){
  // Механизм 1: хищники-мигранты у границы
  if(pop.predators.length < LOW_PRED){
    pop.predRespawnTimer += dt; // накапливаем время ожидания

    if(pop.predRespawnTimer >= RESPAWN_DELAY){
      const n = Math.random()<0.5 ? 1 : 2; // волна из 1 или 2 особей
      for(let i=0;i<n;i++){
        const pos = spawnNearBorder(); // позиция у края поля
        const a   = makeAnimal("pred");
        a.x=pos.x; a.y=pos.y;         // переопределяем позицию
        pop.predators.push(a);
      }
      pop.log.push({kind:"spawn",text:`Мигранты у границы: +${n} хищн.`});
      pop.predRespawnTimer=0; // сбрасываем - ждём снова
    }
  } else {
    pop.predRespawnTimer=0; // хищников достаточно - сбрасываем без ожидания
  }

  // Механизм 2: постепенный приток травоядных
  // Включение: оба условия одновременно
  if(!pop.herbRecovering && pop.predators.length<=LOW_PRED && pop.herbivores.length<=CRIT_HERB){
    pop.herbRecovering=true;
    pop.herbRegrowTimer=0;
  }
  // Выключение: любое из условий
  if(pop.herbRecovering && (pop.herbivores.length>=HERB.max || pop.predators.length>STOP_PRED)){
    pop.herbRecovering=false;
  }
  // Приток - одна особь каждые несколько секунд
  if(pop.herbRecovering && pop.herbivores.length<HERB.max){
    pop.herbRegrowTimer+=dt;
    if(pop.herbRegrowTimer>=REGROW_INTERVAL){
      const a=makeAnimal("herb"); pop.herbivores.push(a);
      pop.log.push({kind:"spawn",text:`Травоядное №${a.id} вернулось`});
      pop.herbRegrowTimer=0;
    }
  }
}

// Отрисовка одного травоядного - зелёный круг
function drawHerbivore(ctx, h) {
  ctx.beginPath();
  ctx.arc(h.x, h.y, 8, 0, Math.PI * 2); // круг радиуса 8px
  ctx.fillStyle = "#7ec87a";
  ctx.strokeStyle = "#4a7a46";
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();

  if(h.state === "fleeing") {
    ctx.beginPath();
    ctx.setLineDash([5,6]);
    ctx.strokeStyle="rgba(126,200,122,0.22)";
    ctx.lineWidth=1;
    ctx.arc(h.x,h.y,HERB.detectR,0,Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawHungerBar(ctx, h);
  drawFatigueBar(ctx,h);
}

// Отрисовка одного хищника - красный треугольник
function drawPredator(ctx, p) {
  ctx.save(); // сохранение текущей системы координат

  // Перенос начала координат в центр хищника
  ctx.translate(p.x, p.y);
  // Поворот системы координат до направления взгляда хищника
  ctx.rotate(p.angle);

  // Отривсовка треугольника относительно нового центра
  ctx.beginPath();
  ctx.moveTo( 12, 0);  // нос - по локальной оси X
  ctx.lineTo(-8, -7);  // левый задний угол
  ctx.lineTo(-8, 7);  // правый задний угол
  ctx.closePath();

  ctx.fillStyle = "#e04428";
  ctx.strokeStyle = "#8a2414";
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
  ctx.restore(); // возвращаем исходную систему координат

  if(p.state === "hunting") {
    ctx.beginPath();
    ctx.setLineDash([5,6]);
    ctx.strokeStyle = "rgba(224,80,50,0.22)";
    ctx.lineWidth=1;
    ctx.arc(p.x,p.y,PRED.detectR,0,Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
  }


  drawHungerBar(ctx, p);
  drawFatigueBar(ctx,p);
}


// Один полный шаг (params — объект из paramsRef, меняется слайдерами)
function simulateStep(pop,dt,params){
  const eff=dt*params.speedMult; // ← множитель скорости применяется здесь
  stepGrass(pop,eff,params);
  stepHerbivores(pop,eff,params);
  stepPredators(pop,eff,params);
  repro(pop,pop.herbivores,HERB,"травоядное");
  repro(pop,pop.predators,PRED,"хищник");
  pop.herbivores=pop.herbivores.filter(h=>h.alive);
  pop.predators=pop.predators.filter(p=>p.alive);
  stepRespawns(pop,eff);
  pop.time+=eff;
  if(pop.log.length>10) pop.log=pop.log.slice(-10);
}

// Функция отрисовки
function draw(ctx, pop, popTime = 0) {
  // очистка всей страницы перед рисованием
  ctx.clearRect(0, 0, W, H);

  // заливка фона - тёмно-зелёный
  ctx.fillStyle = "#1a2e1a";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255, 255, 0, 0.06)"; // (red, green, blue, alpha) - прозрачность 0.06
  ctx.lineWidth = 1;
  for (let x = CELL; x < W; x += CELL) {
    ctx.beginPath();   // начало пути
    ctx.moveTo(x, 0);  // верхняя точка линии
    ctx.lineTo(x, H);  // нижняя точка линии
    ctx.stroke();
  }

  // Горизонтальные линии сетки 
  for (let y = CELL; y < H; y += CELL) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Подписи шкалы по X каждые CELL*2 px (через 2 клетки от начала)
  ctx.fillStyle = "rgba(255, 255, 0, 0.18)";
  ctx.font = "10px monospace";
  for (let x = CELL * 2; x < W; x += CELL * 2) {
    ctx.fillText(`${x}`, x + 2, 12); // текст чуть ниже верхнего края
  }

  // Подписи шкалы по Y 
  for (let y = CELL * 2; y < H; y += CELL * 2) {
    ctx.fillText(`${y}`, 3, y - 2);
  }

  // рамка поля
  ctx.strokeStyle = "#3a5a3a";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  // Таймер симуляции
  ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.font = "11px monospace";
  const timeValue = Number(popTime) || 0;
  ctx.fillText(`t = ${timeValue.toFixed(1)}s`, W - 80, H - 6);

  // Отображение травы с учётом времени и роста (прозрачность = growth)
  for (const g of pop.grass) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(70,120,50,${0.15 + g.growth * 0.6})`;
    ctx.arc(g.x, g.y, 3 + g.growth * 7, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const h of pop.herbivores) drawHerbivore(ctx, h);
  for (const p of pop.predators)  drawPredator(ctx, p);
}

// Компонент
export default function Micro01() {
  const canvasRef = useRef(null);

  // Животные создаются один раз и хранятся в ref
  const popRef = useRef(createPopulation());
  const runRef   =useRef(true);   // true - для работы паузы
  const lastTs = useRef(null);

  const popTime   = useRef(0);
  const uiAccum   = useRef(0);
  const [counts, setCounts] = useState({ herb: 6, pred: 5, predCD: null, herbR: false });
  const [log,setLog]=useState([]);
  const [running,  setRunning ] =useState(true);

  const [startN,   setStartN  ] =useState({h:6,p:5});
  const [sliders,  setSliders ] =useState({predDetect:150,herbDetect:130,grassGrowth:0.045,speedMult:1});
  const [history,  setHistory ] =useState([{t:0,herb:6,pred:5}]);
  const paramsRef=useRef({predDetect:150,herbDetect:130,grassGrowth:0.045,speedMult:1});

  const slide=(key,val)=>{
    paramsRef.current[key]=val;         
    setSliders(s=>({...s,[key]:val})); 
  };

  const reset=useCallback(()=>{
    popRef.current=createPopulation(startN.h,startN.p);
    setHistory([{t:0,herb:startN.h,pred:startN.p}]);
    setLog([]);
  },[startN]);

  useEffect(() => {
    let rafId;

    function loop(ts) {

      if (lastTs.current == null) lastTs.current = ts;
      const dt = Math.min((ts - lastTs.current) / 1000, 0.05); // 50ms - скорость движения
      lastTs.current = ts;
      popTime.current += dt;
      
      const sim=popRef.current;

      // stepGrass(popRef.current,dt);
      // stepHerbivores(popRef.current,dt);
      // stepPredators(popRef.current,dt);

      // repro(sim,sim.herbivores,HERB,"травоядное");
      // repro(sim,sim.predators,PRED,"хищник");
      // sim.herbivores=sim.herbivores.filter(h=>h.alive);
      // sim.predators=sim.predators.filter(p=>p.alive);
      // stepRespawns(sim,dt); // ← ПОСЛЕДНЕЙ
      // if(sim.log.length>10)sim.log=sim.log.slice(-10);

      if (runRef.current) {
        simulateStep(sim, dt, paramsRef.current);
      }

      uiAccum.current += dt;

      // Обновляем React-счётчик не каждый кадр, а раз в 0.5 секунды
      if (uiAccum.current >= 0.5) {
        uiAccum.current = 0;
        const predCD = sim.predators.length < LOW_PRED?Math.max(0,RESPAWN_DELAY-sim.predRespawnTimer):null;

        const all=[...sim.herbivores,...sim.predators];
        const avgSat=all.length?Math.round(all.reduce((a,e)=>a+sat(e),0)/all.length):0;

        setCounts({
          herb: sim.herbivores.length,
          pred: sim.predators.length,
          predCD,
		      herbR:sim.herbRecovering,
          sat: avgSat,
        });
        setLog([...sim.log].reverse());
      }

      // Обновление графика раз в секунду
      if(sim.chartAccum>=1){
        sim.chartAccum=0;
        setHistory(h=>{
          const next=[...h,{t:Math.round(sim.time),herb:sim.herbivores.length,pred:sim.predators.length}];
          return next.length>150?next.slice(-150):next; 
        });
      }

      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) draw(ctx, sim, popTime.current); // отрисовка кадра

      rafId = requestAnimationFrame(loop); // повторный запуск
    }

    rafId = requestAnimationFrame(loop); // запуск цикла

    // Функция очистки - вызывается когда компонент снимается со страницы
    return () => cancelAnimationFrame(rafId);
  }, []); // [] - эффект запускается только один раз

  const dotColor={kill:"#e04428",birth:"#d8a657",death:"#555",spawn:"#5599aa"};
  const toggle=()=>{runRef.current=!runRef.current;setRunning(runRef.current);};

  //<button onClick={reset} style={btn}>↺ Перезапустить</button>
  return(
    <div style={{padding:20,background:"#0b100b",minHeight:"100%",fontFamily:"monospace",color:"#b0c8a8"}}>
      <span style={{fontSize:10,letterSpacing:"0.18em",textTransform:"uppercase",color:"#c8944a",display:"block",marginBottom:6}}>Симуляция Травоядные - Хищники</span>
      <h2 style={{fontFamily:"Georgia,serif",fontSize:22,margin:"0 0 4px",color:"#cce0c2"}}>График и управление</h2>
      

      <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:16,alignItems:"start"}}>

        <div>
          <canvas ref={canvasRef} width={W} height={H} style={{border:"1px solid #2a4028",borderRadius:8,display:"block"}}/>
          <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap",alignItems:"center"}}>
            <button onClick={toggle} style={Btn(true)}>{running?"⏸ Пауза":"▶ Старт"}</button>
            <button onClick={reset}  style={Btn(false)}>↺ Сбросить</button>
            <span style={{fontSize:12,color:"#5a7054"}}>
              Травоядных: <b style={{color:"#7ec87a"}}>{counts.herb}</b> ·
              Хищников: <b style={{color:"#e04428"}}>{counts.pred}</b> ·
              Sat: <b style={{color:"#d8a657"}}>{counts.sat}%</b>
            </span>
            {counts.predCD!==null&&<span style={badge("#e04428")}>⚠ Мигрирование хищников через {Math.ceil(counts.predCD)}с</span>}
            {counts.herbR&&<span style={badge("#7ec87a")}>⟳ Восстановление</span>}
          </div>

          <div style={{marginTop:14,background:"#131e13",border:"1px solid #2a4028",borderRadius:8,padding:"10px 6px 6px"}}>
            <div style={{fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",color:"#4a6444",marginBottom:4,paddingLeft:8}}>
              Динамика численности
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={history} margin={{top:4,right:8,left:-18,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
                <XAxis dataKey="t" tick={{fontSize:9,fill:"#4a6444"}} tickFormatter={t=>`${t}с`}/>
                <YAxis tick={{fontSize:9,fill:"#4a6444"}} allowDecimals={false}/>
                <Tooltip contentStyle={{background:"#131e13",border:"1px solid #2a4028",fontSize:11}}
                         labelFormatter={t=>`t = ${t}с`}/>
                <Legend wrapperStyle={{fontSize:10}}/>

                <Line type="monotone" dataKey="pred" name="Хищники"    stroke="#e04428" strokeWidth={2} dot={false} isAnimationActive={false}/>
                <Line type="monotone" dataKey="herb" name="Травоядные" stroke="#7ec87a" strokeWidth={2} dot={false} isAnimationActive={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <div style={{background:"#131e13",border:"1px solid #2a4028",borderRadius:8,padding:14,marginBottom:12}}>
            <div style={{fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",color:"#4a6444",marginBottom:12}}>Параметры</div>
            {[
              ["predDetect",  "Радиус хищника, px",    60, 260, 1,    sliders.predDetect],
              ["herbDetect",  "Радиус травоядного, px", 60, 260, 1,    sliders.herbDetect],
              ["grassGrowth", "Рост травы",             0.01,0.15,0.01,sliders.grassGrowth],
              ["speedMult",   "Скорость симуляции x",  0.25, 3, 0.25, sliders.speedMult],
            ].map(([key,label,mn,mx,step,val])=>(
              <div key={key} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#5a7054",marginBottom:4}}>
                  <span>{label}</span>
                  <span style={{color:"#d8a657"}}>{Number(val).toFixed(step<1?2:0)}</span>
                </div>

                <input type="range" min={mn} max={mx} step={step} value={val}
                       onChange={e=>slide(key,Number(e.target.value))}
                       style={{width:"100%",accentColor:"#d8a657"}}/>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:4}}>
              {[["h","Трав. при сбросе"],["p","Хищн. при сбросе"]].map(([k,label])=>(
                <div key={k} style={{flex:1}}>
                  <div style={{fontSize:10,color:"#4a6044",marginBottom:3}}>{label}</div>
                  <input type="number" min={5} max={7} value={startN[k]}
                         onChange={e=>setStartN(s=>({...s,[k]:clamp(+e.target.value||5,5,7)}))}
                         style={{width:"100%",background:"#1a2617",border:"1px solid #2a3825",color:"#b0c8a8",borderRadius:6,padding:"4px 6px",fontFamily:"monospace",fontSize:13}}/>
                </div>
              ))}
            </div>
          </div>

          <div style={{background:"#131e13",border:"1px solid #2a4028",borderRadius:8,padding:14}}>
            <div style={{fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",color:"#4a6444",marginBottom:8}}>Журнал событий</div>
            <div style={{fontSize:11,color:"#4a7050",maxHeight:220,overflowY:"auto",lineHeight:2}}>
              {log.length===0&&<span>Событий пока нет…</span>}
              {log.map((l,i)=>(
                <div key={i} style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:dotColor[l.kind]||"#555",flexShrink:0,display:"inline-block"}}/>
                  {l.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Стили для работы
const wrap   = { padding: 22, background: "#0d120d", minHeight: "100%", fontFamily: "monospace", color: "#b8ccb0" };
const h2     = { fontFamily: "Sans,serif", fontSize: 20, margin: "0 0 6px", color: "#cce0c2" };
const canvas = { border: "1px solid #2a4028", borderRadius: 8, display: "block" };
const tag    = { fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#c8944a", marginBottom: 6, display: "block" };
const Tag    = ({ children }) => <span style={tag}>{children}</span>;
const btn    = { padding: "4px 10px", background: "#1e2c1a", border: "1px solid #3a4c34", borderRadius: 6, color: "#a8c4a0", cursor: "pointer", fontFamily: "monospace", fontSize: 12 };
const badge=col=>({fontSize:11,padding:"2px 8px",borderRadius:10,background:col+"22",border:`1px solid ${col}55`,color:col});
const Btn=p=>({padding:"6px 14px",borderRadius:7,cursor:"pointer",fontFamily:"monospace",fontSize:12,fontWeight:600,border:"1px solid",background:p?"#c8944a":"#1a2617",color:p?"#1a1406":"#b0c8a8",borderColor:p?"#c8944a":"#2a4028"});