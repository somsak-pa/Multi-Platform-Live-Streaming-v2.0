@echo off
echo 🚀 Starting RTMP Server for User 1...
echo ===============================================

cd /d "%~dp0"
node multi-platform-server.js user1

pause