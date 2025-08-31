@echo off
echo 🎬 เริ่ม Multi-Platform Streaming
echo ===============================

cd /d "%~dp0"

echo ⚡ กำลังเริ่ม RTMP Server...
echo 💡 หลังจากนี้ให้เปิด OBS และตั้งค่า:
echo    - Server: rtmp://127.0.0.1:1935/live
echo    - Stream Key: my-stream-key
echo    - แล้วกด Start Streaming ใน OBS
echo.
echo ⏹️  กด Ctrl+C เพื่อหยุด
echo ===============================

node multi-platform-server.js myuser

pause