require('dotenv').config();
const NodeMediaServer = require('node-media-server');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// FFmpeg processes for each platform
let ffmpegProcesses = {};

const ffmpegPath = 'C:/ffmpeg/bin/ffmpeg.exe';

console.log('🚀 Dynamic Multi-Platform RTMP Server');
console.log('=' * 50);

// Load platform configurations from JSON file
let platformConfigs = {};
const configPath = path.join(__dirname, 'platforms-config.json');

if (fs.existsSync(configPath)) {
  try {
    platformConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('📋 Loaded platform configurations from platforms-config.json');
  } catch (error) {
    console.error('❌ Error loading platform configurations:', error.message);
    platformConfigs = {};
  }
} else {
  console.log('⚠️  platforms-config.json not found, using default configuration');
  // Create default config file
  const defaultConfig = {
    "youtube": {
      "name": "YouTube",
      "rtmpUrl": "rtmp://a.rtmp.youtube.com/live2/",
      "icon": "🔴",
      "enabled": true
    },
    "facebook": {
      "name": "Facebook",
      "rtmpUrl": "rtmp://live-api-s.facebook.com:443/rtmp/",
      "icon": "🔵",
      "enabled": true
    },
    "twitch": {
      "name": "Twitch",
      "rtmpUrl": "rtmp://live.twitch.tv/app/",
      "icon": "🟣",
      "enabled": true
    },
    "tiktok": {
      "name": "TikTok",
      "rtmpUrl": "rtmp://live.tiktok.com/live/",
      "icon": "⚫",
      "enabled": false
    },
    "instagram": {
      "name": "Instagram",
      "rtmpUrl": "rtmp://live.instagram.com/rtmp/",
      "icon": "🟡",
      "enabled": false
    }
  };
  
  try {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    platformConfigs = defaultConfig;
    console.log('✅ Created default platforms-config.json');
  } catch (error) {
    console.error('❌ Error creating default config:', error.message);
    platformConfigs = defaultConfig;
  }
}

// Load user stream keys from JSON file
let userStreamKeys = {};
const keysPath = path.join(__dirname, 'user-stream-keys.json');

if (fs.existsSync(keysPath)) {
  try {
    userStreamKeys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
    console.log('🔑 Loaded user stream keys from user-stream-keys.json');
  } catch (error) {
    console.error('❌ Error loading user stream keys:', error.message);
    userStreamKeys = {};
  }
} else {
  console.log('⚠️  user-stream-keys.json not found, creating template');
  const defaultKeys = {
    "user1": {
      "name": "User 1",
      "youtube": "your-youtube-key-here",
      "facebook": "your-facebook-key-here",
      "twitch": "your-twitch-key-here"
    },
    "user2": {
      "name": "User 2",
      "youtube": "",
      "facebook": "",
      "twitch": ""
    }
  };
  
  try {
    fs.writeFileSync(keysPath, JSON.stringify(defaultKeys, null, 2));
    userStreamKeys = defaultKeys;
    console.log('✅ Created template user-stream-keys.json');
  } catch (error) {
    console.error('❌ Error creating template keys:', error.message);
    userStreamKeys = defaultKeys;
  }
}

// Get current user ID from command line argument or environment
const currentUserId = process.argv[2] || process.env.USER_ID || 'user1';
console.log(`👤 Current User: ${currentUserId}`);

const currentUser = userStreamKeys[currentUserId];
if (!currentUser) {
  console.error(`❌ User '${currentUserId}' not found in user-stream-keys.json`);
  console.log('Available users:', Object.keys(userStreamKeys).join(', '));
  process.exit(1);
}

console.log(`👋 Welcome ${currentUser.name || currentUserId}!`);

// Display platform status for current user
console.log('📋 Platform Status:');
Object.entries(platformConfigs).forEach(([platformKey, platform]) => {
  if (platform.enabled) {
    const hasKey = currentUser[platformKey] && currentUser[platformKey].length > 0;
    console.log(`${platform.icon} ${platform.name}: ${hasKey ? '✅ Ready' : '⚠️  No Key'}`);
  } else {
    console.log(`${platform.icon} ${platform.name}: 🚫 Disabled`);
  }
});
console.log(`FFmpeg: ${fs.existsSync(ffmpegPath) ? '✅ Found' : '❌ Not Found'}`);

if (!fs.existsSync(ffmpegPath)) {
  console.log('❌ FFmpeg not found!');
  process.exit(1);
}

