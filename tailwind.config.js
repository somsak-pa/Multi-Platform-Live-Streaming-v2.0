/** @type {import('tailwindcss').Config} */

// ✅ นำเข้า plugin จาก tailwindcss
const plugin = require('tailwindcss/plugin')

module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  // ✅ เพิ่มส่วน plugins เข้าไป
  plugins: [
    plugin(function({ addVariant }) {
      // เพิ่ม variant ใหม่ชื่อ 'portrait'
      // ซึ่งจะทำงานเมื่อ @media (orientation: portrait) เป็นจริง
      addVariant('portrait', '@media (orientation: portrait)')
    })
  ],
}