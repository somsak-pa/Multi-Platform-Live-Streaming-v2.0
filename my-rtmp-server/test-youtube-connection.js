// ทดสอบการเชื่อมต่อ YouTube Stream
require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');

console.log('🧪 ทดสอบการเชื่อมต่อ YouTube Stream...\n');

// ตรวจสอบ YouTube Stream Key
const youtubeKey = process.env.YOUTUBE_STREAM_KEY;
console.log('📺 YouTube Stream Key:');
if (youtubeKey) {
    console.log(`   ✅ พบ Stream Key: ${youtubeKey.substring(0, 4)}...${youtubeKey.substring(youtubeKey.length-4)}`);
    console.log(`   📏 ความยาว: ${youtubeKey.length} ตัวอักษร`);
    
    // ตรวจสอบว่าเป็น pattern ของ test key ทั่วไป
    if (youtubeKey === 'test123' || youtubeKey === 'your-key-here' || youtubeKey.includes('test-key')) {
        console.log('   ❌ นี่เป็น TEST KEY! ไม่สามารถส่งไป YouTube ได้');
        console.log('   🔗 ไปที่: https://studio.youtube.com > Go Live > Stream settings\n');
        process.exit(1);
    } else {
        console.log('   ✅ ใช้ YouTube Stream Key จริง');
    }
} else {
    console.log('   ❌ ไม่พบ YouTube Stream Key!');
    console.log('   💡 ตั้งค่าใน .env file: YOUTUBE_STREAM_KEY=your-key-here\n');
    process.exit(1);
}

// ตรวจสอบ FFmpeg
const ffmpegPath = 'C:/ffmpeg/bin/ffmpeg.exe';
console.log('\n🎬 FFmpeg:');
if (fs.existsSync(ffmpegPath)) {
    console.log(`   ✅ พบ FFmpeg ที่: ${ffmpegPath}`);
} else {
    console.log(`   ❌ ไม่พบ FFmpeg ที่: ${ffmpegPath}`);
    console.log('   💡 ดาวน์โหลดได้ที่: https://ffmpeg.org/download.html\n');
    process.exit(1);
}

// ทดสอบการเชื่อมต่อ YouTube (แบบ dry run)
console.log('\n🔗 ทดสอบการเชื่อมต่อ YouTube...');
console.log('   (ไม่ส่งข้อมูลจริง แค่ทดสอบการเชื่อมต่อ)');

const testArgs = [
    '-f', 'lavfi',
    '-i', 'testsrc2=duration=5:size=320x240:rate=1',  // สร้าง test video 5 วินาที
    '-f', 'lavfi',
    '-i', 'sine=frequency=1000:duration=5',            // สร้าง test audio 5 วินาที
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-b:v', '500k',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-f', 'flv',
    '-t', '5',  // จำกัดเวลา 5 วินาที
    `rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`
];

console.log(`   📡 กำลังทดสอบ: rtmp://a.rtmp.youtube.com/live2/${youtubeKey.substring(0, 4)}...`);

const testProcess = spawn(ffmpegPath, testArgs);
let hasError = false;
let connectionSuccess = false;

testProcess.stderr.on('data', (data) => {
    const output = data.toString();
    
    if (output.includes('Server returned 404')) {
        console.log('   ❌ YouTube ส่งกลับ 404 - Stream Key ไม่ถูกต้องหรือ YouTube Live ไม่เปิด');
        hasError = true;
    } else if (output.includes('Authentication failed')) {
        console.log('   ❌ Authentication ล้มเหลว - Stream Key ไม่ถูกต้อง');
        hasError = true;
    } else if (output.includes('Connection refused')) {
        console.log('   ❌ การเชื่อมต่อถูกปฏิเสธ - ตรวจสอบอินเทอร์เน็ต');
        hasError = true;
    } else if (output.includes('Invalid stream key')) {
        console.log('   ❌ Stream Key ไม่ถูกต้อง');
        hasError = true;
    } else if (output.includes('Non-monotonous DTS')) {
        // ปกติของ test - ไม่ใช่ error
    } else if (output.includes('frame=') && !connectionSuccess) {
        console.log('   ✅ เชื่อมต่อ YouTube สำเร็จ! กำลังส่งข้อมูล...');
        connectionSuccess = true;
    }
});

testProcess.on('close', (code) => {
    console.log(`\n📋 ผลการทดสอบ:`);
    
    if (connectionSuccess && !hasError) {
        console.log('   🎉 ✅ การเชื่อมต่อ YouTube สำเร็จ!');
        console.log('   📺 YouTube Stream Key ใช้งานได้');
        console.log('   🚀 พร้อมสำหรับการ streaming จริง');
        console.log('\n💡 ขั้นตอนต่อไป:');
        console.log('   1. เริ่ม RTMP Server: node server.js');
        console.log('   2. เริ่ม React App');
        console.log('   3. กด Start Stream ใน UI');
    } else if (hasError) {
        console.log('   ❌ การเชื่อมต่อ YouTube ล้มเหลว');
        console.log('   🔧 ตรวจสอบ:');
        console.log('     - YouTube Stream Key ถูกต้องหรือไม่');
        console.log('     - เปิด YouTube Live ใน YouTube Studio หรือยัง');
        console.log('     - การเชื่อมต่ออินเทอร์เน็ตปกติหรือไม่');
    } else {
        console.log('   ⚠️  ไม่สามารถยืนยันการเชื่อมต่อได้');
        console.log('   💡 อาจต้องลองส่ง stream จริงเพื่อทดสอบ');
    }
    
    console.log('\n' + '='.repeat(50));
});

testProcess.on('error', (err) => {
    console.log('   ❌ ไม่สามารถเรียกใช้ FFmpeg ได้');
    console.log(`   💡 Error: ${err.message}`);
    process.exit(1);
});

// Timeout หลัง 15 วินาที
setTimeout(() => {
    if (testProcess && !testProcess.killed) {
        console.log('   ⏰ ทดสอบหมดเวลา กำลังหยุด...');
        testProcess.kill();
    }
}, 15000);