/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontSize: {
        "xs":   ["1.5rem",  { lineHeight: "2rem" }],
        "sm":   ["1.75rem", { lineHeight: "2.5rem" }],
        "base": ["2rem",    { lineHeight: "2.75rem" }],
        "lg":   ["2.25rem", { lineHeight: "3rem" }],
        "xl":   ["2.5rem",  { lineHeight: "3.25rem" }],
        "2xl":  ["3rem",    { lineHeight: "3.75rem" }],
        "3xl":  ["3.75rem", { lineHeight: "4.5rem" }],
        "4xl":  ["4.5rem",  { lineHeight: "5rem" }],
        "5xl":  ["6rem",    { lineHeight: "1.25" }],
        "6xl":  ["7.5rem",  { lineHeight: "1" }],
      },
    },
  },
  plugins: [],
};
