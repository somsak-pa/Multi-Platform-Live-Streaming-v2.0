// Manual Test สำหรับ YouTube Streaming
require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');

console.log('🧪 Manual Test: ทดสอบการ Stream ไป YouTube โดยตรง\n');

const youtubeKey = process.env.YOUTUBE_STREAM_KEY;
const ffmpegPath = 'C:/ffmpeg/bin/ffmpeg.exe';

// ตรวจสอบ requirements
console.log('📋 Requirements Check:');
console.log(`- YouTube Key: ${youtubeKey ? '✅' : '❌'} ${youtubeKey ? youtubeKey.substring(0,4)+'...'+youtubeKey.substring(youtubeKey.length-4) : 'Missing'}`);
console.log(`- FFmpeg: ${fs.existsSync(ffmpegPath) ? '✅' : '❌'} ${ffmpegPath}`);

if (!youtubeKey || !fs.existsSync(ffmpegPath)) {
  console.log('\n❌ Requirements ไม่ครบ! กรุณาตรวจสอบ');
  process.exit(1);
}

console.log('\n🎬 สร้าง Test Video และส่งไป YouTube...');
console.log('⏰ ระยะเวลา: 30 วินาที');
console.log('📺 ไปดูที่ YouTube Studio Dashboard ได้เลย\n');

// สร้าง test video pattern และส่งไป YouTube
const args = [
  // สร้าง test pattern
  '-f', 'lavfi',
  '-i', 'testsrc=duration=30:size=1280x720:rate=30',
  '-f', 'lavfi', 
  '-i', 'sine=frequency=1000:duration=30',
  
  // Video settings
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-b:v', '2500k',
  '-maxrate', '2500k',
  '-bufsize', '5000k',
  '-vf', 'format=yuv420p',
  '-g', '50',
  '-r', '30',
  
  // Audio settings
  '-c:a', 'aac',
  '-b:a', '128k',
  '-ar', '44100',
  '-ac', '2',
  
  // Output
  '-f', 'flv',
  '-flvflags', 'no_duration_filesize',
  `rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`
];

console.log('🚀 เริ่ม FFmpeg...');
const ffmpeg = spawn(ffmpegPath, args);

let frameCount = 0;
let hasStarted = false;

ffmpeg.stdout.on('data', (data) => {
  console.log(`[STDOUT] ${data}`);
});

ffmpeg.stderr.on('data', (data) => {
  const output = data.toString();
  
  if (!hasStarted && (output.includes('Opening') || output.includes('Stream mapping:'))) {
    hasStarted = true;
    console.log('✅ การเชื่อมต่อ YouTube สำเร็จ!');
  }
  
  if (output.includes('frame=')) {
    frameCount++;
    if (frameCount % 30 === 0) {
      console.log(`📊 ส่งไปแล้ว ${frameCount} frames (${Math.round(frameCount/30)} วินาที)`);
    }
  }
  
  // แสดง errors สำคัญ
  if (output.includes('403') || output.includes('404') || output.includes('Authentication failed')) {
    console.log(`❌ YouTube Error: ${output.trim()}`);
  }
  
  // แสดง status สำคัญ
  if (output.includes('Connection') || output.includes('Stream') || output.includes('Opening')) {
    console.log(`[FFmpeg] ${output.trim()}`);
  }
});

ffmpeg.on('close', (code) => {
  console.log(`\n🏁 Test เสร็จสิ้น! (Exit code: ${code})`);
  console.log(`📊 ส่งไป YouTube ทั้งหมด ${frameCount} frames`);
  
  if (code === 0) {
    console.log('✅ Test สำเร็จ! YouTube ควรได้รับ stream แล้ว');
  } else {
    console.log('⚠️  Test มีปัญหา กรุณาตรวจสอบ:');
    console.log('   - YouTube Stream Key ถูกต้องหรือไม่');
    console.log('   - YouTube Live Stream เปิดอยู่หรือไม่');
    console.log('   - Internet connection เสถียรหรือไม่');
  }
  
  console.log('\n' + '='.repeat(50));
});

ffmpeg.on('error', (err) => {
  console.error(`❌ ไม่สามารถเริ่ม FFmpeg: ${err.message}`);
});

// Auto timeout
setTimeout(() => {
  console.log('\n⏰ หมดเวลา Test กำลังหยุด...');
  if (ffmpeg && !ffmpeg.killed) {
    ffmpeg.kill('SIGTERM');
  }
}, 35000);

console.log('💡 กด Ctrl+C เพื่อหยุดก่อนเวลา');