@echo off
echo 🚀 Starting Dynamic Multi-Platform RTMP Server...
echo ===============================================

cd /d "%~dp0"

echo 📋 Checking Node.js...
node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo 📦 Installing dependencies...
npm install > nul 2>&1

echo 🔧 Checking configuration files...
if not exist platforms-config.json (
    echo ⚠️  platforms-config.json not found (will be created automatically)
)
if not exist user-stream-keys.json (
    echo ⚠️  user-stream-keys.json not found (will be created automatically)
)

echo.
echo 👤 Available Users:
echo ===============================================
if exist user-stream-keys.json (
    node -e "const users = require('./user-stream-keys.json'); Object.entries(users).forEach(([id, user]) => console.log('- ' + id + ': ' + (user.name || 'Unnamed')));"
) else (
    echo - user1: Default User 1
    echo - user2: Default User 2
    echo - demo: Demo User
)
echo ===============================================
echo.

:: Get user ID from command line argument or ask user
set USER_ID=%1
if "%USER_ID%"=="" (
    set /p USER_ID="Enter User ID (default: user1): "
    if "!USER_ID!"=="" set USER_ID=user1
)

echo ✅ Starting Multi-Platform RTMP Server for user: %USER_ID%
echo 💡 Press Ctrl+C to stop the server
echo ===============================================

node multi-platform-server.js %USER_ID%

pause