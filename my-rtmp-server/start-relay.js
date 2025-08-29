const { spawn } = require('child_process');

const youtubeKey = process.env.YOUTUBE_STREAM_KEY;

if (!youtubeKey) {
  console.log('❌ YouTube Stream Key not found!');
  console.log('📝 Set environment variable:');
  console.log('   PowerShell: $env:YOUTUBE_STREAM_KEY="your-key-here"');
  process.exit(1);
}

console.log('🎬 Starting Manual YouTube Relay...');
console.log(`📺 YouTube Key: ${youtubeKey.substring(0, 8)}...${youtubeKey.substring(youtubeKey.length-4)}`);

const ffmpegArgs = [
  '-i', 'rtmp://127.0.0.1:1935/live/my-stream-key',
  '-c:v', 'copy',
  '-c:a', 'aac',
  '-b:a', '128k',
  '-ar', '44100',
  '-f', 'flv',
  `rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`
];

console.log(`📡 FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);

const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

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
});

ffmpegProcess.on('error', (err) => {
  console.error(`❌ FFmpeg error: ${err.message}`);
});

console.log('✅ Manual relay started!');
console.log('🛑 Press Ctrl+C to stop');