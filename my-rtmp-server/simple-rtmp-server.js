// Simplified RTMP Server สำหรับทดสอบ YouTube Streaming
require('dotenv').config();
const NodeMediaServer = require('node-media-server');
const { spawn } = require('child_process');
const fs = require('fs');

let ffmpegProcess = null;

console.log('🚀 เริ่มต้น Simplified RTMP Server สำหรับทดสอบ...\n');

// ตรวจสอบ YouTube Stream Key
const youtubeKey = process.env.YOUTUBE_STREAM_KEY;
console.log('📺 YouTube Configuration:');
console.log(`- Stream Key: ${youtubeKey ? '✅ Set' : '❌ Missing'}`);
if (youtubeKey) {
  console.log(`- Key Preview: ${youtubeKey.substring(0,4)}...${youtubeKey.substring(youtubeKey.length-4)}`);
  console.log(`- Key Length: ${youtubeKey.length} characters`);
}

// ตรวจสอบ FFmpeg
const ffmpegPath = 'C:/ffmpeg/bin/ffmpeg.exe';
console.log(`\n🎬 FFmpeg: ${fs.existsSync(ffmpegPath) ? '✅ Found' : '❌ Missing'}`);

if (!youtubeKey || !fs.existsSync(ffmpegPath)) {
  console.log('\n❌ ระบบไม่พร้อม! ตรวจสอบการตั้งค่าก่อน');
  process.exit(1);
}

// RTMP Server Configuration (ง่ายขึ้น)
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

// ฟังก์ชัน YouTube Relay ที่แก้ไขแล้ว
function startYouTubeRelay() {
  if (ffmpegProcess) {
    console.log('⚠️  [YouTube Relay] Already running, skipping...');
    return;
  }

  console.log('\n🚀 [YouTube Relay] Starting YouTube relay...');
  
  // FFmpeg arguments ที่แก้ไขแล้ว (ไม่มี stimeout และ rw_timeout)
  const ffmpegArgs = [
    '-i', 'rtmp://127.0.0.1:1935/live/my-stream-key',
    '-loglevel', 'info',
    '-c:v', 'copy',           // copy video stream
    '-c:a', 'aac',            // encode audio to AAC
    '-b:a', '128k',           // audio bitrate
    '-ar', '44100',           // audio sample rate
    '-ac', '2',               // stereo audio
    '-f', 'flv',              // output format
    '-reconnect', '1',        // enable reconnect
    '-reconnect_at_eof', '1', // reconnect at end of file
    '-reconnect_streamed', '1', // reconnect streamed
    '-reconnect_delay_max', '5', // max delay before reconnect
    '-y',                     // overwrite output
    `rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`
  ];

  console.log(`[YouTube Relay] Command: ffmpeg ${ffmpegArgs.join(' ')}`);
  
  try {
    ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
    
    console.log(`[YouTube Relay] ✅ Process started (PID: ${ffmpegProcess.pid})`);
    
    ffmpegProcess.stdout.on('data', (data) => {
      console.log(`[FFmpeg OUT] ${data.toString().trim()}`);
    });
    
    ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      console.log(`[FFmpeg ERR] ${output}`);
      
      // ตรวจสอบ success indicators
      if (output.includes('Stream mapping:') || 
          output.includes('Opening') && output.includes('rtmp://a.rtmp.youtube.com')) {
        console.log('✅ [YouTube Relay] Stream started successfully!');
      }
      
      // ตรวจสอบ critical errors
      if (output.includes('403 Forbidden') || 
          output.includes('404 Not Found') ||
          output.includes('Authentication failed') ||
          output.includes('Invalid stream key')) {
        console.log('❌ [YouTube Relay] Critical error detected, stopping...');
        stopYouTubeRelay();
      }
    });
    
    ffmpegProcess.on('close', (code) => {
      console.log(`[YouTube Relay] Process exited with code ${code}`);
      ffmpegProcess = null;
      
      if (code === 0) {
        console.log('✅ [YouTube Relay] Exited normally');
      } else {
        console.log(`⚠️  [YouTube Relay] Exited with error code ${code}`);
      }
    });
    
    ffmpegProcess.on('error', (err) => {
      console.error(`❌ [YouTube Relay] Failed to start: ${err.message}`);
      ffmpegProcess = null;
    });
    
  } catch (error) {
    console.error(`❌ [YouTube Relay] Error: ${error.message}`);
  }
}

function stopYouTubeRelay() {
  if (ffmpegProcess) {
    console.log('🛑 [YouTube Relay] Stopping...');
    try {
      ffmpegProcess.kill('SIGTERM');
      ffmpegProcess = null;
      console.log('✅ [YouTube Relay] Stopped');
    } catch (error) {
      console.error(`❌ [YouTube Relay] Error stopping: ${error.message}`);
      ffmpegProcess = null;
    }
  }
}

// Event Handlers
nms.on('prePublish', (id, StreamPath, args) => {
  console.log(`\n🎬 [RTMP] Stream started: ${StreamPath || '/live/my-stream-key'}`);
  console.log(`[RTMP] Session ID: ${id}`);
  
  // เริ่ม YouTube relay หลังจาก 3 วินาที
  setTimeout(() => {
    console.log('[RTMP] Starting YouTube relay...');
    startYouTubeRelay();
  }, 3000);
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log(`\n📺 [RTMP] Stream ended: ${StreamPath || '/live/my-stream-key'}`);
  console.log(`[RTMP] Session ID: ${id}`);
  
  console.log('[RTMP] Stopping YouTube relay...');
  stopYouTubeRelay();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  stopYouTubeRelay();
  if (nms) {
    nms.stop();
  }
  process.exit(0);
});

// เริ่มต้น server
nms.run();

console.log('\n=======================================');
console.log('🎯 RTMP Server Started!');
console.log('=======================================');
console.log('📡 RTMP URL: rtmp://127.0.0.1:1935/live');
console.log('🔑 Stream Key: my-stream-key');
console.log('🌐 HTTP Server: http://127.0.0.1:8000');
console.log('📺 YouTube Relay: Ready');
console.log('=======================================');
console.log('\n💡 วิธีใช้:');
console.log('1. เปิด OBS');
console.log('2. ตั้งค่า Stream:');
console.log('   - URL: rtmp://127.0.0.1:1935/live');
console.log('   - Key: my-stream-key');
console.log('3. กด Start Streaming');
console.log('4. ระบบจะ relay ไป YouTube อัตโนมัติ');
console.log('\n🔄 กด Ctrl+C เพื่อหยุด server');