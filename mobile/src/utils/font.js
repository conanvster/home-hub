export const FONT_SCALES = [
  { label: "Звичайний (1×)", value: 1.0 },
  { label: "Великий (1.5×)", value: 1.5 },
  { label: "Дуже великий (2×)", value: 2.0 },
];

export function fs(size, scale) {
  return Math.round(size * scale);
}
