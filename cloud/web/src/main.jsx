import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Застосовуємо масштаб шрифту з куки до першого рендеру (без мигання)
(function () {
  const m = document.cookie.match(/(^| )font-scale=([^;]+)/);
  const v = m ? parseFloat(m[2]) : 1.5;
  document.documentElement.dataset.fontScale = String([1, 1.5, 2].includes(v) ? v : 1.5);
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
