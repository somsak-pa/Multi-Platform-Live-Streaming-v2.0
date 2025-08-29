// ตรวจสอบการตั้งค่า RTMP Server และ YouTube Key
require('dotenv').config();

console.log('🔍 ตรวจสอบการตั้งค่าระบบ...\n');

// 1. ตรวจสอบ YouTube Stream Key
const youtubeKey = process.env.YOUTUBE_STREAM_KEY;
console.log('📺 YouTube Stream Key:');
if (youtubeKey) {
    console.log(`   ✅ พบ Stream Key: ${youtubeKey.substring(0, 4)}...${youtubeKey.substring(youtubeKey.length-4)}`);
    console.log(`   📏 ความยาว: ${youtubeKey.length} ตัวอักษร`);
    
    // ตรวจสอบว่าเป็น pattern ของ test key ทั่วไป
    if (youtubeKey === 'test123' || youtubeKey === 'your-key-here' || youtubeKey.includes('test-key')) {
        console.log('   ⚠️  นี่ดูเหมือน TEST KEY! ต้องเปลี่ยนเป็น Key จริงจาก YouTube Studio');
        console.log('   🔗 ไปที่: https://studio.youtube.com > Go Live > Stream settings');
    } else {
        console.log('   ✅ ใช้ YouTube Stream Key จริง');
    }
} else {
    console.log('   ❌ ไม่พบ YouTube Stream Key!');
}

// 2. ตรวจสอบ FFmpeg
const fs = require('fs');
const ffmpegPath = 'C:/ffmpeg/bin/ffmpeg.exe';
console.log('\n🎬 FFmpeg:');
if (fs.existsSync(ffmpegPath)) {
    console.log(`   ✅ พบ FFmpeg ที่: ${ffmpegPath}`);
} else {
    console.log(`   ❌ ไม่พบ FFmpeg ที่: ${ffmpegPath}`);
    console.log('   💡 ดาวน์โหลดได้ที่: https://ffmpeg.org/download.html');
}

// 3. ตรวจสอบ Node Modules
console.log('\n📦 Dependencies:');
try {
    require('node-media-server');
    console.log('   ✅ node-media-server: OK');
} catch (e) {
    console.log('   ❌ node-media-server: ไม่พบ');
    console.log('   💡 รัน: npm install');
}

try {
    require('dotenv');
    console.log('   ✅ dotenv: OK');
} catch (e) {
    console.log('   ❌ dotenv: ไม่พบ');
    console.log('   💡 รัน: npm install dotenv');
}

// 4. สรุปสถานะ
console.log('\n📋 สรุป:');
const allGood = youtubeKey && 
                youtubeKey !== 'test123' && 
                youtubeKey !== 'your-key-here' &&
                !youtubeKey.includes('test-key') &&
                fs.existsSync(ffmpegPath);

if (allGood) {
    console.log('   🎉 ระบบพร้อมสำหรับ Streaming!');
    console.log('\n🚀 ขั้นตอนต่อไป:');
    console.log('   1. รัน: node server.js');
    console.log('   2. เริ่ม React App');
    console.log('   3. กด Start Stream');
} else {
    console.log('   ⚠️  ยังมีปัญหาที่ต้องแก้ไข');
    console.log('\n🔧 แนะนำ:');
    if (!youtubeKey || youtubeKey === 'test123' || youtubeKey === 'your-key-here' || youtubeKey.includes('test-key')) {
        console.log('   - ตั้งค่า YouTube Stream Key จริงใน .env file');
    }
    if (!fs.existsSync(ffmpegPath)) {
        console.log('   - ติดตั้ง FFmpeg');
    }
}

console.log('\n' + '='.repeat(50));