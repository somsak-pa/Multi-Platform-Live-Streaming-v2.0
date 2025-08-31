@echo off
echo 🎬 ตั้งค่า Stream Keys
echo ==================

cd /d "%~dp0"

echo 💡 ใส่แค่ Stream Key ของแต่ละแพลตฟอร์มที่คุณใช้
echo    (ถ้าไม่ใช้แพลตฟอร์มไหน กด Enter เพื่อข้าม)
echo.

set /p YOUTUBE_KEY="🔴 YouTube Stream Key: "
set /p FACEBOOK_KEY="🔵 Facebook Stream Key: "
set /p TWITCH_KEY="🟣 Twitch Stream Key: "

echo.
echo 💾 บันทึกการตั้งค่า...

:: สร้างไฟล์ config แบบง่าย
echo {> user-stream-keys.json
echo   "myuser": {>> user-stream-keys.json
echo     "name": "My Streamer",>> user-stream-keys.json
echo     "youtube": "%YOUTUBE_KEY%",>> user-stream-keys.json
echo     "facebook": "%FACEBOOK_KEY%",>> user-stream-keys.json
echo     "twitch": "%TWITCH_KEY%",>> user-stream-keys.json
echo     "tiktok": "",>> user-stream-keys.json
echo     "instagram": "",>> user-stream-keys.json
echo     "linkedin": "",>> user-stream-keys.json
echo     "custom1": "",>> user-stream-keys.json
echo     "custom2": "">> user-stream-keys.json
echo   }>> user-stream-keys.json
echo }>> user-stream-keys.json

echo.
echo ✅ เสร็จแล้ว! ตอนนี้ดับเบิลคลิก "start-streaming.bat"
echo.
pause