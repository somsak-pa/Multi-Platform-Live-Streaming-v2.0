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
function manageFFmpegProcess(ffmpegPath, commandArgs) {
    if (ffmpegProcess) {
        console.warn('FFmpeg is already running. Stopping it before starting a new one.');
        stopStreaming();
    }
    // (โค้ดส่วนนี้เหมือนเดิม)
    try {
        ffmpegProcess = spawn(ffmpegPath, commandArgs);
        console.log(`FFmpeg process started with PID: ${ffmpegProcess.pid}`);
        if (mainWindow) {
            mainWindow.webContents.send('ffmpeg-log', `FFmpeg process started with PID: ${ffmpegProcess.pid}`);
        }
        ffmpegProcess.stderr.on('data', (data) => {
            const log = data.toString();
            console.error(`FFmpeg: ${log.trim()}`);
            if (mainWindow) {
                mainWindow.webContents.send('ffmpeg-log', log);
            }
        });
        ffmpegProcess.on('close', (code) => {
            const log = `FFmpeg process exited with code ${code}`;
            console.log(log);
            if (mainWindow) {
                mainWindow.webContents.send('ffmpeg-log', log);
            }
            ffmpegProcess = null;
        });
        ffmpegProcess.on('error', (err) => {
            const log = `Failed to start FFmpeg process: ${err.message}`;
            console.error(log);
            if (mainWindow) {
                mainWindow.webContents.send('ffmpeg-log', log);
            }
            ffmpegProcess = null;
        });
    } catch (error) {
        const log = `Error spawning FFmpeg: ${error.message}`;
        console.error(log);
        if (mainWindow) {
            mainWindow.webContents.send('ffmpeg-log', log);
        }
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
ipcMain.handle('ffmpeg-start', (event, { destinations, ffmpegPath, srtInput }) => {
    console.log('IPC event "ffmpeg-start" received.');
    if (!destinations || destinations.length === 0 || !ffmpegPath || !srtInput) {
        const errorMsg = 'Invalid arguments received for ffmpeg-start.';
        console.error(errorMsg, { destinations, ffmpegPath, srtInput });
        return { success: false, error: errorMsg };
    }
    const commandArgs = ['-hide_banner', '-i', srtInput, '-c', 'copy'];
    destinations.forEach(dest => {
        commandArgs.push('-f', 'flv', dest);
    });
    console.log(`Executing: ${ffmpegPath} ${commandArgs.join(' ')}`);
    manageFFmpegProcess(ffmpegPath, commandArgs);
    return { success: true };
});

ipcMain.handle('ffmpeg-stop', () => {
    console.log('IPC event "ffmpeg-stop" received.');
    stopStreaming();
    return { success: true };
});