// Filename: src/electron.js

// --- ส่วนที่ 1: Import Modules ที่จำเป็น (ES Module Syntax) ---
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import squirrelStartup from 'electron-squirrel-startup';

// --- ส่วนที่ 2: สร้าง __dirname และ Boilerplate ของ Electron ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let ffmpegProcess = null;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (squirrelStartup) {
    app.quit();
}

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            // ใช้ __dirname ที่เราสร้างขึ้นมาเอง
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};

// --- ส่วนที่ 3: การจัดการ Lifecycle ของแอป ---
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    console.log('App is quitting, ensuring FFmpeg is stopped.');
    stopStreaming();
});

// --- ส่วนที่ 4: โค้ดควบคุม FFmpeg และ IPC ---
// --- แก้ไขในส่วนของ manageFFmpegProcess ---
function manageFFmpegProcess(ffmpegPath, commandArgs) {
    // ... (โค้ดส่วนอื่น ๆ เหมือนเดิม) ...

    ffmpegProcess.stderr.on('data', (data) => {
        const log = data.toString();
        // ส่ง log ไปยัง UI เพื่อแสดงผลแบบ Real-time
        if (mainWindow) {
            mainWindow.webContents.send('ffmpeg-log', log);
        }
    });

    ffmpegProcess.on('close', (code) => {
        // อัปเดตสถานะเมื่อ FFmpeg ปิดตัว
        if (code !== 0) {
            const errorMsg = `FFmpeg process exited with an error code: ${code}`;
            console.error(errorMsg);
            // ส่งข้อความ Error ที่ชัดเจนไปที่ UI
            if (mainWindow) {
                mainWindow.webContents.send('streaming-status', { success: false, message: errorMsg });
            }
        } else {
            const successMsg = 'FFmpeg process has stopped successfully.';
            console.log(successMsg);
            // ส่งข้อความสำเร็จไปที่ UI
            if (mainWindow) {
                mainWindow.webContents.send('streaming-status', { success: true, message: successMsg });
            }
        }
        ffmpegProcess = null;
    });

    ffmpegProcess.on('error', (err) => {
        const errorMsg = `Failed to start FFmpeg process: ${err.message}`;
        console.error(errorMsg);
        // ส่งข้อความ Error ที่ชัดเจนไปที่ UI
        if (mainWindow) {
            mainWindow.webContents.send('streaming-status', { success: false, message: errorMsg });
        }
        ffmpegProcess = null;
    });

    // ส่งสถานะเริ่มต้นเมื่อ Process เริ่มทำงาน
    if (mainWindow) {
        mainWindow.webContents.send('streaming-status', { success: true, message: 'Streaming started successfully.' });
    }
}

function stopStreaming() {
    if (ffmpegProcess) {
        console.log(`Stopping FFmpeg process (PID: ${ffmpegProcess.pid})...`);
        ffmpegProcess.kill('SIGINT');
        ffmpegProcess = null;
    }
}

// --- IPC Handlers (เหมือนเดิม) ---
// --- แก้ไขในส่วนของ ipcMain.handle('ffmpeg-start', ...) ---
ipcMain.handle('ffmpeg-start', (event, { destinations, ffmpegPath, srtInput }) => {
    // ... (โค้ด console.log เหมือนเดิม) ...

    // ตรวจสอบความถูกต้องของ Input
    const errors = [];
    if (!ffmpegPath || typeof ffmpegPath !== 'string') {
        errors.push('ffmpegPath is required and must be a string.');
    }
    if (!srtInput || typeof srtInput !== 'string') {
        errors.push('Input stream URL (srtInput) is required and must be a string.');
    }
    if (!destinations || !Array.isArray(destinations) || destinations.length === 0) {
        errors.push('At least one destination URL is required.');
    }

    if (errors.length > 0) {
        console.error('Invalid arguments:', errors.join(', '));
        // ส่งข้อความ Error กลับไปยัง Renderer Process
        return { success: false, error: errors.join('. ') };
    }

    // ... (โค้ดส่วนอื่น ๆ ที่สร้าง commandArgs เหมือนเดิม) ...
    
    return { success: true };
});

ipcMain.handle('ffmpeg-stop', () => {
    console.log('IPC event "ffmpeg-stop" received.');
    stopStreaming();
    return { success: true };
});