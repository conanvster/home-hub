import { useState } from "react";

const SCALES = [1, 1.5, 2];
const COOKIE = "font-scale";
const DEFAULT = 1.5;

function readCookie() {
  const m = document.cookie.match(/(^| )font-scale=([^;]+)/);
  const v = m ? parseFloat(m[2]) : null;
  return SCALES.includes(v) ? v : DEFAULT;
}

function writeCookie(value) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  document.cookie = `${COOKIE}=${value};expires=${d.toUTCString()};path=/`;
}

export function useFontScale() {
  const [scale, setScaleState] = useState(() => readCookie());

  function setScale(v) {
    setScaleState(v);
    document.documentElement.dataset.fontScale = String(v);
    writeCookie(v);
  }

  return [scale, setScale];
}
