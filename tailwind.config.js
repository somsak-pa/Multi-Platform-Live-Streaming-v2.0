/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // <--- ต้องมีบรรทัดนี้
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}