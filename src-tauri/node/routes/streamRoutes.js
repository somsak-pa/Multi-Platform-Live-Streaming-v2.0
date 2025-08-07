// /home/ubuntu/rtmp-backend/routes/streamRoutes.js
const express = require('express');
const router = express.Router();
const streamController = require('../controllers/streamController');

// POST /api/stream/start (จาก NGINX on_publish)
router.post('/publish-start', streamController.handlePublishStart);

// router.get('/youtube-stream-key', streamController.getYouTubeStreamKey); // คอมเมนต์ออกเพราะไม่ใช้แล้ว

module.exports = router; // <--- สำคัญ: บรรทัดนี้ต้องไม่มีคอมเมนต์แล้ว!
