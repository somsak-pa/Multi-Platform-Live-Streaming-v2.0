// Alternative YouTube Relay Configuration
import { config } from 'dotenv';
import { spawn } from 'child_process';
import { existsSync } from 'fs';

config();

console.log('🔧 YouTube Relay Fix - Alternative Configuration\n');

const youtubeKey = process.env.YOUTUBE_STREAM_KEY;
const ffmpegPath = 'C:/ffmpeg/bin/ffmpeg.exe';

if (!youtubeKey || !existsSync(ffmpegPath)) {
    console.log('❌ Missing requirements!');
    process.exit(1);
}

console.log('🚀 Testing YouTube connection with alternative settings...');

// Alternative FFmpeg configuration สำหรับ YouTube
const altArgs = [
    '-i', 'rtmp://127.0.0.1:1935/live/my-stream-key',
    
    // Network and connection settings
    '-rtmp_live', 'live',
    '-rtmp_pageurl', 'https://youtube.com',
    '-rtmp_swfurl', 'https://youtube.com',
    '-rtmp_flashver', 'FMLE/3.0 (compatible; FMSc/1.0)',
    
    // Timeout settings
    '-rw_timeout', '30000000',
    '-stimeout', '30000000',
    
    // Video settings
    '-c:v', 'libx264',
    '-preset', 'veryfast', 
    '-profile:v', 'baseline',
    '-level', '3.0',
    '-pix_fmt', 'yuv420p',
    '-b:v', '2500k',
    '-maxrate', '2500k',
    '-bufsize', '5000k',
    '-g', '60',
    '-keyint_min', '60',
    '-r', '30',
    
    // Audio settings
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    
    // Timestamp and sync
    '-fps_mode', 'cfr',
    '-avoid_negative_ts', 'make_zero',
    '-fflags', '+genpts',
    
    // Output
    '-f', 'flv',
    '-y',
    `rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`
];

console.log('📡 Starting alternative relay...');
const relayProcess = spawn(ffmpegPath, altArgs);

let connected = false;
let frameCount = 0;

relayProcess.stdout.on('data', (data) => {
    console.log(`[RELAY OUT] ${data}`);
});

relayProcess.stderr.on('data', (data) => {
    const output = data.toString();
    
    // ตรวจสอบการเชื่อมต่อ
    if (!connected && (output.includes('Stream mapping:') || output.includes('Opening'))) {
        connected = true;
        console.log('✅ YouTube connection established!');
    }
    
    // นับ frames
    if (output.includes('frame=')) {
        frameCount++;
        const match = output.match(/frame=\s*(\d+)/);
        if (match && parseInt(match[1]) % 60 === 0) {
            console.log(`📊 Relayed ${match[1]} frames (${Math.round(parseInt(match[1])/30)} seconds)`);
        }
    }
    
    // Error detection
    if (output.includes('Error') || output.includes('failed') || output.includes('Cannot')) {
        console.log(`❌ [RELAY ERR] ${output.trim()}`);
    }
    
    // Success indicators
    if (output.includes('Opening') && output.includes('youtube')) {
        console.log(`🎉 [RELAY] ${output.trim()}`);
    }
});

relayProcess.on('close', (code) => {
    console.log(`\n🏁 Alternative Relay Test Complete!`);
    console.log(`📊 Exit Code: ${code}`);
    console.log(`📊 Total Frames: ${frameCount}`);
    console.log(`📊 YouTube Connection: ${connected ? '✅ Success' : '❌ Failed'}`);
    
    if (connected && code === 0) {
        console.log('\n🎉 Alternative configuration works!');
        console.log('💡 Consider updating main server with these settings');
    } else {
        console.log('\n🔧 Issues detected:');
        if (code === 1) {
            console.log('   - FFmpeg configuration issue');
        }
        if (!connected) {
            console.log('   - YouTube connection failed');
            console.log('   - Check YouTube Stream Key');
            console.log('   - Verify YouTube Live is enabled');
            console.log('   - Check firewall settings');
        }
    }
    
    console.log('\n' + '='.repeat(50));
});

relayProcess.on('error', (err) => {
    console.error(`❌ Failed to start alternative relay: ${err.message}`);
});

// Auto timeout after 30 seconds
setTimeout(() => {
    console.log('\n⏰ Test timeout, stopping...');
    if (relayProcess && !relayProcess.killed) {
        relayProcess.kill('SIGTERM');
    }
}, 30000);

console.log('💡 Press Ctrl+C to stop early');