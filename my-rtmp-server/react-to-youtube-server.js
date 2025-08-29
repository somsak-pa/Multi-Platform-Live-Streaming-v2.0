// Simple RTMP Server สำหรับ React App → YouTube
require('dotenv').config();
const NodeMediaServer = require('node-media-server');
const { spawn } = require('child_process');
const fs = require('fs');

let ffmpegProcess = null;
const ffmpegPath = 'C:/ffmpeg/bin/ffmpeg.exe';

console.log('🚀 Simple RTMP Server for React App → YouTube');
console.log('=' * 50);

// ตรวจสอบ requirements
const youtubeKey = process.env.YOUTUBE_STREAM_KEY;
console.log(`YouTube Key: ${youtubeKey ? '✅ มี (' + youtubeKey.length + ' chars)' : '❌ ไม่มี'}`);
console.log(`FFmpeg: ${fs.existsSync(ffmpegPath) ? '✅ พบ' : '❌ ไม่พบ'}`);

if (!youtubeKey || !fs.existsSync(ffmpegPath)) {
  console.log('❌ Missing requirements!');
  process.exit(1);
}

// Simple RTMP Server config
const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8000,
    mediaroot: './media',
    allow_origin: '*',
  }
};

const nms = new NodeMediaServer(config);

// Simple YouTube Relay function
function startYouTubeRelay() {
  if (ffmpegProcess) {
    console.log('⚠️  YouTube relay already running');
    return;
  }

  console.log('\n🎬 Starting YouTube relay...');
  
  const ffmpegArgs = [
    '-i', 'rtmp://127.0.0.1:1935/live/my-stream-key',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    '-f', 'flv',
    '-y',
    `rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`
  ];

  console.log('📡 FFmpeg command:', ffmpegArgs.join(' '));
  
  try {
    ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
    
    console.log(`✅ YouTube relay started (PID: ${ffmpegProcess.pid})`);
    
    ffmpegProcess.stdout.on('data', (data) => {
      console.log(`[YouTube OUT] ${data.toString().trim()}`);
    });
    
    ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      
      // แสดงเฉพาะข้อมูลสำคัญ
      if (output.includes('Stream mapping:') || 
          output.includes('Opening') ||
          output.includes('frame=') ||
          output.includes('fps=') ||
          output.includes('error') ||
          output.includes('Error')) {
        console.log(`[YouTube] ${output}`);
      }
      
      // ตรวจสอบ success
      if (output.includes('Stream mapping:')) {
        console.log('🎉 YouTube relay connected successfully!');
      }
      
      // ตรวจสอบ critical errors
      if (output.includes('403 Forbidden') || 
          output.includes('Authentication failed') ||
          output.includes('Invalid stream key')) {
        console.log('❌ YouTube authentication error!');
        console.log('🔧 Check your YouTube Stream Key in .env file');
      }
    });
    
    ffmpegProcess.on('close', (code) => {
      console.log(`[YouTube] Relay stopped (exit code: ${code})`);
      ffmpegProcess = null;
    });
    
    ffmpegProcess.on('error', (err) => {
      console.error(`❌ YouTube relay error: ${err.message}`);
      ffmpegProcess = null;
    });
    
  } catch (error) {
    console.error(`❌ Failed to start YouTube relay: ${error.message}`);
  }
}

function stopYouTubeRelay() {
  if (ffmpegProcess) {
    console.log('🛑 Stopping YouTube relay...');
    try {
      ffmpegProcess.kill('SIGTERM');
      ffmpegProcess = null;
      console.log('✅ YouTube relay stopped');
    } catch (error) {
      console.error(`❌ Error stopping relay: ${error.message}`);
      ffmpegProcess = null;
    }
  }
}

