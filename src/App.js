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
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Случайное число в [a, b)
const rand = (a, b) => a + Math.random() * (b - a);

const SPEED = {
  herb: 55,  // px/с для травоядных
  pred: 70,  // px/с для хищников
};

// Параметры блуждания
const WANDER = {
  minInterval: 0.7, // мин. секунд между сменами направления
  maxInterval: 2.5, // макс. секунд
  maxTurn:     1.4, // макс. отклонение за одну смену (радианы ≈ 80°)
};

// ─── Шаг блуждания ───
function stepWander(pop, dt) {
  for (const e of [...pop.herbivores, ...pop.predators]) {
    // Отсчитываем время до следующей смены
    e.wanderTimer -= dt;

    if (e.wanderTimer <= 0) {
      // Время вышло: немного меняем угол
      e.angle += rand(-WANDER.maxTurn, WANDER.maxTurn);
      // Планируем следующую смену
      e.wanderTimer = rand(WANDER.minInterval, WANDER.maxInterval);
    }

    // Вычисляем следующую позицию
    const spd = SPEED[e.kind];
    const nx  = e.x + Math.cos(e.angle) * spd * dt;
    const ny  = e.y + Math.sin(e.angle) * spd * dt;

    // Отражение от стенок
    if (nx < MARGIN || nx > W - MARGIN) e.angle = Math.PI - e.angle;
    if (ny < MARGIN || ny > H - MARGIN) e.angle = -e.angle;

    e.x = clamp(e.x + Math.cos(e.angle) * spd * dt, MARGIN, W - MARGIN);
    e.y = clamp(e.y + Math.sin(e.angle) * spd * dt, MARGIN, H - MARGIN);
  }
}

// Общие атрибуты животного
function makeAnimal(kind) {
  return {
    kind,                    // 'herb' — травоядное, 'pred' — хищник
    x: rand(30, W - 30),    // случайная позиция X (на небольшом расстоянии от границы)
    y: rand(30, H - 30),    // случайная позиция Y
    angle: rand(-Math.PI, Math.PI), // направление взгляда объектов
    wanderTimer: rand(WANDER.minInterval, WANDER.maxInterval),
    alive: true,
  };
}

// Инициализация популяции
function createPopulation() {
  return {
    herbivores: Array.from({ length: 6 }, () => makeAnimal("herb")), // 6 травоядных
    predators:  Array.from({ length: 5 }, () => makeAnimal("pred")), // 5 хищников
  };
}

// Шаг симуляции
// dt — сколько реального времени прошло с прошлого кадра (в секундах).
// Скорость задаётся в px/сек, поэтому смещение = speed * dt.
// Т.е. если speed=60, dt=0.016, то смещение=0.96px за кадр при 60fps.
function step(pop, dt) {
  for (const e of [...pop.herbivores, ...pop.predators]) {
    const speed = SPEED[e.kind];

    // Формула движения
    // cos(angle) — проекция на ось X
    // sin(angle) — проекция на ось Y
    e.x += Math.cos(e.angle) * speed * dt;
    e.y += Math.sin(e.angle) * speed * dt;

  }
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

  // for (const h of pop.herbivores) {
  //   // «Шлейф» направления
  //   ctx.beginPath(); ctx.strokeStyle = "rgba(126,200,122,0.2)"; ctx.lineWidth = 1;
  //   ctx.moveTo(h.x, h.y);
  //   ctx.lineTo(h.x - Math.cos(h.angle)*18, h.y - Math.sin(h.angle)*18);
  //   ctx.stroke();
  //   // Тело
  //   // ctx.beginPath(); ctx.arc(h.x, h.y, 8, 0, Math.PI*2);
  //   // ctx.fillStyle="#7ec87a"; ctx.strokeStyle="#4a7a46"; ctx.lineWidth=1.5; ctx.fill(); ctx.stroke();
  //   drawHerbivore(ctx, h);
  // }

  // for (const p of pop.predators) {
  //   ctx.beginPath(); ctx.strokeStyle = "rgba(224,68,40,0.2)"; ctx.lineWidth = 1;
  //   ctx.moveTo(p.x, p.y);
  //   ctx.lineTo(p.x - Math.cos(p.angle)*22, p.y - Math.sin(p.angle)*22);
  //   ctx.stroke();
  //   ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
  //   // ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(-8,-7); ctx.lineTo(-8,7); ctx.closePath();
  //   // ctx.fillStyle="#e04428"; ctx.strokeStyle="#8a2414"; ctx.lineWidth=1.5; ctx.fill(); ctx.stroke();
  //   drawPredator(ctx, p);
  //   ctx.restore();
  // }

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
  const uiAccum   = useRef(0); // накапливаем время до обновления UI

  const [counts, setCounts] = useState({ herb: 6, pred: 5 });

  useEffect(() => {
    let rafId;

    function loop(ts) {

      if (lastTs.current == null) lastTs.current = ts;
      const dt = Math.min((ts - lastTs.current) / 1000, 0.05); // 50ms - скорость движения
      lastTs.current = ts;
      simTime.current += dt;
      uiAccum.current += dt;
      stepWander(popRef.current, dt);
      step(popRef.current, dt); // движение животных

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
  }, []); // [] - эффект запускается только один раз при монтировании

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
