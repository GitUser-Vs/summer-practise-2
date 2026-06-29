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




import React, { useEffect, useRef, useState } from "react";

// Размеры поля в пикселях
const W = 700, H = 700;
const CELL = 50; // размер ячейки сетки в пикселях
const MARGIN = 12;

const GRASS_N   = 45;
const EAT_R     = 15; // радиус потребления травы

// Радиусы обнаружения
const PRED_DETECT = 140; // Радиус обзора хищника
const HERB_DETECT = 120; // Радиус обзора травоядного

const CATCH_R  = 13;   // радиус досягаемости хищников
const TURN_RATE = 6.5; // рад/сек — макс. скорость поворота

// Случайное число в [a, b)
const rand = (a, b) => a + Math.random() * (b - a);
const dist  = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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
    kind,                    // 'herb' — травоядное, 'pred' — хищник
    x: rand(30, W - 30),    // случайная позиция X (на небольшом расстоянии от границы)
    y: rand(30, H - 30),    // случайная позиция Y
    angle: rand(-Math.PI, Math.PI), // направление взгляда объектов
    wanderTimer: rand(WANDER.minInterval, WANDER.maxInterval),
    hunger: rand(10, 35),  // изначально небольшой голод
    starveT: 0,            // счётчик нахождения травы при голоде
    fatigue: rand(0, 8), // усталость
    alive: true,
    state: "wander",
  };
}

const makeGrass = () => ({
  x:      rand(20, W-20),
  y:      rand(20, H-20),
  growth: rand(0.3, 1.0), // изначально трава частично выросшая
});

// Инициализация популяции
function createPopulation() {
  _id = 1;
  return {
    herbivores: Array.from({ length: 6 }, () => makeAnimal("herb")), // 6 травоядных
    predators:  Array.from({ length: 5 }, () => makeAnimal("pred")), // 5 хищников
    grass:      Array.from({ length: GRASS_N }, makeGrass),
    uiAccum: 0,
    events:[],
  };
}

// Трава медленно отрастает
function stepGrass(pop, dt) {
  for (const g of pop.grass) {
    g.growth = clamp(g.growth + 0.04 * dt, 0, 1);
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
// dt — сколько реального времени прошло с прошлого кадра (в секундах).
// Скорость задаётся в px/сек, поэтому смещение = speed * dt.
// Т.е. если speed=60, dt=0.016, то смещение=0.96px за кадр при 60fps.

// Травоядные
function stepHerbivores(pop, dt) {
  for (const h of pop.herbivores) {
    if (!h.alive) continue;

    // Голод растёт независимо от поведения
    h.hunger = clamp(h.hunger + 3 * dt, 0, 100);
    h.fatigue = clamp(h.fatigue +  0 * dt, 0, 100); // накапливается только при беге

    let nearPred=null, pd=Infinity;
    for (const p of pop.predators) {
      if (!p.alive) continue;
      const d=dist(h,p); if(d<120&&d<pd){pd=d;nearPred=p;}
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
    if (h.hunger >= 100) { h.starveT += dt; if (h.starveT > 6) h.alive = false; }
    else h.starveT = 0;
  }
  pop.herbivores = pop.herbivores.filter(h => h.alive);
}

// Шаг: хищники
function stepPredators(pop, dt) {
  for (const p of pop.predators) {
    if (!p.alive) continue;
    p.hunger = clamp(p.hunger + 2.3*dt, 0, 100);

    let target=null, td=Infinity;
    for (const h of pop.herbivores) {
      if(!h.alive) continue; const d=dist(p,h); if(d<150&&d<td){td=d;target=h;}
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

    if(p.hunger>=100){p.starveT+=dt;if(p.starveT>9)p.alive=false;}else p.starveT=0;
  }
  pop.predators  = pop.predators.filter(p=>p.alive);
  pop.herbivores = pop.herbivores.filter(h=>h.alive);
}

// Отрисовка одного травоядного — зелёный круг
function drawHerbivore(ctx, h) {
  ctx.beginPath();
  ctx.arc(h.x, h.y, 8, 0, Math.PI * 2); // круг радиуса 8px
  ctx.fillStyle = "#7ec87a";
  ctx.strokeStyle = "#4a7a46";
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
  drawHungerBar(ctx, h);
  drawFatigueBar(ctx,h);
}

// Отрисовка одного хищника — красный треугольник
function drawPredator(ctx, p) {
  ctx.save(); // сохранение текущей системы координат

  // Перенос начала координат в центр хищника
  ctx.translate(p.x, p.y);
  // Поворот системы координат до направления взгляда хищника
  ctx.rotate(p.angle);

  // Отривсовка треугольника относительно нового центра
  ctx.beginPath();
  ctx.moveTo( 12, 0);  // нос — по локальной оси X
  ctx.lineTo(-8, -7);  // левый задний угол
  ctx.lineTo(-8, 7);  // правый задний угол
  ctx.closePath();

  ctx.fillStyle = "#e04428";
  ctx.strokeStyle = "#8a2414";
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
  ctx.restore(); // возвращаем исходную систему координат
  drawHungerBar(ctx, p);
  drawFatigueBar(ctx,p);
}

// Функция отрисовки
function draw(ctx, pop, simTime = 0) {
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
  const timeValue = Number(simTime) || 0;
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

  const lastTs = useRef(null);

  const simTime   = useRef(0);
  const uiAccum   = useRef(0);

  const [counts, setCounts] = useState({ herb: 6, pred: 5 });

  useEffect(() => {
    let rafId;

    function loop(ts) {

      if (lastTs.current == null) lastTs.current = ts;
      const dt = Math.min((ts - lastTs.current) / 1000, 0.05); // 50ms - скорость движения
      lastTs.current = ts;
      simTime.current += dt;
      uiAccum.current += dt;

      stepGrass(popRef.current,dt);
      stepHerbivores(popRef.current,dt);
      stepPredators(popRef.current,dt);

      // Обновляем React-счётчик не каждый кадр, а раз в 0.5 секунды
      if (uiAccum.current >= 0.5) {
        uiAccum.current = 0;
        setCounts({
          herb: popRef.current.herbivores.length,
          pred: popRef.current.predators.length,
        });
      }

      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) draw(ctx, popRef.current, simTime.current); // отрисовка кадра

      rafId = requestAnimationFrame(loop); // повторный запуск
    }

    rafId = requestAnimationFrame(loop); // запуск цикла

    // Функция очистки - вызывается когда компонент снимается со страницы
    return () => cancelAnimationFrame(rafId);
  }, []); // [] - эффект запускается только один раз

  const reset = () => {
    popRef.current = createPopulation();
    simTime.current = 0;
    lastTs.current = null;
  };

  return (
    <div style={wrap}>
      <Tag>Симуляция Травоядные - Хищники</Tag>
      <h2 style={h2}>Пустое поле</h2>
      <canvas ref={canvasRef} width={W} height={H} style={canvas} />
      <button onClick={reset} style={btn}>↺ Перезапустить</button>
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
