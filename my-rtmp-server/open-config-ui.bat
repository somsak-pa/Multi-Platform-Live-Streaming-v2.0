@echo off
echo 🎨 เปิด UI สำหรับตั้งค่า Stream Keys
echo ===============================

cd /d "%~dp0"

echo 📦 ติดตั้ง dependencies...
npm install express cors > nul 2>&1

echo 🌐 เริ่ม Config UI Server...
echo 💡 เบราว์เซอร์จะเปิดอัตโนมัติ
echo ⏹️  กด Ctrl+C เพื่อหยุด
echo ===============================

:: เปิดเบราว์เซอร์
start http://localhost:3000

:: เริ่ม server
node config-server.js

pause