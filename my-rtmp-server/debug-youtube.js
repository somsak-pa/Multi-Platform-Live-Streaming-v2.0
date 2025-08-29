// Debug script สำหรับตรวจสอบปัญหา YouTube Streaming
import { config } from 'dotenv';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import http from 'http';

config();

console.log('🔍 Debug YouTube Streaming Issues\n');

// ตรวจสอบ Environment Variables
console.log('1️⃣ Environment Variables:');
const youtubeKey = process.env.YOUTUBE_STREAM_KEY;
console.log(`   YouTube Key: ${youtubeKey ? '✅ Set' : '❌ Missing'}`);
if (youtubeKey) {
    console.log(`   Key Preview: ${youtubeKey.substring(0,4)}...${youtubeKey.substring(youtubeKey.length-4)}`);
    console.log(`   Key Length: ${youtubeKey.length} characters`);
    
    if (youtubeKey === 'test123' || youtubeKey === 'your-key-here' || youtubeKey.includes('test')) {
        console.log('   ⚠️  WARNING: This looks like a test key!');
    } else {
        console.log('   ✅ Appears to be a real YouTube key');
    }
}

// ตรวจสอบ FFmpeg
console.log('\n2️⃣ FFmpeg Configuration:');
const ffmpegPath = 'C:/ffmpeg/bin/ffmpeg.exe';
const ffmpegExists = existsSync(ffmpegPath);
console.log(`   FFmpeg Path: ${ffmpegExists ? '✅ Found' : '❌ Missing'} (${ffmpegPath})`);

if (ffmpegExists) {
    console.log('   Testing FFmpeg version...');
    const ffmpegTest = spawn(ffmpegPath, ['-version']);
    ffmpegTest.stdout.on('data', (data) => {
        const version = data.toString().split('\n')[0];
        console.log(`   FFmpeg Version: ${version}`);
    });
}

// ตรวจสอบ RTMP Server Status
console.log('\n3️⃣ RTMP Server Status:');
function checkRTMPServer() {
    return new Promise((resolve) => {
        const req = http.get('http://127.0.0.1:8000', (res) => {
            console.log(`   HTTP Server: ✅ Running (Status: ${res.statusCode})`);
            resolve(true);
        });
        
        req.on('error', (err) => {
            console.log(`   HTTP Server: ❌ Not Running (${err.code})`);
            resolve(false);
        });
        
        req.setTimeout(2000, () => {
            console.log('   HTTP Server: ❌ Timeout');
            req.destroy();
            resolve(false);
        });
    });
}

// ตรวจสอบ Network Connectivity
console.log('\n4️⃣ Network Connectivity:');
function checkYouTubeConnectivity() {
    return new Promise((resolve) => {
        const req = http.get('http://a.rtmp.youtube.com', (res) => {
            console.log(`   YouTube RTMP: ✅ Reachable (Status: ${res.statusCode})`);
            resolve(true);
        });
        
        req.on('error', (err) => {
            console.log(`   YouTube RTMP: ❌ Not Reachable (${err.code})`);
            resolve(false);
        });
        
        req.setTimeout(5000, () => {
            console.log('   YouTube RTMP: ❌ Timeout');
            req.destroy();
            resolve(false);
        });
    });
}

// Main diagnostic function
async function runDiagnostics() {
    const rtmpRunning = await checkRTMPServer();
    const youtubeReachable = await checkYouTubeConnectivity();
    
    console.log('\n5️⃣ Manual YouTube Stream Test:');
    
    if (!youtubeKey) {
        console.log('   ❌ Cannot test - YouTube key missing');
        return;
    }
    
    if (!ffmpegExists) {
        console.log('   ❌ Cannot test - FFmpeg missing');
        return;
    }
    
    console.log('   🧪 Testing direct YouTube connection...');
    console.log('   (Will run for 10 seconds)');
    
    // สร้าง test video และส่งไป YouTube
    const testArgs = [
        '-f', 'lavfi',
        '-i', 'testsrc=duration=10:size=640x480:rate=30',
        '-f', 'lavfi',
        '-i', 'sine=frequency=1000:duration=10',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-b:v', '1000k',
        '-c:a', 'aac',
        '-b:a', '64k',
        '-f', 'flv',
        `rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`
    ];
    
    const testProcess = spawn(ffmpegPath, testArgs);
    let success = false;
    
    testProcess.stderr.on('data', (data) => {
        const output = data.toString();
        
        if (output.includes('Stream mapping:') || output.includes('Opening')) {
            console.log('   ✅ YouTube connection established!');
            success = true;
        }
        
        if (output.includes('403') || output.includes('404') || output.includes('Authentication failed')) {
            console.log('   ❌ YouTube authentication failed!');
            console.log(`   Error: ${output.trim()}`);
        }
        
        // Show important messages
        if (output.includes('frame=') || output.includes('Stream') || output.includes('Connection')) {
            console.log(`   [FFmpeg] ${output.trim()}`);
        }
    });
    
    testProcess.on('close', (code) => {
        console.log(`\n📊 Test Results:`);
        console.log(`   Exit Code: ${code}`);
        console.log(`   YouTube Connection: ${success ? '✅ Success' : '❌ Failed'}`);
        
        if (success) {
            console.log('\n🎉 YouTube streaming should work!');
            console.log('💡 If React App still can\'t stream, check:');
            console.log('   - OBS settings: rtmp://127.0.0.1:1935/live');
            console.log('   - Stream key: my-stream-key');
            console.log('   - RTMP server is running');
        } else {
            console.log('\n🔧 Troubleshooting:');
            console.log('   1. Check YouTube Stream Key');
            console.log('   2. Ensure YouTube Live is enabled');
            console.log('   3. Check internet connection');
            console.log('   4. Try generating new stream key');
        }
        
        console.log('\n' + '='.repeat(50));
    });
    
    // Kill test after 15 seconds
    setTimeout(() => {
        if (testProcess && !testProcess.killed) {
            testProcess.kill('SIGTERM');
        }
    }, 15000);
}

// Run diagnostics
runDiagnostics().catch(console.error);