// RTMP Server config
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
  }
};

const nms = new NodeMediaServer(config);

// Start relay for specific platform
function startPlatformRelay(platformKey, streamPath) {
  const platform = platformConfigs[platformKey];
  const streamKey = currentUser[platformKey];
  
  if (!platform) {
    console.log(`⚠️  Platform '${platformKey}' not found in configuration`);
    return false;
  }
  
  if (!platform.enabled) {
    console.log(`⚠️  ${platform.name}: Platform disabled in configuration`);
    return false;
  }
  
  if (!streamKey || streamKey.trim() === '' || streamKey === 'your-' + platformKey + '-key-here') {
    console.log(`⚠️  ${platform.name}: No stream key configured for user '${currentUserId}', skipping...`);
    return false;
  }

  if (ffmpegProcesses[platformKey]) {
    console.log(`⚠️  ${platform.name} relay already running`);
    return false;
  }

  console.log(`\n🎬 Starting ${platform.name} relay for ${currentUser.name || currentUserId}...`);
  
  const ffmpegArgs = [
    '-i', `rtmp://127.0.0.1:1935${streamPath}`,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    '-f', 'flv',
    '-y',
    `${platform.rtmpUrl}${streamKey}`
  ];

  console.log(`📡 ${platform.name} FFmpeg command:`, ffmpegArgs.join(' '));
  
  try {
    const process = spawn(ffmpegPath, ffmpegArgs);
    ffmpegProcesses[platformKey] = process;
    
    console.log(`✅ ${platform.name} relay started (PID: ${process.pid})`);
    
    process.stdout.on('data', (data) => {
      console.log(`[${platform.name} OUT] ${data.toString().trim()}`);
    });
    
    process.stderr.on('data', (data) => {
      const output = data.toString().trim();
      
      // แสดงเฉพาะข้อมูลสำคัญ
      if (output.includes('Stream mapping:') || 
          output.includes('Opening') ||
          output.includes('frame=') ||
          output.includes('fps=') ||
          output.includes('error') ||
          output.includes('Error')) {
        console.log(`[${platform.name}] ${output}`);
      }
      
      // ตรวจสอบ success
      if (output.includes('Stream mapping:')) {
        console.log(`🎉 ${platform.name} relay connected successfully!`);
      }
      
      // ตรวจสอบ critical errors
      if (output.includes('403 Forbidden') || 
          output.includes('Authentication failed') ||
          output.includes('Invalid stream key')) {
        console.log(`❌ ${platform.name} authentication error!`);
        console.log(`🔧 Check stream key for user '${currentUserId}' in user-stream-keys.json`);
      }
    });
    
    process.on('close', (code) => {
      console.log(`[${platform.name}] Relay stopped (exit code: ${code})`);
      ffmpegProcesses[platformKey] = null;
    });
    
    process.on('error', (err) => {
      console.error(`❌ ${platform.name} relay error: ${err.message}`);
      ffmpegProcesses[platformKey] = null;
    });
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to start ${platform.name} relay: ${error.message}`);
    return false;
  }
}

// Stop relay for specific platform
function stopPlatformRelay(platformKey) {
  const platform = platformConfigs[platformKey];
  const process = ffmpegProcesses[platformKey];
  
  if (process) {
    console.log(`🛑 Stopping ${platform.name} relay...`);
    try {
      process.kill('SIGTERM');
      ffmpegProcesses[platformKey] = null;
      console.log(`✅ ${platform.name} relay stopped`);
    } catch (error) {
      console.error(`❌ Error stopping ${platform.name} relay: ${error.message}`);
      ffmpegProcesses[platformKey] = null;
    }
  }
}

// Start all configured and enabled platforms
function startAllRelays(streamPath) {
  console.log(`🚀 Starting relays for user '${currentUserId}'...`);
  let startedCount = 0;
  
  Object.keys(platformConfigs).forEach(platformKey => {
    const platform = platformConfigs[platformKey];
    if (platform.enabled) {
      if (startPlatformRelay(platformKey, streamPath)) {
        startedCount++;
      }
    } else {
      console.log(`⚠️  ${platform.name}: Disabled in configuration`);
    }
  });
  
  console.log(`✅ Started ${startedCount} platform relays`);
  return startedCount > 0;
}

// Stop all relays
function stopAllRelays() {
  console.log('🛑 Stopping all platform relays...');
  Object.keys(ffmpegProcesses).forEach(platformKey => {
    stopPlatformRelay(platformKey);
  });
}

// Event Handlers
nms.on('prePublish', (id, StreamPath, args) => {
  console.log(`\n🎬 [RTMP] Stream started!`);
  console.log(`[RTMP] Raw Path: "${StreamPath}"`);
  console.log(`[RTMP] Session: ${id}`);
  console.log(`[RTMP] Time: ${new Date().toLocaleString('th-TH')}`);
  
  // เช็ค path หลายแบบ
  const targetPaths = [
    '/live/my-stream-key',
    'live/my-stream-key',
    'my-stream-key'
  ];
  
  let isTargetStream = false;
  let actualPath = StreamPath || 'undefined';
  
  // ตรวจสอบว่า path ตรงกับ target หรือไม่
  if (!StreamPath || StreamPath === 'undefined') {
    console.log('🔍 [RTMP] StreamPath is undefined, assuming target stream');
    isTargetStream = true;
    actualPath = '/live/my-stream-key';
  } else {
    // ตรวจสอบ path ที่เป็นไปได้
    for (const targetPath of targetPaths) {
      if (actualPath === targetPath || actualPath.endsWith(targetPath)) {
        isTargetStream = true;
        console.log(`✅ [RTMP] Matched target path: ${targetPath}`);
        break;
      }
    }
  }
  
  console.log(`[RTMP] Final Path: ${actualPath}`);
  console.log(`[RTMP] Is Target Stream: ${isTargetStream ? '✅ YES' : '❌ NO'}`);
  
  if (isTargetStream) {
    console.log('✅ [RTMP] Target stream detected!');
    console.log(`⏰ [RTMP] Starting platform relays for user '${currentUserId}' in 2 seconds...`);
    
    // รอ 2 วินาที แล้วเริ่ม relay ทุกแพลตฟอร์ม
    setTimeout(() => {
      startAllRelays(actualPath.startsWith('/') ? actualPath : '/' + actualPath);
    }, 2000);
    
  } else {
    console.log(`❌ [RTMP] Stream path not recognized`);
    console.log(`[RTMP] Expected one of: ${targetPaths.join(', ')}`);
    console.log(`[RTMP] Got: ${actualPath}`);
    
    // เริ่ม relay อยู่ดี (fallback)
    console.log('🔄 [RTMP] Starting relay anyway as fallback...');
    setTimeout(() => {
      startAllRelays('/live/my-stream-key');
    }, 5000);
  }
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log(`\n📺 [RTMP] Stream ended!`);
  console.log(`[RTMP] Path: ${StreamPath || 'undefined'}`);
  console.log(`[RTMP] Session: ${id}`);
  console.log(`[RTMP] Time: ${new Date().toLocaleString('th-TH')}`);
  
  console.log('🛑 [RTMP] Stopping all platform relays...');
  stopAllRelays();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down...');
  stopAllRelays();
  if (nms) {
    nms.stop();
  }
  process.exit(0);
});

// Start server
nms.run();

console.log('\n✅ Dynamic Multi-Platform RTMP Server started!');
console.log('=' * 50);
console.log('📡 RTMP URL: rtmp://127.0.0.1:1935/live');
console.log('🔑 Stream Key: my-stream-key');
console.log('🌐 HTTP Server: http://127.0.0.1:8000');
console.log(`👤 Current User: ${currentUser.name || currentUserId}`);
console.log('📺 Multi-Platform Relay: Ready');
console.log('=' * 50);
console.log('\n💡 วิธีใช้:');
console.log('1. รัน script นี้ด้วย: node multi-platform-server.js [user_id]');
console.log('2. เปิด React App');
console.log('3. กด Start Stream ใน React App');
console.log('4. ดูผลลัพธ์ที่นี่');
console.log('\n🔧 Platform Configuration:');
Object.entries(platformConfigs).forEach(([key, platform]) => {
  const hasKey = currentUser[key] && currentUser[key].length > 0 && currentUser[key] !== 'your-' + key + '-key-here';
  const status = platform.enabled ? (hasKey ? 'Ready' : 'No Key') : 'Disabled';
  console.log(`${platform.icon} ${platform.name}: ${status}`);
});
console.log('\n📝 Configuration Files:');
console.log('- platforms-config.json: Platform configurations');
console.log('- user-stream-keys.json: User stream keys');
console.log('\n🛑 กด Ctrl+C เพื่อหยุด');