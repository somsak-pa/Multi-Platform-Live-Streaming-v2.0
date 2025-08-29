// Startup script เพื่อให้แน่ใจว่า RTMP Server พร้อมก่อน React App
import { spawn } from 'child_process';
import http from 'http';

console.log('🚀 เริ่มต้นระบบ Live Streaming...\n');

// Function เพื่อตรวจสอบว่า RTMP server พร้อมหรือยัง
function checkRTMPServer() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:8000', (res) => {
      resolve(true);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Function เพื่อรอให้ RTMP server พร้อม
async function waitForRTMPServer(maxWait = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    const isReady = await checkRTMPServer();
    if (isReady) {
      return true;
    }
    console.log('⏳ รอ RTMP Server เริ่มต้น...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return false;
}

async function startSystem() {
  console.log('1️⃣ เริ่ม RTMP Server...');
  
  // เริ่ม RTMP Server
  const rtmpProcess = spawn('node', ['server.js'], {
    cwd: 'my-rtmp-server',
    stdio: ['inherit', 'pipe', 'pipe']
  });
  
  rtmpProcess.stdout.on('data', (data) => {
    console.log(`[RTMP] ${data.toString().trim()}`);
  });
  
  rtmpProcess.stderr.on('data', (data) => {
    console.log(`[RTMP] ${data.toString().trim()}`);
  });
  
  // รอให้ RTMP Server พร้อม
  console.log('\n⏳ รอ RTMP Server พร้อม...');
  const rtmpReady = await waitForRTMPServer();
  
  if (!rtmpReady) {
    console.log('❌ RTMP Server ไม่พร้อม! กรุณาตรวจสอบ');
    process.exit(1);
  }
  
  console.log('✅ RTMP Server พร้อมแล้ว!\n');
  console.log('2️⃣ เริ่ม React App...');
  
  // เริ่ม React App
  const reactProcess = spawn('npm', ['run', 'electron-dev'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });
  
  reactProcess.stdout.on('data', (data) => {
    console.log(`[ELECTRON] ${data.toString().trim()}`);
  });
  
  reactProcess.stderr.on('data', (data) => {
    console.log(`[ELECTRON] ${data.toString().trim()}`);
  });
  
  console.log('\n🎉 ระบบพร้อมใช้งาน!');
  console.log('📝 คำแนะนำ:');
  console.log('   - RTMP Server: http://127.0.0.1:8000');
  console.log('   - Stream URL: rtmp://127.0.0.1:1935/live');
  console.log('   - Stream Key: my-stream-key');
  console.log('   - กด Ctrl+C เพื่อหยุดระบบ\n');
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 กำลังหยุดระบบ...');
    rtmpProcess.kill('SIGTERM');
    reactProcess.kill('SIGTERM');
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  });
  
  // Handle process exits
  rtmpProcess.on('exit', (code) => {
    console.log(`[RTMP] Process exited with code ${code}`);
    if (code !== 0) {
      console.log('❌ RTMP Server หยุดทำงาน');
      reactProcess.kill('SIGTERM');
      process.exit(1);
    }
  });
  
  reactProcess.on('exit', (code) => {
    console.log(`[ELECTRON] Process exited with code ${code}`);
    if (code !== 0) {
      console.log('❌ React App หยุดทำงาน');
      rtmpProcess.kill('SIGTERM');
      process.exit(1);
    }
  });
}

// เริ่มระบบ
startSystem().catch((error) => {
  console.error('❌ เกิดข้อผิดพลาด:', error.message);
  process.exit(1);
});