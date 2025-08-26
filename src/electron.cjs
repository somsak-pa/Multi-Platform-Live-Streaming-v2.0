// Filename: electron.cjs

// --- ส่วนที่ 1: Import Modules ที่จำเป็น ---
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { spawn } = require('child_process');

// --- ส่วนที่ 2: Boilerplate พื้นฐานของ Electron ---

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

const createWindow = () => {
    // สร้างหน้าต่างโปรแกรม (BrowserWindow)
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            // แก้ไข: เปิดการใช้งาน Node.js API ในหน้าเว็บโดยตรง
            // ทำให้ไม่ต้องใช้ preload.js
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    // โหลด UI ของคุณขึ้นมาแสดง
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
};

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});


// --- ส่วนที่ 3: โค้ดควบคุม FFmpeg และการสื่อสาร (IPC) ---

let ffmpegProcess = null;

/**
 * จัดการการรัน FFmpeg process และจัดการเหตุการณ์ต่างๆ
 * @param {string} ffmpegPath - Path ไปยังไฟล์ ffmpeg.exe
 * @param {string[]} commandArgs - Arguments ที่จะส่งให้ FFmpeg
 * @param {BrowserWindow} window - หน้าต่างหลักของ Electron เพื่อส่ง log กลับไป
 */
function manageFFmpegProcess(ffmpegPath, commandArgs, window) {
    // ป้องกันการรันซ้ำซ้อน
    if (ffmpegProcess) {
        console.log('FFmpeg is already running. Stopping it before starting a new one.');
        ffmpegProcess.kill('SIGINT');
        ffmpegProcess = null;
    }

    try {
        ffmpegProcess = spawn(ffmpegPath, commandArgs);
        console.log('FFmpeg process started with PID:', ffmpegProcess.pid);

        // ส่ง log แบบ real-time กลับไปยัง UI
        ffmpegProcess.stderr.on('data', (data) => {
            const log = data.toString();
            console.error(`FFmpeg stderr: ${log}`);
            // ส่ง log กลับไปที่ Renderer Process
            window.webContents.send('ffmpeg-log', log);
        });

        // จัดการเมื่อ process จบการทำงาน
        ffmpegProcess.on('close', (code) => {
            const log = `FFmpeg process exited with code ${code}`;
            console.log(log);
            window.webContents.send('ffmpeg-log', log);
            ffmpegProcess = null;
        });

        ffmpegProcess.on('error', (err) => {
            const log = `Failed to start FFmpeg process: ${err.message}`;
            console.error(log);
            window.webContents.send('ffmpeg-log', log);
            ffmpegProcess = null;
        });

    } catch (error) {
        const log = `Unexpected error: ${error.message}`;
        console.error(log);
        window.webContents.send('ffmpeg-log', log);
    }
}

/**
 * ฟังก์ชันสำหรับสั่งหยุด FFmpeg
 */
function stopStreaming() {
    if (ffmpegProcess) {
        console.log('Stopping FFmpeg process...');
        ffmpegProcess.kill('SIGINT');
    }
}

// --- ส่วนรับฟังคำสั่งจาก UI (Frontend) ผ่าน IPC ---

ipcMain.handle('ffmpeg-start', (event, { destinations, ffmpegPath, srtInput }) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    
    // ประกอบร่าง Arguments สำหรับ FFmpeg
    const commandArgs = ['-i', srtInput, '-c', 'copy'];
    destinations.forEach(dest => {
        commandArgs.push('-f', 'flv', dest);
    });

    // เรียกใช้ฟังก์ชันจัดการ process
    manageFFmpegProcess(ffmpegPath, commandArgs, window);
    
    return { success: true };
});

ipcMain.handle('ffmpeg-stop', () => {
    stopStreaming();
    return { success: true };
});