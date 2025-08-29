// Load environment variables from .env file
require('dotenv').config();

const NodeMediaServer = require('node-media-server');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let ffmpegProcess = null;

// Create media directory if it doesn't exist
const mediaDir = './media';
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
  console.log('[Server] Created media directory');
}

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8000,
    mediaroot: './media',
    allow_origin: '*',
  },
  trans: {
    ffmpeg: 'C:/ffmpeg/bin/ffmpeg.exe',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        dash: true,
        dashFlags: '[f=dash:window_size=3:extra_window_size=5]',
      },
    ],
  },
};

// Check if FFmpeg exists
const ffmpegPath = 'C:/ffmpeg/bin/ffmpeg.exe';
if (!fs.existsSync(ffmpegPath)) {
  console.error(`[ERROR] FFmpeg not found at: ${ffmpegPath}`);
  console.log('[INFO] Please install FFmpeg and update the path in server.js');
}

try {
  var nms = new NodeMediaServer(config);
  
  // Error handling for the server
  nms.on('preConnect', (id, args) => {
    console.log(`[NodeMediaServer] 🔗 Pre-connect: ${id}`);
  });
  
  nms.on('postConnect', (id, args) => {
    console.log(`[NodeMediaServer] ✅ Post-connect: ${id}`);
  });
  
  nms.on('prePublish', (id, StreamPath, args) => {
    console.log(`\n🎬 [NodeMediaServer] Stream เริ่มต้น!`);
    console.log(`[NodeMediaServer] - ID: ${typeof id === 'object' ? JSON.stringify(id) : id}`);
    console.log(`[NodeMediaServer] - Path: ${StreamPath}`);
    console.log(`[NodeMediaServer] - Args:`, args);
    console.log(`[NodeMediaServer] - เวลา: ${new Date().toLocaleString('th-TH')}`);
    
    // ถ้า StreamPath undefined ให้ใช้ข้อมูลจาก session info
    let actualPath = StreamPath;
    if (!actualPath || actualPath === 'undefined') {
      console.log('🔍 [NodeMediaServer] StreamPath undefined, ใช้ path เริ่มต้น...');
      actualPath = '/live/my-stream-key';
    }
    
    console.log(`📝 [NodeMediaServer] ใช้ path: ${actualPath}`);
    
    if (actualPath === '/live/my-stream-key') {
      console.log('✅ [YouTube Relay] ตรวจพบ target stream, เริ่ม relay...');
      console.log('⏰ [YouTube Relay] รอ 3 วินาทีให้ stream เสถียร...');
      
      // ลด delay เหลือ 3 วินาที
      setTimeout(() => {
        if (!ffmpegProcess) {
          console.log('🚀 [YouTube Relay] เริ่ม YouTube relay ทันที!');
          startYouTubeRelay();
        } else {
          console.log('⚠️  [YouTube Relay] Relay ทำงานอยู่แล้ว!');
        }
      }, 3000);
    } else {
      console.log(`❌ [YouTube Relay] Stream path '${actualPath}' ไม่ตรงกับ target '/live/my-stream-key'`);
    }
  });
  
  // เพิ่ม event listener สำหรับ postPublish เพื่อจับ stream ที่เริ่มสำเร็จ
  nms.on('postPublish', (id, StreamPath, args) => {
    console.log(`[NodeMediaServer] 📡 Stream confirmed: ${StreamPath}`);
    
    // จัดการ undefined StreamPath เหมือน prePublish
    let actualPath = StreamPath;
    if (!actualPath || actualPath === 'undefined') {
      console.log('[NodeMediaServer] 🔍 PostPublish StreamPath undefined, assuming target stream');
      actualPath = '/live/my-stream-key';
    }
    
    if (actualPath === '/live/my-stream-key' && !ffmpegProcess) {
      console.log('[YouTube Relay] 🚀 Stream confirmed, starting relay immediately...');
      startYouTubeRelay();
    }
  });
  
  // Manual trigger function สำหรับทดสอบ
  function manualStartRelay() {
    console.log('\n🎯 Manual relay trigger activated!');
    console.log('⏰ Starting relay in 5 seconds...');
    setTimeout(() => {
      if (!ffmpegProcess) {
        startYouTubeRelay();
      } else {
        console.log('[YouTube Relay] ⚠️  Relay already running!');
      }
    }, 5000);
  }
  
  // เริ่ม manual trigger หลังจาก server start 15 วินาที
  setTimeout(() => {
    console.log('\n🔧 Auto-trigger: Checking for streams and starting relay...');
    try {
      // ตรวจสอบว่ามี stream active หรือไม่ก่อนเริ่ม manual trigger
      if (nms && nms.getSession) {
        try {
          const sessions = nms.getSession();
          const streamingSessions = Object.values(sessions).filter(session => 
            session && session.publishStreamPath === '/live/my-stream-key'
          );
          if (streamingSessions.length > 0) {
            console.log('🚀 [Auto-trigger] Found active streams, starting relay immediately...');
            startYouTubeRelay();
          } else {
            console.log('ℹ️ [Auto-trigger] No active streams found, continuing monitoring...');
          }
        } catch (sessionError) {
          console.log('⚠️ [Auto-trigger] Cannot check sessions:', sessionError.message);
        }
      }
    } catch (error) {
      console.error('❌ Auto-trigger error:', error.message);
    }
  }, 15000);

  // เพิ่มการตรวจสอบสามารถ streaming ทุก 10 วินาที
  let streamCheckInterval = setInterval(() => {
    try {
      // ตรวจสอบว่า relay ยังไม่ทำงาน และไม่มี stream active
      if (!ffmpegProcess) {
        console.log('[Polling] 🔍 Checking for active streams...');
        
        // ตรวจสอบ session ที่ active
        let hasActiveStream = false;
        if (nms && nms.getSession) {
          try {
            const sessions = nms.getSession();
            const streamingSessions = Object.values(sessions).filter(session => 
              session && session.publishStreamPath === '/live/my-stream-key'
            );
            hasActiveStream = streamingSessions.length > 0;
            
            if (hasActiveStream) {
              console.log(`[Polling] ✅ Found ${streamingSessions.length} active stream(s)`);
            }
          } catch (sessionError) {
            console.log('[Polling] ⚠️  Cannot check sessions:', sessionError.message);
          }
        }
        
        // ถ้ามี YouTube key และมี stream active แต่ยังไม่มี relay
        if (hasActiveStream && process.env.YOUTUBE_STREAM_KEY && process.env.YOUTUBE_STREAM_KEY !== 'test123') {
          console.log('[Polling] 🚀 Found active stream, starting relay...');
          startYouTubeRelay();
        }
      } else {
        console.log('[Polling] ⚡ YouTube relay is running...');
      }
    } catch (error) {
      console.error('❌ Polling error:', error.message);
    }
  }, 10000); // ลดกลับเป็น 10 วินาที
  
  nms.on('donePublish', (id, StreamPath, args) => {
    console.log(`\n📺 [NodeMediaServer] Stream ended!`);
    console.log(`[NodeMediaServer] - ID: ${typeof id === 'string' ? id : 'session-object'}`);
    console.log(`[NodeMediaServer] - Path: ${StreamPath}`);
    console.log(`[NodeMediaServer] - Args:`, args);
    console.log(`[NodeMediaServer] - เวลา: ${new Date().toLocaleString('th-TH')}`);
    
    // จัดการ undefined StreamPath เหมือน prePublish
    let actualPath = StreamPath;
    if (!actualPath || actualPath === 'undefined') {
      console.log('🔍 [NodeMediaServer] StreamPath undefined, assuming target stream ended');
      actualPath = '/live/my-stream-key';
    }
    
    console.log(`📝 [NodeMediaServer] ใช้ path: ${actualPath}`);
    
    if (actualPath === '/live/my-stream-key') {
      console.log('🛑 [YouTube Relay] ตรวจพบ target stream หยุด, กำลังหยุด relay...');
      stopYouTubeRelay();
      
      // เคลียร์ interval ทั้งหมด
      if (streamCheckInterval) {
        clearInterval(streamCheckInterval);
        streamCheckInterval = null;
        console.log('🧹 [YouTube Relay] Cleared polling interval');
      }
    } else {
      console.log(`ℹ️ [YouTube Relay] Stream path '${actualPath}' ไม่ใช่ target stream`);
    }
  });
  
  function startYouTubeRelay() {
    // ตรวจสอบว่ามี YouTube key หรือไม่
    const youtubeKey = process.env.YOUTUBE_STREAM_KEY;
    
    console.log(`\n📊 [YouTube Relay] Environment check:`);
    console.log(`[YouTube Relay] - YOUTUBE_STREAM_KEY set: ${youtubeKey ? '✅ YES' : '❌ NO'}`);
    
    if (youtubeKey) {
      console.log(`[YouTube Relay] - Key length: ${youtubeKey.length} characters`);
      console.log(`[YouTube Relay] - Key preview: ${youtubeKey.substring(0, 4)}...${youtubeKey.substring(youtubeKey.length-4)}`);
      
      // เริ่มทำการ relay ไป YouTube
      console.log('🚀 [YouTube Relay] Starting relay to YouTube...');
    }
    
    if (!youtubeKey) {
      console.log('\n❌ [YouTube Relay] No YouTube stream key found.');
      console.log('ℹ️ [YouTube Relay] To enable YouTube relay, set the environment variable:');
      console.log('ℹ️ [YouTube Relay] PowerShell: $env:YOUTUBE_STREAM_KEY="your-key-here"');
      console.log('ℹ️ [YouTube Relay] CMD: set YOUTUBE_STREAM_KEY=your-key-here');
      console.log('');
      return;
    }
    
    if (ffmpegProcess) {
      console.log('[YouTube Relay] FFmpeg already running, stopping first...');
      stopYouTubeRelay();
    }
    
    console.log('[YouTube Relay] Starting YouTube relay...');
    
    const ffmpegArgs = [
      '-i', 'rtmp://127.0.0.1:1935/live/my-stream-key',
      '-loglevel', 'info', // เพิ่ม logging
      '-fps_mode', 'cfr',  // ใช้ fps_mode แทน -vsync ที่ deprecated
      '-async', '1',    // จัดการ audio sync
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2',       // stereo audio
      '-avoid_negative_ts', 'make_zero', // แก้ negative timestamp
      '-fflags', '+genpts+igndts', // generate presentation timestamps และ ignore DTS
      '-max_muxing_queue_size', '4096', // เพิ่ม buffer size
      '-reconnect', '1', // auto reconnect
      '-reconnect_at_eof', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5', // รอสูงสุด 5 วิ ก่อน reconnect
      '-timeout', '30000000', // เพิ่ม timeout เป็น 30 วินาที (microseconds)
      '-bufsize', '8000k', // เพิ่ม buffer size
      '-maxrate', '8000k', // จำกัด max bitrate
      '-rtmp_live', 'live', // บอก YouTube ว่าเป็น live stream
      '-y', // overwrite output
      '-f', 'flv',
      `rtmp://a.rtmp.youtube.com/live2/${youtubeKey}`
    ];
    
    console.log(`[YouTube Relay] FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);
    
    try {
      ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
      
      // ตั้ง timeout ให้ FFmpeg หยุดถ้าไม่มีข้อมูลเข้ามานาน (30 วินาที)
      let lastFrameTime = Date.now();
      let frameCheckInterval;
      let hasReceivedFrames = false;
      
      ffmpegProcess.stdout.on('data', (data) => {
        console.log(`[YouTube Relay] stdout: ${data}`);
        lastFrameTime = Date.now();
        hasReceivedFrames = true;
      });
      
      ffmpegProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log(`[YouTube Relay] stderr: ${output}`);
        
        // ตรวจสอบว่ามี frame ใหม่
        if (output.includes('frame=')) {
          lastFrameTime = Date.now();
          hasReceivedFrames = true;
        }
        
        // ตรวจสอบ error ที่ร้ายแรงจริง (เฉพาะ authentication errors)
        if (output.includes('Server returned 403') ||
            output.includes('Server returned 404') ||
            output.includes('Authentication failed') ||
            output.includes('Invalid stream key') ||
            output.includes('403 Forbidden') ||
            output.includes('Error number -10049') ||
            output.includes('Cannot open connection') ||
            output.includes('Unauthorized')) {
          console.log(`❌ [YouTube Relay] Critical error detected: ${output.trim()}`);
          console.log('[YouTube Relay] 🛑 Stopping due to critical error...');
          stopYouTubeRelay();
        }
        
        // ตรวจสอบข้อความสำเร็จ
        if (output.includes('Stream publish started') ||
            output.includes('Opening') && output.includes('rtmp://a.rtmp.youtube.com') ||
            output.includes('Stream mapping:')) {
          console.log(`✅ [YouTube Relay] Stream started successfully: ${output.trim()}`);
        }
        
        // สำหรับ connection errors ให้บันทึก log แต่ไม่หยุดทันที
        if (output.includes('Connection refused') || 
            output.includes('Connection timed out') ||
            output.includes('I/O error') ||
            output.includes('Resource temporarily unavailable')) {
          console.log(`⚠️ [YouTube Relay] Connection issue (will retry): ${output.trim()}`);
          // ไม่หยุด FFmpeg ให้ retry เอง
        }
      });
      
      // ตรวจสอบ frame timeout ทุก 20 วินาที
      frameCheckInterval = setInterval(() => {
        const timeSinceLastFrame = Date.now() - lastFrameTime;
        
        // ถ้าไม่มี frame มานาน 120 วินาที และเคยรับ frames มาแล้ว
        if (hasReceivedFrames && timeSinceLastFrame > 120000) {
          console.log(`⚠️  [YouTube Relay] No frames received for ${Math.round(timeSinceLastFrame/1000)} seconds`);
          console.log('[YouTube Relay] 🛑 Stopping due to frame timeout...');
          clearInterval(frameCheckInterval);
          stopYouTubeRelay();
        }
        
        // ถ้าไม่เคยรับ frames เลยหลัง 300 วินาที (5 นาที)
        if (!hasReceivedFrames && timeSinceLastFrame > 300000) {
          console.log(`❌ [YouTube Relay] No frames received for ${Math.round(timeSinceLastFrame/1000)} seconds (never started)`);
          console.log('[YouTube Relay] 🛑 Stopping due to startup timeout...');
          clearInterval(frameCheckInterval);
          stopYouTubeRelay();
        } else if (!hasReceivedFrames) {
          console.log(`[YouTube Relay] ⏳ Waiting for frames... ${Math.round(timeSinceLastFrame/1000)}s elapsed`);
        }
      }, 20000); // ตรวจทุก 20 วินาที
      
      ffmpegProcess.on('close', (code) => {
        console.log(`[YouTube Relay] FFmpeg process exited with code ${code}`);
        console.log(`[YouTube Relay] - เวลา: ${new Date().toLocaleString('th-TH')}`);
        
        if (frameCheckInterval) {
          clearInterval(frameCheckInterval);
        }
        
        ffmpegProcess = null;
        
        if (code === 0) {
          console.log('✅ [YouTube Relay] FFmpeg exited normally');
        } else {
          console.log(`⚠️  [YouTube Relay] FFmpeg exited with error code ${code}`);
        }
      });
      
      ffmpegProcess.on('error', (err) => {
        console.error(`❌ [YouTube Relay] Failed to start FFmpeg: ${err.message}`);
        
        if (frameCheckInterval) {
          clearInterval(frameCheckInterval);
        }
        
        ffmpegProcess = null;
      });
      
      console.log(`[YouTube Relay] ✅ FFmpeg process started (PID: ${ffmpegProcess.pid})`);
      console.log(`[YouTube Relay] - Command: ffmpeg ${ffmpegArgs.join(' ')}`);
      console.log(`[YouTube Relay] - เวลา: ${new Date().toLocaleString('th-TH')}`);
      
    } catch (error) {
      console.error(`❌ [YouTube Relay] Error starting FFmpeg: ${error.message}`);
    }
  }
  
  function stopYouTubeRelay() {
    if (ffmpegProcess) {
      console.log('\n🛑 [YouTube Relay] Stopping YouTube relay...');
      console.log(`[YouTube Relay] - Process PID: ${ffmpegProcess.pid}`);
      console.log(`[YouTube Relay] - เวลา: ${new Date().toLocaleString('th-TH')}`);
      
      try {
        // ลองส่ง SIGTERM ก่อน (graceful shutdown)
        console.log('[YouTube Relay] Sending SIGTERM to FFmpeg...');
        ffmpegProcess.kill('SIGTERM');
        
        // รอ 3 วินาที แล้วถ้ายังไม่หยุดให้ force kill
        setTimeout(() => {
          if (ffmpegProcess && ffmpegProcess.pid) {
            console.log('[YouTube Relay] ⚠️  FFmpeg still running, force killing...');
            try {
              ffmpegProcess.kill('SIGKILL');
              console.log('[YouTube Relay] ✅ FFmpeg force killed');
            } catch (killError) {
              console.error(`[YouTube Relay] ❌ Error force killing FFmpeg: ${killError.message}`);
            }
            ffmpegProcess = null;
          }
        }, 3000);
        
        // Reset process reference
        ffmpegProcess = null;
        console.log('[YouTube Relay] ✅ FFmpeg stop command sent');
        
      } catch (error) {
        console.error(`[YouTube Relay] ❌ Error stopping FFmpeg: ${error.message}`);
        // Force reset even on error
        ffmpegProcess = null;
      }
    } else {
      console.log('[YouTube Relay] ℹ️  No FFmpeg process to stop');
    }
  }
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down...');
    stopYouTubeRelay();
    if (nms) {
      nms.stop();
    }
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n[Server] Received SIGTERM, shutting down...');
    stopYouTubeRelay();
    if (nms) {
      nms.stop();
    }
    process.exit(0);
  });
  
  // เพิ่มข้อมูลการ debug สำหรับ YouTube Relay
  function logRelayStatus() {
    console.log('\n📊 [YouTube Relay Status]');
    console.log(`- FFmpeg Process: ${ffmpegProcess ? '✅ Running' : '❌ Not Running'}`);
    console.log(`- YouTube Key: ${process.env.YOUTUBE_STREAM_KEY ? '✅ Set' : '❌ Missing'}`);
    if (process.env.YOUTUBE_STREAM_KEY) {
      const key = process.env.YOUTUBE_STREAM_KEY;
      console.log(`- Key Preview: ${key.substring(0,4)}...${key.substring(key.length-4)}`);
    }
    console.log(`- Server Time: ${new Date().toLocaleString('th-TH')}`);
    
    // ตรวจสอบ active sessions
    if (nms && nms.getSession) {
      try {
        const sessions = nms.getSession();
        const activeSessions = Object.values(sessions).filter(session => 
          session && session.publishStreamPath
        );
        console.log(`- Active Streams: ${activeSessions.length}`);
        activeSessions.forEach((session, index) => {
          console.log(`  ${index + 1}. Path: ${session.publishStreamPath}`);
        });
      } catch (error) {
        console.log('- Active Streams: Cannot check (error)');
      }
    }
    console.log('📊 [End Status]\n');
  }
  
  // Log status ทุก 60 วินาที
  setInterval(logRelayStatus, 60000);
  // เริ่มการทำงาน Node Media Server
  nms.run();
  
  // Log initial status
  setTimeout(logRelayStatus, 5000);
  
} catch (error) {
  console.error('[ERROR] Failed to start media server:', error.message);
  console.error('[ERROR] Stack trace:', error.stack);
  process.exit(1);
}