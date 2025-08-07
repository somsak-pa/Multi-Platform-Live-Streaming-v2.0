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
    extend: {
      colors: {
        // Facebook Colors
        facebookBlue: '#1877F2',
        facebookDarkBlue: '#166FE5',
        facebookBlueDark: '#3b5998', // สี Facebook สำหรับ Dark Mode (เข้มขึ้น)
        facebookDarkBlueDark: '#2d4373', // สี Facebook เข้มขึ้นสำหรับ Dark Mode (hover)

        // YouTube Colors
        youtubeRed: '#FF0000',
        youtubeDarkRed: '#CC0000',
        youtubeRedDark: '#b00000', // สี YouTube สำหรับ Dark Mode (เข้มขึ้น)
        youtubeDarkRedDark: '#8b0000', // สี YouTube เข้มขึ้นสำหรับ Dark Mode (hover)

        // TikTok Colors (อิงจากสีที่คุณเคยใช้)
        tiktokBlack: '#000000',
        tiktokDarkGray: '#363636', // สีสำหรับ hover
        tiktokBlackDark: '#121212', // สี TikTok สำหรับ Dark Mode (เกือบดำ)
        tiktokDarkGrayDark: '#212121', // สี TikTok เข้มขึ้นสำหรับ Dark Mode (hover)

        // Twitch Colors
        twitchPurple: '#9146FF',
        twitchDarkPurple: '#7A3ACC',
        twitchPurpleDark: '#6441a5', // สี Twitch สำหรับ Dark Mode (เข้มขึ้น)
        twitchDarkPurpleDark: '#4a2b77', // สี Twitch เข้มขึ้นสำหรับ Dark Mode (hover)

        // Shopee Colors (ที่คุณเคยเพิ่มไว้แล้ว)
        shopeeOrange: '#EE4D2D',
        shopeeDarkOrange: '#D64228',
        shopeeOrangeDark: '#ED573D', // สี Shopee สำหรับ Dark Mode (ปรับให้เหมาะ)
        shopeeDarkOrangeDark: '#C74126', // สี Shopee เข้มขึ้นสำหรับ Dark Mode (hover)
      },
    },
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