// Simple Event Handlers (ลดความซับซ้อน)
nms.on('prePublish', (id, StreamPath, args) => {
  console.log(`\n🎬 [RTMP] Stream started!`);
  console.log(`[RTMP] Raw Path: "${StreamPath}"`);
  console.log(`[RTMP] Session: ${id}`);
  console.log(`[RTMP] Args:`, args);
  console.log(`[RTMP] Time: ${new Date().toLocaleString('th-TH')}`);
  
  // เช็ค path หลายแบบ
  const targetPaths = [
    '/live/my-stream-key',
    'live/my-stream-key',
    'my-stream-key'
  ];
  
  let isTargetStream = false;
  let actualPath = StreamPath || 'undefined';
  
  // ตรวจสอบว่า path ตรงกับ target หรือไม่
  if (!StreamPath || StreamPath === 'undefined') {
    console.log('🔍 [RTMP] StreamPath is undefined, assuming target stream');
    isTargetStream = true;
    actualPath = '/live/my-stream-key (assumed)';
  } else {
    // ตรวจสอบ path ที่เป็นไปได้
    for (const targetPath of targetPaths) {
      if (actualPath === targetPath || actualPath.endsWith(targetPath)) {
        isTargetStream = true;
        console.log(`✅ [RTMP] Matched target path: ${targetPath}`);
        break;
      }
    }
  }
  
  console.log(`[RTMP] Final Path: ${actualPath}`);
  console.log(`[RTMP] Is Target Stream: ${isTargetStream ? '✅ YES' : '❌ NO'}`);
  
  if (isTargetStream) {
    console.log('✅ [RTMP] Target stream detected!');
    console.log('⏰ [RTMP] Starting YouTube relay in 2 seconds...');
    
    // รอ 2 วินาที แล้วเริ่ม relay
    setTimeout(() => {
      startYouTubeRelay();
    }, 2000);
    
  } else {
    console.log(`❌ [RTMP] Stream path not recognized`);
    console.log(`[RTMP] Expected one of: ${targetPaths.join(', ')}`);
    console.log(`[RTMP] Got: ${actualPath}`);
    
    // เริ่ม relay อยู่ดี (fallback)
    console.log('🔄 [RTMP] Starting relay anyway as fallback...');
    setTimeout(() => {
      startYouTubeRelay();
    }, 5000);
  }
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log(`\n📺 [RTMP] Stream ended!`);
  console.log(`[RTMP] Path: ${StreamPath || 'undefined'}`);
  console.log(`[RTMP] Session: ${id}`);
  console.log(`[RTMP] Time: ${new Date().toLocaleString('th-TH')}`);
  
  console.log('🛑 [RTMP] Stopping YouTube relay...');
  stopYouTubeRelay();
});

// เพิ่ม fallback mechanism - ถ้าไม่มี stream มาใน 30 วินาที
let noStreamTimer = setTimeout(() => {
  console.log('\n⚠️  [Fallback] No stream detected in 30 seconds');
  console.log('💡 [Fallback] If React App is streaming, trying to start relay anyway...');
  
  // ลองเริ่ม relay อยู่ดี (กรณี event ไม่ทำงาน)
  if (!ffmpegProcess) {
    console.log('🔄 [Fallback] Attempting to start YouTube relay...');
    startYouTubeRelay();
  }
}, 30000);

// ล้าง timer เมื่อมี stream
nms.on('prePublish', () => {
  if (noStreamTimer) {
    clearTimeout(noStreamTimer);
    noStreamTimer = null;
    console.log('✅ [Fallback] Stream detected, cancelled fallback timer');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down...');
  stopYouTubeRelay();
  if (nms) {
    nms.stop();
  }
  process.exit(0);
});

// Start server
nms.run();

console.log('\n✅ Simple RTMP Server started!');
console.log('=' * 50);
console.log('📡 RTMP URL: rtmp://127.0.0.1:1935/live');
console.log('🔑 Stream Key: my-stream-key');
console.log('🌐 HTTP Server: http://127.0.0.1:8000');
console.log('📺 YouTube Relay: Ready');
console.log('=' * 50);
console.log('\n💡 วิธีใช้:');
console.log('1. รัน script นี้');
console.log('2. เปิด React App');
console.log('3. กด Start Stream ใน React App');
console.log('4. ดูผลลัพธ์ที่นี่');
console.log('\n🛑 กด Ctrl+C เพื่อหยุด');