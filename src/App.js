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
const W = 700;
const H = 700;
const CELL = 60; // размер ячейки сетки в пикселях

// Функция отрисовки
function draw(ctx) {
  // очистка всей страницы перед рисованием
  ctx.clearRect(0, 0, W, H);

  // заливка фона - тёмно-зелёный
  ctx.fillStyle = "#1a2e1a";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255, 255, 0, 0.06)"; // (red, green, blue, alpha) - прозрачность 0.06
  ctx.lineWidth   = 1;
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

  // Подписи шкалы по X (каждые 120px) 
  ctx.fillStyle = "rgba(255, 255, 0, 0.18)";
  ctx.font      = "10px monospace";
  for (let x = CELL * 2; x < W; x += CELL * 2) {
    ctx.fillText(`${x}`, x + 2, 12); // текст чуть ниже верхнего края
  }

  // Подписи шкалы по Y 
  for (let y = CELL * 2; y < H; y += CELL * 2) {
    ctx.fillText(`${y}`, 3, y - 2);
  }

  // рамка поля
  ctx.strokeStyle = "#3a5a3a";
  ctx.lineWidth   = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
}

// Компонент
export default function Micro01() {
  const canvasRef = useRef(null);

  useEffect(() => {
    let rafId;

    function loop() {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) draw(ctx); // отрисовка кадра

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
