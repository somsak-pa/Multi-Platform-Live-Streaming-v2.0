const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// เสิร์ฟ UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'config-ui.html'));
});

// บันทึกการตั้งค่า
app.post('/save-config', (req, res) => {
    try {
        const config = req.body;
        const configPath = path.join(__dirname, 'user-stream-keys.json');
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        console.log('✅ บันทึกการตั้งค่าสำเร็จ!');
        console.log('📋 ข้อมูลที่บันทึก:', JSON.stringify(config, null, 2));
        
        res.json({ success: true, message: 'บันทึกสำเร็จ!' });
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการบันทึก:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});

// โหลดการตั้งค่า
app.get('/load-config', (req, res) => {
    try {
        const configPath = path.join(__dirname, 'user-stream-keys.json');
        
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            res.json(config);
        } else {
            res.json({});
        }
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการโหลด:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});

// เริ่ม RTMP Server
app.post('/start-streaming', (req, res) => {
    try {
        const { spawn } = require('child_process');
        
        console.log('🚀 เริ่ม RTMP Server...');
        
        const rtmpProcess = spawn('node', ['multi-platform-server.js', 'myuser'], {
            cwd: __dirname,
            stdio: 'inherit'
        });
        
        res.json({ success: true, message: 'เริ่ม RTMP Server แล้ว!' });
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการเริ่ม RTMP Server:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});

app.listen(PORT, () => {
    console.log('🎬 Stream Config UI Server กำลังทำงาน!');
    console.log('====================================');
    console.log(`🌐 เปิดเบราว์เซอร์และไปที่: http://localhost:${PORT}`);
    console.log('💡 ใส่ Stream Key ของคุณแล้วเริ่มสตรีม!');
    console.log('====================================');
});

module.exports = app;