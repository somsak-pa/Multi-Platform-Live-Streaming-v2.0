// /home/ubuntu/rtmp-backend/server.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

try {
    // เรียกใช้ Routes
    const authRoutes = require('./routes/authRoutes');
    const streamRoutes = require('./routes/streamRoutes');

    // Middleware สำหรับการอ่าน Body ของ Request
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    // กำหนด Endpoint พื้นฐานสำหรับทดสอบ
    app.get('/', (req, res) => {
        res.send('Multi-Platform Live Streaming Backend is running.');
    });

    // กำหนดให้ Express ใช้ Routes ที่สร้างไว้
    app.use('/api/auth', authRoutes); // สำหรับ OAuth และ Stream Key Verification
    app.use('/api/stream', streamRoutes); // สำหรับ Stream Management (รวมถึง YouTube Stream Key Dynamic)

    // เริ่มต้น Server
    app.listen(PORT, () => {
        console.log(`Multi-Platform Live Streaming Backend listening on port ${PORT}`);
    });

} catch (error) {
    console.error('SERVER STARTUP ERROR (Top Level):', error);
    process.exit(1); // ออกจากโปรเซสด้วยโค้ด Error
}