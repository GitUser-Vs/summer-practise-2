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

// Функция отрисовки
function draw(ctx) {
  // очистка всей страницы перед рисованием
  ctx.clearRect(0, 0, W, H);

  // заливка фона - тёмно-зелёный
  ctx.fillStyle = "#1a2e1a";
  ctx.fillRect(0, 0, W, H);

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
