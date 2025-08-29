// ทดสอบการ Stream จาก React App ไป YouTube
require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');

console.log('🧪 ทดสอบการ Stream จาก React App ไป YouTube');
console.log('=' * 50);

// ตรวจสอบ requirements
const youtubeKey = process.env.YOUTUBE_STREAM_KEY;
const ffmpegPath = 'C:/ffmpeg/bin/ffmpeg.exe';

console.log('\n📋 ตรวจสอบ Requirements:');
console.log(`- YouTube Key: ${youtubeKey ? '✅ มี' : '❌ ไม่มี'}`);
console.log(`- FFmpeg: ${fs.existsSync(ffmpegPath) ? '✅ พบ' : '❌ ไม่พบ'}`);

if (!youtubeKey) {
  console.log('\n❌ ไม่พบ YouTube Stream Key!');
  console.log('💡 ตั้งค่าใน .env file');
  process.exit(1);
}

if (!fs.existsSync(ffmpegPath)) {
  console.log('\n❌ ไม่พบ FFmpeg!');
  console.log(`💡 ติดตั้ง FFmpeg ที่: ${ffmpegPath}`);
  process.exit(1);
}

console.log('\n🎯 จำลองการ Stream จาก React App...');
console.log('⏰ รอ 5 วินาที แล้วเริ่มทดสอบ');

// รอ 5 วินาที เพื่อให้ RTMP Server พร้อม
setTimeout(() => {
  console.log('\n🚀 เริ่มการทดสอบ!');
  
  // สร้าง test stream เหมือน React App
  const testStreamArgs = [
    '-f', 'lavfi',
    '-i', 'testsrc=duration=20:size=1280x720:rate=30',
    '-f', 'lavfi',
    '-i', 'sine=frequency=1000:duration=20',
    
    // Video encoding
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-b:v', '2500k',
    '-g', '60',
    
    // Audio encoding
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    
    // Output to RTMP server (เหมือน React App)
    '-f', 'flv',
    '-y',
    'rtmp://127.0.0.1:1935/live/my-stream-key'
  ];
  
  console.log('📡 กำลังส่ง test stream ไป RTMP Server...');
  const streamProcess = spawn(ffmpegPath, testStreamArgs);
  
  let connected = false;
  
  streamProcess.stdout.on('data', (data) => {
    console.log(`[STREAM OUT] ${data}`);
  });
  
  streamProcess.stderr.on('data', (data) => {
    const output = data.toString();
    
    if (!connected && (output.includes('Stream mapping:') || output.includes('Opening'))) {
      connected = true;
      console.log('✅ เชื่อมต่อ RTMP Server สำเร็จ!');
      console.log('⏳ รอให้ RTMP Server ตรวจจับและเริ่ม YouTube relay...');
    }
    
    if (output.includes('frame=')) {
      const match = output.match(/frame=\s*(\d+)/);
      if (match && parseInt(match[1]) % 60 === 0) {
        console.log(`📊 ส่งแล้ว ${match[1]} frames`);
      }
    }
  });
  
  streamProcess.on('close', (code) => {
    console.log(`\n🏁 การทดสอบเสร็จสิ้น (Exit Code: ${code})`);
    
    if (connected && code === 0) {
      console.log('✅ การส่ง stream ไป RTMP Server สำเร็จ!');
      console.log('\n💡 ตรวจสอบผลลัพธ์:');
      console.log('1. ดู console ของ RTMP Server');
      console.log('2. ตรวจสอบว่ามี YouTube relay เริ่มหรือไม่');
      console.log('3. ตรวจสอบ YouTube Live Stream status');
    } else {
      console.log('❌ การทดสอบไม่สำเร็จ');
      console.log('🔧 ปัญหาที่เป็นไปได้:');
      console.log('   - RTMP Server ไม่ทำงาน');
      console.log('   - Port 1935 ถูกใช้งาน');
      console.log('   - FFmpeg configuration ผิด');
    }
  });
  
  streamProcess.on('error', (err) => {
    console.error(`❌ ข้อผิดพลาด: ${err.message}`);
  });
  
}, 5000);

console.log('\n💡 วิธีใช้:');
console.log('1. เริ่ม RTMP Server ก่อน: npm run start-streaming');
console.log('2. รันไฟล์นี้: node test-react-to-youtube.js');
console.log('3. ดูผลลัพธ์ใน console');