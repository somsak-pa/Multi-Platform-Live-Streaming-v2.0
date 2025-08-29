const { spawn } = require('child_process');
const net = require('net');

let ffmpegProcess = null;
let isStreamActive = false;

console.log('🚀 Simple RTMP to YouTube Relay Server');
console.log('=====================================');

// ตรวจสอบ YouTube Stream Key
const youtubeKey = process.env.YOUTUBE_STREAM_KEY;
if (!youtubeKey) {
  console.log('❌ YouTube Stream Key not found!');
  console.log('📝 Please set environment variable:');
  console.log('   PowerShell: $env:YOUTUBE_STREAM_KEY="your-key-here"');
  console.log('   CMD: set YOUTUBE_STREAM_KEY=your-key-here');
  console.log('');
  process.exit(1);
}

console.log('✅ YouTube Stream Key found');
console.log(`📝 Key preview: ${youtubeKey.substring(0, 8)}...${youtubeKey.substring(youtubeKey.length-4)}`);
console.log('');

// Function to start YouTube relay
function startYouTubeRelay() {
  if (ffmpegProcess) {
    console.log('⚠️  FFmpeg already running, stopping first...');
    stopYouTubeRelay();
  }

  console.log('🎬 Starting YouTube relay...');
  
  const ffmpegArgs = [
    '-f', 'flv',
    '-listen', '1',
    '-i', 'rtmp://127.0.0.1:1935/live/my-stream-key',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-f', 'flv',
    `rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`
  ];

  console.log(`📡 FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);

  try {
    ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
    
    ffmpegProcess.stdout.on('data', (data) => {
      console.log(`[FFmpeg OUT] ${data}`);
    });
    
    ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Connection to tcp://a.rtmp.youtube.com')) {
        console.log('🎯 Connected to YouTube!');
      }
      console.log(`[FFmpeg] ${output}`);
    });
    
    ffmpegProcess.on('close', (code) => {
      console.log(`📻 FFmpeg process exited with code ${code}`);
      ffmpegProcess = null;
      isStreamActive = false;
    });
    
    ffmpegProcess.on('error', (err) => {
      console.error(`❌ FFmpeg error: ${err.message}`);
      ffmpegProcess = null;
      isStreamActive = false;
    });

    isStreamActive = true;
    console.log(`✅ FFmpeg process started (PID: ${ffmpegProcess.pid})`);
    console.log('🎥 Waiting for OBS stream...');
    
  } catch (error) {
    console.error(`❌ Error starting FFmpeg: ${error.message}`);
  }
}

// Function to stop YouTube relay
function stopYouTubeRelay() {
  if (ffmpegProcess) {
    console.log('⏹️  Stopping YouTube relay...');
    try {
      ffmpegProcess.kill('SIGINT');
      ffmpegProcess = null;
      isStreamActive = false;
      console.log('✅ FFmpeg process stopped');
    } catch (error) {
      console.error(`❌ Error stopping FFmpeg: ${error.message}`);
    }
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  stopYouTubeRelay();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  stopYouTubeRelay();
  process.exit(0);
});

// Start the relay
console.log('🎬 Starting relay server...');
console.log('📺 OBS Settings:');
console.log('   Server: rtmp://127.0.0.1:1935/live');
console.log('   Stream Key: my-stream-key');
console.log('');

startYouTubeRelay();

console.log('✅ Server ready! Start streaming in OBS to begin relay to YouTube.');