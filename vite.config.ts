import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from 'vite-plugin-electron';

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // --- เพิ่มปลั๊กอิน electron เข้าไป ---
    electron([
      {
        // Script for the Main Process
        entry: 'src/electron.cjs',
      },
      {
        // Script for the Preload
        entry: 'preload.js', // << ชี้ไปยัง preload.js ที่ Root
        onstart(options) {
          // Notifies the Renderer-Process to reload the page when the Preload-Scripts build is complete.
          options.reload()
        },
      },
    ]),
    // ------------------------------------
  ],
})
