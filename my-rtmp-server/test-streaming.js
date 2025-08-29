// ทดสอบการ Stream จริงไป YouTube ด้วย Test Video
require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');

console.log('🧪 ทดสอบการ Stream จริงไป YouTube...\n');

// ตรวจสอบ requirements
const youtubeKey = process.env.YOUTUBE_STREAM_KEY;
const ffmpegPath = 'C:/ffmpeg/bin/ffmpeg.exe';

console.log('📋 ตรวจสอบ Requirements:');
console.log(`- YouTube Key: ${youtubeKey ? '✅ Set' : '❌ Missing'}`);
console.log(`- FFmpeg: ${fs.existsSync(ffmpegPath) ? '✅ Found' : '❌ Missing'}`);

if (!youtubeKey) {
  console.log('\n❌ ไม่พบ YouTube Stream Key!');
  console.log('💡 ตั้งค่าใน .env file: YOUTUBE_STREAM_KEY=your-key-here');
  process.exit(1);
}

if (!fs.existsSync(ffmpegPath)) {
  console.log('\n❌ ไม่พบ FFmpeg!');
  console.log('💡 ดาวน์โหลดและติดตั้ง FFmpeg ที่: https://ffmpeg.org/download.html');
  process.exit(1);
}

console.log('\n🎬 เริ่มทดสอบการ Stream...');
console.log('⏰ การทดสอบจะใช้เวลา 30 วินาที');
console.log('📺 ระหว่างนี้ไปดูที่ YouTube Studio ว่าขึ้น Live Stream หรือไม่\n');

// สร้าง test pattern video และส่งไป YouTube
const testArgs = [
  // สร้าง test pattern video
  '-f', 'lavfi',
  '-i', 'testsrc=duration=30:size=1280x720:rate=30',
  '-f', 'lavfi', 
  '-i', 'sine=frequency=1000:duration=30',
  
  // Video encoding
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-b:v', '2500k',
  '-maxrate', '2500k',
  '-bufsize', '5000k',
  '-vf', 'format=yuv420p',
  '-g', '50',
  '-r', '30',
  
  // Audio encoding
  '-c:a', 'aac',
  '-b:a', '128k',
  '-ar', '44100',
  '-ac', '2',
  
  // Output settings
  '-f', 'flv',
  '-flvflags', 'no_duration_filesize',
  
  `rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`
];

console.log('🚀 เริ่ม FFmpeg...');
const ffmpegProcess = spawn(ffmpegPath, testArgs);

let hasStarted = false;
let frameCount = 0;

ffmpegProcess.stdout.on('data', (data) => {
  console.log(`[FFmpeg stdout] ${data}`);
});

ffmpegProcess.stderr.on('data', (data) => {
  const output = data.toString();
  
  // ตรวจสอบการเริ่มต้น
  if (!hasStarted && (output.includes('Opening') || output.includes('Stream mapping:'))) {
    hasStarted = true;
    console.log('✅ FFmpeg เริ่มต้นสำเร็จ!');
  }
  
  // นับ frames
  if (output.includes('frame=')) {
    frameCount++;
    if (frameCount % 10 === 0) {
      console.log(`📊 ประมวลผลแล้ว ${frameCount} frames...`);
    }
  }
  
  // ตรวจสอบ errors
  if (output.includes('403 Forbidden') || 
      output.includes('404 Not Found') ||
      output.includes('Authentication failed')) {
    console.log('❌ YouTube เกิดข้อผิดพลาด:');
    console.log(`   ${output.trim()}`);
  }
  
  // แสดง output ที่สำคัญ
  if (output.includes('Connection refused') || 
      output.includes('timed out') ||
      output.includes('Stream') ||
      output.includes('Broadcast')) {
    console.log(`[FFmpeg] ${output.trim()}`);
  }
});

ffmpegProcess.on('close', (code) => {
  console.log(`\n🏁 FFmpeg เสร็จสิ้น (exit code: ${code})`);
  console.log(`📊 ประมวลผลทั้งหมด ${frameCount} frames`);
  
  if (code === 0) {
    console.log('✅ การทดสอบสำเร็จ!');
    console.log('📺 ตรวจสอบที่ YouTube Studio ว่าได้รับ stream หรือไม่');
  } else {
    console.log('⚠️  การทดสอบมีปัญหา');
    console.log('💡 ตรวจสอบ YouTube Stream Key และสถานะ YouTube Live');
  }
  
  console.log('\n' + '='.repeat(50));
});

ffmpegProcess.on('error', (err) => {
  console.error(`❌ ไม่สามารถเริ่ม FFmpeg: ${err.message}`);
});

// Timeout หลัง 35 วินาที
setTimeout(() => {
  console.log('\n⏰ ครบเวลาทดสอบ กำลังหยุด...');
  if (ffmpegProcess && !ffmpegProcess.killed) {
    ffmpegProcess.kill('SIGTERM');
  }
}, 35000);

console.log('💡 กด Ctrl+C เพื่อหยุดการทดสอบก่อนเวลา');