// Debug Script สำหรับตรวจสอบ RTMP Server และ YouTube Relay
require('dotenv').config();
const NodeMediaServer = require('node-media-server');
const { spawn } = require('child_process');
const fs = require('fs');

let ffmpegProcess = null;
const ffmpegPath = 'C:/ffmpeg/bin/ffmpeg.exe';

console.log('🔧 Debug RTMP Server และ YouTube Relay');
console.log('=' * 50);

// ตรวจสอบ environment
const youtubeKey = process.env.YOUTUBE_STREAM_KEY;
console.log('\n📊 Environment Check:');
console.log(`- YouTube Key: ${youtubeKey ? '✅ มี (' + youtubeKey.length + ' chars)' : '❌ ไม่มี'}`);
console.log(`- FFmpeg: ${fs.existsSync(ffmpegPath) ? '✅ มี' : '❌ ไม่มี'}`);

if (!youtubeKey || !fs.existsSync(ffmpegPath)) {
  console.log('\n❌ Missing requirements!');
  process.exit(1);
}

// RTMP Server configuration (แบบง่าย)
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

console.log('\n🚀 เริ่ม RTMP Server...');
const nms = new NodeMediaServer(config);

// ฟังก์ชัน YouTube Relay แบบง่าย
function startYouTubeRelay() {
  if (ffmpegProcess) {
    console.log('⚠️  [YouTube Relay] กำลังทำงานอยู่แล้ว');
    return;
  }

  console.log('\n🎬 [YouTube Relay] เริ่ม relay ไป YouTube...');
  
  const ffmpegArgs = [
    '-i', 'rtmp://127.0.0.1:1935/live/my-stream-key',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    '-f', 'flv',
    '-reconnect', '1',
    '-reconnect_at_eof', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-y',
    `rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`
  ];

  console.log(`📡 FFmpeg Command: ${ffmpegArgs.join(' ')}`);
  
  try {
    ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
    
    console.log(`✅ [YouTube Relay] Process started (PID: ${ffmpegProcess.pid})`);
    
    ffmpegProcess.stdout.on('data', (data) => {
      console.log(`[YouTube OUT] ${data.toString().trim()}`);
    });
    
    ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      console.log(`[YouTube LOG] ${output}`);
      
      // ตรวจสอบ success
      if (output.includes('Stream mapping:') || 
          output.includes('Opening') && output.includes('rtmp://a.rtmp.youtube.com')) {
        console.log('🎉 [YouTube Relay] เชื่อมต่อ YouTube สำเร็จ!');
      }
      
      // ตรวจสอบ errors
      if (output.includes('403 Forbidden') || 
          output.includes('Authentication failed') ||
          output.includes('Invalid stream key')) {
        console.log('❌ [YouTube Relay] YouTube authentication error!');
      }
      
      if (output.includes('Connection refused') || 
          output.includes('Cannot open connection')) {
        console.log('⚠️  [YouTube Relay] Connection issue (will retry)');
      }
    });
    
    ffmpegProcess.on('close', (code) => {
      console.log(`[YouTube Relay] Process exited (code: ${code})`);
      ffmpegProcess = null;
    });
    
    ffmpegProcess.on('error', (err) => {
      console.error(`❌ [YouTube Relay] Error: ${err.message}`);
      ffmpegProcess = null;
    });
    
  } catch (error) {
    console.error(`❌ [YouTube Relay] Failed to start: ${error.message}`);
  }
}

function stopYouTubeRelay() {
  if (ffmpegProcess) {
    console.log('🛑 [YouTube Relay] หยุด relay...');
    try {
      ffmpegProcess.kill('SIGTERM');
      ffmpegProcess = null;
      console.log('✅ [YouTube Relay] หยุดแล้ว');
    } catch (error) {
      console.error(`❌ [YouTube Relay] Error stopping: ${error.message}`);
      ffmpegProcess = null;
    }
  }
}

// Event Handlers (แบบง่าย)
nms.on('prePublish', (id, StreamPath, args) => {
  console.log(`\n🎬 [RTMP] Stream เริ่มต้น!`);
  console.log(`[RTMP] - Path: ${StreamPath || 'undefined'}`);
  console.log(`[RTMP] - ID: ${id}`);
  console.log(`[RTMP] - Args:`, args);
  
  // ตรวจสอบ path
  const targetPath = '/live/my-stream-key';
  const actualPath = StreamPath || targetPath;
  
  console.log(`[RTMP] - ตรวจสอบ Path: ${actualPath}`);
  
  if (actualPath === targetPath) {
    console.log('✅ [RTMP] ตรงกับ target path! กำลังเริ่ม YouTube relay...');
    
    // รอ 3 วินาที แล้วเริ่ม relay
    setTimeout(() => {
      startYouTubeRelay();
    }, 3000);
    
  } else {
    console.log(`❌ [RTMP] Path ไม่ตรง! Expected: ${targetPath}, Got: ${actualPath}`);
  }
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log(`\n📺 [RTMP] Stream หยุด!`);
  console.log(`[RTMP] - Path: ${StreamPath || 'undefined'}`);
  console.log(`[RTMP] - ID: ${id}`);
  
  console.log('🛑 [RTMP] หยุด YouTube relay...');
  stopYouTubeRelay();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 [Server] กำลังหยุด server...');
  stopYouTubeRelay();
  if (nms) {
    nms.stop();
  }
  process.exit(0);
});

// เริ่ม server
nms.run();

console.log('\n✅ Debug RTMP Server เริ่มแล้ว!');
console.log('=' * 50);
console.log('📡 RTMP URL: rtmp://127.0.0.1:1935/live');
console.log('🔑 Stream Key: my-stream-key');
console.log('🌐 HTTP Server: http://127.0.0.1:8000');
console.log('📺 YouTube Relay: พร้อม');
console.log('=' * 50);
console.log('\n💡 ขั้นตอนทดสอบ:');
console.log('1. รัน script นี้');
console.log('2. ใน terminal อีกอัน รัน: node test-react-to-youtube.js');
console.log('3. ดูผลลัพธ์ที่นี่');
console.log('\n🛑 กด Ctrl+C เพื่อหยุด');