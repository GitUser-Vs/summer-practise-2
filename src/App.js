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




import React, { useEffect, useRef } from "react";

// Размеры поля в пикселях
const W = 700, H = 700;
const CELL = 50; // размер ячейки сетки в пикселях

// Случайное число в [a, b)
const rand = (a, b) => a + Math.random() * (b - a);

const SPEED = {
  herb: 55,  // px/с для травоядных
  pred: 70,  // px/с для хищников
};

// Общие атрибуты животного
function makeAnimal(kind) {
  return {
    kind,                    // 'herb' — травоядное, 'pred' — хищник
    x: rand(30, W - 30),    // случайная позиция X (на небольшом расстоянии от границы)
    y: rand(30, H - 30),    // случайная позиция Y
    angle: rand(-Math.PI, Math.PI), // направление взгляда объектов
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
function draw(ctx, pop) {
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

  for (const h of pop.herbivores) drawHerbivore(ctx, h);
  for (const p of pop.predators)  drawPredator(ctx, p);
}

// Компонент
export default function Micro01() {
  const canvasRef = useRef(null);

  // Животные создаются один раз и хранятся в ref
  const popRef = useRef(createPopulation());

  const lastTs = useRef(null);

  useEffect(() => {
    let rafId;

    function loop(ts) {

      if (lastTs.current == null) lastTs.current = ts;
      const dt = Math.min((ts - lastTs.current) / 1000, 0.05); // 50ms - скорость движения
      lastTs.current = ts;

      step(popRef.current, dt); // движение животных


      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) draw(ctx, popRef.current); // отрисовка кадра

      rafId = requestAnimationFrame(loop); // повторный запуск
    }

    rafId = requestAnimationFrame(loop); // запуск цикла

    // Функция очистки - вызывается когда компонент снимается со страницы
    return () => cancelAnimationFrame(rafId);
  }, []); // [] - эффект запускается только один раз при монтировании

  return (
    <div style={wrap}>
      <Tag>Симуляция Травоядные - Хищники</Tag>
      <h2 style={h2}>Пустое поле</h2>
      <canvas ref={canvasRef} width={W} height={H} style={canvas} />
    </div>
  );
}

// Стили для работы
const wrap   = { padding: 22, background: "#0d120d", minHeight: "100%", fontFamily: "monospace", color: "#b8ccb0" };
const h2     = { fontFamily: "Sans,serif", fontSize: 20, margin: "0 0 6px", color: "#cce0c2" };
const canvas = { border: "1px solid #2a4028", borderRadius: 8, display: "block" };
const tag    = { fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#c8944a", marginBottom: 6, display: "block" };
const Tag    = ({ children }) => <span style={tag}>{children}</span>;
