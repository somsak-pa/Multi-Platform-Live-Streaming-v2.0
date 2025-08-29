// Test script เพื่อจำลองการ stream จาก React App
import { spawn } from 'child_process';
import { existsSync } from 'fs';

console.log('🧪 ทดสอบการ Stream แบบ React App');
console.log('🎯 จำลองการส่ง stream ไป RTMP Server แล้ว relay ไป YouTube\n');

const ffmpegPath = 'C:/ffmpeg/bin/ffmpeg.exe';

if (!existsSync(ffmpegPath)) {
    console.log('❌ ไม่พบ FFmpeg!');
    process.exit(1);
}

console.log('📡 เริ่มส่ง test stream ไป RTMP Server...');
console.log('⏰ จะทำงาน 15 วินาที');
console.log('👀 ดู terminal RTMP server ว่ามี YouTube relay เริ่มหรือไม่\n');

// สร้าง test stream และส่งไป RTMP server (เหมือน OBS/React App)
const streamArgs = [
    '-f', 'lavfi',
    '-i', 'testsrc=duration=15:size=1280x720:rate=30',
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=15',
    
    // Video encoding
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-b:v', '2500k',
    '-g', '60',
    '-keyint_min', '60',
    
    // Audio encoding
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    
    // Output to RTMP server
    '-f', 'flv',
    '-y',
    'rtmp://127.0.0.1:1935/live/my-stream-key'
];

console.log('🚀 เริ่ม FFmpeg...');
const streamProcess = spawn(ffmpegPath, streamArgs);

let frameCount = 0;
let connected = false;

streamProcess.stdout.on('data', (data) => {
    console.log(`[STREAM OUT] ${data}`);
});

streamProcess.stderr.on('data', (data) => {
    const output = data.toString();
    
    // ตรวจสอบการเชื่อมต่อ
    if (!connected && (output.includes('Stream mapping:') || output.includes('Opening'))) {
        connected = true;
        console.log('✅ เชื่อมต่อ RTMP Server สำเร็จ!');
    }
    
    // นับ frames
    if (output.includes('frame=')) {
        frameCount++;
        const match = output.match(/frame=\s*(\d+)/);
        if (match && parseInt(match[1]) % 30 === 0) {
            console.log(`📊 ส่งแล้ว ${match[1]} frames (${Math.round(parseInt(match[1])/30)} วินาที)`);
        }
    }
    
    // แสดง errors
    if (output.includes('Connection refused') || output.includes('error')) {
        console.log(`❌ [STREAM ERR] ${output.trim()}`);
    }
});

streamProcess.on('close', (code) => {
    console.log(`\n🏁 Stream Test เสร็จสิ้น!`);
    console.log(`📊 Exit Code: ${code}`);
    console.log(`📊 Total Frames: ${frameCount}`);
    console.log(`📊 RTMP Connection: ${connected ? '✅ Success' : '❌ Failed'}`);
    
    if (connected && code === 0) {
        console.log('\n🎉 Stream ไป RTMP Server สำเร็จ!');
        console.log('💡 ตรวจสอบ RTMP server log ว่ามี YouTube relay หรือไม่');
    } else {
        console.log('\n🔧 ปัญหาที่เป็นไปได้:');
        console.log('   - RTMP Server ไม่ทำงาน (รัน npm run start-streaming)');
        console.log('   - Port 1935 ถูกใช้งานโดยโปรแกรมอื่น');
        console.log('   - Firewall block การเชื่อมต่อ');
    }
    
    console.log('\n' + '='.repeat(50));
});

streamProcess.on('error', (err) => {
    console.error(`❌ ไม่สามารถเริ่ม stream: ${err.message}`);
});

console.log('💡 กด Ctrl+C เพื่อหยุดก่อนเวลา');